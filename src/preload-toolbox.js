// src/preload-toolbox.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fakecam', {
  // Controles da fakecam
  updateParams: (p) => ipcRenderer.send('fakecam:updateParams', p),
  setImageDataUrl: (url) => ipcRenderer.send('fakecam:setImageDataUrl', url),
  setVideoDataUrl: (url) => ipcRenderer.send('fakecam:setVideoDataUrl', url),
  // Auto-injeção: configura vídeo/imagem para substituir em uploads
  setMediaForInjection: (type, filePath) => ipcRenderer.invoke('media:setForInjection', { type, filePath }),
  setMediaForInjectionFromDataUrl: (type, dataUrl, filename) =>
    ipcRenderer.invoke('media:setForInjectionFromDataUrl', { type, dataUrl, filename }),
  selectFileForInjection: (type) => ipcRenderer.invoke('media:selectFileForInjection', { type }),
  getMediaForInjection: () => ipcRenderer.invoke('media:getForInjection'),
  // Modo Drive: só altera os 6 campos na resposta; desativa injeção de selfie e aprovação Veriff
  driveModeGet: () => ipcRenderer.invoke('drive-mode:get'),
  driveModeSet: (enabled) => ipcRenderer.invoke('drive-mode:set', enabled),
  // Logs de upload
  getUploadLogs: () => ipcRenderer.invoke('logs:getUploadLogs'),
  saveUploadLogs: () => ipcRenderer.invoke('logs:saveUploadLogs'),
  setResolution: (res) => ipcRenderer.send('fakecam:setResolution', res),

  // Navegar para URL externa
  navigateToUrl: (url) =>
    ipcRenderer.invoke('browser:navigate', { type: 'external', url }),

  // Abrir test-cam.html
  openCamTest: () =>
    ipcRenderer.invoke('browser:navigate', { type: 'local', url: 'test-cam' }),

  // Lista de atalhos de navegação (config.js)
  getShortcuts: () => ipcRenderer.invoke('shortcuts:list'),

  // Trocar proxy durante a sessão
  getProxy: () => ipcRenderer.invoke('proxy:get'),
  changeProxy: (cfg) => ipcRenderer.invoke('proxy:change', cfg),

  // Presets de fingerprint (salva no perfil e aplica)
  setDevicePreset: (preset) =>
    ipcRenderer.invoke('profiles:updateFingerprint', { fingerprint: { preset } }),

  // Novo fingerprint (estilo Ads Power) — gera valores únicos e recarrega
  newFingerprint: (id) => ipcRenderer.invoke('fingerprint:new', { id }),

  // ===== PERFIS =====
  identityNew: (name) => ipcRenderer.invoke('identity:new', { name }),
  identityGet: () => ipcRenderer.invoke('identity:get'),
  identityClearStorage: () => ipcRenderer.invoke('identity:clearStorage'),
  profilesList: () => ipcRenderer.invoke('profiles:list'),
  profilesSwitch: (id) => ipcRenderer.invoke('profiles:switch', { id }),
  profilesRename: (id, name) =>
    ipcRenderer.invoke('profiles:rename', { id, name }),
  profilesDelete: (id) => ipcRenderer.invoke('profiles:delete', { id }),
  profilesUpdateUrl: (id, url) =>
    ipcRenderer.invoke('profiles:updateUrl', { id, url }),
  profilesUpdateFingerprint: (id, fingerprint) =>
    ipcRenderer.invoke('profiles:updateFingerprint', { id, fingerprint }),

  onIdentityCurrent: (cb) => {
    ipcRenderer.on('identity:current', (_e, payload) => cb(payload));
  },
});
