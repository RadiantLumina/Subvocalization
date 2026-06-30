const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  openReader: () => ipcRenderer.invoke('reader:open'),
  closeReader: () => ipcRenderer.invoke('reader:close'),
  loadNovel: (data) => ipcRenderer.invoke('reader:loadNovel', data),
  hideReader: () => ipcRenderer.invoke('reader:hide'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (category, key, value) => ipcRenderer.invoke('settings:set', { category, key, value }),
  setReaderSettings: (data) => ipcRenderer.invoke('settings:setReader', data),
  getShortcuts: () => ipcRenderer.invoke('shortcuts:get'),
  setShortcuts: (data) => ipcRenderer.invoke('shortcuts:set', data),
  resetShortcuts: () => ipcRenderer.invoke('shortcuts:reset'),
  browser: {
    open: (url) => ipcRenderer.invoke('browser:open', url),
    extract: () => ipcRenderer.invoke('browser:extract'),
    extractChapters: () => ipcRenderer.invoke('browser:extractChapters'),
    clean: () => ipcRenderer.invoke('browser:clean')
  },
  getLibrary: () => ipcRenderer.invoke('library:get'),
  saveToLibrary: (item) => ipcRenderer.invoke('library:save', item),
  removeFromLibrary: (id) => ipcRenderer.invoke('library:remove', id),

  onOpacityChanged: (cb) => ipcRenderer.on('opacity-changed', (e, v) => cb(v)),
  onLockChanged: (cb) => ipcRenderer.on('lock-changed', (e, v) => cb(v)),
  onStealthChanged: (cb) => ipcRenderer.on('stealth-changed', (e, v) => cb(v)),
  onNavigateTo: (cb) => ipcRenderer.on('navigate-to', (e, url) => cb(url))
});
