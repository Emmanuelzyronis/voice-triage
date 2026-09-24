"""Stage 1 — Listen: AssemblyAI real-time STT.

Two modes:
  - WebSocket mode (production): browser streams audio chunks over WS → we relay to AssemblyAI
  - Mic mode (local dev/test): uses pyaudio MicrophoneStream, requires [mic] extra
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from typing import Any

import assemblyai as aai

from backend.config import settings
from backend.models.types import Transcript, TranscriptWord

logger = logging.getLogger(__name__)

# Configure AssemblyAI once at import time
aai.settings.api_key = settings.assemblyai_api_key


class ListenStage:
    """Wraps AssemblyAI real-time transcription.

    Usage (WebSocket mode):
        stage = ListenStage(on_final=my_callback)
        await stage.stream_bytes(audio_chunk)  # call per browser audio chunk
        await stage.close()

    Usage (mic mode — local testing):
        stage = ListenStage(on_final=my_callback)
        stage.run_mic()  # blocks until Ctrl-C
    """

    def __init__(
        self,
        on_final: Callable[[Transcript], None] | None = None,
        on_partial: Callable[[Transcript], None] | None = None,
        sample_rate: int = 16_000,
    ) -> None:
        self._on_final = on_final
        self._on_partial = on_partial
        self._sample_rate = sample_rate
        self._transcriber: aai.RealtimeTranscriber | None = None
        self._session_id: str | None = None

    # ── callbacks ────────────────────────────────────────────────────────────

    def _handle_open(self, session: aai.RealtimeSessionOpened) -> None:
        self._session_id = session.session_id
        logger.info("AssemblyAI session opened: %s", session.session_id)

    def _handle_data(self, raw: aai.RealtimeTranscript) -> None:
        if not raw.text:
            return

        words = [
            TranscriptWord(
                text=w.text,
                start=w.start,
                end=w.end,
                confidence=w.confidence,
            )
            for w in (raw.words or [])
        ]

        transcript = Transcript(
            session_id=self._session_id or "",
            text=raw.text,
            words=words,
            is_final=isinstance(raw, aai.RealtimeFinalTranscript),
        )

        if transcript.is_final:
            logger.info("FINAL: %s", transcript.text)
            if self._on_final:
                self._on_final(transcript)
        else:
            logger.debug("partial: %s", transcript.text)
            if self._on_partial:
                self._on_partial(transcript)

    def _handle_error(self, error: aai.RealtimeError) -> None:
        logger.error("AssemblyAI error: %s", error)

    def _handle_close(self) -> None:
        logger.info("AssemblyAI session closed: %s", self._session_id)

    # ── WebSocket mode ────────────────────────────────────────────────────────

    def connect(self) -> None:
        """Open a RealtimeTranscriber connection (call once before streaming bytes)."""
        self._transcriber = aai.RealtimeTranscriber(
            sample_rate=self._sample_rate,
            on_data=self._handle_data,
            on_error=self._handle_error,
            on_open=self._handle_open,
            on_close=self._handle_close,
        )
        self._transcriber.connect()

    def stream_bytes(self, chunk: bytes) -> None:
        """Send a raw audio chunk received from the browser WebSocket."""
        if self._transcriber is None:
            raise RuntimeError("Call connect() before stream_bytes()")
        self._transcriber.stream(chunk)

    def close(self) -> None:
        if self._transcriber:
            self._transcriber.close()
            self._transcriber = None

    # ── Mic mode (local dev) ──────────────────────────────────────────────────

    def run_mic(self) -> None:
        """Blocking: capture from local microphone and print transcripts.

        Requires: pip install 'voice-triage[mic]'  (pulls in pyaudio)
        """
        try:
            mic_stream = aai.extras.MicrophoneStream(sample_rate=self._sample_rate)
        except AttributeError as exc:
            raise RuntimeError(
                "pyaudio not installed. Run: pip install 'voice-triage[mic]'"
            ) from exc

        self.connect()
        print("Listening… press Ctrl-C to stop.\n")
        try:
            self._transcriber.stream(mic_stream)  # type: ignore[union-attr]
        except KeyboardInterrupt:
            pass
        finally:
            self.close()
