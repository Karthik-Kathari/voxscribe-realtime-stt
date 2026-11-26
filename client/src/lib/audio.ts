export interface AudioCaptureHandle {
  stop: () => Promise<void>;
}

/**
 * Captures microphone audio using AudioWorklet and streams 16kHz Int16 PCM buffers.
 */
export async function startPcmCapture(
  onPcmChunk: (buffer: ArrayBuffer, rms: number) => void
): Promise<AudioCaptureHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const audioCtx = new AudioContext();
  await audioCtx.audioWorklet.addModule("/pcm-processor.js");

  const source = audioCtx.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(audioCtx, "pcm-16-processor");

  workletNode.port.onmessage = (event) => {
    const data = event.data as { pcm?: ArrayBuffer; rms?: number };
    if (data?.pcm) {
      onPcmChunk(data.pcm, data.rms ?? 0);
    }
  };

  source.connect(workletNode);
  // Connect to a silent gain node so the audio graph stays active without echoing mic audio
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;
  workletNode.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  return {
    stop: async () => {
      workletNode.disconnect();
      source.disconnect();
      silentGain.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      if (audioCtx.state !== "closed") {
        await audioCtx.close();
      }
    },
  };
}

