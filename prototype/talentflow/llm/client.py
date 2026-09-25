"""A thin LLM client with caching.

Deliberately small. This is not an abstraction over every provider; it is the smallest thing
that lets the rest of the codebase call a model without knowing which one, and without
re-billing for work already done.

## Caching is not an optimization here, it is a requirement

Every evaluation run over the 220-resume gold set is 220 calls. Iterating on a prompt means
running that repeatedly, and a student project cannot absorb re-billing each time. Responses
are keyed on a hash of the exact model, prompt, system prompt and parameters, so changing any
of them is a cache miss and reusing all of them is free. That also makes an evaluation run
reproducible offline once it has been run once, which is what the team contract asks for when
it says any result must be re-derivable.

## Providers

Anthropic, OpenAI and Google Gemini. Three, because the team may hold any of them, and the
interface is one method wide, so a provider is a `complete()` implementation and nothing else.

Which one runs is decided by whichever key is present, or by `LLM_PROVIDER` when several
are. Key formats tell them apart on sight:

| Provider | Key prefix | Default model |
|---|---|---|
| Anthropic | `sk-ant-` | claude-sonnet-4 |
| OpenAI | `sk-proj-` or `sk-` | gpt-4o-mini |
| Gemini | `AIza` | gemini-2.0-flash |

**Only the Anthropic path can be exercised from the build shells.** The egress proxy denies
`api.openai.com` and `generativelanguage.googleapis.com`, so the OpenAI and Gemini clients
are written against the documented APIs and need verifying on a machine with ordinary
internet, which is any teammate's laptop. Both are thin and shaped like the Anthropic one, so
a failure will be a wrong field name rather than a wrong design.

## No key is a normal state, not an error

The whole pipeline runs without a key; only the LLM engine needs one. `load_client` returns
None rather than raising, so callers can offer the lexical engine and say why the other one
is unavailable.
"""
from __future__ import annotations

import functools
import hashlib
import json
import logging
import os
import ssl
import time
from pathlib import Path
from typing import Protocol

from ..config import DATA_DIR

log = logging.getLogger(__name__)

CACHE_DIR = DATA_DIR / "llm_cache"
# Every model name belongs to exactly one provider, so every default is named after its
# provider. There is deliberately no unqualified DEFAULT_MODEL to import by mistake (F29).
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
# Retired by Google in August 2026; its 404 named the replacement. Model names are
# perishable, which is why scripts/12_list_models.py exists. See F31.
DEFAULT_GEMINI_MODEL = "gemini-3.6-flash"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
# 4096 truncated a 24-skill extraction on the first live run: gemini-3.6-flash spends part
# of the budget on reasoning before it writes anything. See F34.
DEFAULT_MAX_TOKENS = 8192

# Requests per minute to stay under, per provider. Google's free tier allows 15 for
# flash-lite. Override with <PROVIDER>_RPM in .env; 0 disables pacing entirely.
DEFAULT_RPM = {"gemini": 15.0, "openai": None, "anthropic": None}


class LLMError(RuntimeError):
    """Raised when a call fails in a way the caller has to handle."""


class LLMClient(Protocol):
    """What the rest of the codebase needs from a model."""

    model: str

    def complete(self, prompt: str, system: str = "", temperature: float = 0.0) -> str:
        """Return the model's text response."""


def _cache_key(model: str, prompt: str, system: str, temperature: float) -> str:
    """Hash everything that could change the answer. Anything omitted here is a silent bug."""
    blob = json.dumps(
        {"model": model, "prompt": prompt, "system": system, "temperature": temperature},
        sort_keys=True,
    )
    return hashlib.sha256(blob.encode()).hexdigest()[:32]


@functools.lru_cache(maxsize=1)
def _ssl_context():
    """An SSL context with a CA bundle that actually exists on this machine.

    The python.org macOS builds do not read the system keychain and ship with no CA
    bundle wired up, so a stock urlopen to any https endpoint dies with
    CERTIFICATE_VERIFY_FAILED until someone runs "Install Certificates.command". That is a
    setup step every teammate would have to know about, on a failure whose message names
    neither Python nor the fix. certifi carries its own bundle and pip can install it, so
    prefer it and fall back to the default context when it is absent (Linux, or a Python
    whose certificates are already fine). See F28.
    """
    try:
        import certifi
    except ImportError:
        return ssl.create_default_context()
    return ssl.create_default_context(cafile=certifi.where())


# A 429 means two opposite things, and treating them alike wastes a minute or hides a bug.
# "Slow down" is fixed by waiting. "You have no quota" is not fixed by anything this process
# can do, so retrying it just delays an error the caller needs now. These strings are the
# providers' own machine-readable codes for the second kind. See F30.
_TERMINAL_QUOTA = (
    "insufficient_quota",           # OpenAI, no credits on the account
    "credit_balance_exhausted",     # OpenAI, same thing by another name
    "billing_not_active",           # OpenAI, account not set up
    "PerDay",                       # Gemini, daily free-tier allowance gone until tomorrow
    "PerProjectPerDay",             # Gemini, same cap under its other quotaId spelling
)
_RETRYABLE_STATUS = (429, 500, 502, 503, 529)


def _post_json(request, timeout: int, provider: str, retries: int = 4,
               pacer: '_Pacer | None' = None) -> dict:
    """POST and decode, retrying the failures that waiting actually fixes.

    Rate limits are the normal operating condition of a free tier, not an error. A 20-resume
    comparison run on Gemini's free tier will hit one, and a run that dies on it wastes the
    vocabulary build that preceded it. Backoff is exponential and honours Retry-After.
    """
    import http.client
    import urllib.error
    import urllib.request

    delay = 2.0
    for attempt in range(retries + 1):
        try:
            if pacer is not None:
                pacer.wait()
            with urllib.request.urlopen(
                request, timeout=timeout, context=_ssl_context()
            ) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as exc:
            # Match against the WHOLE body, show a slice. Truncating first hid Google's
            # quotaId (it sits past 400 characters, after the human-readable message) and
            # cost four pointless retries on a daily cap. See F34.
            body = exc.read().decode(errors="replace")
            detail = body[:400]

            if exc.code == 429 and any(code in body for code in _TERMINAL_QUOTA):
                raise LLMError(
                    f"{provider} has no quota left, so waiting will not help. Add credits, "
                    f"or switch provider by editing LLM_PROVIDER in .env. Detail: {detail}"
                ) from exc

            if exc.code in _RETRYABLE_STATUS and attempt < retries:
                wait = float(exc.headers.get("Retry-After") or delay)
                log.warning(
                    "%s HTTP %s, waiting %.0fs then retrying (%d of %d)",
                    provider, exc.code, wait, attempt + 1, retries,
                )
                time.sleep(wait)
                delay = min(delay * 2, 60.0)
                continue

            raise LLMError(f"{provider} HTTP {exc.code}: {detail}") from exc

        except (urllib.error.URLError, http.client.HTTPException, TimeoutError,
                ConnectionError) as exc:
            # A dropped connection is the most retryable failure there is, and it killed a
            # 152-resume run at resume 68 (F36). A certificate failure is not: it will fail
            # identically every time, so it raises at once rather than sleeping four times
            # on the way to the same message.
            if isinstance(getattr(exc, "reason", None), ssl.SSLCertVerificationError):
                raise LLMError(f"{type(exc).__name__}: {exc}") from exc
            if attempt < retries:
                log.warning("%s transport error (%s), retrying in %.0fs (%d of %d)",
                            provider, type(exc).__name__, delay, attempt + 1, retries)
                time.sleep(delay)
                delay = min(delay * 2, 60.0)
                continue
            raise LLMError(f"{type(exc).__name__}: {exc}") from exc

        except Exception as exc:  # noqa: BLE001 - one error type reaches callers
            raise LLMError(f"{type(exc).__name__}: {exc}") from exc

    raise LLMError(f"{provider}: still rate limited after {retries} retries")


def _rpm_for(provider: str) -> float | None:
    """Requests per minute for this provider, from <PROVIDER>_RPM or the default.

    An explicit 0 disables pacing, which is what a paid tier wants.
    """
    raw = os.environ.get(f"{provider.upper()}_RPM")
    if raw is not None and raw.strip():
        try:
            value = float(raw)
        except ValueError:
            log.warning("%s_RPM is not a number (%r), ignoring it", provider.upper(), raw)
        else:
            return value or None
    return DEFAULT_RPM.get(provider)


class _Pacer:
    """Spaces calls so the provider's per-minute limit is respected before it is hit.

    Reactive backoff alone was not enough. A 152-resume run against a 15 RPM limit spent
    most of its wall clock in 429 retries, and a rejected request still counts against the
    daily allowance on some tiers, so every avoidable 429 is quota spent on nothing. Waiting
    4 seconds by choice is strictly cheaper than being refused and waiting 2, 4 and 8. F36.

    Backoff stays: this handles the limit we know about, and backoff handles everything
    else, including another client sharing the same key.
    """

    def __init__(self, requests_per_minute: float | None):
        self.min_interval = 60.0 / requests_per_minute if requests_per_minute else 0.0
        self._last = 0.0

    def wait(self) -> None:
        if self.min_interval <= 0:
            return
        gap = time.monotonic() - self._last
        if gap < self.min_interval:
            time.sleep(self.min_interval - gap)
        self._last = time.monotonic()


class AnthropicClient:
    """Anthropic messages API, with an on-disk response cache."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_ANTHROPIC_MODEL,
        cache_dir: Path | None = CACHE_DIR,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ):
        import anthropic  # imported lazily so the package is optional

        self._client = anthropic.Anthropic(api_key=api_key)
        self.model = model
        self.max_tokens = max_tokens
        self.cache_dir = cache_dir
        self.calls_made = 0
        self.cache_hits = 0
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)
        self.pacer = _Pacer(_rpm_for("anthropic"))

    def complete(self, prompt: str, system: str = "", temperature: float = 0.0) -> str:
        key = _cache_key(self.model, prompt, system, temperature)
        cached = self.cache_dir / f"{key}.json" if self.cache_dir else None

        if cached and cached.exists():
            self.cache_hits += 1
            return json.loads(cached.read_text())["response"]

        try:
            message = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=temperature,
                system=system or "You are a precise information extraction system.",
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as exc:  # noqa: BLE001 - surfaced as one error type to callers
            raise LLMError(f"{type(exc).__name__}: {exc}") from exc

        text = "".join(block.text for block in message.content if block.type == "text")
        self.calls_made += 1

        if cached:
            cached.write_text(json.dumps({
                "model": self.model, "system": system, "temperature": temperature,
                "prompt": prompt, "response": text,
            }))
        return text

    def stats(self) -> dict:
        return {"model": self.model, "api_calls": self.calls_made, "cache_hits": self.cache_hits}

    def list_models(self) -> list[str]:
        """Model names this key can actually call, asked of the provider. See F31."""
        try:
            return sorted(m.id for m in self._client.models.list(limit=100).data)
        except Exception as exc:  # noqa: BLE001
            raise LLMError(f"{type(exc).__name__}: {exc}") from exc


class MockClient:
    """Returns canned responses. Lets every test run with no key and no network."""

    def __init__(self, responses: list[str] | str = "", model: str = "mock"):
        self._responses = [responses] if isinstance(responses, str) else list(responses)
        self.model = model
        self.prompts: list[str] = []

    def complete(self, prompt: str, system: str = "", temperature: float = 0.0) -> str:
        self.prompts.append(prompt)
        if not self._responses:
            return ""
        # Repeat the last response once the script runs out, so a test does not have to
        # supply one response per call just to exercise a loop.
        return self._responses.pop(0) if len(self._responses) > 1 else self._responses[0]

    def stats(self) -> dict:
        return {"model": self.model, "api_calls": len(self.prompts), "cache_hits": 0}


class GeminiClient:
    """Google Gemini via the v1beta generateContent endpoint, with the same disk cache.

    Uses urllib rather than the google SDK or requests: the call is one POST with a JSON
    body, and the standard library covers it without adding a dependency whose version
    behaviour nobody here can test, since this environment cannot reach Google at all.
    """

    ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_GEMINI_MODEL,
        cache_dir: Path | None = CACHE_DIR,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        timeout: int = 120,
    ):
        self._api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.cache_dir = cache_dir
        self.timeout = timeout
        self.calls_made = 0
        self.cache_hits = 0
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)
        self.pacer = _Pacer(_rpm_for("gemini"))

    def complete(self, prompt: str, system: str = "", temperature: float = 0.0) -> str:
        key = _cache_key(self.model, prompt, system, temperature)
        cached = self.cache_dir / f"{key}.json" if self.cache_dir else None

        if cached and cached.exists():
            self.cache_hits += 1
            return json.loads(cached.read_text())["response"]

        import urllib.request

        body: dict = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": self.max_tokens,
            },
        }
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}

        request = urllib.request.Request(
            self.ENDPOINT.format(model=self.model),
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "x-goog-api-key": self._api_key},
            method="POST",
        )

        payload = _post_json(request, self.timeout, "Gemini", pacer=self.pacer)

        try:
            parts = payload["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts)
        except (KeyError, IndexError) as exc:
            # A blocked or empty candidate is a normal outcome, not a crash. Surfacing the
            # payload matters because the reason (safety, recitation, token limit) is in it.
            raise LLMError(f"no text in Gemini response: {json.dumps(payload)[:300]}") from exc

        self.calls_made += 1
        if cached:
            cached.write_text(json.dumps({
                "model": self.model, "system": system, "temperature": temperature,
                "prompt": prompt, "response": text,
            }))
        return text

    def stats(self) -> dict:
        return {"model": self.model, "api_calls": self.calls_made, "cache_hits": self.cache_hits}

    def list_models(self) -> list[str]:
        """Model names this key can actually call, asked of the provider.

        Names are perishable. Guessing one costs a full vocabulary build to find out. See F31.
        """
        import urllib.request

        request = urllib.request.Request(
            self.MODELS_ENDPOINT, headers={"x-goog-api-key": self._api_key}, method="GET")
        payload = _post_json(request, self.timeout, "Gemini", pacer=self.pacer)
        return sorted(
            m["name"].removeprefix("models/")
            for m in payload.get("models", [])
            if "generateContent" in m.get("supportedGenerationMethods", [])
        )


class OpenAIClient:
    """OpenAI chat completions, with the same disk cache.

    urllib rather than the openai SDK, matching GeminiClient: one POST with a JSON body,
    covered by the standard library, and no dependency whose version behaviour cannot be
    tested from here.
    """

    ENDPOINT = "https://api.openai.com/v1/chat/completions"
    MODELS_ENDPOINT = "https://api.openai.com/v1/models"

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_OPENAI_MODEL,
        cache_dir: Path | None = CACHE_DIR,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        timeout: int = 120,
    ):
        self._api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.cache_dir = cache_dir
        self.timeout = timeout
        self.calls_made = 0
        self.cache_hits = 0
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)
        self.pacer = _Pacer(_rpm_for("openai"))

    def complete(self, prompt: str, system: str = "", temperature: float = 0.0) -> str:
        key = _cache_key(self.model, prompt, system, temperature)
        cached = self.cache_dir / f"{key}.json" if self.cache_dir else None

        if cached and cached.exists():
            self.cache_hits += 1
            return json.loads(cached.read_text())["response"]

        import urllib.request

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        request = urllib.request.Request(
            self.ENDPOINT,
            data=json.dumps({
                "model": self.model, "messages": messages,
                "temperature": temperature, "max_tokens": self.max_tokens,
            }).encode(),
            headers={"Content-Type": "application/json",
                     "Authorization": f"Bearer {self._api_key}"},
            method="POST",
        )

        payload = _post_json(request, self.timeout, "OpenAI", pacer=self.pacer)

        try:
            text = payload["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError) as exc:
            raise LLMError(f"no text in OpenAI response: {json.dumps(payload)[:300]}") from exc

        self.calls_made += 1
        if cached:
            cached.write_text(json.dumps({
                "model": self.model, "system": system, "temperature": temperature,
                "prompt": prompt, "response": text,
            }))
        return text

    def stats(self) -> dict:
        return {"model": self.model, "api_calls": self.calls_made, "cache_hits": self.cache_hits}

    def list_models(self) -> list[str]:
        """Model names this key can actually call, asked of the provider. See F31."""
        import urllib.request

        request = urllib.request.Request(
            self.MODELS_ENDPOINT,
            headers={"Authorization": f"Bearer {self._api_key}"},
            method="GET",
        )
        payload = _post_json(request, self.timeout, "OpenAI", pacer=self.pacer)
        return sorted(m["id"] for m in payload.get("data", []))


def detect_provider(
    anthropic_key: str | None = None,
    gemini_key: str | None = None,
    openai_key: str | None = None,
) -> str | None:
    """Which provider to use, from the keys present and an optional LLM_PROVIDER override.

    An override naming a provider whose key is absent returns None rather than silently
    falling back. A run that quietly used a different model than the one configured would
    make the recorded model in the results wrong, and the team contract requires every
    result to name the model that produced it.
    """
    keys = {"anthropic": anthropic_key, "openai": openai_key, "gemini": gemini_key}
    override = (os.environ.get("LLM_PROVIDER") or "").strip().lower()
    if override:
        return override if keys.get(override) else None
    for name in ("anthropic", "openai", "gemini"):
        if keys[name]:
            return name
    return None


def load_client(model: str | None = None, env_file: Path | None = None) -> LLMClient | None:
    """Build a client from whichever API key is configured, or None if there is none.

    Returns None rather than raising: running without an LLM is a supported mode, and the
    caller should fall back to the lexical engine and be able to explain why.
    """
    try:
        from dotenv import load_dotenv

        load_dotenv(env_file or (DATA_DIR.parent / ".env"))
    except ImportError:
        pass

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    provider = detect_provider(anthropic_key, gemini_key, openai_key)
    if provider is None:
        log.info("no usable API key found; LLM features unavailable")
        return None

    log.info("LLM provider: %s", provider)

    # Precedence: an explicit --model, then <PROVIDER>_MODEL in .env, then the constant.
    # The .env layer is a reversal of a decision made two sessions ago and the reason is
    # recorded as X4: which model is right depends on the account's quota tier, which is an
    # environment fact, not a code fact.
    def _model_for(provider_name: str, fallback: str) -> str:
        return model or os.environ.get(f"{provider_name.upper()}_MODEL") or fallback

    if provider == "anthropic":
        chosen = _model_for("anthropic", DEFAULT_ANTHROPIC_MODEL)
        log.info("model: %s", chosen)
        return AnthropicClient(api_key=anthropic_key, model=chosen)
    if provider == "openai":
        chosen = _model_for("openai", DEFAULT_OPENAI_MODEL)
        log.info("model: %s", chosen)
        return OpenAIClient(api_key=openai_key, model=chosen)
    chosen = _model_for("gemini", DEFAULT_GEMINI_MODEL)
    log.info("model: %s", chosen)
    return GeminiClient(api_key=gemini_key, model=chosen)
