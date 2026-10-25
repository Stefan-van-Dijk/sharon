import { loadCardScanner, createCardReader, decodedCard } from './CardCodes.js?v=0.3.100';

export function mountCardScanner(host, { onResult, onClose, autoStart = false, photoFirst = false }) {
  let stopped = false, stream = null, timer = null, reader = null, token = 0;
  host.innerHTML = '<section class="module-view sh-card-view">' +
    '<button data-scan-close type="button" style="border:0;background:none;color:#222;padding:14px 0">‹ Kaarten</button>' +
    '<h2 style="font-weight:350">Code scannen</h2>' +
    '<p style="font-size:14px;color:#777">Scan een QR-code of barcode, of kies een foto.</p>' +
    '<video data-scan-video playsinline muted autoplay style="width:100%;max-height:45dvh;background:#171717;border-radius:12px"></video>' +
    '<p role="status" data-scan-status style="color:#777;font-size:14px"></p>' +
    '<button type="button" data-scan-start style="width:100%;border:0;background:#111;color:#fff;padding:15px">Camera starten</button>' +
    '<label style="display:block;margin-top:20px">Code uit foto lezen <input data-scan-photo type="file" accept="image/*" /></label></section>';
  const video = host.querySelector('[data-scan-video]');
  const start = host.querySelector('[data-scan-start]');
  const status = host.querySelector('[data-scan-status]');
  function stopCamera() {
    ++token;
    clearTimeout(timer); timer = null;
    reader?.reset?.(); reader = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.pause(); video.srcObject = null;
  }
  function cleanup() {
    if (stopped) return;
    stopped = true;
    stopCamera();
    document.removeEventListener('visibilitychange', hidden);
    window.removeEventListener('pagehide', cleanup);
  }
  function hidden() {
    if (document.hidden) { stopCamera(); start.disabled = false; start.textContent = 'Camera hervatten'; }
  }
  const accept = result => {
    const decoded = decodedCard(result);
    if (!decoded.format || !decoded.value) return;
    cleanup();
    onResult(decoded);
  };
  async function openCamera() {
    stopCamera();
    const current = token;
    start.disabled = true;
    status.textContent = 'Camera openen…';
    try {
      await loadCardScanner();
      if (stopped || token !== current) return;
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false
      });
      if (stopped || token !== current) { stream.getTracks().forEach(track => track.stop()); stream = null; return; }
      video.srcObject = stream; await video.play();
      if (stopped || token !== current) return;
      reader = createCardReader();
      const canvas = document.createElement('canvas');
      const attempt = () => {
        if (stopped || token !== current) return;
        try {
          if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
            const ratio = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
            canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const ZXing = globalThis.ZXing;
            const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(
              new ZXing.HTMLCanvasElementLuminanceSource(canvas)));
            accept(reader.decodeBitmap(bitmap));
            return;
          }
        } catch (error) {
          const ZXing = globalThis.ZXing;
          if (!(error instanceof ZXing.NotFoundException ||
              error instanceof ZXing.ChecksumException || error instanceof ZXing.FormatException)) {
            status.textContent = 'Leesfout. Houd de code volledig in beeld of kies een foto.';
          }
        }
        timer = window.setTimeout(attempt, 220);
      };
      status.textContent = 'Houd de code rustig in beeld.';
      attempt();
    } catch (error) {
      if (stopped || token !== current) return;
      stopCamera();
      status.textContent = error.name === 'NotAllowedError'
        ? 'Geef cameratoegang, of gebruik een foto.'
        : 'Camera niet beschikbaar. Kies een foto.';
      start.disabled = false; start.textContent = 'Opnieuw proberen';
    }
  }
  start.addEventListener('click', openCamera);
  host.querySelector('[data-scan-photo]').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    stopCamera();
    const current = token;
    status.textContent = 'Foto lezen…';
    let url = null, decoder = null;
    try {
      await loadCardScanner();
      if (stopped || current !== token) return;
      decoder = createCardReader();
      url = URL.createObjectURL(file);
      const result = await decoder.decodeFromImageUrl(url);
      if (!stopped && current === token) accept(result);
    } catch {
      if (!stopped && current === token) status.textContent = 'Geen herkenbare code in deze foto.';
    } finally {
      decoder?.reset?.(); if (url) URL.revokeObjectURL(url); event.target.value = '';
    }
  });
  host.querySelector('[data-scan-close]').addEventListener('click', () => { cleanup(); onClose(); });
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('pagehide', cleanup);
  if (autoStart) openCamera();
  if (photoFirst) {
    status.textContent = 'Kies een foto met een code.';
    host.querySelector('[data-scan-photo]').click();
  }
  return cleanup;
}
