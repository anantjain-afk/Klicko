import { VOICE_MAX_SECONDS, VOICE_SAMPLE_RATE, WAV_HEADER_BYTES } from '@clickpilot/shared/voice';

export async function toVoiceWav(clip: Blob): Promise<ArrayBuffer | null> {
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try { decoded = await context.decodeAudioData(await clip.arrayBuffer()); }
  finally { await context.close(); }
  if (decoded.duration < 0.25) return null;

  const length = Math.floor(Math.min(decoded.duration, VOICE_MAX_SECONDS) * VOICE_SAMPLE_RATE);
  const mono = new OfflineAudioContext(1, length, VOICE_SAMPLE_RATE);
  const source = mono.createBufferSource();
  source.buffer = decoded;
  source.connect(mono.destination);
  source.start();
  const samples = (await mono.startRendering()).getChannelData(0);
  if (!samples.some((sample) => Math.abs(sample) >= 0.005)) return null;

  const dataBytes = length * 2;
  const bytes = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const wav = new DataView(bytes);
  wav.setUint32(0, 0x52494646); // RIFF
  wav.setUint32(4, bytes.byteLength - 8, true);
  wav.setUint32(8, 0x57415645); // WAVE
  wav.setUint32(12, 0x666d7420); // fmt
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, 1, true);
  wav.setUint32(24, VOICE_SAMPLE_RATE, true);
  wav.setUint32(28, VOICE_SAMPLE_RATE * 2, true);
  wav.setUint16(32, 2, true);
  wav.setUint16(34, 16, true);
  wav.setUint32(36, 0x64617461); // data
  wav.setUint32(40, dataBytes, true);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    wav.setInt16(WAV_HEADER_BYTES + index * 2, clamped * (clamped < 0 ? 32768 : 32767), true);
  });
  return bytes;
}
