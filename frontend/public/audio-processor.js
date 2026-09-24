class AudioCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (!input || !input[0]) return true
    const float32 = input[0]
    const int16 = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = s < 0 ? s * 32768 : s * 32767
    }
    this.port.postMessage(int16.buffer, [int16.buffer])
    return true
  }
}
registerProcessor('audio-capture-processor', AudioCaptureProcessor)
