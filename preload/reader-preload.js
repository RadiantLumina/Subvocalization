const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  navigate: (direction) => ipcRenderer.invoke('reader:navigate', direction),
  gotoChapter: (index) => ipcRenderer.invoke('reader:gotoChapter', index),
  hideReader: () => ipcRenderer.invoke('reader:hide'),
  toggleLock: () => ipcRenderer.invoke('reader:toggleLock'),
  getState: () => ipcRenderer.invoke('reader:getState'),
  getLinesPerPage: () => ipcRenderer.invoke('reader:getLinesPerPage'),

  onLoadContent: (cb) => {
    ipcRenderer.on('loadContent', (event, data) => cb(data));
  },
  onUpdateSetting: (cb) => {
    ipcRenderer.on('updateSetting', (event, data) => cb(data));
  },
  onNav: (cb) => {
    ipcRenderer.on('nav', (event, direction) => cb(direction));
  }
});
