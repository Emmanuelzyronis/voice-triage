"""Stage 1 — Listen: AssemblyAI real-time STT via DictationTranscriber.

Two modes:
  - WebSocket mode (production): browser streams raw PCM audio chunks → we relay to AssemblyAI
  - Mic mode (local dev/test): uses sounddevice or pyaudio, requires [mic] extra
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable

import assemblyai as aai

from backend.config import settings
from backend.models.types import Transcript, TranscriptWord

logger = logging.getLogger(__name__)

aai.settings.api_key = settings.assemblyai_api_key


class ListenStage:
    """Wraps AssemblyAI DictationTranscriber for real-time transcription.

    Usage (WebSocket mode):
        stage = ListenStage(on_final=my_callback)
        stage.connect()
        stage.stream_bytes(chunk)   # call per browser audio chunk
        stage.close()               # fires on_final once transcript is ready

    Usage (mic mode — local testing):
        stage = ListenStage(on_final=my_callback)
        stage.run_mic()             # blocks until Ctrl-C
    """

    def __init__(
        self,
        on_final: Callable[[Transcript], None] | None = None,
        on_partial: Callable[[Transcript], None] | None = None,
        on_empty: Callable[[str], None] | None = None,
        sample_rate: int = 16_000,
    ) -> None:
        self._on_final = on_final
        self._on_partial = on_partial   # no-op: DictationTranscriber has no partial events
        self._on_empty = on_empty       # called when transcript is blank or STT fails
        self._sample_rate = sample_rate
        self._transcriber = aai.DictationTranscriber(api_key=settings.assemblyai_api_key)
        self._session: aai.DictationLiveSession | None = None

    # ── WebSocket mode ────────────────────────────────────────────────────────

    def connect(self) -> None:
        """Open a live session (call once before stream_bytes)."""
        config = aai.DictationConfig(sample_rate=self._sample_rate, channels=1)
        self._session = self._transcriber.open_live(config=config)
        logger.info("AssemblyAI DictationTranscriber session opened")

    def stream_bytes(self, chunk: bytes) -> None:
        """Queue a raw audio chunk received from the browser WebSocket."""
        if self._session is None:
            raise RuntimeError("Call connect() before stream_bytes()")
        self._session.write(chunk)

    def close(self) -> None:
        """Signal end of audio. Waits for the transcript in a background thread,
        then fires on_final. Returns immediately (non-blocking)."""
        session = self._session
        self._session = None
        if session is None:
            return

        on_final = self._on_final
        on_empty = self._on_empty

        def _finish() -> None:
            session.close()
            try:
                result = session.result()
            except Exception as exc:
                logger.error("AssemblyAI DictationTranscriber error: %s", exc)
                if on_empty:
                    on_empty(f"Transcription failed — {exc}")
                return
            if not result or not result.text.strip():
                logger.info("DictationTranscriber: empty transcript")
                if on_empty:
                    on_empty("No speech detected — please try again")
                return
            transcript = _to_transcript(result)
            logger.info("FINAL: %s", transcript.text)
            if on_final:
                on_final(transcript)

        threading.Thread(target=_finish, daemon=True).start()

    # ── Mic mode (local dev) ──────────────────────────────────────────────────

    def run_mic(self) -> None:
        """Blocking: capture from local microphone using a generator.

        Requires: pip install 'voice-triage[mic]'  (pulls in pyaudio)
        """
        try:
            import pyaudio  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError(
                "pyaudio not installed. Run: pip install 'voice-triage[mic]'"
            ) from exc

        pa = pyaudio.PyAudio()
        stream = pa.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self._sample_rate,
            input=True,
            frames_per_buffer=4096,
        )

        print("Listening… press Ctrl-C to stop.\n")
        config = aai.DictationConfig(sample_rate=self._sample_rate, channels=1)

        def _chunks():
            try:
                while True:
                    yield stream.read(4096, exception_on_overflow=False)
            except KeyboardInterrupt:
                pass
            finally:
                stream.stop_stream()
                stream.close()
                pa.terminate()

        result = self._transcriber.transcribe_live(data=_chunks(), config=config)
        if result and result.text.strip():
            transcript = _to_transcript(result)
            print(f"\n[FINAL] {transcript.text}\n")
            if self._on_final:
                self._on_final(transcript)


def _to_transcript(result: aai.DictationResponse) -> Transcript:
    words = [
        TranscriptWord(text=w.text, start=0, end=0, confidence=w.confidence)
        for w in result.words
    ]
    return Transcript(
        session_id=result.session_id,
        text=result.text,
        words=words,
        is_final=True,
    )
