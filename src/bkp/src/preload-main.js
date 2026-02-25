// src/preload-main.js
const { ipcRenderer, webFrame } = require('electron');

// ── Silenciar ruídos (Sentry, warnings, etc)
(function silenceNoise() {
  try {
    const kill = (url) => {
      try { const u = String(url).toLowerCase(); return u.includes('sentry.io'); } catch { return false; }
    };
    const _fetch = window.fetch?.bind(window);
    if (_fetch) {
      window.fetch = (...args) => {
        const url = args?.[0];
        if (kill(url)) return Promise.resolve(new Response(null, { status: 204 }));
        return _fetch(...args);
      };
    }
    const _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this.__kill = kill(url);
      return _open.call(this, method, url, ...rest);
    };
    const _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
      if (this.__kill) { try { this.abort(); } catch {} return; }
      return _send.call(this, body);
    };
    const dropMsgs = ['preloaded using link preload', 'sqlite_open returned null'];
    const wrap = (fnName) => {
      const orig = console[fnName]?.bind(console);
      if (!orig) return;
      console[fnName] = (...args) => {
        const s = args.map(a => String(a||'')).join(' ');
        if (dropMsgs.some(k => s.includes(k))) return;
        return orig(...args);
      };
    };
    wrap('warn'); wrap('error');
  } catch {}
})();

// ── Fakecam principal
const DUMMY_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwHwAFZgJ9v8vpWQAAAABJRU5ErkJggg==';
let cfg = { BASE_W: 720, BASE_H: 1280, FPS: 30 };
let injected = false;

function buildInjection({ BASE_W, BASE_H, FPS, initialDataUrl }) {
  return `
(() => {
  const ORIG = {
    gum: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) || null,
    enum: navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices) || null,
    constraints: navigator.mediaDevices?.getSupportedConstraints?.bind(navigator.mediaDevices) || null,
    permQuery: navigator.permissions?.query?.bind(navigator.permissions) || null,
  };

  // Touch mobile
  try { Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true }); } catch {}

  // Permissões sempre granted
  if (navigator.permissions) {
    const origQuery = navigator.permissions.query;
    navigator.permissions.query = (desc) => {
      const name = desc?.name || desc?.permission;
      if (name === 'camera' || name === 'microphone') {
        return Promise.resolve({ state: 'granted', onchange: null });
      }
      return origQuery(desc);
    };
  }

  let BASE_W = ${JSON.stringify(BASE_W)};
  let BASE_H = ${JSON.stringify(BASE_H)};
  const FPS = ${JSON.stringify(FPS)};
  const START = ${JSON.stringify(initialDataUrl || DUMMY_1x1)};

  let state = { zoom: 1, x: 0, y: 0, rotate: 0, flipH: false };
  let media = null;
  let C = null;
  let STREAM = null;
  const FAKE_IDS = { video: 'fakecam-back', audio: 'fakecam-mic', group: 'fakecam-group' };

  function useImage(dataUrl){ const img=new Image(); img.src=dataUrl; media=img; }
  function useVideo(dataUrl){
    const vid=document.createElement('video');
    vid.src=dataUrl; vid.loop=true; vid.muted=true; vid.playsInline=true; vid.autoplay=true;
    vid.oncanplay = () => vid.play().catch(()=>{});
    media=vid;
  }
  useImage(START);

  function ensureCanvas(){
    if(C) return C;
    C=document.createElement('canvas');
    C.width=BASE_W; C.height=BASE_H;
    const ctx=C.getContext('2d');
    function draw(){
      ctx.fillStyle='#000'; ctx.fillRect(0,0,C.width,C.height);
      if(media){
        const mw=media.videoWidth||media.naturalWidth||0;
        const mh=media.videoHeight||media.naturalHeight||0;
        if(mw===0||mh===0) { requestAnimationFrame(draw); return; }
        const cx=C.width/2, cy=C.height/2;
        ctx.save();
        ctx.translate(cx,cy);
        ctx.rotate((state.rotate*Math.PI)/180);
        ctx.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
        ctx.drawImage(media, (-mw/2)+state.x, (-mh/2)+state.y);
        ctx.restore();
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    return C;
  }

  function isVeriffHost() {
    try { return /veriff\\.(me|com)$/.test(location.hostname); } catch { return false; }
  }

  async function fakeEnumerateDevices(){
    if (isVeriffHost()) {
      return [
        { kind:'videoinput', deviceId:FAKE_IDS.video, label:'Back Camera', groupId:FAKE_IDS.group },
        { kind:'audioinput', deviceId:FAKE_IDS.audio, label:'Microphone', groupId:FAKE_IDS.group }
      ];
    }
    return [
      { kind:'videoinput', deviceId:FAKE_IDS.video, label:'Back Camera', groupId:FAKE_IDS.group },
      { kind:'audioinput', deviceId:FAKE_IDS.audio, label:'Microphone', groupId:FAKE_IDS.group }
    ];
  }

  function fakeSupportedConstraints(){
    return { width:true, height:true, frameRate:true, facingMode:true, deviceId:true, aspectRatio:true };
  }

  function patchVideoTrackMeta(track, {w,h,fps}){
    if (track.__patched) return;
    const settings = { width:w, height:h, frameRate:fps, facingMode:'environment', deviceId:FAKE_IDS.video };
    track.getSettings = () => settings;
    track.getConstraints = () => ({});
    track.getCapabilities = () => ({ facingMode:['environment'], deviceId:[FAKE_IDS.video] });
    track.__patched = true;
  }

  async function fakeGetUserMedia(constraints = { video: true }){
    const wantsVideo = constraints?.video;
    if (!wantsVideo && ORIG.gum) return ORIG.gum(constraints);

    let targetW = BASE_W, targetH = BASE_H, fps = FPS;
    const v = constraints?.video || {};
    if (v.width) targetW = v.width.exact || v.width.ideal || v.width || targetW;
    if (v.height) targetH = v.height.exact || v.height.ideal || v.height || targetH;
    if (v.frameRate) fps = v.frameRate.exact || v.frameRate.ideal || v.frameRate || fps;

    const c = ensureCanvas();
    if (c.width !== targetW || c.height !== targetH) { c.width = targetW; c.height = targetH; }

    if (!STREAM) {
      STREAM = c.captureStream(fps);
      try {
        if (constraints?.audio && ORIG.gum) {
          const a = await ORIG.gum({audio:true});
          a.getAudioTracks().forEach(t => STREAM.addTrack(t));
        }
      } catch {}
    }

    const vt = STREAM.getVideoTracks()[0];
    if (vt) patchVideoTrackMeta(vt, {w: c.width, h: c.height, fps});

    return STREAM;
  }

  // === INJEÇÃO ===
  if (navigator.mediaDevices) {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: fakeGetUserMedia, configurable: true, writable: true });
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: fakeEnumerateDevices, configurable: true, writable: true });
    Object.defineProperty(navigator.mediaDevices, 'getSupportedConstraints', { value: fakeSupportedConstraints, configurable: true, writable: true });
  } else {
    navigator.mediaDevices = { getUserMedia: fakeGetUserMedia, enumerateDevices: fakeEnumerateDevices, getSupportedConstraints: fakeSupportedConstraints };
  }

  // === COMUNICAÇÃO COM TOOLBOX ===
  window.addEventListener('message', (ev) => {
    const d = ev?.data;
    if (!d || d.__FAKECAM__ !== true) return;

    if (d.type === 'PARAMS') {
      const p = d.params || {};
      if (p.zoom !== undefined) state.zoom = Math.min(Math.max(parseFloat(p.zoom) || 1, 0.1), 5);
      if (p.x !== undefined) state.x = parseInt(p.x, 10) || 0;
      if (p.y !== undefined) state.y = parseInt(p.y, 10) || 0;
      if (p.rotate !== undefined) state.rotate = parseInt(p.rotate, 10) || 0;
      if (p.flipH !== undefined) state.flipH = !!p.flipH;   // ← CORRIGIDO
    }
    if (d.type === 'SET_IMAGE' && typeof d.dataUrl === 'string') useImage(d.dataUrl);
    if (d.type === 'SET_VIDEO' && typeof d.dataUrl === 'string') useVideo(d.dataUrl);
    if (d.type === 'SET_RES' && d.width && d.height) {
      const w = parseInt(d.width, 10), h = parseInt(d.height, 10);
      if (w > 0 && h > 0) {
        BASE_W = w; BASE_H = h;
        const c = ensureCanvas();
        c.width = w; c.height = h;
      }
    }
  });
})();
  `.trim();
}

// Injeção precoce
(async function earlyInject(){
  if (injected) return;
  injected = true;
  await webFrame.executeJavaScript(buildInjection({ BASE_W: cfg.BASE_W, BASE_H: cfg.BASE_H, FPS: cfg.FPS, initialDataUrl: DUMMY_1x1 }), true);
})();

// Bootstrap e IPC
ipcRenderer.on('fakecam:bootstrap', async (_e, data) => {
  cfg = { BASE_W: data.BASE_W || cfg.BASE_W, BASE_H: data.BASE_H || cfg.BASE_H, FPS: data.FPS || cfg.FPS };
  if (data.initialDataUrl) {
    window.postMessage({ __FAKECAM__: true, type: 'SET_IMAGE', dataUrl: data.initialDataUrl }, '*');
  }
});
ipcRenderer.on('fakecam:params', (_e, params) => window.postMessage({ __FAKECAM__: true, type: 'PARAMS', params }, '*'));
ipcRenderer.on('fakecam:setImageDataUrl', (_e, url) => window.postMessage({ __FAKECAM__: true, type: 'SET_IMAGE', dataUrl: url }, '*'));
ipcRenderer.on('fakecam:setVideoDataUrl', (_e, url) => window.postMessage({ __FAKECAM__: true, type: 'SET_VIDEO', dataUrl: url }, '*'));
ipcRenderer.on('fakecam:setResolution', (_e, res) => window.postMessage({ __FAKECAM__: true, type: 'SET_RES', ...res }, '*'));