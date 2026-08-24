// src/fingerprint.js — Gerador de fingerprint único por perfil (estilo Ads Power)
const { randomInt, randomUUID } = require('crypto');

// Locale sempre EUA (idioma + fuso). Offset = minutos de getTimezoneOffset (UTC - local).
const US_LOCALES = {
  languages: ['en-US', 'en'],
  timezones: [
    { timezone: 'America/New_York', timezoneOffset: 300 },
    { timezone: 'America/Chicago', timezoneOffset: 360 },
    { timezone: 'America/Denver', timezoneOffset: 420 },
    { timezone: 'America/Los_Angeles', timezoneOffset: 480 },
  ],
};

function pickUsaLocale() {
  const tz = pick(US_LOCALES.timezones);
  return {
    timezone: tz.timezone,
    timezoneOffset: tz.timezoneOffset,
    language: US_LOCALES.languages[0],
    languages: [...US_LOCALES.languages],
  };
}

function applyUsaLocale(fp) {
  if (!fp || typeof fp !== 'object') return fp;
  const locale = pickUsaLocale();
  const keepTz = US_LOCALES.timezones.find((t) => t.timezone === fp.timezone);
  return {
    ...fp,
    timezone: keepTz ? keepTz.timezone : locale.timezone,
    timezoneOffset: keepTz ? keepTz.timezoneOffset : locale.timezoneOffset,
    language: US_LOCALES.languages[0],
    languages: [...US_LOCALES.languages],
  };
}

function ensureLocaleFields(fp) {
  if (!fp || typeof fp !== 'object') return fp;
  if (fp.language && Array.isArray(fp.languages) && fp.timezone) return fp;
  return applyUsaLocale(fp);
}

const PLATFORMS = {
  desktop: ['Win32', 'MacIntel', 'Linux x86_64'],
  android: ['Linux aarch64', 'Linux armv8l'],
  iphone: ['iPhone'],
};

const USER_AGENTS = {
  desktop: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ],
  android: [
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  ],
  iphone: [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  ],
};

// Resoluções físicas (px) — iPhone usa devicePixelRatio 3
const SCREEN_RESOLUTIONS = {
  desktop: [
    [1920, 1080], [2560, 1440], [1366, 768], [1536, 864], [1440, 900],
    [1680, 1050], [1280, 720], [2560, 1080], [3840, 2160],
  ],
  android: [
    [1080, 2400],   // Pixel 7/8/9
    [1080, 2340],   // Samsung S23/S24
    [1080, 1920],   // modelos médios
    [1440, 3200],   // Samsung S24 Ultra
    [1440, 3088],   // Samsung S24+
  ],
  iphone: [
    [1170, 2532],   // iPhone 14
    [1179, 2556],   // iPhone 15/16
    [1284, 2778],   // iPhone 14 Plus
    [1290, 2796],   // iPhone 15 Pro / 16 Pro
  ],
};

function pick(arr) {
  return arr[randomInt(0, arr.length)];
}

function pickRange(min, max) {
  return randomInt(min, max + 1);
}

function generateNoise(base = 0, range = 0.0001) {
  return base + (Math.random() * 2 - 1) * range;
}

// Valores específicos de iPhone (Safari iOS)
const IPHONE_SPEC = {
  hardwareConcurrency: [6, 8],        // A15/A16 = 6, A17 Pro = 8
  deviceMemory: undefined,            // Safari iOS não expõe
  pixelRatio: 3,                      // Retina 3x (todos os iPhones modernos)
  colorDepth: 24,
  pixelDepth: 24,
  vendor: 'Apple Computer, Inc.',
  product: 'Gecko',
  appName: 'Netscape',
  maxTouchPoints: 5,
  appVersion: (ua) => (ua || '').replace(/^Mozilla\/\d\.\d\s+/, '') || '5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

// Valores específicos de Desktop (Chrome Windows/macOS/Linux)
const DESKTOP_SPEC = {
  hardwareConcurrency: [4, 6, 8, 12, 16],
  deviceMemory: [4, 8, 16, 32],
  pixelRatio: [1, 1.25, 1.5, 2],
  colorDepth: 24,
  pixelDepth: 24,
  maxTouchPoints: 0,
  vendor: 'Google Inc.',
  product: 'Gecko',
  appName: 'Netscape',
  webglVariants: [
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)' },
  ],
};

// Valores específicos de Android (Chrome)
const ANDROID_SPEC = {
  hardwareConcurrency: [4, 6, 8],   // Snapdragon/Exynos
  deviceMemory: [4, 6, 8, 12],     // Chrome expõe
  pixelRatio: [2.5, 2.625, 2.75, 3], // Pixel 2.625, Samsung 3
  colorDepth: 24,
  pixelDepth: 24,
  vendor: 'Google Inc.',
  product: 'Gecko',
  appName: 'Netscape',
  maxTouchPoints: 5,
  appVersion: (ua) => (ua || '').replace(/^Mozilla\/\d\.\d\s+/, '') || '5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  // WebGL: Qualcomm Adreno (Pixel), ARM Mali (Exynos), Samsung
  webglVariants: [
    { vendor: 'Qualcomm', renderer: 'Adreno (TM) 730' },
    { vendor: 'Qualcomm', renderer: 'Adreno (TM) 740' },
    { vendor: 'ARM', renderer: 'Mali-G715 MP7' },
    { vendor: 'Samsung Electronics Co., Ltd.', renderer: 'Samsung Xclipse 540' },
  ],
};

/**
 * Gera um fingerprint completo único para o perfil.
 * @param {string} preset - 'desktop' | 'android' | 'iphone'
 * @param {object} base - Valores base (width, height) para compatibilidade
 */
function generateFingerprint(preset = 'iphone', base = {}) {
  const resolutions = SCREEN_RESOLUTIONS[preset] || SCREEN_RESOLUTIONS.desktop;
  const [screenW, screenH] = pick(resolutions);

  const width = base.width || screenW;
  const height = base.height || screenH;

  const userAgent = pick(USER_AGENTS[preset] || USER_AGENTS.desktop);
  const isIphone = preset === 'iphone';
  const isAndroid = preset === 'android';
  const isDesktop = preset === 'desktop';

  return {
    preset,
    width,
    height,
    // Identificador único deste fingerprint
    fingerprintId: randomUUID().slice(0, 8),
    // Navegador / Sistema
    userAgent,
    platform: pick(PLATFORMS[preset] || PLATFORMS.desktop),
    ...pickUsaLocale(),
    // Hardware
    hardwareConcurrency: isIphone ? pick(IPHONE_SPEC.hardwareConcurrency) : isAndroid ? pick(ANDROID_SPEC.hardwareConcurrency) : pick([2, 4, 6, 8, 10, 12, 16]),
    deviceMemory: isIphone ? undefined : isAndroid ? pick(ANDROID_SPEC.deviceMemory) : pick([2, 4, 8, 16]),
    // Tela
    screenWidth: screenW,
    screenHeight: screenH,
    availWidth: screenW - pickRange(0, 20),
    availHeight: screenH - pickRange(50, 100),
    colorDepth: isIphone ? IPHONE_SPEC.colorDepth : isAndroid ? ANDROID_SPEC.colorDepth : pick([24, 30, 32]),
    pixelDepth: isIphone ? IPHONE_SPEC.pixelDepth : isAndroid ? ANDROID_SPEC.pixelDepth : 24,
    pixelRatio: isIphone ? IPHONE_SPEC.pixelRatio : isAndroid ? pick(ANDROID_SPEC.pixelRatio) : pick([1, 1.25, 1.5, 2]),
    // Navigator (Safari iOS / Chrome Android)
    ...(isIphone && {
      vendor: IPHONE_SPEC.vendor,
      product: IPHONE_SPEC.product,
      appName: IPHONE_SPEC.appName,
      appVersion: typeof IPHONE_SPEC.appVersion === 'function' ? IPHONE_SPEC.appVersion(userAgent) : IPHONE_SPEC.appVersion,
      maxTouchPoints: IPHONE_SPEC.maxTouchPoints,
      webglVendor: 'Apple Inc.',
      webglRenderer: 'Apple GPU',
    }),
    ...(isAndroid && (() => {
      const wg = pick(ANDROID_SPEC.webglVariants);
      return {
        vendor: ANDROID_SPEC.vendor,
        product: ANDROID_SPEC.product,
        appName: ANDROID_SPEC.appName,
        appVersion: typeof ANDROID_SPEC.appVersion === 'function' ? ANDROID_SPEC.appVersion(userAgent) : ANDROID_SPEC.appVersion,
        maxTouchPoints: ANDROID_SPEC.maxTouchPoints,
        webglVendor: wg.vendor,
        webglRenderer: wg.renderer,
      };
    })()),
    ...(isDesktop && (() => {
      const wg = pick(DESKTOP_SPEC.webglVariants);
      return {
        vendor: DESKTOP_SPEC.vendor,
        product: DESKTOP_SPEC.product,
        appName: DESKTOP_SPEC.appName,
        appVersion: (userAgent || '').replace(/^Mozilla\/\d\.\d\s+/, ''),
        maxTouchPoints: DESKTOP_SPEC.maxTouchPoints,
        webglVendor: wg.vendor,
        webglRenderer: wg.renderer,
      };
    })()),
    // Ruído para Canvas, WebGL, AudioContext (valores únicos por perfil)
    canvasNoise: generateNoise(1, 0.0001),
    webglNoise: generateNoise(1, 0.0001),
    audioContextNoise: generateNoise(0, 0.00001),
    clientRectsNoise: generateNoise(0, 0.0001),
    // WebRTC — sempre ativo (não bloquear)
    webRTC: true,
    // Do Not Track
    doNotTrack: pick([null, '1', 'unspecified']),
  };
}

/**
 * Mescla fingerprint gerado com valores existentes (para preservar preset ao renovar).
 */
function mergeFingerprint(existing, preset) {
  const p = preset || existing?.preset || 'iphone';
  const fresh = generateFingerprint(p, { width: existing?.width, height: existing?.height });
  // Novo fingerprint nasce USA; sync com proxy (se houver) sobrescreve depois
  return { ...existing, ...fresh, preset: p };
}

/**
 * Garante que o fingerprint tem todos os campos necessários (migração de perfis antigos).
 */
function ensureFingerprintFields(fp, preset = 'iphone') {
  if (!fp || typeof fp !== 'object') return generateFingerprint(preset);
  const hasNewFields = fp.userAgent && fp.platform && fp.hardwareConcurrency;
  if (!hasNewFields) {
    return mergeFingerprint({ preset: fp.preset || preset, width: fp.width, height: fp.height }, fp.preset || preset);
  }
  // Migração: adiciona campos específicos se preset e faltando
  const p = fp.preset || preset;
  let out = fp;
  if (p === 'iphone' && !fp.vendor) {
    out = {
      ...fp,
      vendor: IPHONE_SPEC.vendor,
      product: IPHONE_SPEC.product,
      appName: IPHONE_SPEC.appName,
      appVersion: typeof IPHONE_SPEC.appVersion === 'function' ? IPHONE_SPEC.appVersion(fp.userAgent) : IPHONE_SPEC.appVersion,
      maxTouchPoints: IPHONE_SPEC.maxTouchPoints,
      webglVendor: 'Apple Inc.',
      webglRenderer: 'Apple GPU',
      deviceMemory: undefined,
      hardwareConcurrency: fp.hardwareConcurrency || pick(IPHONE_SPEC.hardwareConcurrency),
      pixelRatio: fp.pixelRatio || 3,
      colorDepth: fp.colorDepth || 24,
    };
  } else if (p === 'android' && !fp.vendor) {
    const wg = pick(ANDROID_SPEC.webglVariants);
    out = {
      ...fp,
      vendor: ANDROID_SPEC.vendor,
      product: ANDROID_SPEC.product,
      appName: ANDROID_SPEC.appName,
      appVersion: typeof ANDROID_SPEC.appVersion === 'function' ? ANDROID_SPEC.appVersion(fp.userAgent) : ANDROID_SPEC.appVersion,
      maxTouchPoints: ANDROID_SPEC.maxTouchPoints,
      webglVendor: wg.vendor,
      webglRenderer: wg.renderer,
      deviceMemory: fp.deviceMemory ?? pick(ANDROID_SPEC.deviceMemory),
      hardwareConcurrency: fp.hardwareConcurrency || pick(ANDROID_SPEC.hardwareConcurrency),
      pixelRatio: fp.pixelRatio || pick(ANDROID_SPEC.pixelRatio),
      colorDepth: fp.colorDepth || 24,
    };
  } else if (p === 'desktop' && !fp.webglVendor) {
    const wg = pick(DESKTOP_SPEC.webglVariants);
    out = {
      ...fp,
      vendor: DESKTOP_SPEC.vendor,
      product: DESKTOP_SPEC.product,
      appName: DESKTOP_SPEC.appName,
      appVersion: fp.appVersion || (fp.userAgent || '').replace(/^Mozilla\/\d\.\d\s+/, ''),
      maxTouchPoints: DESKTOP_SPEC.maxTouchPoints,
      webglVendor: wg.vendor,
      webglRenderer: wg.renderer,
      deviceMemory: fp.deviceMemory ?? pick(DESKTOP_SPEC.deviceMemory),
      hardwareConcurrency: fp.hardwareConcurrency || pick(DESKTOP_SPEC.hardwareConcurrency),
      pixelRatio: fp.pixelRatio || pick(DESKTOP_SPEC.pixelRatio),
      colorDepth: fp.colorDepth || 24,
      pixelDepth: fp.pixelDepth || 24,
    };
  }
  return ensureLocaleFields(out);
}

// País do proxy → idiomas coerentes com o IP
const COUNTRY_TO_LANGUAGES = {
  BR: ['pt-BR', 'pt', 'en-US', 'en'],
  US: ['en-US', 'en'],
  GB: ['en-GB', 'en'],
  AR: ['es-AR', 'es', 'en-US', 'en'],
  MX: ['es-MX', 'es', 'en-US', 'en'],
  ES: ['es', 'es-ES', 'en-US', 'en'],
  FR: ['fr-FR', 'fr', 'en-US', 'en'],
  DE: ['de-DE', 'de', 'en-US', 'en'],
  IT: ['it-IT', 'it', 'en-US', 'en'],
  PT: ['pt-PT', 'pt', 'en-US', 'en'],
  NL: ['nl-NL', 'nl', 'en-US', 'en'],
  PL: ['pl-PL', 'pl', 'en-US', 'en'],
  RU: ['ru-RU', 'ru', 'en-US', 'en'],
  JP: ['ja-JP', 'ja', 'en-US', 'en'],
  CN: ['zh-CN', 'zh', 'en-US', 'en'],
  IN: ['en-IN', 'hi', 'en'],
  AU: ['en-AU', 'en'],
  CA: ['en-CA', 'fr-CA', 'en', 'fr'],
  CO: ['es-CO', 'es', 'en-US', 'en'],
  CL: ['es-CL', 'es', 'en-US', 'en'],
  PE: ['es-PE', 'es', 'en-US', 'en'],
};

// Offsets aproximados (minutos getTimezoneOffset) para fusos comuns
const TIMEZONE_OFFSETS = {
  'America/New_York': 300,
  'America/Chicago': 360,
  'America/Denver': 420,
  'America/Los_Angeles': 480,
  'America/Sao_Paulo': 180,
  'America/Argentina/Buenos_Aires': 180,
  'America/Mexico_City': 360,
  'Europe/London': 0,
  'Europe/Paris': -60,
  'Europe/Berlin': -60,
  'Asia/Tokyo': -540,
  'Asia/Shanghai': -480,
  'Australia/Sydney': -660,
};

function getLanguagesForCountry(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') return [...US_LOCALES.languages];
  const cc = countryCode.toUpperCase().slice(0, 2);
  return COUNTRY_TO_LANGUAGES[cc] || [...US_LOCALES.languages];
}

function applyGeoToFingerprint(fp, geo) {
  if (!fp) return fp;
  if (!geo || !geo.timezone) return applyUsaLocale(fp);
  const languages = getLanguagesForCountry(geo.countryCode);
  const offset = TIMEZONE_OFFSETS[geo.timezone];
  return {
    ...fp,
    timezone: geo.timezone,
    ...(typeof offset === 'number' ? { timezoneOffset: offset } : {}),
    language: languages[0],
    languages: [...languages],
  };
}

module.exports = {
  generateFingerprint,
  mergeFingerprint,
  ensureFingerprintFields,
  applyUsaLocale,
  ensureLocaleFields,
  getLanguagesForCountry,
  applyGeoToFingerprint,
};
