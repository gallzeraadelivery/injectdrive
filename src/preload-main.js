// src/preload-main.js
const { ipcRenderer, webFrame } = require('electron');

/** Injeção no MAIN WORLD — a página vê essas alterações (contextIsolation separa preload da página) */
function buildMainWorldFingerprint(fp) {
  if (!fp || typeof fp !== 'object') return '';
  const fJson = JSON.stringify(fp).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `
(function(){
  const f = ${fJson};
  if (!f || typeof f !== 'object') return;
  try {
    if (f.platform) Object.defineProperty(navigator,'platform',{value:f.platform,configurable:true});
    if (typeof f.hardwareConcurrency==='number') Object.defineProperty(navigator,'hardwareConcurrency',{value:f.hardwareConcurrency,configurable:true});
    if (f.preset==='iphone') Object.defineProperty(navigator,'deviceMemory',{get:()=>undefined,configurable:true,enumerable:true});
    else if (typeof f.deviceMemory==='number') Object.defineProperty(navigator,'deviceMemory',{value:f.deviceMemory,configurable:true});
    if (f.language) Object.defineProperty(navigator,'language',{value:f.language,configurable:true});
    if (Array.isArray(f.languages)) Object.defineProperty(navigator,'languages',{value:Object.freeze([...f.languages]),configurable:true});
    if (f.doNotTrack!==undefined) Object.defineProperty(navigator,'doNotTrack',{value:f.doNotTrack,configurable:true});
    if (f.vendor) Object.defineProperty(navigator,'vendor',{value:f.vendor,configurable:true});
    if (f.product) Object.defineProperty(navigator,'product',{value:f.product,configurable:true});
    if (f.appName) Object.defineProperty(navigator,'appName',{value:f.appName,configurable:true});
    if (f.appVersion) Object.defineProperty(navigator,'appVersion',{value:f.appVersion,configurable:true});
    if (typeof f.maxTouchPoints==='number') Object.defineProperty(navigator,'maxTouchPoints',{value:f.maxTouchPoints,configurable:true});
    if (typeof f.screenWidth==='number'&&typeof f.screenHeight==='number') {
      Object.defineProperty(screen,'width',{get:()=>f.screenWidth,configurable:true,enumerable:true});
      Object.defineProperty(screen,'height',{get:()=>f.screenHeight,configurable:true,enumerable:true});
    }
    if (typeof f.availWidth==='number'&&typeof f.availHeight==='number') {
      Object.defineProperty(screen,'availWidth',{get:()=>f.availWidth,configurable:true,enumerable:true});
      Object.defineProperty(screen,'availHeight',{get:()=>f.availHeight,configurable:true,enumerable:true});
    }
    if (typeof f.colorDepth==='number') Object.defineProperty(screen,'colorDepth',{value:f.colorDepth,configurable:true,enumerable:true});
    if (typeof f.pixelDepth==='number') Object.defineProperty(screen,'pixelDepth',{value:f.pixelDepth,configurable:true,enumerable:true});
    if (typeof f.pixelRatio==='number') Object.defineProperty(window,'devicePixelRatio',{get:()=>f.pixelRatio,configurable:true,enumerable:true});
    if (f.webglVendor&&f.webglRenderer) {
      [WebGLRenderingContext,WebGL2RenderingContext].forEach(function(C){
        if (typeof C==='undefined') return;
        var p=C&&C.prototype; if (!p||p.__fpPatched) return;
        var o=p.getParameter; if (!o) return;
        p.getParameter=function(x){ if (x===37445) return f.webglVendor; if (x===37446) return f.webglRenderer; return o.call(this,x); };
        p.__fpPatched=true;
      });
    }
    if (f.preset==='iphone') {
      Object.defineProperty(navigator,'userAgentData',{value:{brands:[{brand:'Safari',version:'18'},{brand:'Apple',version:'18'}],mobile:true,platform:'iPhone',getHighEntropyValues:h=>Promise.resolve({})},configurable:true,writable:false});
    } else if (f.preset==='android') {
      Object.defineProperty(navigator,'userAgentData',{value:{brands:[{brand:'Chromium',version:'131'},{brand:'Google Chrome',version:'131'}],mobile:true,platform:'Android',getHighEntropyValues:h=>Promise.resolve({})},configurable:true,writable:false});
    }
    if (f.timezone) {
      var _ro=Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions=function(){ var o=_ro.call(this); return Object.assign({},o,{timeZone:f.timezone}); };
    }
    if (typeof f.canvasNoise==='number') {
      var _gid=CanvasRenderingContext2D.prototype.getImageData;
      if (_gid) {
        var s=Math.abs(Math.floor(f.canvasNoise*1e9))%255;
        CanvasRenderingContext2D.prototype.getImageData=function(a,b,c,d){ var i=_gid.call(this,a,b,c,d); if (i&&i.data&&i.data.length>4) { var idx=(s*7)%(i.data.length-4); i.data[idx]=Math.min(255,Math.max(0,(i.data[idx]||0)+(s%3))); } return i; };
      }
    }
  } catch(e) {}
})();
`.trim();
}

// ── Fingerprint no MAIN WORLD (a página vê) — executa imediatamente
(function injectFingerprintMainWorld() {
  try {
    const fp = ipcRenderer.sendSync('fingerprint:get');
    const script = buildMainWorldFingerprint(fp);
    if (script) webFrame.executeJavaScript(script, true);
  } catch (_) {}
})();

// ── Fingerprint no preload (fallback / contexto isolado)
(function injectFingerprint() {
  try {
    const fp = ipcRenderer.sendSync('fingerprint:get');
    if (!fp || typeof fp !== 'object') return;

    // navigator
    if (fp.platform) {
      try { Object.defineProperty(navigator, 'platform', { value: fp.platform, configurable: true }); } catch {}
    }
    if (typeof fp.hardwareConcurrency === 'number') {
      try { Object.defineProperty(navigator, 'hardwareConcurrency', { value: fp.hardwareConcurrency, configurable: true }); } catch {}
    }
    // deviceMemory: Safari iOS não expõe (undefined). iPhone: não definir; outros: valor numérico
    if (fp.preset === 'iphone') {
      try {
        Object.defineProperty(navigator, 'deviceMemory', { get: () => undefined, configurable: true, enumerable: true });
      } catch {}
    } else if (typeof fp.deviceMemory === 'number') {
      try { Object.defineProperty(navigator, 'deviceMemory', { value: fp.deviceMemory, configurable: true }); } catch {}
    }
    if (fp.language) {
      try { Object.defineProperty(navigator, 'language', { value: fp.language, configurable: true }); } catch {}
    }
    if (Array.isArray(fp.languages)) {
      try { Object.defineProperty(navigator, 'languages', { value: Object.freeze([...fp.languages]), configurable: true }); } catch {}
    }
    if (fp.doNotTrack !== undefined) {
      try { Object.defineProperty(navigator, 'doNotTrack', { value: fp.doNotTrack, configurable: true }); } catch {}
    }
    // Navigator Safari iOS (vendor, product, appName, appVersion)
    if (fp.vendor) {
      try { Object.defineProperty(navigator, 'vendor', { value: fp.vendor, configurable: true }); } catch {}
    }
    if (fp.product) {
      try { Object.defineProperty(navigator, 'product', { value: fp.product, configurable: true }); } catch {}
    }
    if (fp.appName) {
      try { Object.defineProperty(navigator, 'appName', { value: fp.appName, configurable: true }); } catch {}
    }
    if (fp.appVersion) {
      try { Object.defineProperty(navigator, 'appVersion', { value: fp.appVersion, configurable: true }); } catch {}
    }
    if (typeof fp.maxTouchPoints === 'number') {
      try { Object.defineProperty(navigator, 'maxTouchPoints', { value: fp.maxTouchPoints, configurable: true }); } catch {}
    }

    // User-Agent Client Hints — mobile: iPhone ou Android
    if (fp.preset === 'iphone') {
      try {
        const uaData = {
          brands: [{ brand: 'Safari', version: '18' }, { brand: 'Apple', version: '18' }],
          mobile: true,
          platform: 'iPhone',
          getHighEntropyValues: (hints) => Promise.resolve({
            ...(hints.includes('platform') && { platform: 'iPhone' }),
            ...(hints.includes('platformVersion') && { platformVersion: '18.0' }),
            ...(hints.includes('architecture') && { architecture: 'arm' }),
            ...(hints.includes('model') && { model: '' }),
            ...(hints.includes('uaFullVersion') && { uaFullVersion: '18.0' }),
          }),
        };
        Object.defineProperty(navigator, 'userAgentData', { value: uaData, configurable: true, writable: false });
      } catch {}
    } else if (fp.preset === 'android') {
      try {
        const uaData = {
          brands: [{ brand: 'Chromium', version: '131' }, { brand: 'Google Chrome', version: '131' }, { brand: 'Not_A Brand', version: '24' }],
          mobile: true,
          platform: 'Android',
          getHighEntropyValues: (hints) => Promise.resolve({
            ...(hints.includes('platform') && { platform: 'Android' }),
            ...(hints.includes('platformVersion') && { platformVersion: '14.0' }),
            ...(hints.includes('architecture') && { architecture: 'arm' }),
            ...(hints.includes('model') && { model: '' }),
            ...(hints.includes('uaFullVersion') && { uaFullVersion: '131.0.0.0' }),
          }),
        };
        Object.defineProperty(navigator, 'userAgentData', { value: uaData, configurable: true, writable: false });
      } catch {}
    }

    // timezone (Intl + Date) — deve bater com IP/proxy para não ser detectado
    if (fp.timezone) {
      try {
        const orig = Intl.DateTimeFormat.prototype.resolvedOptions;
        Intl.DateTimeFormat.prototype.resolvedOptions = function() {
          const opts = orig.call(this);
          return { ...opts, timeZone: fp.timezone };
        };
      } catch {}
      try {
        const origToString = Date.prototype.toString;
        Date.prototype.toString = function() {
          try {
            return this.toLocaleString('en-US', {
              timeZone: fp.timezone,
              weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
              timeZoneName: 'shortOffset'
            });
          } catch {
            return origToString.call(this);
          }
        };
      } catch {}
      try {
        const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        Date.prototype.getTimezoneOffset = function() {
          try {
            const parts = new Intl.DateTimeFormat('en-US', { timeZone: fp.timezone, timeZoneName: 'shortOffset' }).formatToParts(this);
            const tz = parts.find(p => p.type === 'timeZoneName')?.value || '';
            const m = tz.match(/GMT([+-])(\d+)(?::(\d+))?/);
            if (m) {
              const sign = m[1] === '+' ? -1 : 1;
              const h = parseInt(m[2], 10) || 0;
              const min = parseInt(m[3], 10) || 0;
              return sign * (h * 60 + min);
            }
          } catch {}
          return origGetTimezoneOffset.call(this);
        };
      } catch {}
    }

    // screen (Object.defineProperty no screen)
    if (typeof fp.screenWidth === 'number' && typeof fp.screenHeight === 'number') {
      try {
        const desc = { configurable: true, enumerable: true };
        Object.defineProperty(screen, 'width', { ...desc, get: () => fp.screenWidth });
        Object.defineProperty(screen, 'height', { ...desc, get: () => fp.screenHeight });
      } catch {}
    }
    if (typeof fp.availWidth === 'number' && typeof fp.availHeight === 'number') {
      try {
        const desc = { configurable: true, enumerable: true };
        Object.defineProperty(screen, 'availWidth', { ...desc, get: () => fp.availWidth });
        Object.defineProperty(screen, 'availHeight', { ...desc, get: () => fp.availHeight });
      } catch {}
    }
    if (typeof fp.colorDepth === 'number') {
      try { Object.defineProperty(screen, 'colorDepth', { value: fp.colorDepth, configurable: true, enumerable: true }); } catch {}
    }
    if (typeof fp.pixelDepth === 'number') {
      try { Object.defineProperty(screen, 'pixelDepth', { value: fp.pixelDepth, configurable: true, enumerable: true }); } catch {}
    }

    // devicePixelRatio
    if (typeof fp.pixelRatio === 'number') {
      try { Object.defineProperty(window, 'devicePixelRatio', { get: () => fp.pixelRatio, configurable: true, enumerable: true }); } catch {}
    }

    // Canvas noise (getImageData) — adiciona ruído único por perfil
    if (typeof fp.canvasNoise === 'number') {
      try {
        const orig = CanvasRenderingContext2D.prototype.getImageData;
        if (orig) {
          const seed = Math.abs(Math.floor(fp.canvasNoise * 1e9)) % 255;
          CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
            const img = orig.call(this, sx, sy, sw, sh);
            if (img?.data?.length > 4) {
              const idx = (seed * 7) % (img.data.length - 4);
              img.data[idx] = Math.min(255, Math.max(0, (img.data[idx] || 0) + (seed % 3)));
            }
            return img;
          };
        }
      } catch {}
    }

    // WebGL — iPhone: vendor/renderer Apple; outros: ruído único
    if (fp.webglVendor && fp.webglRenderer) {
      try {
        const patch = (proto) => {
          if (!proto || proto.__fpPatched) return;
          const orig = proto.getParameter;
          if (!orig) return;
          proto.getParameter = function(p) {
            if (p === 37445) return fp.webglVendor;
            if (p === 37446) return fp.webglRenderer;
            return orig.call(this, p);
          };
          proto.__fpPatched = true;
        };
        if (typeof WebGLRenderingContext !== 'undefined') patch(WebGLRenderingContext.prototype);
        if (typeof WebGL2RenderingContext !== 'undefined') patch(WebGL2RenderingContext.prototype);
      } catch {}
    } else if (typeof fp.webglNoise === 'number') {
      try {
        const patch = (proto) => {
          if (!proto || proto.__fpPatched) return;
          const orig = proto.getParameter;
          if (!orig) return;
          const seed = Math.abs(Math.floor(fp.webglNoise * 1e9));
          proto.getParameter = function(p) {
            const v = orig.call(this, p);
            if (typeof v === 'string' && (p === 37445 || p === 37446)) {
              return v + String.fromCharCode(0x200B + (seed % 10));
            }
            return v;
          };
          proto.__fpPatched = true;
        };
        if (typeof WebGLRenderingContext !== 'undefined') patch(WebGLRenderingContext.prototype);
        if (typeof WebGL2RenderingContext !== 'undefined') patch(WebGL2RenderingContext.prototype);
      } catch {}
    }
  } catch {}
})();

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

function getDeviceIdsForPreset() {
  try {
    const fp = ipcRenderer.sendSync('fingerprint:get') || {};
    const preset = fp.preset || 'iphone';
    const id = (fp.fingerprintId || 'default').replace(/[^a-f0-9]/gi, '') || 'a1b2c3d4';
    const pad = (s, n) => (s + '0'.repeat(32)).slice(0, n);
    const hex = (n) => n.toString(16).padStart(2, '0');
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const v = pad(id + hex(h) + hex(h >> 8) + hex(h >> 16) + hex(h >> 24), 32);
    const vFront = pad(hex(h >> 16) + id + hex(h) + hex(h >> 8), 32);
    const a = pad(hex(h) + id + hex(h >> 24) + hex(h >> 16), 32);
    const g = pad(hex(h >> 8) + hex(h >> 16) + id + hex(h), 32);
    const isMobile = preset === 'iphone' || preset === 'android';
    const labels = isMobile
      ? { videoLabel: 'Back Camera', videoLabelFront: 'Front Camera', audioLabel: 'Microphone', hasFrontCamera: true }
      : { videoLabel: 'Integrated Camera', audioLabel: 'Microphone', hasFrontCamera: false };
    return { video: v, videoFront: vFront, audio: a, group: g, ...labels };
  } catch {
    return {
      video: 'B0E42D601A2B3C4D5E6F7890ABCDEF12',
      videoFront: 'B0E42D601A2B3C4D5E6F7890ABCDEF13',
      audio: 'C1F53E712B3C4D5E6F7890ABCDEF1234',
      group: 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6',
      videoLabel: 'Back Camera',
      videoLabelFront: 'Front Camera',
      audioLabel: 'Microphone',
      hasFrontCamera: true,
    };
  }
}

function buildInjection({ BASE_W, BASE_H, FPS, initialDataUrl, deviceIds }) {
  const ids = deviceIds || getDeviceIdsForPreset();
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
  const DEVICE_IDS = ${JSON.stringify(ids)};

  let currentImageObjectUrl = null;
  function useImage(dataUrl){ 
    if (!dataUrl || typeof dataUrl !== 'string') return;
    if (currentImageObjectUrl) {
      try { URL.revokeObjectURL(currentImageObjectUrl); } catch(e) {}
      currentImageObjectUrl = null;
    }
    const img = new Image();
    img.onload = function() {
      console.log('[Fakecam] Imagem carregada:', img.naturalWidth, 'x', img.naturalHeight);
      if (C) {
        const ctx = C.getContext('2d');
        ctx.fillStyle='#000';
        ctx.fillRect(0,0,C.width,C.height);
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          const cx = C.width/2, cy = C.height/2;
          ctx.save();
          ctx.translate(cx,cy);
          ctx.rotate((state.rotate*Math.PI)/180);
          ctx.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
          try {
            ctx.drawImage(img, (-img.naturalWidth/2)+state.x, (-img.naturalHeight/2)+state.y);
          } catch(e) {
            console.warn('[Fakecam] Erro ao desenhar imagem:', e);
          }
          ctx.restore();
        }
      }
    };
    img.onerror = function(e) {
      console.error('[Fakecam] Erro ao carregar imagem:', e);
    };
    var src = dataUrl;
    if (dataUrl.indexOf('fakecam://') === 0) {
      src = dataUrl;
    } else if (dataUrl.indexOf('data:image/gif') === 0) {
      try {
        var mimeMatch = dataUrl.match(/^data:(.+?);base64,/);
        var mime = (mimeMatch && mimeMatch[1]) || 'image/gif';
        var b64 = dataUrl.split(',')[1];
        if (b64) {
          var bin = atob(b64);
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          var blob = new Blob([arr], { type: mime });
          currentImageObjectUrl = URL.createObjectURL(blob);
          src = currentImageObjectUrl;
        }
      } catch (e) {
        console.warn('[Fakecam] GIF blob fallback, usando data URL:', e);
      }
    } else {
      img.crossOrigin = 'anonymous';
    }
    img.src = src;
    media = img;
  }
  let currentVideoObjectUrl = null;
  function useVideo(dataUrl){
    if (!dataUrl || typeof dataUrl !== 'string') return;
    if (currentVideoObjectUrl) {
      try { URL.revokeObjectURL(currentVideoObjectUrl); } catch(e) {}
      currentVideoObjectUrl = null;
    }
    const vid = document.createElement('video');
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.autoplay = true;
    vid.setAttribute('playsinline', '');
    vid.setAttribute('muted', '');
    vid.preload = 'auto';
    vid.crossOrigin = 'anonymous';
    if (dataUrl.indexOf('data:') === 0) {
      try {
        const mimeMatch = dataUrl.match(/^data:(.+?);base64,/);
        const mime = (mimeMatch && mimeMatch[1]) || 'video/mp4';
        const b64 = dataUrl.split(',')[1];
        if (b64) {
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          const blob = new Blob([arr], { type: mime });
          currentVideoObjectUrl = URL.createObjectURL(blob);
          vid.src = currentVideoObjectUrl;
        } else {
          vid.src = dataUrl;
        }
      } catch (e) {
        console.warn('[Fakecam] Blob URL fallback, usando data URL:', e);
        vid.src = dataUrl;
      }
    } else {
      vid.src = dataUrl;
    }
    vid.style.position = 'absolute';
    vid.style.opacity = '0';
    vid.style.pointerEvents = 'none';
    vid.style.width = '1px';
    vid.style.height = '1px';
    vid.style.top = '-9999px';
    if (document.body) document.body.appendChild(vid);
    let playAttempted = false;
    const tryPlay = () => {
      if (playAttempted) return;
      if (vid.readyState >= 2 && vid.videoWidth > 0) {
        playAttempted = true;
        vid.play().then(() => {
          console.log('[Fakecam] Vídeo iniciado com sucesso');
        }).catch((e) => {
          console.warn('[Fakecam] Erro ao reproduzir vídeo:', e);
          playAttempted = false;
        });
      }
    };
    vid.onloadedmetadata = () => { tryPlay(); };
    vid.oncanplay = () => { tryPlay(); };
    vid.oncanplaythrough = () => { tryPlay(); };
    vid.onloadeddata = () => { tryPlay(); };
    vid.onplaying = () => { };
    vid.onerror = (e) => {
      console.error('[Fakecam] Erro no vídeo:', vid.error ? vid.error.message : e);
    };
    vid.load();
    if (vid.readyState >= 2 && vid.videoWidth > 0) tryPlay();
    media = vid;
  }
  useImage(START);

  function forceDrawOnce() {
    if (!C || !media) return;
    const ctx = C.getContext('2d');
    ctx.fillStyle='#000'; ctx.fillRect(0,0,C.width,C.height);
    const mw = media.videoWidth || media.naturalWidth || 0;
    const mh = media.videoHeight || media.naturalHeight || 0;
    if (mw > 0 && mh > 0) {
      const cx = C.width/2, cy = C.height/2;
      ctx.save();
      ctx.translate(cx,cy);
      ctx.rotate((state.rotate*Math.PI)/180);
      ctx.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
      try {
        ctx.drawImage(media, (-mw/2)+state.x, (-mh/2)+state.y);
      } catch(e) {}
      ctx.restore();
    }
  }

  function ensureCanvas(){
    if(C) return C;
    C=document.createElement('canvas');
    C.width=BASE_W; C.height=BASE_H;
    const ctx=C.getContext('2d');
    function draw(){
      ctx.fillStyle='#000'; ctx.fillRect(0,0,C.width,C.height);
      if(media){
        // Se é vídeo, garante que está reproduzindo e pronto
        if(media.tagName === 'VIDEO') {
          // Garante que vídeo está no DOM (necessário para alguns navegadores)
          if (!media.parentNode) {
            console.log('[Liveness] draw: Vídeo não está no DOM, adicionando...');
            media.style.position = 'absolute';
            media.style.opacity = '0';
            media.style.pointerEvents = 'none';
            media.style.width = '1px';
            media.style.height = '1px';
            media.style.top = '-9999px';
            if (document.body) {
              document.body.appendChild(media);
            } else {
              // Se body ainda não existe, aguarda
              requestAnimationFrame(draw);
              return;
            }
          }
          
          // Força carregar se necessário
          if(media.readyState === 0) {
            media.load();
          }
          // Garante que metadata está carregada
          if(media.readyState >= 2) {
            // Garante que está reproduzindo
            if(media.paused || media.ended) {
              media.currentTime = 0;
              const playPromise = media.play();
              if (playPromise) {
                playPromise.catch((e) => {
                  console.warn('[Liveness] draw: Erro ao reproduzir vídeo:', e);
                });
              }
            }
          }
        }
        const mw=media.videoWidth||media.naturalWidth||0;
        const mh=media.videoHeight||media.naturalHeight||0;
        if(mw===0||mh===0) { 
          // Se é vídeo e ainda não tem dimensões, aguarda um pouco
          if (media.tagName === 'VIDEO') {
            console.log('[Liveness] draw: Vídeo ainda sem dimensões, aguardando...');
          } else if (media.tagName === 'IMG') {
            // Se é imagem e ainda não carregou, aguarda
            console.log('[Fakecam] draw: Imagem ainda sem dimensões (naturalWidth:', media.naturalWidth + ', naturalHeight:', media.naturalHeight + '), aguardando...');
            if (media.complete) {
              // Imagem já carregou mas não tem dimensões - pode ser problema
              console.warn('[Fakecam] draw: Imagem marcada como completa mas sem dimensões!');
            }
          }
          requestAnimationFrame(draw); 
          return; 
        }
        const cx=C.width/2, cy=C.height/2;
        ctx.save();
        ctx.translate(cx,cy);
        ctx.rotate((state.rotate*Math.PI)/180);
        ctx.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
        // Desenha o vídeo/imagem no canvas
        try {
          ctx.drawImage(media, (-mw/2)+state.x, (-mh/2)+state.y);
        } catch(e) {
          console.warn('[Liveness] draw: Erro ao desenhar media no canvas:', e);
        }
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
    const videoLabel = DEVICE_IDS.videoLabel || 'Back Camera';
    const videoLabelFront = DEVICE_IDS.videoLabelFront || 'Front Camera';
    const audioLabel = DEVICE_IDS.audioLabel || 'Microphone';
    const list = [
      { kind:'videoinput', deviceId:DEVICE_IDS.video, label:videoLabel, groupId:DEVICE_IDS.group },
    ];
    if (DEVICE_IDS.hasFrontCamera) {
      list.push({ kind:'videoinput', deviceId:DEVICE_IDS.videoFront, label:videoLabelFront, groupId:DEVICE_IDS.group });
    }
    list.push({ kind:'audioinput', deviceId:DEVICE_IDS.audio, label:audioLabel, groupId:DEVICE_IDS.group });
    return list;
  }

  function fakeSupportedConstraints(){
    return { width:true, height:true, frameRate:true, facingMode:true, deviceId:true, aspectRatio:true };
  }

  function patchVideoTrackMeta(track, {w,h,fps,facingMode,deviceId}){
    if (track.__patched) return;
    const facing = facingMode || 'environment';
    const devId = deviceId || DEVICE_IDS.video;
    const trackLabel = facing === 'user' ? (DEVICE_IDS.videoLabelFront || 'Front Camera') : (DEVICE_IDS.videoLabel || 'Back Camera');
    const aspectRatio = w && h ? (w/h) : 16/9;
    const settings = { width:w, height:h, frameRate:fps, facingMode:facing, deviceId:devId, aspectRatio:Math.round(aspectRatio*100)/100 };
    track.getSettings = () => settings;
    track.getConstraints = () => ({});
    const caps = { facingMode: DEVICE_IDS.hasFrontCamera ? ['user','environment'] : ['environment'], deviceId:[devId] };
    if (w&&h) { caps.width = { min: 320, max: w, ideal: w }; caps.height = { min: 240, max: h, ideal: h }; }
    track.getCapabilities = () => caps;
    try { Object.defineProperty(track, 'label', { value: trackLabel, configurable: true, enumerable: true }); } catch(e) {}
    try { Object.defineProperty(track, 'id', { value: devId + '-track', configurable: true, enumerable: true }); } catch(e) {}
    try { Object.defineProperty(track, 'canvas', { value: undefined, configurable: true }); } catch(e) {}
    try { Object.defineProperty(track, 'constructor', { value: typeof MediaStreamTrack !== 'undefined' ? MediaStreamTrack : track.constructor, configurable: true }); } catch(e) {}
    track.__patched = true;
  }

  function wantFrontCamera(constraints){
    const v = constraints?.video || {};
    const facing = typeof v === 'object' && v.facingMode;
    const ideal = facing && (v.facingMode.ideal || v.facingMode.exact);
    if (ideal === 'user') return true;
    const devId = v.deviceId && (v.deviceId.ideal || v.deviceId.exact);
    if (devId === DEVICE_IDS.videoFront) return true;
    return false;
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

    // Força desenho imediato para evitar primeiro frame preto
    forceDrawOnce();
    await new Promise(function(r) {
      requestAnimationFrame(function() {
        forceDrawOnce();
        requestAnimationFrame(function() {
          forceDrawOnce();
          r();
        });
      });
    });

    if (!STREAM) {
      STREAM = c.captureStream(fps);
      try {
        if (constraints?.audio && ORIG.gum) {
          const a = await ORIG.gum({audio:true});
          a.getAudioTracks().forEach(t => STREAM.addTrack(t));
        }
      } catch {}
    }

    const front = wantFrontCamera(constraints);
    const facingMode = front ? 'user' : 'environment';
    const deviceId = front ? DEVICE_IDS.videoFront : DEVICE_IDS.video;
    const vt = STREAM.getVideoTracks()[0];
    if (vt) patchVideoTrackMeta(vt, { w: c.width, h: c.height, fps, facingMode, deviceId });

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

  // === INTERCEPTAÇÃO DE CAPTURA DE FOTO (Veriff Liveness) ===
  // Intercepta quando o Veriff tenta capturar uma foto do stream
  // e substitui pela nossa imagem/vídeo configurada
  
  // Contador de frames para variações sutis (simula "live")
  let frameCounter = 0;
  let lastCaptureTime = 0;
  
  // Função auxiliar para capturar frame atual do nosso canvas COM MELHORIAS DE "LIVENESS"
  function captureCurrentFrame() {
    const c = ensureCanvas();
    const ctx = c.getContext('2d');
    const now = Date.now();
    
    // Redesenha para garantir que está atualizado
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    
    if (media) {
      // Se é imagem, garante que está carregada antes de desenhar
      if (media.tagName === 'IMG') {
        if (!media.complete) {
          console.warn('[Fakecam] captureCurrentFrame: Imagem ainda não carregou completamente');
          // Retorna canvas vazio temporariamente - a imagem ainda está carregando
          return c;
        }
        if (media.naturalWidth === 0 || media.naturalHeight === 0) {
          console.warn('[Fakecam] captureCurrentFrame: Imagem não tem dimensões válidas');
          return c;
        }
      }
      // Se é vídeo, garante que está reproduzindo e pronto
      if (media.tagName === 'VIDEO') {
        // Força carregar se necessário
        if (media.readyState === 0) {
          media.load();
          console.log('[Liveness] Vídeo forçado a carregar');
        }
        // Garante que metadata está carregada
        if (media.readyState < 2) {
          console.log('[Liveness] Vídeo ainda não tem metadata (readyState:', media.readyState + ')');
          return c; // Retorna canvas vazio temporariamente
        }
        // Verifica se tem dimensões válidas
        if (media.videoWidth === 0 || media.videoHeight === 0) {
          console.log('[Liveness] Vídeo não tem dimensões válidas:', media.videoWidth, 'x', media.videoHeight);
          return c; // Retorna canvas vazio se vídeo não tem dimensões
        }
        // Garante que vídeo está reproduzindo
        if (media.paused || media.ended) {
          console.log('[Liveness] Vídeo pausado/terminado, reiniciando...');
          media.currentTime = 0; // Volta ao início
          const playPromise = media.play();
          if (playPromise) {
            playPromise.catch((e) => {
              console.warn('[Liveness] Erro ao reproduzir vídeo:', e);
            });
          }
        }
        // Verifica novamente após tentar play
        if (media.paused) {
          console.warn('[Liveness] Vídeo ainda pausado após tentar play');
        }
      }
      
      const mw = media.videoWidth || media.naturalWidth || 0;
      const mh = media.videoHeight || media.naturalHeight || 0;
      if (mw > 0 && mh > 0) {
        const cx = c.width / 2, cy = c.height / 2;
        
        // === MELHORIAS PARA PARECER "LIVE" ===
        // 1. Micro-movimentos sutis (simula tremor natural da mão)
        const microMovement = Math.sin(frameCounter * 0.1) * 0.5; // Movimento muito sutil
        const microX = state.x + microMovement;
        const microY = state.y + (Math.cos(frameCounter * 0.15) * 0.3);
        
        // 2. Variação sutil de brilho/contraste (simula mudanças de iluminação)
        const brightnessVariation = 1 + (Math.sin(frameCounter * 0.05) * 0.02); // ±2% de brilho
        const contrastVariation = 1 + (Math.cos(frameCounter * 0.07) * 0.015); // ±1.5% de contraste
        
        // 3. Pequena variação de zoom (simula autofocus)
        const zoomVariation = state.zoom + (Math.sin(frameCounter * 0.03) * 0.001);
        
        ctx.save();
        
        // Aplica variações de brilho/contraste
        ctx.globalAlpha = 1.0;
        ctx.filter = 'brightness(' + brightnessVariation + ') contrast(' + contrastVariation + ')';
        
        ctx.translate(cx, cy);
        ctx.rotate((state.rotate * Math.PI) / 180);
        ctx.scale(state.flipH ? -zoomVariation : zoomVariation, zoomVariation);
        
        // Desenha o vídeo/imagem - garante que funciona mesmo se vídeo não estiver pronto
        try {
          ctx.drawImage(media, (-mw / 2) + microX, (-mh / 2) + microY);
        } catch(e) {
          console.warn('[Liveness] Erro ao desenhar media em captureCurrentFrame:', e);
          // Tenta novamente sem filtros se falhar
          ctx.restore();
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((state.rotate * Math.PI) / 180);
          ctx.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
          ctx.drawImage(media, (-mw / 2) + state.x, (-mh / 2) + state.y);
        }
        
        ctx.restore();
        
        // 4. Adiciona ruído sutil (simula sensor de câmera real)
        const imageData = ctx.getImageData(0, 0, c.width, c.height);
        const data = imageData.data;
        const noiseAmount = 0.3; // Ruído muito sutil (0-255)
        
        for (let i = 0; i < data.length; i += 4) {
          // Aplica ruído apenas em alguns pixels aleatórios (não em todos)
          if (Math.random() < 0.1) { // 10% dos pixels
            const noise = (Math.random() - 0.5) * noiseAmount;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));     // R
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise)); // G
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise)); // B
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        frameCounter++;
        lastCaptureTime = now;
      }
    }
    
    return c;
  }
  
  // 1. Intercepta ImageCapture API (usado pelo Veriff para liveness)
  if (typeof ImageCapture !== 'undefined' && ImageCapture.prototype) {
    const origTakePhoto = ImageCapture.prototype.takePhoto;
    const origGrabFrame = ImageCapture.prototype.grabFrame;
    
    // Intercepta takePhoto() - quando Veriff pede para tirar foto
    ImageCapture.prototype.takePhoto = function(photoSettings) {
      // Verifica se é do nosso stream fake
      if (STREAM && this.track && STREAM.getVideoTracks().includes(this.track)) {
        // Função auxiliar para capturar e criar File
        const createPhotoFile = (canvas) => {
          return new Promise((resolve) => {
            canvas.toBlob((blob) => {
              if (!blob || blob.size === 0) {
                console.warn('[Liveness] Blob vazio ou inválido, usando método original');
                return origTakePhoto.call(this, photoSettings).then(resolve);
              }
              
              const now = new Date();
              const captureTime = now.getTime() - (Math.random() * 100);
              const filename = 'IMG_' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '_' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0') + '.jpg';
              
              const file = new File([blob], filename, {
                type: 'image/jpeg',
                lastModified: captureTime
              });
              
              try {
                Object.defineProperty(file, 'size', { value: blob.size, writable: false });
                Object.defineProperty(file, 'lastModifiedDate', { value: new Date(captureTime), writable: false });
              } catch {}
              
              const mediaType = media && media.tagName === 'VIDEO' ? 'vídeo' : 'imagem';
              console.log('[Liveness] Foto capturada de ' + mediaType + ' substituída (blob size: ' + blob.size + ' bytes)');
              resolve(file);
            }, 'image/jpeg', 0.95);
          });
        };
        
        // Se é vídeo, garante que está pronto antes de capturar
        if (media && media.tagName === 'VIDEO') {
          return new Promise((resolve) => {
            const ensureVideoReady = () => {
              // Verifica se vídeo está pronto
              if (media.readyState < 2) {
                // Metadata ainda não carregou
                console.log('[Liveness] takePhoto: Aguardando vídeo carregar metadata (readyState:', media.readyState + ')');
                media.addEventListener('loadedmetadata', ensureVideoReady, { once: true });
                if (media.readyState === 0) {
                  media.load();
                }
                return;
              }
              
              // Verifica se tem dimensões válidas
              if (media.videoWidth === 0 || media.videoHeight === 0) {
                console.log('[Liveness] takePhoto: Aguardando vídeo ter dimensões válidas (atual:', media.videoWidth, 'x', media.videoHeight + ')');
                setTimeout(ensureVideoReady, 100);
                return;
              }
              
              // Garante que está reproduzindo
              if (media.paused || media.ended) {
                console.log('[Liveness] takePhoto: Vídeo pausado/terminado, reiniciando...');
                media.currentTime = 0;
                const playPromise = media.play();
                if (playPromise) {
                  playPromise.then(() => {
                    console.log('[Liveness] takePhoto: Vídeo iniciado com sucesso');
                  }).catch((e) => {
                    console.warn('[Liveness] takePhoto: Erro ao reproduzir vídeo:', e);
                  });
                }
              }
              
              // Aguarda um pouco para garantir que frame está sendo desenhado
              setTimeout(() => {
                // Força redesenhar o canvas antes de capturar
                const c = ensureCanvas();
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, c.width, c.height);
                
                // Desenha vídeo diretamente no canvas
                const mw = media.videoWidth || 0;
                const mh = media.videoHeight || 0;
                if (mw > 0 && mh > 0) {
                  const cx = c.width / 2, cy = c.height / 2;
                  ctx.save();
                  ctx.translate(cx, cy);
                  ctx.rotate((state.rotate * Math.PI) / 180);
                  ctx.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
                  try {
                    ctx.drawImage(media, (-mw / 2) + state.x, (-mh / 2) + state.y);
                    console.log('[Liveness] takePhoto: Vídeo desenhado no canvas');
                  } catch(e) {
                    console.error('[Liveness] takePhoto: Erro ao desenhar vídeo:', e);
                    ctx.restore();
                    // Fallback: usa método original
                    return origTakePhoto.call(this, photoSettings).then(resolve);
                  }
                  ctx.restore();
                }
                
                // Verifica se canvas tem conteúdo válido
                const testCtx = c.getContext('2d');
                const testData = testCtx.getImageData(0, 0, Math.min(50, c.width), Math.min(50, c.height));
                let hasContent = false;
                let nonBlackPixels = 0;
                for (let i = 0; i < testData.data.length; i += 4) {
                  const r = testData.data[i];
                  const g = testData.data[i + 1];
                  const b = testData.data[i + 2];
                  if (r !== 0 || g !== 0 || b !== 0) {
                    nonBlackPixels++;
                    if (nonBlackPixels > 10) {
                      hasContent = true;
                      break;
                    }
                  }
                }
                
                console.log('[Liveness] takePhoto: Canvas tem conteúdo?', hasContent, '(pixels não-pretos:', nonBlackPixels + ')');
                
                if (!hasContent) {
                  console.warn('[Liveness] takePhoto: Canvas parece vazio, aguardando mais um pouco...');
                  setTimeout(() => {
                    // Tenta novamente
                    const c2 = ensureCanvas();
                    const ctx2 = c2.getContext('2d');
                    ctx2.fillStyle = '#000';
                    ctx2.fillRect(0, 0, c2.width, c2.height);
                    const mw2 = media.videoWidth || 0;
                    const mh2 = media.videoHeight || 0;
                    if (mw2 > 0 && mh2 > 0) {
                      const cx2 = c2.width / 2, cy2 = c2.height / 2;
                      ctx2.save();
                      ctx2.translate(cx2, cy2);
                      ctx2.rotate((state.rotate * Math.PI) / 180);
                      ctx2.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
                      ctx2.drawImage(media, (-mw2 / 2) + state.x, (-mh2 / 2) + state.y);
                      ctx2.restore();
                    }
                    createPhotoFile(c2).then(resolve);
                  }, 300);
                  return;
                }
                
                // Aplica melhorias de liveness antes de criar blob
                const finalCanvas = captureCurrentFrame();
                createPhotoFile(finalCanvas).then(resolve);
              }, 200); // Aguarda 200ms para garantir frame estável do vídeo
            };
            
            ensureVideoReady();
          });
        }
        
        // Para imagem, garante que está carregada antes de capturar
        if (media && media.tagName === 'IMG') {
          if (!media.complete) {
            console.warn('[Liveness] takePhoto: Imagem ainda não carregou, aguardando...');
            return new Promise((resolve) => {
              const checkComplete = () => {
                if (media.complete && media.naturalWidth > 0 && media.naturalHeight > 0) {
                  const c = captureCurrentFrame();
                  createPhotoFile(c).then(resolve);
                } else {
                  setTimeout(checkComplete, 50);
                }
              };
              media.addEventListener('load', checkComplete, { once: true });
              // Se já está carregando, verifica periodicamente
              setTimeout(checkComplete, 50);
            });
          }
          if (media.naturalWidth === 0 || media.naturalHeight === 0) {
            console.error('[Liveness] takePhoto: Imagem não tem dimensões válidas!');
            return origTakePhoto.call(this, photoSettings);
          }
        }
        
        // Para imagem, captura diretamente
        const c = captureCurrentFrame();
        
        // Verifica se o canvas tem conteúdo antes de criar o arquivo
        const testCtx = c.getContext('2d');
        const testData = testCtx.getImageData(0, 0, Math.min(50, c.width), Math.min(50, c.height));
        let hasContent = false;
        for (let i = 0; i < testData.data.length; i += 4) {
          const r = testData.data[i];
          const g = testData.data[i + 1];
          const b = testData.data[i + 2];
          if (r !== 0 || g !== 0 || b !== 0) {
            hasContent = true;
            break;
          }
        }
        
        if (!hasContent) {
          console.warn('[Liveness] takePhoto: Canvas está vazio! Tentando redesenhar...');
          // Força redesenhar
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, c.width, c.height);
          if (media && media.naturalWidth > 0 && media.naturalHeight > 0) {
            const cx = c.width / 2, cy = c.height / 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate((state.rotate * Math.PI) / 180);
            ctx.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
            ctx.drawImage(media, (-media.naturalWidth / 2) + state.x, (-media.naturalHeight / 2) + state.y);
            ctx.restore();
          }
        }
        
        return createPhotoFile(c);
      }
      return origTakePhoto.call(this, photoSettings);
    };
    
    // Intercepta grabFrame() - captura frame do vídeo
    ImageCapture.prototype.grabFrame = function() {
      if (STREAM && this.track && STREAM.getVideoTracks().includes(this.track)) {
        const c = captureCurrentFrame();
        return Promise.resolve(c);
      }
      return origGrabFrame.call(this);
    };
  }

  // 2. Intercepta canvas.toBlob() quando usado para capturar do stream
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
    // Verifica se este canvas está capturando do nosso stream fake
    if (this === C && media) {
      // Função auxiliar para criar File do blob
      const createFileFromBlob = (blob) => {
        if (!blob || blob.size === 0) {
          console.warn('[Liveness] Blob vazio em toBlob()');
          callback(blob);
          return;
        }
        
        const now = new Date();
        const captureTime = now.getTime() - (Math.random() * 100);
        const filename = 'IMG_' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '_' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0') + '.jpg';
        
        const file = new File([blob], filename, {
          type: type || 'image/jpeg',
          lastModified: captureTime
        });
        
        try {
          Object.defineProperty(file, 'size', { value: blob.size, writable: false });
          Object.defineProperty(file, 'lastModifiedDate', { value: new Date(captureTime), writable: false });
        } catch {}
        
        const mediaType = media.tagName === 'VIDEO' ? 'vídeo' : 'imagem';
        console.log('[Liveness] Canvas.toBlob() capturado de ' + mediaType + ' (blob size: ' + blob.size + ' bytes)');
        callback(file);
      };
      
      // Se é vídeo, garante que está pronto antes de capturar
      if (media.tagName === 'VIDEO') {
        const ensureVideoReady = () => {
          if (media.readyState < 2) {
            console.log('[Liveness] toBlob: Aguardando vídeo carregar metadata...');
            media.addEventListener('loadedmetadata', ensureVideoReady, { once: true });
            media.load();
            return;
          }
          
          if (media.videoWidth === 0 || media.videoHeight === 0) {
            console.log('[Liveness] toBlob: Aguardando vídeo ter dimensões...');
            setTimeout(ensureVideoReady, 100);
            return;
          }
          
          if (media.paused || media.ended) {
            media.currentTime = 0;
            media.play().catch(() => {});
          }
          
            // Aguarda frame estável e força redesenhar
            setTimeout(() => {
              // Força redesenhar o canvas antes de capturar
              const c = ensureCanvas();
              const ctx = c.getContext('2d');
              ctx.fillStyle = '#000';
              ctx.fillRect(0, 0, c.width, c.height);
              
              // Desenha vídeo diretamente no canvas
              const mw = media.videoWidth || 0;
              const mh = media.videoHeight || 0;
              if (mw > 0 && mh > 0) {
                const cx = c.width / 2, cy = c.height / 2;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate((state.rotate * Math.PI) / 180);
                ctx.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
                try {
                  ctx.drawImage(media, (-mw / 2) + state.x, (-mh / 2) + state.y);
                  console.log('[Liveness] toBlob: Vídeo desenhado no canvas');
                } catch(e) {
                  console.error('[Liveness] toBlob: Erro ao desenhar vídeo:', e);
                  ctx.restore();
                  // Fallback: usa método original
                  return origToBlob.call(this, callback, type, quality);
                }
                ctx.restore();
              }
              
              // Aplica melhorias de liveness
              captureCurrentFrame();
              
              // Verifica se canvas tem conteúdo
              const testCtx = this.getContext('2d');
              const testData = testCtx.getImageData(0, 0, Math.min(50, this.width), Math.min(50, this.height));
              let hasContent = false;
              let nonBlackPixels = 0;
              for (let i = 0; i < testData.data.length; i += 4) {
                const r = testData.data[i];
                const g = testData.data[i + 1];
                const b = testData.data[i + 2];
                if (r !== 0 || g !== 0 || b !== 0) {
                  nonBlackPixels++;
                  if (nonBlackPixels > 10) {
                    hasContent = true;
                    break;
                  }
                }
              }
              
              console.log('[Liveness] toBlob: Canvas tem conteúdo?', hasContent, '(pixels não-pretos:', nonBlackPixels + ')');
              
              if (!hasContent) {
                console.warn('[Liveness] toBlob: Canvas vazio, aguardando mais...');
                setTimeout(() => {
                  // Tenta novamente
                  const c2 = ensureCanvas();
                  const ctx2 = c2.getContext('2d');
                  ctx2.fillStyle = '#000';
                  ctx2.fillRect(0, 0, c2.width, c2.height);
                  const mw2 = media.videoWidth || 0;
                  const mh2 = media.videoHeight || 0;
                  if (mw2 > 0 && mh2 > 0) {
                    const cx2 = c2.width / 2, cy2 = c2.height / 2;
                    ctx2.save();
                    ctx2.translate(cx2, cy2);
                    ctx2.rotate((state.rotate * Math.PI) / 180);
                    ctx2.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
                    ctx2.drawImage(media, (-mw2 / 2) + state.x, (-mh2 / 2) + state.y);
                    ctx2.restore();
                  }
                  captureCurrentFrame();
                  origToBlob.call(this, (blob) => createFileFromBlob(blob), type || 'image/jpeg', quality !== undefined ? quality : 0.95);
                }, 300);
                return;
              }
              
              origToBlob.call(this, (blob) => createFileFromBlob(blob), type || 'image/jpeg', quality !== undefined ? quality : 0.95);
            }, 200);
        };
        
        // Inicia verificação
        ensureVideoReady();
        return; // Retorna imediatamente (toBlob não retorna Promise)
      }
      
      // Para imagem, garante que está carregada antes de capturar
      if (media && media.tagName === 'IMG') {
        if (!media.complete || media.naturalWidth === 0 || media.naturalHeight === 0) {
          console.warn('[Liveness] toBlob: Imagem não está pronta, aguardando...');
          // Aguarda imagem carregar
          const waitForImage = () => {
            if (media.complete && media.naturalWidth > 0 && media.naturalHeight > 0) {
              captureCurrentFrame();
              origToBlob.call(this, (blob) => createFileFromBlob(blob), type || 'image/jpeg', quality !== undefined ? quality : 0.95);
            } else {
              setTimeout(waitForImage, 50);
            }
          };
          media.addEventListener('load', waitForImage, { once: true });
          setTimeout(waitForImage, 50);
          return;
        }
      }
      
      // Para imagem, captura diretamente
      captureCurrentFrame();
      
      // Verifica se canvas tem conteúdo
      const testCtx = this.getContext('2d');
      const testData = testCtx.getImageData(0, 0, Math.min(50, this.width), Math.min(50, this.height));
      let hasContent = false;
      for (let i = 0; i < testData.data.length; i += 4) {
        const r = testData.data[i];
        const g = testData.data[i + 1];
        const b = testData.data[i + 2];
        if (r !== 0 || g !== 0 || b !== 0) {
          hasContent = true;
          break;
        }
      }
      
      if (!hasContent && media && media.tagName === 'IMG' && media.naturalWidth > 0) {
        console.warn('[Liveness] toBlob: Canvas vazio, forçando redesenho...');
        const ctx = this.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.width, this.height);
        const cx = this.width / 2, cy = this.height / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((state.rotate * Math.PI) / 180);
        ctx.scale(state.flipH ? -state.zoom : state.zoom, state.zoom);
        ctx.drawImage(media, (-media.naturalWidth / 2) + state.x, (-media.naturalHeight / 2) + state.y);
        ctx.restore();
      }
      
      origToBlob.call(this, (blob) => createFileFromBlob(blob), type || 'image/jpeg', quality !== undefined ? quality : 0.95);
      return;
    }
    // Para outros canvas, usa comportamento normal
    origToBlob.call(this, callback, type, quality);
  };
  
  // 2b. Intercepta canvas.toDataURL() também (alguns sites usam)
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
    if (this === C && media) {
      captureCurrentFrame();
      console.log('[Liveness] Canvas.toDataURL() capturado - usando nosso conteúdo');
    }
    return origToDataURL.call(this, type, quality);
  };

  // 3. Intercepta quando sites capturam frame diretamente do video element
  // (alguns sites fazem: video.captureStream() e depois capturam frame)
  if (HTMLVideoElement && HTMLVideoElement.prototype) {
    const origCaptureStream = HTMLVideoElement.prototype.captureStream;
    if (origCaptureStream) {
      HTMLVideoElement.prototype.captureStream = function(frameRate) {
        // Se este vídeo é o nosso media fake, retorna nosso stream
        if (media && media.tagName === 'VIDEO' && this === media) {
          return STREAM || ensureCanvas().captureStream(frameRate || FPS);
        }
        return origCaptureStream.call(this, frameRate);
      };
    }
  }
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
  const initialDataUrl = data.initialDataUrl || DUMMY_1x1;
  window.postMessage({ __FAKECAM__: true, type: 'SET_IMAGE', dataUrl: initialDataUrl }, '*');
  try {
    const script = buildInjection({ BASE_W: cfg.BASE_W, BASE_H: cfg.BASE_H, FPS: cfg.FPS, initialDataUrl });
    ipcRenderer.send('fakecam:injectionScript', script);
  } catch (e) {
    console.warn('[Fakecam] Erro ao enviar script para main:', e);
  }
});
ipcRenderer.on('fakecam:params', (_e, params) => window.postMessage({ __FAKECAM__: true, type: 'PARAMS', params }, '*'));
ipcRenderer.on('fakecam:setImageDataUrl', (_e, url) => {
  window.postMessage({ __FAKECAM__: true, type: 'SET_IMAGE', dataUrl: url }, '*');
  if (typeof url === 'string' && url.indexOf('data:image/gif') !== 0) {
    ipcRenderer.send('fakecam:setImageDataUrlBroadcast', url);
  }
});
ipcRenderer.on('fakecam:setImageDataUrlBroadcastToIframes', (_e, url) => {
  ipcRenderer.send('fakecam:setImageDataUrlBroadcast', url);
});
ipcRenderer.on('fakecam:setVideoDataUrl', (_e, url) => {
  window.postMessage({ __FAKECAM__: true, type: 'SET_VIDEO', dataUrl: url }, '*');
  ipcRenderer.send('fakecam:setVideoDataUrlBroadcast', url);
});
ipcRenderer.on('fakecam:setResolution', (_e, res) => window.postMessage({ __FAKECAM__: true, type: 'SET_RES', ...res }, '*'));

// Listener para salvar logs automaticamente na pasta do projeto
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SAVE_UPLOAD_LOGS' && event.data.logs) {
    try {
      ipcRenderer.send('logs:saveToFile', event.data.logs);
    } catch (e) {
      console.warn('[Preload] Erro ao salvar logs:', e);
    }
  }
});