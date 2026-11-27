import { browser } from 'wxt/browser';
import { readBoundedJson } from '@clickpilot/shared/http';
import { readTranscript, VOICE_MAX_SECONDS } from '@clickpilot/shared/voice';
import { VOICE_AUDIO_PORT, VOICE_HOSTED, VOICE_WORKER_URL, type VoiceMessage } from './preview';
import { toVoiceWav } from './wav';

export function receiveVoiceRecording() {
  let busy = false;
  browser.runtime.onConnect.addListener((port) => {
    const sender = port.sender;
    if (port.name !== VOICE_AUDIO_PORT || sender?.id !== browser.runtime.id
      || sender.url !== browser.runtime.getURL('/background.js') || sender.tab) return;
    if (busy) { port.postMessage({ type: 'error', reason: 'busy' }); return; }
    busy = true;
    const abort = new AbortController();
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let finishing = false;
    let uploadTimeout: ReturnType<typeof setTimeout> | undefined;
    const chunks: Blob[] = [];
    const cap = setTimeout(() => end({ type: 'error', reason: 'expired' }), VOICE_MAX_SECONDS * 1000);

    function stopMic() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;
    }
    function cleanup() {
      if (abort.signal.aborted) return;
      abort.abort();
      clearTimeout(cap);
      clearTimeout(uploadTimeout);
      if (recorder?.state === 'recording') recorder.stop();
      stopMic();
      chunks.length = 0;
      busy = false;
    }
    function end(message: VoiceMessage) {
      if (abort.signal.aborted) return;
      try { port.postMessage(message); } finally { cleanup(); }
    }
    async function transcribe() {
      if (!finishing || abort.signal.aborted) return;
      const clip = new Blob(chunks, { type: recorder?.mimeType });
      chunks.length = 0;
      if (!clip.size) return end({ type: 'error', reason: 'empty' });
      try {
        const wav = await toVoiceWav(clip);
        if (abort.signal.aborted) return;
        if (!wav) return end({ type: 'error', reason: 'empty' });
        const response = await fetch(VOICE_WORKER_URL, {
          method: 'POST', headers: { 'Content-Type': 'audio/wav', 'X-Klicko-Voice': 'preview' }, body: wav,
          signal: abort.signal, redirect: 'error', cache: 'no-store', credentials: 'omit',
        });
        if (!response.ok) {
          await response.body?.cancel();
          if (VOICE_HOSTED && response.status === 429) return end({ type: 'error', reason: 'rateLimited' });
          if (VOICE_HOSTED && response.status === 503) return end({ type: 'error', reason: 'serviceUnavailable' });
          throw new Error('Transcription failed.');
        }
        const text = readTranscript(await readBoundedJson(response, 16 * 1024));
        if (text === null) throw new Error('Invalid transcription response.');
        end(text ? { type: 'transcript', text } : { type: 'error', reason: 'empty' });
      } catch { end({ type: 'error', reason: 'failed' }); }
    }
    port.onDisconnect.addListener(cleanup);
    port.onMessage.addListener((value: unknown) => {
      if (value !== 'finish' || recorder?.state !== 'recording' || abort.signal.aborted || finishing) return;
      finishing = true;
      clearTimeout(cap);
      recorder.stop();
      stopMic();
      uploadTimeout = setTimeout(() => end({ type: 'error', reason: 'failed' }), 20_000);
      port.postMessage({ type: 'transcribing' });
    });
    void (async () => {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (abort.signal.aborted) { microphone.getTracks().forEach((track) => track.stop()); return; }
      stream = microphone;
      stream.getAudioTracks().forEach((track) => {
        track.addEventListener('ended', () => end({ type: 'error', reason: 'permission' }));
      });
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => { if (!abort.signal.aborted && event.data.size) chunks.push(event.data); };
      recorder.onerror = () => end({ type: 'error', reason: 'interrupted' });
      recorder.onstop = () => { void transcribe(); };
      recorder.start();
      port.postMessage({ type: 'listening' });
    })().catch(() => end({ type: 'error', reason: 'permission' }));
  });
}
