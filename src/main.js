// src/main.js — FakeCam + Toolbox + Navegação + UA Presets + Perfis (profiles.json)
const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const crypto = require('crypto');
const {
  TCC_URL,
  BASE_W,
  BASE_H,
  FPS,
  DEFAULT_IMAGE_PATH,
  REQUIRE_PROXY_LOGIN,
  PROXY_BYPASS,
  SHORTCUTS: CONFIG_SHORTCUTS,
  IGNORE_SSL_FOR_LOCAL_PROXY,
  ACCEPT_PROXY_SSL_CERTIFICATES,
  IGNORE_SSL_CERTIFICATES,
  BURP_CA_PATH,
  AUTO_INJECT_MEDIA,
  AUTO_INJECT_MODE,
  AUTO_INJECT_URLS,
  ENABLE_WEBSOCKET_INTERCEPT,
  ANDROID_EMULATE_VIEWPORT,
} = require('./config');

// Ignorar erros de certificado (Burp, etc). Deve ser ANTES de app.ready.
if (IGNORE_SSL_CERTIFICATES === true) {
  app.commandLine.appendSwitch('ignore-certificate-errors');
}
// Bypass Veriff na linha de comando para WebRTC/TURN (evita -105 com proxy).
app.commandLine.appendSwitch('proxy-bypass-list', '.veriff.me,.veriff.com,*.veriff.me,*.veriff.com');

let mainWin = null;
let toolboxWin = null;
let loginWin = null;
let lastRes = null;

let currentProfileId = null;
let currentPartition = null;

// Proxy em memória
let lastProxy = {
  host: '',
  port: '',
  user: '',
  pass: '',
  bypass: PROXY_BYPASS || '<-loopback>'
};

const partitionOf = (id) => `persist:dev-${id}`;
// Arquivo ORIGINAL de perfis
const storeFile = () => path.join(app.getPath('userData'), 'profiles.json');
// Pasta do projeto (para salvar imagem que o Burp usa na substituição)
const projectRoot = path.join(__dirname, '..');
const BURP_REPLACEMENT_PATH_FILE = path.join(projectRoot, 'burp-replacement-path.txt');

const { generateFingerprint, mergeFingerprint, ensureFingerprintFields, applyGeoToFingerprint } = require('./fingerprint');

// Fingerprint atual para o preload (sync)
let currentFingerprintForPreload = null;

// User-Agent padrão (desktop)
let defaultUserAgent = null;

// Mídia atual para auto-injeção (vídeo/imagem do toolbox)
let currentMediaForInjection = {
  type: null,  // 'video' ou 'image'
  data: null,  // Buffer do arquivo
  mime: null,  // MIME type (ex: 'video/mp4', 'image/jpeg')
  path: null,  // Caminho do arquivo original
};

// Script da fakecam para injetar em iframes (Veriff costuma rodar em iframe)
let storedFakecamScript = null;
let currentFakecamImageDataUrl = '';
// Script de injeção no upload (fetch/XHR) — precisa rodar também nos iframes onde o Veriff faz o upload
let storedUploadInjectionScript = null;

// Modo Drive: só altera os 6 campos na resposta (manual_image_upload_required, etc.); desativa injeção de selfie e aprovação Veriff
let driveModeEnabled = false;

/* ================ PERFIS (profiles.json) ================= */
function loadProfiles() {
  try {
    const txt = fs.readFileSync(storeFile(), 'utf8');
    if (!txt) return [];
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProfiles(list) {
  try {
    fs.writeFileSync(storeFile(), JSON.stringify(list, null, 2));
  } catch {
    // ignora erro
  }
}

function getDefaultFingerprint() {
  return generateFingerprint('iphone');
}

function getFingerprintUA(fp) {
  if (!fp || typeof fp !== 'object') return defaultUserAgent || '';
  if (fp.userAgent) return fp.userAgent;
  const preset = fp.preset || 'iphone';
  const uas = {
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  };
  return uas[preset] || defaultUserAgent || '';
}

function getFingerprintRes(fp) {
  if (!fp || typeof fp !== 'object') return { width: BASE_W, height: BASE_H };
  if (fp.width && fp.height) return { width: fp.width, height: fp.height };
  const preset = fp.preset || 'iphone';
  if (preset === 'android' || preset === 'iphone') return { width: 1920, height: 1080 };
  return { width: BASE_W, height: BASE_H };
}

function ensureProfiles() {
  let list = loadProfiles();
  if (!Array.isArray(list) || list.length === 0) {
    const id = randomUUID();
    list = [{ id, name: 'Perfil 1', url: TCC_URL, fingerprint: getDefaultFingerprint() }];
    saveProfiles(list);
  }
  return list;
}

function normalizeProfile(p) {
  if (!p) return p;
  const rawFp = p.fingerprint && typeof p.fingerprint === 'object' ? p.fingerprint : null;
  const hasCompleteFp = rawFp && rawFp.userAgent && rawFp.platform && rawFp.hardwareConcurrency;
  const fp = hasCompleteFp ? { ...rawFp } : (rawFp ? ensureFingerprintFields({ ...rawFp }, rawFp.preset || 'iphone') : getDefaultFingerprint());
  return {
    ...p,
    url: p.url || TCC_URL,
    fingerprint: fp,
    __fingerprintWasCompleted: !hasCompleteFp,
  };
}

function getProfileById(id) {
  if (!id) return undefined;
  const rawProfile = loadProfiles().find((p) => p.id === id);
  if (!rawProfile) return undefined;
  const normalized = normalizeProfile(rawProfile);
  // Persiste quando o fingerprint foi completado (perfil antigo ou sem fingerprint)
  // para que "Ver fingerprint" e os sites vejam sempre os mesmos valores
  if (normalized.__fingerprintWasCompleted) {
    const { __fingerprintWasCompleted, ...toSave } = normalized;
    upsertProfile(toSave);
  }
  const { __fingerprintWasCompleted, ...result } = normalized;
  return result;
}

function upsertProfile(profile) {
  const list = loadProfiles();
  const idx = list.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...profile };
  } else {
    list.push(profile);
  }
  saveProfiles(list);
}

function deleteProfile(id) {
  const list = loadProfiles().filter((p) => p.id !== id);
  saveProfiles(list);
  return list;
}

/* ================ PROXY ================= */
function isProxyLocal(host) {
  if (!host || typeof host !== 'string') return false;
  const h = host.trim().toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '0.0.0.0';
}

function shouldAcceptProxyCertificates() {
  const hasProxy = lastProxy.host && lastProxy.port;
  if (!hasProxy) return false;
  if (ACCEPT_PROXY_SSL_CERTIFICATES === true) return true;
  return IGNORE_SSL_FOR_LOCAL_PROXY !== false && isProxyLocal(lastProxy.host);
}

// Fingerprint do CA do Burp (carregado de BURP_CA_PATH) para aceitar certificados assinados por ele
let burpCaFingerprint256 = null;
function loadBurpCaFingerprint() {
  burpCaFingerprint256 = null;
  if (!BURP_CA_PATH || typeof BURP_CA_PATH !== 'string') return;
  const p = path.isAbsolute(BURP_CA_PATH) ? BURP_CA_PATH : path.resolve(app.getAppPath(), BURP_CA_PATH);
  if (!fs.existsSync(p)) {
    console.warn('BURP_CA_PATH não encontrado:', p);
    return;
  }
  try {
    const data = fs.readFileSync(p);
    const pem = data.toString('utf8');
    const isPem = /-----BEGIN CERTIFICATE-----/i.test(pem);
    const cert = isPem
      ? new crypto.X509Certificate(pem)
      : new crypto.X509Certificate(data);
    burpCaFingerprint256 = cert.fingerprint256 || null;
    if (burpCaFingerprint256) {
      console.log('CA do Burp carregado (fingerprint):', burpCaFingerprint256.slice(0, 20) + '...');
    }
  } catch (e) {
    console.warn('Erro ao carregar BURP_CA_PATH:', e?.message || e);
  }
}

function certChainIncludesBurpCa(cert) {
  if (!burpCaFingerprint256 || !cert) return false;
  const norm = (fp) => (fp || '').replace(/:/g, '').toUpperCase();
  const want = norm(burpCaFingerprint256);
  let c = cert;
  while (c) {
    try {
      const pem = c.data || '';
      if (pem) {
        const x = new crypto.X509Certificate(pem);
        const fp = x.fingerprint256 || x.fingerprint || '';
        if (norm(fp) === want) return true;
      }
    } catch (_) { /* ignorar cert inválido */ }
    try {
      c = c.issuerCert;
    } catch (_) {
      c = null;
    }
  }
  return false;
}

function setSessionCertificateVerify(sess, acceptProxyCerts) {
  const useBurpCa = !!burpCaFingerprint256;
  if (!acceptProxyCerts && !useBurpCa) {
    sess.setCertificateVerifyProc(null);
    return;
  }
  sess.setCertificateVerifyProc((request, callback) => {
    if (acceptProxyCerts) {
      callback(0);
      return;
    }
    if (useBurpCa && certChainIncludesBurpCa(request.certificate)) {
      callback(0);
      return;
    }
    callback(request.errorCode);
  });
}

async function applyProxy(cfg) {
  lastProxy = { ...lastProxy, ...cfg };

  // Inclui socks5 para WebRTC (UDP) — muitos proxies suportam HTTP e SOCKS5 na mesma porta
  const rules =
    lastProxy.host && lastProxy.port
      ? `http=${lastProxy.host}:${lastProxy.port};https=${lastProxy.host}:${lastProxy.port};socks5=${lastProxy.host}:${lastProxy.port}`
      : 'direct://';

  await session.defaultSession.setProxy({
    proxyRules: rules,
    proxyBypassRules: lastProxy.bypass,
  });

  if (currentPartition) {
    await session.fromPartition(currentPartition).setProxy({
      proxyRules: rules,
      proxyBypassRules: lastProxy.bypass,
    });
  }

  // Aceita certs do proxy (Burp, etc) ou todos se IGNORE_SSL_CERTIFICATES (macOS costuma precisar)
  const acceptProxyCerts = shouldAcceptProxyCertificates() || IGNORE_SSL_CERTIFICATES === true;
  setSessionCertificateVerify(session.defaultSession, acceptProxyCerts);
  if (currentPartition) {
    setSessionCertificateVerify(session.fromPartition(currentPartition), acceptProxyCerts);
  }

  app.removeAllListeners('login');
  if (lastProxy.user) {
    app.on('login', (event, _wc, _req, authInfo, cb) => {
      if (authInfo.isProxy) {
        event.preventDefault();
        cb(lastProxy.user, lastProxy.pass || '');
      }
    });
  }
}

/* ================ AUTO-INJEÇÃO DE MÍDIA (substitui vídeo/imagem em uploads) ================= */
function setupMediaInjection(sess) {
  if (!AUTO_INJECT_MEDIA) return;
  
  // A injeção será feita via JavaScript no preload (mais confiável para multipart e JSON)
  // Esta função apenas prepara os dados para serem usados pelo código injetado
}

/* ================ TOOLBOX ================= */
function createToolbox() {
  if (toolboxWin) return;

  toolboxWin = new BrowserWindow({
    width: 460,
    height: 920,
    x: 20,
    y: 60,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-toolbox.js'),
      contextIsolation: true,
    },
  });

  toolboxWin.loadFile(path.join(__dirname, 'toolbox.html'));
  toolboxWin.show();
  toolboxWin.setAlwaysOnTop(true, 'screen-saver');

  toolboxWin.on('closed', () => {
    toolboxWin = null;
  });
}

/* ================ MAIN WINDOW (por perfil) ================= */
async function recreateMain(profileId) {
  const list = ensureProfiles();
  let targetId = profileId;

  if (!targetId || !getProfileById(targetId)) {
    targetId = list[0].id;
  }

  currentProfileId = targetId;
  currentPartition = partitionOf(currentProfileId);

  // Sincroniza timezone/idiomas do proxy (não bloqueia se falhar)
  if (lastProxy.host && lastProxy.port) {
    try {
      await syncFingerprintWithProxyGeo();
    } catch (_) {
      // Continua mesmo se o geo falhar — proxy deve funcionar
    }
  }

  if (mainWin) mainWin.destroy();

  // Aplica proxy e certificados SSL ANTES de criar a janela (Burp, mitmproxy, etc)
  await applyProxy({});

  const p = getProfileById(currentProfileId);
  const rawUrl = (p?.url || TCC_URL || '').toString().trim();
  const profileUrl = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : (TCC_URL || 'https://google.com');
  let fp = p?.fingerprint;
  if (!fp || typeof fp !== 'object') {
    fp = generateFingerprint(p?.fingerprint?.preset || 'iphone');
    if (p) upsertProfile({ ...p, fingerprint: fp });
  }
  const preset = fp.preset || 'iphone';

  const isMobilePreset = preset === 'android' || preset === 'iphone';
  const pixelRatio = typeof fp.pixelRatio === 'number' ? fp.pixelRatio : 2;
  const screenW = typeof fp.screenWidth === 'number' ? fp.screenWidth : 1170;
  const screenH = typeof fp.screenHeight === 'number' ? fp.screenHeight : 2532;
  const logicalW = isMobilePreset && ANDROID_EMULATE_VIEWPORT
    ? Math.floor(screenW / pixelRatio)
    : 1200;
  const logicalH = isMobilePreset && ANDROID_EMULATE_VIEWPORT
    ? Math.floor(screenH / pixelRatio)
    : 860;

  mainWin = new BrowserWindow({
    width: logicalW,
    height: logicalH,
    minWidth: isMobilePreset ? logicalW : 400,
    minHeight: isMobilePreset ? logicalH : 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload-main.js'),
      contextIsolation: true,
      partition: currentPartition,
    },
  });

  const sess = session.fromPartition(currentPartition);
  sess.setPermissionRequestHandler((_, __, cb) => cb(true));

  // Garante bypass de certificado na partição (Burp / IGNORE_SSL_CERTIFICATES)
  const acceptProxyCerts = shouldAcceptProxyCertificates() || IGNORE_SSL_CERTIFICATES === true;
  setSessionCertificateVerify(sess, acceptProxyCerts);

  // Guarda user-agent padrão (desktop) na primeira vez
  if (!defaultUserAgent) {
    defaultUserAgent = mainWin.webContents.getUserAgent();
  }

  const ua = getFingerprintUA(fp);
  const res = fp.width && fp.height ? { width: fp.width, height: fp.height } : getFingerprintRes(fp);
  lastRes = res;
  // Para mobile: site deve ver câmera realista (1920x1080). Viewport já é o tamanho lógico da janela.
  const cameraRes = isMobilePreset ? { width: 1920, height: 1080 } : res;

  mainWin.webContents.setUserAgent(ua);

  // WebRTC: sempre ativo — política 'default' garante que nunca seja bloqueado
  try {
    mainWin.webContents.setWebRTCIPHandlingPolicy('default');
  } catch (_) { /* fallback: Electron usa default se falhar */ }

  // Fingerprint para o preload injetar (deve ser setado ANTES de loadURL)
  currentFingerprintForPreload = fp;

  // Accept-Language header (sites como BrowserScan verificam)
  sess.webRequest.onBeforeSendHeaders(null);
  const acceptLang = Array.isArray(fp.languages) && fp.languages.length
    ? fp.languages.map((l, i) => i === 0 ? l : `${l};q=${(1 - i * 0.1).toFixed(1)}`).join(', ')
    : (fp.language || 'en-US');
  sess.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (d, cb) => {
    d.requestHeaders['Accept-Language'] = acceptLang;
    cb({ requestHeaders: d.requestHeaders });
  });

  // Auto-injeção de mídia (substitui vídeo/imagem em uploads)
  setupMediaInjection(sess);

  try {
    await mainWin.loadURL(profileUrl);
  } catch (loadErr) {
    const msg = friendlyLoadError(loadErr, profileUrl);
    if (mainWin && !mainWin.isDestroyed()) {
      dialog.showMessageBox(mainWin, { type: 'warning', title: 'Erro ao carregar', message: msg });
      mainWin.loadURL('about:blank').catch(() => {});
    } else {
      mainWin = null;
    }
    return;
  }

  // Reaplica fingerprint no main world em cada carregamento (dom-ready) — garante WebGL/screen antes do BrowserScan
  mainWin.webContents.on('dom-ready', () => {
    const fp = currentFingerprintForPreload;
    if (!fp || typeof fp !== 'object') return;
    const fJson = JSON.stringify(fp).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    const script = `
(function(){const f=${fJson};if(!f||typeof f!=='object')return;try{
if(f.platform)Object.defineProperty(navigator,'platform',{value:f.platform,configurable:true});
if(typeof f.hardwareConcurrency==='number')Object.defineProperty(navigator,'hardwareConcurrency',{value:f.hardwareConcurrency,configurable:true});
if(f.preset==='iphone')Object.defineProperty(navigator,'deviceMemory',{get:()=>undefined,configurable:true,enumerable:true});
else if(typeof f.deviceMemory==='number')Object.defineProperty(navigator,'deviceMemory',{value:f.deviceMemory,configurable:true});
if(f.vendor)Object.defineProperty(navigator,'vendor',{value:f.vendor,configurable:true});
if(f.product)Object.defineProperty(navigator,'product',{value:f.product,configurable:true});
if(typeof f.maxTouchPoints==='number')Object.defineProperty(navigator,'maxTouchPoints',{value:f.maxTouchPoints,configurable:true});
if(typeof f.screenWidth==='number'&&typeof f.screenHeight==='number'){
  Object.defineProperty(screen,'width',{get:()=>f.screenWidth,configurable:true,enumerable:true});
  Object.defineProperty(screen,'height',{get:()=>f.screenHeight,configurable:true,enumerable:true});
}
if(typeof f.availWidth==='number'&&typeof f.availHeight==='number'){
  Object.defineProperty(screen,'availWidth',{get:()=>f.availWidth,configurable:true,enumerable:true});
  Object.defineProperty(screen,'availHeight',{get:()=>f.availHeight,configurable:true,enumerable:true});
}
if(typeof f.colorDepth==='number')Object.defineProperty(screen,'colorDepth',{value:f.colorDepth,configurable:true,enumerable:true});
if(typeof f.pixelRatio==='number')Object.defineProperty(window,'devicePixelRatio',{get:()=>f.pixelRatio,configurable:true,enumerable:true});
if(f.webglVendor&&f.webglRenderer){
  [WebGLRenderingContext,WebGL2RenderingContext].forEach(function(C){
    if(typeof C==='undefined')return;var p=C&&C.prototype;if(!p||p.__fpPatched)return;
    var o=p.getParameter;if(!o)return;
    p.getParameter=function(x){if(x===37445)return f.webglVendor;if(x===37446)return f.webglRenderer;return o.call(this,x);};
    p.__fpPatched=true;
  });
}
}catch(e){}})();
`.trim();
    mainWin.webContents.executeJavaScript(script).catch(() => {});
    
    // Injeção de código para auto-substituição de vídeo/imagem em uploads + modificação de payloads
    if (AUTO_INJECT_MEDIA) {
      // Cria diretório de logs na pasta do projeto
      const logsDir = path.join(__dirname, '..', 'logs');
      try {
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
      } catch (e) {
        console.warn('Erro ao criar diretório de logs:', e);
      }
      
      const injectScript = `
(function() {
  if (window.__MEDIA_INJECTION_LOADED) {
    if (window.__ORIG_FETCH) window.fetch = window.__ORIG_FETCH;
    if (window.__ORIG_XHR_OPEN && window.__ORIG_XHR_SEND) {
      XMLHttpRequest.prototype.open = window.__ORIG_XHR_OPEN;
      XMLHttpRequest.prototype.send = window.__ORIG_XHR_SEND;
    }
  }
  window.__MEDIA_INJECTION_LOADED = true;
  
  let currentMedia = null;
  var driveModeOnly = false;
  
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'MEDIA_INJECTION_UPDATE') {
      currentMedia = e.data.media;
      console.log('[Media-Inject] ✅ Mídia atualizada:', currentMedia?.type, currentMedia?.filename);
    }
    if (e.data?.type === 'DRIVE_MODE_UPDATE') {
      driveModeOnly = !!e.data.enabled;
      console.log('[Media-Inject] Modo Drive:', driveModeOnly ? 'ON (só 6 campos)' : 'OFF (injeção + Veriff)');
    }
  });
  
  function applyDriveReplacements(text) {
    if (typeof text !== 'string') return text;
    return text
      .replace(/"manual_image_upload_required":\s*false/g, '"manual_image_upload_required":true')
      .replace(/"digital_document_upload":\s*false/g, '"digital_document_upload":true')
      .replace(/"backside_not_required":\s*false/g, '"backside_not_required":true')
      .replace(/"barcode_picture_web":\s*true/g, '"barcode_picture_web":false')
      .replace(/"barcode_picture":\s*true/g, '"barcode_picture":false')
      .replace(/"pdf417_barcode_enabled_web":\s*true/g, '"pdf417_barcode_enabled_web":false');
  }
  
  console.log('[Media-Inject] ✅ Script carregado');
  
  function processImageForLiveness(dataUrl) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (w <= 0 || h <= 0) { reject(new Error('invalid size')); return; }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        var t = Date.now() % 10000;
        var brightness = 1 + Math.sin(t * 0.001) * 0.02;
        var contrast = 1 + Math.cos(t * 0.0015) * 0.015;
        ctx.filter = 'brightness(' + brightness + ') contrast(' + contrast + ')';
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';
        var id = ctx.getImageData(0, 0, w, h);
        var d = id.data;
        var noiseAmount = 0.35;
        for (var i = 0; i < d.length; i += 4) {
          if (Math.random() < 0.1) {
            var n = (Math.random() - 0.5) * noiseAmount;
            d[i] = Math.min(255, Math.max(0, d[i] + n));
            d[i+1] = Math.min(255, Math.max(0, d[i+1] + n));
            d[i+2] = Math.min(255, Math.max(0, d[i+2] + n));
          }
        }
        ctx.putImageData(id, 0, 0);
        canvas.toBlob(function(blob) {
          if (!blob) { reject(new Error('toBlob failed')); return; }
          var now = new Date();
          var filename = 'IMG_' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0') + String(now.getSeconds()).padStart(2,'0') + '.jpg';
          var lastModified = now.getTime() - (Math.random() * 80);
          resolve({ blob: blob, filename: filename, lastModified: lastModified });
        }, 'image/jpeg', 0.92);
      };
      img.onerror = function() { reject(new Error('image load failed')); };
      img.src = dataUrl;
    });
  }
  
  const origFetch = window.fetch;
  window.__ORIG_FETCH = origFetch;
  window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1] || {};
    const method = (options.method || 'GET').toUpperCase();
    
    if (!driveModeOnly && currentMedia && currentMedia.dataUrl && (method === 'POST' || method === 'PUT') && options.body instanceof FormData) {
      const newFormData = new FormData();
      let replaced = false;
      
      for (const [key, value] of options.body.entries()) {
        if (value instanceof File && value.type.startsWith('image/')) {
          try {
            const out = await processImageForLiveness(currentMedia.dataUrl);
            const file = new File([out.blob], out.filename, {
              type: 'image/jpeg',
              lastModified: out.lastModified
            });
            newFormData.append(key, file);
            replaced = true;
            console.log('[Auto-Inject] ✅ Imagem substituída (liveness) em fetch:', url, 'campo:', key);
          } catch (e) {
            try {
              const blob = await fetch(currentMedia.dataUrl).then(r => r.blob());
              const file = new File([blob], currentMedia.filename || 'image.jpg', { type: blob.type || 'image/jpeg', lastModified: Date.now() });
              newFormData.append(key, file);
              replaced = true;
            } catch (e2) {
              console.error('[Auto-Inject] Erro:', e2);
              newFormData.append(key, value);
            }
          }
        } else {
          newFormData.append(key, value);
        }
      }
      
      if (replaced) {
        options.body = newFormData;
      }
    }
    
    const response = await origFetch.apply(this, args);
    
    if (driveModeOnly && response.ok) {
      try {
        var respText = await response.clone().text();
        var modified = applyDriveReplacements(respText);
        if (modified !== respText) {
          return new Response(modified, { status: response.status, statusText: response.statusText, headers: response.headers });
        }
      } catch (e) {}
      return response;
    }
    
    var urlStr = String(url || '').toLowerCase();
    var isVeriff = urlStr.includes('veriff') || urlStr.includes('/verifications/') || urlStr.includes('/sessions/') || urlStr.includes('/decision') || urlStr.includes('/grasp');
    if (!driveModeOnly && isVeriff && response.ok) {
      try {
        var text = await response.clone().text();
        var json = JSON.parse(text);
        var changed = false;
        if (json.status !== undefined && json.status !== 'approved') {
          json.status = 'approved';
          json.code = 9001;
          changed = true;
        }
        if (json.verification) {
          if (json.verification.status !== 'approved') {
            json.verification.status = 'approved';
            json.verification.code = 9001;
            json.verification.reason = null;
            json.verification.reasonCode = null;
            changed = true;
          }
        } else {
          json.verification = { status: 'approved', code: 9001, reason: null, reasonCode: null };
          changed = true;
        }
        if (changed) {
          return new Response(JSON.stringify(json), { status: response.status, statusText: response.statusText, headers: response.headers });
        }
      } catch (e) {}
    }
    return response;
  };
  
  if (!window.__ORIG_XHR_OPEN) {
    window.__ORIG_XHR_OPEN = XMLHttpRequest.prototype.open;
    window.__ORIG_XHR_SEND = XMLHttpRequest.prototype.send;
  }
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__method = method;
    this.__url = url;
    return window.__ORIG_XHR_OPEN.call(this, method, url, ...rest);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    if (!driveModeOnly && currentMedia && currentMedia.dataUrl && (this.__method === 'POST' || this.__method === 'PUT') && body instanceof FormData) {
      const newFormData = new FormData();
      let replaced = false;
      
      for (const [key, value] of body.entries()) {
        if (value instanceof File && value.type.startsWith('image/')) {
          var xhrImg = this;
          var urlImg = this.__url;
          var xhrRef = this;
          xhrImg.addEventListener('load', function() {
            if (xhrImg.responseType === '' || xhrImg.responseType === 'text') {
              var mod = maybeApproveVeriffResponse(urlImg, xhrImg.responseText);
              if (mod != null) {
                try {
                  Object.defineProperty(xhrImg, 'responseText', { value: mod, writable: false });
                } catch (err) {}
              }
            }
          }, true);
          processImageForLiveness(currentMedia.dataUrl).then(function(out) {
            var file = new File([out.blob], out.filename, { type: 'image/jpeg', lastModified: out.lastModified });
            var finalFormData = new FormData();
            for (var entry of body.entries()) {
              if (entry[0] === key && entry[1] === value) {
                finalFormData.append(entry[0], file);
              } else {
                finalFormData.append(entry[0], entry[1]);
              }
            }
            window.__ORIG_XHR_SEND.call(xhrRef, finalFormData);
          }).catch(function() {
            fetch(currentMedia.dataUrl).then(function(r) { return r.blob(); }).then(function(blob) {
              var file = new File([blob], currentMedia.filename || 'image.jpg', { type: blob.type || 'image/jpeg', lastModified: Date.now() });
              var fd = new FormData();
              for (var e of body.entries()) {
                fd.append(e[0], e[0] === key && e[1] === value ? file : e[1]);
              }
              window.__ORIG_XHR_SEND.call(xhrRef, fd);
            }).catch(function() {
              window.__ORIG_XHR_SEND.call(xhrRef, body);
            });
          });
          return;
        }
      }
    }
    
    var xhr = this;
    var reqUrl = this.__url;
    xhr.addEventListener('load', function() {
      if (xhr.responseType === '' || xhr.responseType === 'text') {
        var modified = driveModeOnly ? applyDriveReplacements(xhr.responseText) : maybeApproveVeriffResponse(reqUrl, xhr.responseText);
        if (driveModeOnly ? (modified !== xhr.responseText) : (modified != null)) {
          try {
            Object.defineProperty(xhr, 'responseText', { value: modified, writable: false });
          } catch (e) {}
        }
      }
    }, true);
    return window.__ORIG_XHR_SEND.call(this, body);
  };
  
  function maybeApproveVeriffResponse(url, text) {
    if (!url || typeof text !== 'string') return null;
    var urlStr = String(url).toLowerCase();
    var isVeriff = urlStr.includes('veriff') || urlStr.includes('/verifications/') || urlStr.includes('/sessions/') || urlStr.includes('/decision') || urlStr.includes('/grasp');
    if (!isVeriff) return null;
    try {
      var json = JSON.parse(text);
      var changed = false;
      if (json.status !== undefined && json.status !== 'approved') {
        json.status = 'approved';
        json.code = 9001;
        changed = true;
      }
      if (json.verification) {
        if (json.verification.status !== 'approved') {
          json.verification.status = 'approved';
          json.verification.code = 9001;
          json.verification.reason = null;
          json.verification.reasonCode = null;
          changed = true;
        }
      } else {
        json.verification = { status: 'approved', code: 9001, reason: null, reasonCode: null };
        changed = true;
      }
      return changed ? JSON.stringify(json) : null;
    } catch (e) {
      return null;
    }
  }
})();
      `.trim();
      storedUploadInjectionScript = injectScript;
      mainWin.webContents.executeJavaScript(injectScript).catch(() => {});
      
      // Envia mídia inicial se já estiver configurada
      // Aguarda um pouco para garantir que o listener está pronto
      setTimeout(() => {
        if (currentMediaForInjection.type && currentMediaForInjection.data) {
          const dataUrl = `data:${currentMediaForInjection.mime};base64,${currentMediaForInjection.data.toString('base64')}`;
          const filename = currentMediaForInjection.path ? path.basename(currentMediaForInjection.path) : (currentMediaForInjection.filename || null);
          console.log('[Media-Inject] Enviando mídia para página:', currentMediaForInjection.type, filename || 'sem nome');
          mainWin.webContents.executeJavaScript(`
            window.postMessage({
              type: 'MEDIA_INJECTION_UPDATE',
              media: {
                type: ${JSON.stringify(currentMediaForInjection.type)},
                dataUrl: ${JSON.stringify(dataUrl)},
                mime: ${JSON.stringify(currentMediaForInjection.mime)},
                filename: ${JSON.stringify(filename)}
              }
            }, '*');
            window.postMessage({ type: 'DRIVE_MODE_UPDATE', enabled: ${driveModeEnabled} }, '*');
            console.log('[Media-Inject] Mensagem MEDIA_INJECTION_UPDATE enviada');
          `).catch((e) => {
            console.error('[Media-Inject] Erro ao enviar mídia:', e);
          });
        } else {
          mainWin.webContents.executeJavaScript(`window.postMessage({ type: 'DRIVE_MODE_UPDATE', enabled: ${driveModeEnabled} }, '*');`).catch(() => {});
          console.log('[Media-Inject] ⚠️  Nenhuma mídia configurada para injeção (currentMediaForInjection.type:', currentMediaForInjection.type + ')');
        }
      }, 100);
    }
  });

  // Envia mídia também após cada navegação (did-finish-load)
  const sendMediaUpdate = () => {
    // Aguarda um pouco para garantir que o script de injeção está pronto
    setTimeout(() => {
      if (currentMediaForInjection.type && currentMediaForInjection.data && mainWin && !mainWin.isDestroyed()) {
        const dataUrl = `data:${currentMediaForInjection.mime};base64,${currentMediaForInjection.data.toString('base64')}`;
        const filename = currentMediaForInjection.path ? path.basename(currentMediaForInjection.path) : (currentMediaForInjection.filename || null);
        console.log('[Media-Inject] Enviando mídia após navegação:', currentMediaForInjection.type, filename || 'sem nome');
        mainWin.webContents.executeJavaScript(`
          window.postMessage({
            type: 'MEDIA_INJECTION_UPDATE',
            media: {
              type: ${JSON.stringify(currentMediaForInjection.type)},
              dataUrl: ${JSON.stringify(dataUrl)},
              mime: ${JSON.stringify(currentMediaForInjection.mime)},
              filename: ${JSON.stringify(filename)}
            }
          }, '*');
          window.postMessage({ type: 'DRIVE_MODE_UPDATE', enabled: ${driveModeEnabled} }, '*');
          console.log('[Media-Inject] MEDIA_INJECTION_UPDATE enviado após navegação');
        `).catch((e) => {
          console.error('[Media-Inject] Erro ao enviar mídia após navegação:', e);
        });
      } else {
        mainWin.webContents.executeJavaScript(`window.postMessage({ type: 'DRIVE_MODE_UPDATE', enabled: ${driveModeEnabled} }, '*');`).catch(() => {});
      }
    }, 200);
  };
  
  mainWin.webContents.on('did-finish-load', sendMediaUpdate);
  
  // Injeta em iframes: script de UPLOAD (fetch/XHR) + fakecam (evita tela preta). Veriff faz o upload de dentro do iframe.
  mainWin.webContents.on('did-frame-finish-load', (_event, isMainFrame, frameProcessId, frameRoutingId) => {
    if (isMainFrame) return;
    try {
      const { webFrameMain } = require('electron');
      const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
      if (!frame) return;
      const runAfterUpload = () => {
        if (currentMediaForInjection.type && currentMediaForInjection.data) {
          const dataUrl = `data:${currentMediaForInjection.mime};base64,${currentMediaForInjection.data.toString('base64')}`;
          const filename = currentMediaForInjection.path ? path.basename(currentMediaForInjection.path) : (currentMediaForInjection.filename || null);
          frame.executeJavaScript(`
            window.postMessage({
              type: 'MEDIA_INJECTION_UPDATE',
              media: {
                type: ${JSON.stringify(currentMediaForInjection.type)},
                dataUrl: ${JSON.stringify(dataUrl)},
                mime: ${JSON.stringify(currentMediaForInjection.mime)},
                filename: ${JSON.stringify(filename)}
              }
            }, '*');
            window.postMessage({ type: 'DRIVE_MODE_UPDATE', enabled: ${driveModeEnabled} }, '*');
          `).catch(() => {});
        } else {
          frame.executeJavaScript(`window.postMessage({ type: 'DRIVE_MODE_UPDATE', enabled: ${driveModeEnabled} }, '*');`).catch(() => {});
        }
      };
      // 1) Script que intercepta fetch/XHR e escuta MEDIA_INJECTION_UPDATE
      if (storedUploadInjectionScript) {
        frame.executeJavaScript(storedUploadInjectionScript).then(() => {
          console.log('[Upload-Inject] ✅ Script de upload injetado em iframe:', frame.url || 'unknown');
          // Envia a imagem imediatamente após injetar o script
          runAfterUpload();
          // Envia novamente após um delay para garantir
          setTimeout(runAfterUpload, 200);
        }).catch((e) => {
          const errMsg = (e && (e.message || e.toString)) ? (e.message || e.toString()) : String(e);
          const errStack = e && e.stack;
          console.warn('[Upload-Inject] Erro ao injetar script em iframe:', errMsg);
          if (errStack) console.warn('[Upload-Inject] Stack:', errStack);
          // Tenta pelo menos enviar a mídia para o iframe (postMessage) — às vezes o script já está lá por outro caminho
          runAfterUpload();
        });
      } else if (AUTO_INJECT_MEDIA) {
        // Se AUTO_INJECT_MEDIA está true mas o script ainda não foi guardado, aguarda um pouco
        console.log('[Upload-Inject] ⚠️ Script ainda não está pronto, aguardando...');
        setTimeout(() => {
          if (storedUploadInjectionScript) {
            frame.executeJavaScript(storedUploadInjectionScript).then(() => {
              console.log('[Upload-Inject] ✅ Script de upload injetado em iframe (retry):', frame.url || 'unknown');
              runAfterUpload();
            }).catch((e) => {
              console.warn('[Upload-Inject] Erro ao injetar em iframe (retry):', e?.message || e);
            });
          }
        }, 500);
      } else {
        console.log('[Upload-Inject] ⚠️ AUTO_INJECT_MEDIA está false, script não será injetado');
      }
      // 2) Fakecam no iframe (evita tela preta)
      if (storedFakecamScript) {
        frame.executeJavaScript(storedFakecamScript).then(() => {
          if (currentFakecamImageDataUrl) {
            frame.executeJavaScript(
              `window.postMessage({ __FAKECAM__: true, type: 'SET_IMAGE', dataUrl: ${JSON.stringify(currentFakecamImageDataUrl)} }, '*');`
            ).catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('[Upload-Inject] did-frame-finish-load:', e.message);
    }
  });
  
  mainWin.webContents.once('did-finish-load', () => {
    let dataUrl = '';

    if (DEFAULT_IMAGE_PATH && fs.existsSync(DEFAULT_IMAGE_PATH)) {
      const buf = fs.readFileSync(DEFAULT_IMAGE_PATH);
      const ext = path.extname(DEFAULT_IMAGE_PATH).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    }

    const baseW = cameraRes.width || BASE_W;
    const baseH = cameraRes.height || BASE_H;

    // Bootstrap da fakecam: mobile = resolução de câmera real (1920x1080), desktop = fingerprint
    currentFakecamImageDataUrl = dataUrl || '';
    mainWin.webContents.send('fakecam:bootstrap', {
      BASE_W: baseW,
      BASE_H: baseH,
      FPS,
      initialDataUrl: dataUrl,
    });

    mainWin.webContents.send('fakecam:setResolution', cameraRes);

    // Informa perfil atual ao toolbox
    toolboxWin?.webContents.send('identity:current', {
      id: currentProfileId,
      name: p?.name || '',
      url: profileUrl,
      fingerprint: fp,
    });

    createToolbox();
  });

  mainWin.on('closed', () => {
    mainWin = null;
  });
}

/* ================ FINGERPRINT (sync para preload) ================= */
ipcMain.on('fingerprint:get', (event) => {
  event.returnValue = currentFingerprintForPreload || null;
});

/* ================ APP ================= */
app.whenReady().then(async () => {
  loadBurpCaFingerprint();

  // DNS-over-HTTPS: ajuda a resolver turn*.veriff.me (-105).
  try {
    app.configureHostResolver({
      secureDnsMode: 'automatic',
      secureDnsServers: [
        'https://dns.google/dns-query',
        'https://cloudflare-dns.com/dns-query',
      ],
    });
  } catch (e) {
    console.warn('configureHostResolver:', e?.message || e);
  }

  const list = ensureProfiles();
  if (!currentProfileId) currentProfileId = list[0].id;
  currentPartition = partitionOf(currentPartition);

  createToolbox();

  if (REQUIRE_PROXY_LOGIN) {
    loginWin = new BrowserWindow({
      width: 420,
      height: 520,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload-login.js'),
        contextIsolation: true,
      },
    });

    loginWin.loadFile(path.join(__dirname, 'login.html'));
  } else {
    await recreateMain(currentProfileId);
  }
});

/* ================ GEO VIA PROXY (timezone + idiomas) ================= */
const GEO_FETCH_TIMEOUT_MS = 5000;

async function fetchGeoFromProxy() {
  if (!lastProxy.host || !lastProxy.port) return null;
  // Tela inicial: mainWin não existe — usa defaultSession (proxy já aplicado)
  const sess = mainWin?.webContents?.session ?? session.defaultSession;
  const tryFetch = async (url, parser) => {
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), GEO_FETCH_TIMEOUT_MS)
      );
      const res = await Promise.race([sess.fetch(url), timeout]);
      if (!res.ok) return null;
      const data = await res.json();
      return parser(data);
    } catch (e) {
      return null;
    }
  };
  let geo = await tryFetch('http://ip-api.com/json?fields=timezone,countryCode', (d) =>
    d.timezone && d.countryCode ? { timezone: d.timezone, countryCode: d.countryCode } : null
  );
  if (!geo) {
    geo = await tryFetch('https://ipapi.co/json/', (d) =>
      d.timezone && d.country_code ? { timezone: d.timezone, countryCode: d.country_code } : null
    );
  }
  return geo;
}

async function syncFingerprintWithProxyGeo() {
  if (!lastProxy.host || !lastProxy.port) return;
  const geo = await fetchGeoFromProxy();
  if (!geo) return;
  const p = getProfileById(currentProfileId);
  if (!p?.fingerprint) return;
  const updated = applyGeoToFingerprint(p.fingerprint, geo);
  upsertProfile({ ...p, fingerprint: updated });
}

/* ================ IPC PROXY ================= */
function friendlyProxyError(e) {
  const code = e?.code || e?.errno;
  if (code === 'ERR_PROXY_CONNECTION_FAILED' || code === -130) {
    return new Error('Conexão com o proxy falhou. Verifique: 1) Burp está rodando? 2) Host 127.0.0.1 e porta 8080? 3) Ou use Pular para continuar sem proxy.');
  }
  if (code === 'ERR_TUNNEL_CONNECTION_FAILED' || code === 'ERR_CONNECTION_REFUSED') {
    return new Error('Proxy recusou a conexão. Verifique se o Burp está ativo e host/porta estão corretos.');
  }
  if (code === 'ERR_FAILED' || e?.errno === -2) {
    return new Error('Falha ao carregar (certificado SSL ou proxy). Certifique-se que IGNORE_SSL_CERTIFICATES: true em config.js.');
  }
  if (code === 'ERR_ABORTED' || e?.errno === -3) {
    return new Error('Navegação cancelada. Tente novamente.');
  }
  if (code === 'ERR_INVALID_URL' || code === -300) {
    return new Error('URL inválida. Verifique a URL do perfil em config.js (TCC_URL) ou na toolbox.');
  }
  return new Error(e?.message || String(e));
}

ipcMain.handle('proxy:apply', async (_event, cfg) => {
  await applyProxy(cfg);
  try {
    await syncFingerprintWithProxyGeo(); // timeout 5s — não trava
    await recreateMain(currentProfileId);
    loginWin?.close();
  } catch (e) {
    throw friendlyProxyError(e);
  }
});

ipcMain.handle('proxy:skip', async () => {
  await applyProxy({ host: '', port: '', user: '', pass: '' });
  await recreateMain(currentProfileId);
  loginWin?.close();
});

// Trocar proxy durante a sessão (sem fechar o app)
ipcMain.handle('proxy:get', () => ({
  host: lastProxy.host || '',
  port: lastProxy.port || '',
  user: lastProxy.user || '',
}));

ipcMain.handle('proxy:change', async (_event, cfg) => {
  await applyProxy(cfg);
  // Apenas troca o proxy — janela e página permanecem; novas requisições usam o proxy novo
});

/* ================ FAKECAM IPC ================= */
ipcMain.on('fakecam:updateParams', (_event, p) => {
  mainWin?.webContents.send('fakecam:params', p);
});

ipcMain.on('fakecam:setImageDataUrl', (_event, d) => {
  mainWin?.webContents.send('fakecam:setImageDataUrl', d);
  currentFakecamImageDataUrl = d || '';
});

ipcMain.on('fakecam:injectionScript', (_event, script) => {
  if (script && typeof script === 'string') {
    storedFakecamScript = script;
    console.log('[Fakecam] Script recebido para injeção em iframes');
  }
});

ipcMain.on('fakecam:setImageDataUrlBroadcast', (_event, url) => {
  currentFakecamImageDataUrl = url || '';
  if (!mainWin || mainWin.isDestroyed()) return;
  const code = `window.postMessage({ __FAKECAM__: true, type: 'SET_IMAGE', dataUrl: ${JSON.stringify(url)} }, '*');`;
  try {
    const wc = mainWin.webContents;
    if (wc.mainFrame && wc.mainFrame.frames) {
      wc.mainFrame.frames.forEach((frame) => {
        if (frame !== wc.mainFrame) {
          frame.executeJavaScript(code).catch(() => {});
        }
      });
    }
  } catch (e) {
    console.warn('[Fakecam] Erro ao enviar imagem para iframes:', e);
  }
});

ipcMain.on('fakecam:setVideoDataUrl', (_event, d) => {
  mainWin?.webContents.send('fakecam:setVideoDataUrl', d);
});

// Grava a mídia atual num arquivo no projeto e em burp-replacement-path.txt para a extensão do Burp usar
function writeMediaForBurp(data, mime, filename) {
  const ext = (mime === 'image/png' ? '.png' : mime === 'image/jpeg' ? '.jpg' : mime === 'video/mp4' ? '.mp4' : '.jpg');
  const outPath = path.join(projectRoot, 'burp-replacement' + ext);
  fs.writeFileSync(outPath, data);
  fs.writeFileSync(BURP_REPLACEMENT_PATH_FILE, outPath, 'utf8');
  console.log('[Burp] Imagem salva para o Burp:', outPath);
}

// Handler para auto-injeção: recebe caminho do arquivo e atualiza currentMediaForInjection
ipcMain.handle('media:setForInjection', async (_event, { type, filePath }) => {
  if (!type || !filePath) {
    currentMediaForInjection = { type: null, data: null, mime: null, path: null };
    return { success: true, message: 'Mídia de injeção removida' };
  }
  
  if (!fs.existsSync(filePath)) {
    return { success: false, message: 'Arquivo não encontrado: ' + filePath };
  }
  
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    const mime = mimeTypes[ext] || (type === 'video' ? 'video/mp4' : 'image/jpeg');
    
    currentMediaForInjection = {
      type: type,
      data: data,
      mime: mime,
      path: filePath,
    };
    
    writeMediaForBurp(data, mime, path.basename(filePath));
    console.log(`[Auto-Inject] Mídia configurada: ${type} (${mime}), ${data.length} bytes`);
    
    if (mainWin && !mainWin.isDestroyed()) {
      const dataUrl = `data:${mime};base64,${data.toString('base64')}`;
      mainWin.webContents.executeJavaScript(`
        window.postMessage({
          type: 'MEDIA_INJECTION_UPDATE',
          media: {
            type: ${JSON.stringify(type)},
            dataUrl: ${JSON.stringify(dataUrl)},
            mime: ${JSON.stringify(mime)},
            filename: ${JSON.stringify(path.basename(filePath))}
          }
        }, '*');
      `).catch(() => {});
    }
    
    return { success: true, message: `Mídia configurada: ${path.basename(filePath)}` };
  } catch (e) {
    return { success: false, message: 'Erro ao ler arquivo: ' + (e?.message || e) };
  }
});

// Configura mídia para injeção a partir de data URL (ex.: quando usuário escolhe imagem pelo botão 📷)
ipcMain.handle('media:setForInjectionFromDataUrl', async (_event, { type, dataUrl, filename }) => {
  if (!type || !dataUrl || typeof dataUrl !== 'string') {
    currentMediaForInjection = { type: null, data: null, mime: null, path: null };
    return { success: true, message: 'Mídia de injeção removida' };
  }
  try {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return { success: false, message: 'Data URL inválida' };
    }
    const mime = match[1].trim();
    const base64 = match[2];
    const data = Buffer.from(base64, 'base64');
    const name = filename || (type === 'image' ? 'image.jpg' : 'video.mp4');

    currentMediaForInjection = {
      type: type,
      data: data,
      mime: mime,
      path: null,
      filename: name,
    };

    writeMediaForBurp(data, mime, name);
    console.log(`[Auto-Inject] Mídia configurada a partir de data URL: ${type} (${mime}), ${data.length} bytes`);

    // Envia para TODOS os frames (main + iframes) imediatamente
    const sendToAllFrames = () => {
      if (!mainWin || mainWin.isDestroyed()) return;
      
      const script = `
        window.postMessage({
          type: 'MEDIA_INJECTION_UPDATE',
          media: {
            type: ${JSON.stringify(type)},
            dataUrl: ${JSON.stringify(dataUrl)},
            mime: ${JSON.stringify(mime)},
            filename: ${JSON.stringify(name)}
          }
        }, '*');
        window.postMessage({ type: 'DRIVE_MODE_UPDATE', enabled: ${driveModeEnabled} }, '*');
        console.log('[Auto-Inject] MEDIA_INJECTION_UPDATE enviado para frame:', window.location.href);
      `;
      
      // Envia para main frame
      mainWin.webContents.executeJavaScript(script).catch((e) => {
        console.error('[Auto-Inject] Erro ao enviar para main frame:', e);
      });
      
      // Os iframes receberão a mensagem quando forem criados via did-frame-finish-load
      // Não tentamos enviar para todos os frames aqui porque getAllFrames não existe nesta versão do Electron
    };
    
    // Envia imediatamente e também após um pequeno delay para garantir que listeners estão prontos
    sendToAllFrames();
    setTimeout(sendToAllFrames, 100);
    setTimeout(sendToAllFrames, 500);

    return { success: true, message: `Imagem configurada para injeção: ${name}` };
  } catch (e) {
    return { success: false, message: 'Erro ao processar data URL: ' + (e?.message || e) };
  }
});

// Handler para obter dados da mídia atual (usado pelo preload)
ipcMain.handle('media:getForInjection', () => {
  if (!currentMediaForInjection.type || !currentMediaForInjection.data) {
    return null;
  }
  return {
    type: currentMediaForInjection.type,
    dataUrl: `data:${currentMediaForInjection.mime};base64,${currentMediaForInjection.data.toString('base64')}`,
    mime: currentMediaForInjection.mime,
    filename: currentMediaForInjection.path ? path.basename(currentMediaForInjection.path) : (currentMediaForInjection.filename || null),
  };
});

ipcMain.handle('drive-mode:get', () => driveModeEnabled);
ipcMain.handle('drive-mode:set', (_event, enabled) => {
  driveModeEnabled = !!enabled;
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.executeJavaScript(`
      window.postMessage({ type: 'DRIVE_MODE_UPDATE', enabled: ${driveModeEnabled} }, '*');
      for (var i = 0; i < window.frames.length; i++) { try { window.frames[i].postMessage({ type: 'DRIVE_MODE_UPDATE', enabled: ${driveModeEnabled} }, '*'); } catch(e) {} }
    `).catch(() => {});
  }
  return driveModeEnabled;
});

// Handler para obter logs de upload da janela principal
ipcMain.handle('logs:getUploadLogs', async () => {
  if (!mainWin || mainWin.isDestroyed()) {
    return { logs: [], error: 'Janela principal não está disponível' };
  }
  
  try {
    const logs = await mainWin.webContents.executeJavaScript(`
      (function() {
        if (typeof window.__UPLOAD_LOGS !== 'undefined') {
          return window.__UPLOAD_LOGS || [];
        }
        return [];
      })()
    `);
    
    return { logs: logs || [], error: null };
  } catch (e) {
    return { logs: [], error: e.message };
  }
});

// Handler para salvar logs em arquivo
ipcMain.handle('logs:saveUploadLogs', async () => {
  if (!mainWin || mainWin.isDestroyed()) {
    return { success: false, error: 'Janela principal não está disponível' };
  }
  
  try {
    const logs = await mainWin.webContents.executeJavaScript(`
      (function() {
        if (typeof window.__UPLOAD_LOGS !== 'undefined') {
          return window.__UPLOAD_LOGS || [];
        }
        return [];
      })()
    `);
    
    if (!logs || logs.length === 0) {
      return { success: false, error: 'Nenhum log encontrado' };
    }
    
    // Salva na pasta do projeto
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, `upload-logs-${Date.now()}.json`);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
    
    return { success: true, file: logFile, count: logs.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Handler para receber logs do renderer e salvar automaticamente na pasta do projeto
ipcMain.on('logs:saveToFile', async (_event, logs) => {
  try {
    if (!logs || logs.length === 0) return;
    
    // Cria diretório de logs na pasta do projeto
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Arquivo de log único por sessão (sobrescreve para manter atualizado)
    const sessionLogFile = path.join(logsDir, 'upload-logs-session.json');
    
    // Lê logs existentes se houver
    let allLogs = [];
    if (fs.existsSync(sessionLogFile)) {
      try {
        const existing = fs.readFileSync(sessionLogFile, 'utf8');
        allLogs = JSON.parse(existing);
      } catch (e) {
        // Se houver erro ao ler, começa do zero
        allLogs = [];
      }
    }
    
    // Adiciona novos logs (evita duplicatas por timestamp)
    const existingTimestamps = new Set(allLogs.map(l => l.timestamp));
    logs.forEach(log => {
      if (!existingTimestamps.has(log.timestamp)) {
        allLogs.push(log);
      }
    });
    
    // Mantém apenas os últimos 500 logs
    if (allLogs.length > 500) {
      allLogs = allLogs.slice(-500);
    }
    
    // Salva arquivo de sessão
    fs.writeFileSync(sessionLogFile, JSON.stringify(allLogs, null, 2), 'utf8');
    
    // Também salva um arquivo timestamped para histórico
    const timestampedFile = path.join(logsDir, `upload-logs-${Date.now()}.json`);
    fs.writeFileSync(timestampedFile, JSON.stringify(logs, null, 2), 'utf8');
    
    console.log(`[Logs] Salvos ${logs.length} logs em ${sessionLogFile}`);
  } catch (e) {
    console.warn('[Logs] Erro ao salvar logs:', e);
  }
});

// Handler para abrir dialog de seleção de arquivo para injeção
ipcMain.handle('media:selectFileForInjection', async (_event, { type }) => {
  const result = await dialog.showOpenDialog(mainWin || toolboxWin, {
    title: `Selecionar ${type === 'video' ? 'vídeo' : 'imagem'} para auto-injeção`,
    filters: [
      { name: type === 'video' ? 'Vídeos' : 'Imagens', extensions: type === 'video' ? ['mp4', 'webm', 'mov'] : ['jpg', 'jpeg', 'png'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { success: false, message: 'Nenhum arquivo selecionado' };
  }
  
  const filePath = result.filePaths[0];
  // Chama diretamente a lógica de setForInjection
  if (!fs.existsSync(filePath)) {
    return { success: false, message: 'Arquivo não encontrado: ' + filePath };
  }
  
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    const mime = mimeTypes[ext] || (type === 'video' ? 'video/mp4' : 'image/jpeg');
    
    currentMediaForInjection = {
      type: type,
      data: data,
      mime: mime,
      path: filePath,
    };
    
    console.log(`[Auto-Inject] Mídia configurada: ${type} (${mime}), ${data.length} bytes`);
    
    // Envia atualização para a página via postMessage (se já carregada)
    if (mainWin && !mainWin.isDestroyed()) {
      const dataUrl = `data:${mime};base64,${data.toString('base64')}`;
      mainWin.webContents.executeJavaScript(`
        window.postMessage({
          type: 'MEDIA_INJECTION_UPDATE',
          media: {
            type: ${JSON.stringify(type)},
            dataUrl: ${JSON.stringify(dataUrl)},
            mime: ${JSON.stringify(mime)},
            filename: ${JSON.stringify(path.basename(filePath))}
          }
        }, '*');
      `).catch(() => {});
    }
    
    return { success: true, message: `Mídia configurada: ${path.basename(filePath)}` };
  } catch (e) {
    return { success: false, message: 'Erro ao ler arquivo: ' + (e?.message || e) };
  }
});

ipcMain.on('fakecam:setResolution', (_event, r) => {
  lastRes = r;
  mainWin?.webContents.send('fakecam:setResolution', r);
});

/* ================ NAVEGAÇÃO (URL + test-cam.html) ================= */
function friendlyLoadError(e, url) {
  const code = e?.code || e?.errno;
  if (code === 'ERR_TIMED_OUT' || e?.errno === -7) {
    return 'Timeout. Com Burp: desative "Intercept is on" ou clique em Forward.';
  }
  if (code === 'ERR_ABORTED' || e?.errno === -3) {
    return 'Navegação cancelada (clicou em outro link antes de carregar).';
  }
  if (code === 'ERR_PROXY_CONNECTION_FAILED' || code === 'ERR_TUNNEL_CONNECTION_FAILED') {
    return 'Proxy recusou. Burp está rodando? Host 127.0.0.1 e porta 8080?';
  }
  if (code === 'ERR_FAILED' || e?.errno === -2) {
    return 'Falha ao carregar (SSL/proxy). Verifique IGNORE_SSL_CERTIFICATES: true em config.js.';
  }
  return e?.message || String(e);
}

ipcMain.handle('browser:navigate', async (_event, payload) => {
  if (!mainWin) return;

  const { type, url } = payload || {};

  if (type === 'external') {
    if (!url) return;
    let finalUrl = String(url).trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    try {
      await mainWin.loadURL(finalUrl);
    } catch (e) {
      const msg = friendlyLoadError(e, finalUrl);
      dialog.showMessageBox(mainWin, { type: 'warning', title: 'Erro ao carregar', message: msg });
    }
  }

  if (type === 'local' && url === 'test-cam') {
    await mainWin.loadFile(path.join(__dirname, 'test-cam.html'));
  }
});

ipcMain.handle('shortcuts:list', () => {
  const list = CONFIG_SHORTCUTS;
  return Array.isArray(list) ? list : [];
});

/* ================ USER-AGENT PRESETS (Android / iPhone / Desktop) ================= */
ipcMain.handle('browser:setUserAgentPreset', async (_event, preset) => {
  if (!mainWin) return;

  if (!defaultUserAgent) {
    defaultUserAgent = mainWin.webContents.getUserAgent();
  }

  let ua = defaultUserAgent;
  let res = null;

  if (preset === 'android') {
    ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36';
    res = { width: 1920, height: 1080 };
  } else if (preset === 'iphone') {
    ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    res = { width: 1920, height: 1080 };
  } else if (preset === 'desktop') {
    ua = defaultUserAgent;
    res = { width: BASE_W, height: BASE_H };
  }

  try {
    mainWin.webContents.setUserAgent(ua);

    if (res) {
      lastRes = res;
      mainWin.webContents.send('fakecam:setResolution', res);
    }

    mainWin.webContents.reload();
  } catch (e) {
    console.error('Erro ao aplicar UA/resolução:', e);
  }
});

/* ================ IPC PERFIS ================= */
ipcMain.handle('identity:new', async (_event, payload) => {
  const nameRaw = payload && typeof payload.name === 'string' ? payload.name : '';
  const id = randomUUID();
  const profile = {
    id,
    name: nameRaw.trim() || `Perfil ${id.slice(0, 8)}`,
    url: TCC_URL,
    fingerprint: generateFingerprint('iphone'),
  };

  upsertProfile(profile);
  currentProfileId = id;

  await recreateMain(id);
  return { id, name: profile.name };
});

ipcMain.handle('identity:get', () => {
  const p = getProfileById(currentProfileId);
  let fp = p?.fingerprint;
  // Garante fingerprint persistido: nunca retorna valor temporário/aleatório
  if (!fp || typeof fp !== 'object') {
    fp = generateFingerprint(p?.fingerprint?.preset || 'iphone');
    if (p) upsertProfile({ ...p, fingerprint: fp });
  }
  return {
    id: currentProfileId,
    name: p?.name || '',
    url: p?.url || TCC_URL,
    fingerprint: fp,
  };
});

ipcMain.handle('profiles:list', () => {
  const raw = ensureProfiles();
  const list = raw.map((p) => normalizeProfile(p));
  if (!currentProfileId || !getProfileById(currentProfileId)) {
    currentProfileId = list[0]?.id;
  }
  return {
    list,
    currentId: currentProfileId,
  };
});

ipcMain.handle('profiles:switch', async (_event, { id }) => {
  if (!id || id === currentProfileId) return;
  const p = getProfileById(id);
  if (!p) return;
  const prevId = currentProfileId;
  currentProfileId = id;
  try {
    await recreateMain(id);
  } catch (e) {
    currentProfileId = prevId;
    const msg = friendlyProxyError(e).message;
    dialog.showMessageBox(toolboxWin || mainWin, { type: 'warning', title: 'Erro ao trocar perfil', message: msg });
    throw e;
  }
});

ipcMain.handle('profiles:rename', async (_event, { id, name }) => {
  if (!id || !name) return;
  const p = getProfileById(id);
  if (!p) return;
  const newName = String(name).trim();
  if (!newName) return;

  upsertProfile({ ...p, name: newName });

  toolboxWin?.webContents.send('identity:current', {
    id,
    name: newName,
  });
});

ipcMain.handle('profiles:updateUrl', async (_event, { id, url }) => {
  if (!id) return;
  const p = getProfileById(id);
  if (!p) return;
  const cleanUrl = String(url || '').trim();
  const finalUrl = cleanUrl || TCC_URL;
  upsertProfile({ ...p, url: finalUrl });

  if (id === currentProfileId) {
    toolboxWin?.webContents.send('identity:current', { id, url: finalUrl });
  }
});

ipcMain.handle('profiles:updateFingerprint', async (_event, { id: targetId, fingerprint }) => {
  const id = targetId || currentProfileId;
  if (!id) return;
  const p = getProfileById(id);
  if (!p) return;
  const fp = fingerprint && typeof fingerprint === 'object' ? fingerprint : {};
  const existing = p.fingerprint || {};
  // Se só mudou o preset, regenera fingerprint completo para o novo tipo
  const newPreset = fp.preset || existing.preset || 'iphone';
  const onlyPresetChange = Object.keys(fp).length === 1 && fp.preset;
  const merged = onlyPresetChange
    ? mergeFingerprint(existing, newPreset)
    : { ...getDefaultFingerprint(), ...existing, ...fp };
  upsertProfile({ ...p, fingerprint: ensureFingerprintFields(merged, newPreset) });

  if (id === currentProfileId) {
    await recreateMain(id);
  }
});

ipcMain.handle('fingerprint:new', async (_event, { id: targetId }) => {
  const id = targetId || currentProfileId;
  if (!id) return;
  const p = getProfileById(id);
  if (!p) return;
  const fresh = mergeFingerprint(p.fingerprint, p.fingerprint?.preset || 'iphone');
  upsertProfile({ ...p, fingerprint: fresh });

  if (id === currentProfileId) {
    await recreateMain(id);
  }
  return fresh;
});

ipcMain.handle('profiles:delete', async (_event, { id }) => {
  if (!id) return;
  const list = loadProfiles();
  if (list.length <= 1) {
    // nunca remove o último perfil
    return;
  }

  const newList = deleteProfile(id);

  if (!newList.length) {
    const ensured = ensureProfiles();
    currentProfileId = ensured[0].id;
    await recreateMain(currentProfileId);
    return;
  }

  if (currentProfileId === id) {
    currentProfileId = newList[0].id;
    await recreateMain(currentProfileId);
  }
});

ipcMain.handle('identity:clearStorage', async () => {
  if (!currentPartition) return;
  const p = getProfileById(currentProfileId);
  const raw = (p?.url || TCC_URL || '').toString().trim();
  const url = raw && /^https?:\/\//i.test(raw) ? raw : (TCC_URL || 'https://google.com');
  await session.fromPartition(currentPartition).clearStorageData({});
  try {
    await mainWin?.loadURL(url);
  } catch (e) {
    const msg = friendlyLoadError(e, url);
    if (mainWin && !mainWin.isDestroyed()) {
      dialog.showMessageBox(mainWin, { type: 'warning', title: 'Erro ao carregar', message: msg });
    }
  }
});
