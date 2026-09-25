// Buffer 200ms of audio before posting (AssemblyAI v3 requires chunks ≥ 50ms).
// At 16kHz: 200ms = 3200 samples.
const TARGET_SAMPLES = 3200

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf = new Int16Array(TARGET_SAMPLES)
    this._pos = 0
  }

  process(inputs) {
    const ch = inputs[0]?.[0]
    if (!ch) return true

    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]))
      this._buf[this._pos++] = s < 0 ? s * 32768 : s * 32767

      if (this._pos === TARGET_SAMPLES) {
        // Transfer ownership — zero-copy
        this.port.postMessage(this._buf.buffer, [this._buf.buffer])
        this._buf = new Int16Array(TARGET_SAMPLES)
        this._pos = 0
      }
    }
    return true
  }
}
registerProcessor('audio-capture-processor', AudioCaptureProcessor)
