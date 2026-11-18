"""Task 1: video and audio understanding. Transcribe, then read sentiment and career directions.

Transcription is speech recognition (Whisper or the Gemini API); the sentiment and career
reads are the language-model half, run on the transcript afterwards.
"""
from .analyze import analyze_transcript
from .transcribe import (
    MEDIA_SUFFIXES, MockTranscriber, Transcript, Transcriber, find_media, get_transcriber,
)

__all__ = [
    "analyze_transcript",
    "find_media", "get_transcriber", "Transcriber", "Transcript", "MockTranscriber",
    "MEDIA_SUFFIXES",
]


def process_media(media_path, transcriber, client=None) -> dict:
    """Transcribe one file, then analyze it if a client is given. The whole task-1 flow."""
    transcript = transcriber.transcribe(media_path)
    result = {
        "media": str(media_path),
        "backend": transcript.backend,
        "language": transcript.language,
        "duration_s": transcript.duration_s,
        "transcript": transcript.text,
    }
    if client is not None:
        result["analysis"] = analyze_transcript(client, transcript.text)
    return result
