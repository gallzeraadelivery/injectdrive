// src/preload-login.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proxy', {
  apply: (cfg) => ipcRenderer.invoke('proxy:apply', cfg),
  skip: () => ipcRenderer.invoke('proxy:skip')
});
