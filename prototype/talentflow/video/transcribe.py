"""Turn a video or audio file into text, with a choice of backend.

Task 1 starts here. Everything downstream, the sentiment read and the career directions, runs
on the transcript this produces, so this stage is speech recognition, not a language model.
The architecture note is deliberate: conflating the two would misreport two different metrics,
word error rate for this step and sentiment accuracy for the next.

Three backends, one interface, so the choice is local versus established and nothing else
changes:

- **faster-whisper** (default). A local Whisper, about 200 MB, no PyTorch, runs on a Mac CPU.
- **openai-whisper**. The same Whisper models through the reference package, which pulls in
  PyTorch, about 2 GB. Heavier, and here for people who already have it.
- **gemini**. Not local. Sends the audio to Google and gets a transcript back, so it needs a
  key and a network but no download. This is the established-API side of the same choice.

Nothing is imported until a backend is built, so having faster-whisper installed does not
force PyTorch on anyone, and a missing package fails with the one line that installs it.
"""
from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

log = logging.getLogger(__name__)

# What counts as something to transcribe. Audio and the common video containers, whose audio
# track the backends read through ffmpeg.
MEDIA_SUFFIXES = frozenset({
    ".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus",
    ".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v",
})

_MIME = {
    ".mp3": "audio/mp3", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac",
    ".flac": "audio/flac", ".ogg": "audio/ogg", ".opus": "audio/ogg",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".mkv": "video/x-matroska",
    ".webm": "video/webm", ".avi": "video/x-msvideo", ".m4v": "video/mp4",
}

# Gemini takes the file inline in the request, which the API caps at about 20 MB. Bigger than
# this and the caller should use a local backend or hand it an audio-only file.
GEMINI_INLINE_LIMIT = 18 * 1024 * 1024


@dataclass
class Transcript:
    """The text of one recording, plus what produced it."""

    text: str
    backend: str
    language: str | None = None
    duration_s: float | None = None


class Transcriber(Protocol):
    """What every backend implements."""

    name: str

    def transcribe(self, media_path: str | Path) -> Transcript:
        """Return the transcript of one audio or video file."""


def find_media(path: str | Path) -> list[Path]:
    """Media files at a path. A file returns itself; a folder returns what it holds, newest
    first, so "scan my Desktop" lands on the recording you just made."""
    p = Path(path).expanduser()
    if p.is_file():
        return [p] if p.suffix.lower() in MEDIA_SUFFIXES else []
    if p.is_dir():
        found = [f for f in p.iterdir()
                 if f.is_file() and f.suffix.lower() in MEDIA_SUFFIXES]
        return sorted(found, key=lambda f: f.stat().st_mtime, reverse=True)
    return []


class FasterWhisperTranscriber:
    """Local Whisper through faster-whisper. The default: light, no PyTorch."""

    name = "faster-whisper"

    def __init__(self, model_size: str = "base", compute_type: str = "int8"):
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:  # pragma: no cover - depends on the machine
            raise ImportError(
                "The faster-whisper backend needs its package:\n"
                "    uncomment the video group in requirements.txt, then "
                "pip install -r requirements.txt\n"
                "The model downloads itself on first use and caches after that."
            ) from exc
        self._model = WhisperModel(model_size, device="cpu", compute_type=compute_type)
        self.model_size = model_size

    def transcribe(self, media_path: str | Path) -> Transcript:
        segments, info = self._model.transcribe(str(media_path))
        text = "".join(seg.text for seg in segments).strip()
        return Transcript(text, self.name, getattr(info, "language", None),
                          getattr(info, "duration", None))


class OpenAIWhisperTranscriber:
    """Local Whisper through the reference package. Pulls in PyTorch."""

    name = "openai-whisper"

    def __init__(self, model_size: str = "base"):
        try:
            import whisper
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "The openai-whisper backend needs its package:\n"
                "    uncomment the video group in requirements.txt, then "
                "pip install -r requirements.txt\n"
                "It pulls in PyTorch, about 2 GB."
            ) from exc
        self._whisper = whisper
        self._model = whisper.load_model(model_size)
        self.model_size = model_size

    def transcribe(self, media_path: str | Path) -> Transcript:
        result = self._model.transcribe(str(media_path))
        return Transcript(str(result.get("text", "")).strip(), self.name,
                          result.get("language"))


class GeminiTranscriber:
    """Transcription through the Gemini API. Not local: needs a key and a network.

    The file rides inline in the request, so it is capped at about 20 MB. Past that, extract
    the audio track or use a local backend.
    """

    name = "gemini"
    ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def __init__(self, api_key: str | None = None, model: str | None = None, timeout: int = 300):
        import os

        self._api_key = (api_key or os.environ.get("GEMINI_API_KEY")
                         or os.environ.get("GOOGLE_API_KEY"))
        if not self._api_key:
            raise ValueError("the gemini transcriber needs GEMINI_API_KEY in .env")
        # An audio-capable default, overridable by GEMINI_MODEL.
        self.model = model or os.environ.get("GEMINI_MODEL") or "gemini-2.0-flash"
        self.timeout = timeout

    def transcribe(self, media_path: str | Path) -> Transcript:
        import urllib.request

        path = Path(media_path)
        data = path.read_bytes()
        if len(data) > GEMINI_INLINE_LIMIT:
            raise ValueError(
                f"{path.name} is {len(data) // (1024 * 1024)} MB, over Gemini's ~18 MB inline "
                "limit. Use a local backend, or transcribe an audio-only export."
            )
        mime = _MIME.get(path.suffix.lower(), "audio/mp4")
        body = {
            "contents": [{"parts": [
                {"inline_data": {"mime_type": mime,
                                 "data": base64.b64encode(data).decode()}},
                {"text": "Transcribe this recording verbatim. Return only the transcript "
                         "text, with no commentary."},
            ]}],
            "generationConfig": {"temperature": 0.0},
        }
        request = urllib.request.Request(
            self.ENDPOINT.format(model=self.model),
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "x-goog-api-key": self._api_key},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            payload = json.loads(response.read().decode())
        try:
            parts = payload["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts).strip()
        except (KeyError, IndexError) as exc:
            raise RuntimeError(f"no transcript in Gemini response: "
                               f"{json.dumps(payload)[:300]}") from exc
        return Transcript(text, self.name)


class MockTranscriber:
    """A fixed transcript. Lets the pipeline and its tests run with no model and no network."""

    name = "mock"

    def __init__(self, text: str = ""):
        self.text = text

    def transcribe(self, media_path: str | Path) -> Transcript:
        return Transcript(self.text, self.name)


_BACKENDS = {
    "faster-whisper": FasterWhisperTranscriber,
    "openai-whisper": OpenAIWhisperTranscriber,
    "gemini": GeminiTranscriber,
    "mock": MockTranscriber,
}


def get_transcriber(backend: str = "faster-whisper", **kwargs) -> Transcriber:
    """Build a transcriber by name. Raises with the available names, not a KeyError."""
    if backend not in _BACKENDS:
        raise ValueError(f"unknown transcriber {backend!r}; "
                         f"available: {sorted(_BACKENDS)}")
    return _BACKENDS[backend](**kwargs)
