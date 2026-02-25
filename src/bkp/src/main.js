// src/main.js — FakeCam + Toolbox + Navegação (menu flutuante sempre visível)
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const {
  TCC_URL,
  BASE_W,
  BASE_H,
  FPS,
  DEFAULT_IMAGE_PATH,
  REQUIRE_PROXY_LOGIN,
  PROXY_BYPASS
} = require('./config');

let mainWin = null;
let toolboxWin = null;
let loginWin = null;
let lastRes = null;

// 1 ID simples só para a partition (sem sistema de perfis ainda)
let currentProfileId = randomUUID();
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

/* ================ PROXY ================= */
async function applyProxy(cfg) {
  lastProxy = { ...lastProxy, ...cfg };

  const rules =
    lastProxy.host && lastProxy.port
      ? `http=${lastProxy.host}:${lastProxy.port};https=${lastProxy.host}:${lastProxy.port}`
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

  // Auth de proxy, se tiver user/pass
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

/* ================ TOOLBOX ================= */
function createToolbox() {
  if (toolboxWin) return;

  toolboxWin = new BrowserWindow({
    width: 460,
    height: 820,
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

/* ================ MAIN WINDOW ================= */
async function createMain() {
  currentPartition = partitionOf(currentProfileId);

  if (mainWin) mainWin.destroy();

  mainWin = new BrowserWindow({
    width: 1200,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, 'preload-main.js'),
      contextIsolation: true,
      partition: currentPartition,
    },
  });

  const sess = session.fromPartition(currentPartition);
  sess.setPermissionRequestHandler((_, __, cb) => cb(true));

  await applyProxy({});
  await mainWin.loadURL(TCC_URL);

  mainWin.webContents.once('did-finish-load', () => {
    let dataUrl = '';

    // Carrega imagem padrão (se existir)
    if (DEFAULT_IMAGE_PATH && fs.existsSync(DEFAULT_IMAGE_PATH)) {
      const buf = fs.readFileSync(DEFAULT_IMAGE_PATH);
      const ext = path.extname(DEFAULT_IMAGE_PATH).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    }

    // Bootstrap da fakecam
    mainWin.webContents.send('fakecam:bootstrap', {
      BASE_W,
      BASE_H,
      FPS,
      initialDataUrl: dataUrl,
    });

    if (lastRes) {
      mainWin.webContents.send('fakecam:setResolution', lastRes);
    }

    // Garante o menu flutuante ativo (caso ainda não tenha sido criado)
    createToolbox();
  });

  mainWin.on('closed', () => {
    mainWin = null;
  });
}

/* ================ APP ================= */
app.whenReady().then(async () => {
  // 🔴 GARANTIA: menu flutuante é criado assim que o app abre
  createToolbox();

  if (REQUIRE_PROXY_LOGIN) {
    loginWin = new BrowserWindow({
      width: 440,
      height: 380,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload-login.js'),
        contextIsolation: true,
      },
    });

    loginWin.loadFile(path.join(__dirname, 'login.html'));
  } else {
    await createMain();
  }
});

/* ================ IPC PROXY ================= */
ipcMain.handle('proxy:apply', async (_event, cfg) => {
  await applyProxy(cfg);
  await createMain();
  loginWin?.close();
});

ipcMain.handle('proxy:skip', async () => {
  await applyProxy({ host: '', port: '', user: '', pass: '' });
  await createMain();
  loginWin?.close();
});

/* ================ FAKECAM IPC ================= */
ipcMain.on('fakecam:updateParams', (_event, p) => {
  mainWin?.webContents.send('fakecam:params', p);
});

ipcMain.on('fakecam:setImageDataUrl', (_event, d) => {
  mainWin?.webContents.send('fakecam:setImageDataUrl', d);
});

ipcMain.on('fakecam:setVideoDataUrl', (_event, d) => {
  mainWin?.webContents.send('fakecam:setVideoDataUrl', d);
});

ipcMain.on('fakecam:setResolution', (_event, r) => {
  lastRes = r;
  mainWin?.webContents.send('fakecam:setResolution', r);
});

/* ================ NAVEGAÇÃO (URL + test-cam.html) ================= */
ipcMain.handle('browser:navigate', async (_event, payload) => {
  if (!mainWin) return;

  const { type, url } = payload || {};

  if (type === 'external') {
    if (!url) return;
    let finalUrl = String(url).trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    await mainWin.loadURL(finalUrl);
  }

  if (type === 'local' && url === 'test-cam') {
    await mainWin.loadFile(path.join(__dirname, 'test-cam.html'));
  }
});
