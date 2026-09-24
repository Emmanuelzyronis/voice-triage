"""Local smoke test: capture mic audio, print transcripts to console.

Day 1 goal: see final transcripts appear in the terminal.

Usage:
    cd hackathons/voice-triage
    pip install -e ".[mic]"
    python -m backend.scripts.test_mic

Requires: ASSEMBLYAI_API_KEY in .env or environment.
Press Ctrl-C to stop.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure the project root is on sys.path when running as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.models.types import Transcript
from backend.pipeline.listen import ListenStage


def on_final(t: Transcript) -> None:
    print(f"\n[FINAL] {t.text}\n", flush=True)


def on_partial(t: Transcript) -> None:
    print(f"  [partial] {t.text}", end="\r", flush=True)


if __name__ == "__main__":
    stage = ListenStage(on_final=on_final, on_partial=on_partial)
    stage.run_mic()
