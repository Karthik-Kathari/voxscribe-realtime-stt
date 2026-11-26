/**
 * AudioWorkletProcessor that captures microphone float32 samples,
 * downsamples them to 16kHz Int16 PCM mono, computes RMS level,
 * and posts chunks (~100ms = 1600 samples) to the main thread.
 */
class Pcm16Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.chunkSamples = 1600; // 100ms at 16kHz
    this.buffer = new Int16Array(this.chunkSamples);
    this.bufferOffset = 0;
    this.fractionalIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channelData = input[0];
    const ratio = sampleRate / this.targetSampleRate;

    // Calculate RMS for live mic meter
    let sumSq = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSq += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSq / channelData.length);

    // Linear interpolation downsample to 16kHz
    while (this.fractionalIndex < channelData.length) {
      const idx = Math.floor(this.fractionalIndex);
      const frac = this.fractionalIndex - idx;
      const s0 = channelData[idx];
      const s1 = idx + 1 < channelData.length ? channelData[idx + 1] : s0;
      const sample = s0 + (s1 - s0) * frac;
      const clamped = Math.max(-1, Math.min(1, sample));
      this.buffer[this.bufferOffset++] =
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      if (this.bufferOffset >= this.chunkSamples) {
        const out = this.buffer.slice(0);
        this.port.postMessage({ pcm: out.buffer, rms }, [out.buffer]);
        this.bufferOffset = 0;
      }

      this.fractionalIndex += ratio;
    }

    this.fractionalIndex -= channelData.length;
    return true;
  }
}

registerProcessor("pcm-16-processor", Pcm16Processor);

