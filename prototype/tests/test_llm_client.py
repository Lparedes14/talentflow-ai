"""The parts of the LLM client that do not need a network or a key."""

import json
import ssl
import time

import pytest

from talentflow.llm.client import (
    DEFAULT_GEMINI_MODEL,
    DEFAULT_OPENAI_MODEL,
    MockClient,
    LLMError,
    _cache_key,
    _post_json,
    _ssl_context,
    load_client,
)


def test_ssl_context_has_loaded_certificates():
    """A context with zero CA certificates is the failure this exists to prevent.

    On the python.org macOS builds the default context loads nothing, and every https
    call dies with CERTIFICATE_VERIFY_FAILED at request time, far from the cause. Assert
    the bundle is populated here instead, where the message names the problem.
    """
    context = _ssl_context()
    assert isinstance(context, ssl.SSLContext)
    assert context.cert_store_stats()["x509_ca"] > 0


def test_ssl_context_is_reused():
    """Building a context reads and parses the whole CA bundle. Once per process, not
    once per API call."""
    assert _ssl_context() is _ssl_context()


def test_cache_key_changes_with_temperature():
    """Temperature changes the answer, so a cache that ignores it serves the wrong one."""
    assert _cache_key("m", "p", "s", 0.0) != _cache_key("m", "p", "s", 1.0)


def test_mock_client_repeats_its_last_response():
    client = MockClient(["first", "second"])
    assert [client.complete("a"), client.complete("b"), client.complete("c")] == [
        "first", "second", "second",
    ]


_KEY_VARS = ("ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY")


def _only_key(monkeypatch, name, value="test-key-not-real"):
    """Isolate the environment completely, not just the keys.

    An earlier test that loads the real .env leaves LLM_PROVIDER and GEMINI_MODEL in
    os.environ for the rest of the process. These tests are about precedence, so a leaked
    override silently changes the answer: with LLM_PROVIDER=gemini left set, asking for an
    OpenAI client correctly returns None and the test looks broken. Clear all of it.
    """
    for var in _KEY_VARS:
        monkeypatch.delenv(var, raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    for provider in ("ANTHROPIC", "OPENAI", "GEMINI"):
        monkeypatch.delenv(f"{provider}_MODEL", raising=False)
        monkeypatch.delenv(f"{provider}_RPM", raising=False)
    monkeypatch.setenv(name, value)


@pytest.mark.parametrize("env_var, expected", [
    ("OPENAI_API_KEY", DEFAULT_OPENAI_MODEL),
    ("GEMINI_API_KEY", DEFAULT_GEMINI_MODEL),
])
def test_load_client_uses_the_model_belonging_to_the_detected_provider(
    monkeypatch, tmp_path, env_var, expected
):
    """A model name belongs to one provider. Sending Anthropic's to OpenAI is a 404.

    This is F29. The comparison script imported a module-level DEFAULT_MODEL, which was
    Anthropic's, and passed it to whichever provider happened to hold the configured key.
    The failure surfaced as an HTTP 404 from OpenAI naming a Claude model, which is a long
    way from the line that caused it.
    """
    _only_key(monkeypatch, env_var)
    client = load_client(env_file=tmp_path / "absent.env")
    assert client is not None
    assert client.model == expected


def test_load_client_returns_none_without_a_key(monkeypatch, tmp_path):
    """Running with no LLM is a supported mode, not an error."""
    for var in _KEY_VARS:
        monkeypatch.delenv(var, raising=False)
    assert load_client(env_file=tmp_path / "absent.env") is None


def _http_error(code, body, retry_after=None):
    import email.message
    import io
    import urllib.error

    headers = email.message.Message()
    if retry_after is not None:
        headers["Retry-After"] = str(retry_after)
    return urllib.error.HTTPError(
        "https://example.invalid", code, "err", headers, io.BytesIO(body.encode())
    )


def test_no_quota_fails_immediately_instead_of_retrying(monkeypatch):
    """A 429 means two opposite things. Only one of them is fixed by waiting.

    This is F30. OpenAI returned 429 with `insufficient_quota`, which is a billing state,
    not a rate limit. Backing off through four retries would add a minute of waiting to an
    answer the caller already has, and would read as a hang.
    """
    import urllib.request

    slept = []
    monkeypatch.setattr(time, "sleep", slept.append)

    def refuse(*_args, **_kwargs):
        raise _http_error(429, '{"error":{"code":"insufficient_quota"}}')

    monkeypatch.setattr(urllib.request, "urlopen", refuse)

    with pytest.raises(LLMError, match="no quota left"):
        _post_json(object(), 10, "OpenAI")
    assert slept == [], "a billing failure must not be retried"


def test_a_real_rate_limit_is_retried_and_then_succeeds(monkeypatch):
    """A free tier rate limits by design, and a 20-resume run will hit it. Dying there
    throws away the vocabulary build that preceded it."""
    import urllib.request

    slept = []
    monkeypatch.setattr(time, "sleep", slept.append)
    calls = []

    class _Response:
        def read(self):
            return b'{"ok": true}'

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    def flaky(*_args, **_kwargs):
        calls.append(1)
        if len(calls) < 3:
            raise _http_error(429, '{"error":{"code":"rate_limit_exceeded"}}', retry_after=1)
        return _Response()

    monkeypatch.setattr(urllib.request, "urlopen", flaky)

    assert _post_json(object(), 10, "Gemini") == {"ok": True}
    assert len(calls) == 3
    assert slept == [1.0, 1.0], "Retry-After should be honoured over our own backoff"


def test_gemini_list_models_keeps_only_what_can_generate(monkeypatch):
    """Embedding models are in the same list and cannot answer a prompt. Offering one as a
    choice would send the user back around the same 404 loop this script exists to end."""
    import urllib.request

    from talentflow.llm.client import GeminiClient

    class _Response:
        def read(self):
            return json.dumps({"models": [
                {"name": "models/gemini-3.6-flash",
                 "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/text-embedding-004",
                 "supportedGenerationMethods": ["embedContent"]},
                {"name": "models/gemini-3.6-pro",
                 "supportedGenerationMethods": ["generateContent", "countTokens"]},
            ]}).encode()

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: _Response())
    client = GeminiClient(api_key="test-key-not-real", cache_dir=None)
    assert client.list_models() == ["gemini-3.6-flash", "gemini-3.6-pro"]


def test_env_can_override_the_model_but_an_explicit_argument_still_wins(monkeypatch, tmp_path):
    """X4. Precedence is --model, then <PROVIDER>_MODEL in .env, then the constant.

    The .env layer exists because the right model depends on the account's quota tier, which
    differs per person and is not a fact about the code.
    """
    _only_key(monkeypatch, "GEMINI_API_KEY")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    assert load_client(env_file=tmp_path / "absent.env").model == "gemini-3.5-flash-lite"
    assert load_client(model="gemini-3.6-flash",
                       env_file=tmp_path / "absent.env").model == "gemini-3.6-flash"


def test_no_env_override_falls_back_to_the_constant(monkeypatch, tmp_path):
    _only_key(monkeypatch, "GEMINI_API_KEY")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    assert load_client(env_file=tmp_path / "absent.env").model == DEFAULT_GEMINI_MODEL


def test_the_cache_key_separates_models(monkeypatch):
    """Changing the model must not serve another model's answers. The comparison depends on
    every recorded result belonging to the model named beside it."""
    assert _cache_key("gemini-3.6-flash", "p", "s", 0.0) != \
           _cache_key("gemini-3.5-flash-lite", "p", "s", 0.0)


def test_pacer_spaces_calls_to_the_limit(monkeypatch):
    """F36. 15 requests per minute means one every 4 seconds, waited for on purpose rather
    than discovered by being refused."""
    from talentflow.llm.client import _Pacer

    slept, now = [], [1000.0]
    monkeypatch.setattr(time, "sleep", lambda s: (slept.append(s), now.__setitem__(0, now[0] + s)))
    monkeypatch.setattr(time, "monotonic", lambda: now[0])

    pacer = _Pacer(15.0)
    pacer.wait()                      # first call never waits
    assert slept == []
    pacer.wait()                      # immediately after: waits the full interval
    assert slept == [4.0]

    now[0] += 10.0                    # a slow call already covered the interval
    pacer.wait()
    assert slept == [4.0]


def test_pacer_disabled_never_sleeps(monkeypatch):
    """A paid tier should not be throttled by our guess about a free one."""
    from talentflow.llm.client import _Pacer

    slept = []
    monkeypatch.setattr(time, "sleep", slept.append)
    pacer = _Pacer(None)
    pacer.wait(); pacer.wait()
    assert slept == []


def test_rpm_comes_from_env_and_zero_disables(monkeypatch):
    from talentflow.llm.client import _rpm_for

    monkeypatch.setenv("GEMINI_RPM", "30")
    assert _rpm_for("gemini") == 30.0
    monkeypatch.setenv("GEMINI_RPM", "0")
    assert _rpm_for("gemini") is None
    monkeypatch.setenv("GEMINI_RPM", "banana")
    assert _rpm_for("gemini") == 15.0          # falls back rather than crashing a long run
    monkeypatch.delenv("GEMINI_RPM")
    assert _rpm_for("gemini") == 15.0


def test_a_dropped_connection_is_retried(monkeypatch):
    """F36. RemoteDisconnected killed a 152-resume run at resume 68. A dropped connection
    is the most retryable failure there is."""
    import http.client
    import urllib.request

    monkeypatch.setattr(time, "sleep", lambda _s: None)
    calls = []

    class _Response:
        def read(self):
            return b'{"ok": true}'

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    def flaky(*_a, **_k):
        calls.append(1)
        if len(calls) < 3:
            raise http.client.RemoteDisconnected("closed without response")
        return _Response()

    monkeypatch.setattr(urllib.request, "urlopen", flaky)
    assert _post_json(object(), 10, "Gemini") == {"ok": True}
    assert len(calls) == 3


def test_a_certificate_failure_is_not_retried(monkeypatch):
    """It fails identically every time. Four sleeps on the way to the same message is the
    hang F30 exists to prevent, in a different disguise."""
    import urllib.error
    import urllib.request

    slept = []
    monkeypatch.setattr(time, "sleep", slept.append)

    def refuse(*_a, **_k):
        raise urllib.error.URLError(ssl.SSLCertVerificationError("unable to get local issuer"))

    monkeypatch.setattr(urllib.request, "urlopen", refuse)
    with pytest.raises(LLMError):
        _post_json(object(), 10, "Gemini")
    assert slept == []
