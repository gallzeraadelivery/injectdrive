const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fakecam', {
  // Controles de imagem/vídeo da fakecam
  updateParams: (p) => ipcRenderer.send('fakecam:updateParams', p),
  setImageDataUrl: (url) => ipcRenderer.send('fakecam:setImageDataUrl', url),
  setVideoDataUrl: (url) => ipcRenderer.send('fakecam:setVideoDataUrl', url),
  setResolution: (res) => ipcRenderer.send('fakecam:setResolution', res),

  // Navegar a janela principal para uma URL externa
  navigateToUrl: (url) =>
    ipcRenderer.invoke('browser:navigate', { type: 'external', url }),

  // Abrir o arquivo local test-cam.html
  openCamTest: () =>
    ipcRenderer.invoke('browser:navigate', { type: 'local', url: 'test-cam' }),
});
