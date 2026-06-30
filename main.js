const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { parseChapters, splitIntoPages } = require('./modules/parser');
const { EXTRACT_SCRIPT, buildFigureOutChaptersScript, buildCleanScript } = require('./modules/extractor');

const store = new Store({
  defaults: {
    reader: {
      x: null,
      y: null,
      width: 600,
      height: 400,
      opacity: 0.85,
      fontSize: 16,
      fontFamily: 'Microsoft YaHei, SimSun, serif',
      bgColor: '#1a1a2e',
      textColor: '#e0e0e0',
      linesPerPage: 20,
      pageMode: 'scroll',
      borderGlow: false,
      alwaysOnTop: true,
      showBorder: false
    },
    shortcuts: {
      toggleVisible: 'Alt+`',
      nextPage: 'Right',
      prevPage: 'Left',
      nextChapter: 'Ctrl+Right',
      prevChapter: 'Ctrl+Left',
      lockPosition: 'Ctrl+L',
      toggleStealth: 'Ctrl+B',
      increaseOpacity: 'Ctrl+Up',
      decreaseOpacity: 'Ctrl+Down'
    },
    library: []
  }
});

let controlWindow = null;
let readerWindow = null;
let browserWindow = null;
let tray = null;
let isQuitting = false;
let novelData = { chapters: [], currentChapter: 0, currentPage: 0, source: null, title: '' };

const isDev = process.argv.includes('--dev');

function getAssetPath(name) {
  return path.join(__dirname, 'assets', name);
}

function getRendererPath(name) {
  return path.join(__dirname, 'renderer', name);
}

function getPreloadPath(name) {
  return path.join(__dirname, 'preload', name);
}

function createControlWindow() {
  const bounds = store.get('controlWindowBounds', { width: 900, height: 680 });

  controlWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 800,
    minHeight: 600,
    x: bounds.x,
    y: bounds.y,
    title: '隐读 - 控制台',
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: getPreloadPath('control-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false,
    backgroundColor: '#0f0f23'
  });

  controlWindow.loadFile(getRendererPath('control.html'));

  controlWindow.once('ready-to-show', () => {
    controlWindow.show();
    if (isDev) controlWindow.webContents.openDevTools({ mode: 'detach' });
  });

  controlWindow.on('close', (e) => {
    if (!isQuitting) {
      const b = controlWindow.getBounds();
      store.set('controlWindowBounds', { x: b.x, y: b.y, width: b.width, height: b.height });
    }
    controlWindow = null;
  });
}

function createReaderWindow() {
  const cfg = store.get('reader');

  readerWindow = new BrowserWindow({
    width: cfg.width,
    height: cfg.height,
    x: cfg.x,
    y: cfg.y,
    frame: cfg.showBorder !== true,
    transparent: true,
    alwaysOnTop: cfg.alwaysOnTop !== false,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    title: '隐读 - 阅读',
    webPreferences: {
      preload: getPreloadPath('reader-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false,
    backgroundColor: '#00000000',
    type: 'toolbar'
  });

  readerWindow.setOpacity(cfg.opacity || 0.85);
  readerWindow.setAlwaysOnTop(true, 'screen-saver');
  readerWindow.loadFile(getRendererPath('reader.html'));

  readerWindow.once('ready-to-show', () => {
    readerWindow.show();
  });

  readerWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      readerWindow.hide();
    }
  });

  readerWindow.on('hide', () => {
    saveReaderBounds();
  });

  readerWindow.on('move', () => {
    saveReaderBounds();
  });

  readerWindow.on('resize', () => {
    saveReaderBounds();
  });
}

function saveReaderBounds() {
  if (!readerWindow || readerWindow.isDestroyed()) return;
  const b = readerWindow.getBounds();
  const cfg = store.get('reader');
  cfg.x = b.x;
  cfg.y = b.y;
  cfg.width = b.width;
  cfg.height = b.height;
  store.set('reader', cfg);
}

function createBrowserWindow(url) {
  if (browserWindow && !browserWindow.isDestroyed()) {
    browserWindow.focus();
    if (url) browserWindow.loadURL(url);
    return;
  }

  browserWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '隐读 - 网页浏览',
    webPreferences: {
      preload: getPreloadPath('control-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    },
    show: false,
    backgroundColor: '#ffffff'
  });

  browserWindow.loadFile(getRendererPath('browser.html'));

  browserWindow.once('ready-to-show', () => {
    browserWindow.show();
    if (url && browserWindow.webContents) {
      browserWindow.webContents.send('navigate-to', url);
    }
  });

  browserWindow.on('closed', () => {
    browserWindow = null;
  });
}

function registerShortcuts() {
  const sc = store.get('shortcuts');
  try {
    globalShortcut.register(sc.toggleVisible, toggleReader);
    globalShortcut.register(sc.lockPosition, toggleLockPosition);
    globalShortcut.register(sc.toggleStealth, toggleStealthMode);
    globalShortcut.register(sc.increaseOpacity, () => changeOpacity(0.05));
    globalShortcut.register(sc.decreaseOpacity, () => changeOpacity(-0.05));
    globalShortcut.register(sc.nextPage, () => sendToReader('nav', 'nextPage'));
    globalShortcut.register(sc.prevPage, () => sendToReader('nav', 'prevPage'));
    globalShortcut.register(sc.nextChapter, () => sendToReader('nav', 'nextChapter'));
    globalShortcut.register(sc.prevChapter, () => sendToReader('nav', 'prevChapter'));
  } catch (err) {
    console.error('Failed to register shortcuts:', err);
  }
}

function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

function toggleReader() {
  if (!readerWindow || readerWindow.isDestroyed()) {
    createReaderWindow();
    if (novelData.chapters.length > 0) {
      setTimeout(() => sendReaderContent(), 500);
    }
    return;
  }
  if (readerWindow.isVisible()) {
    readerWindow.hide();
  } else {
    readerWindow.show();
    readerWindow.focus();
  }
}

function toggleLockPosition() {
  if (!readerWindow || readerWindow.isDestroyed()) return;
  const locked = !readerWindow.isResizable();
  readerWindow.setResizable(!locked);
  readerWindow.setMovable(!locked);
  sendToReader('updateSetting', { key: 'positionLocked', value: !locked });
  if (controlWindow) {
    controlWindow.webContents.send('lock-changed', !locked);
  }
}

let isStealth = false;
function toggleStealthMode() {
  if (!readerWindow || readerWindow.isDestroyed()) return;
  isStealth = !isStealth;
  readerWindow.setOpacity(isStealth ? 0.08 : store.get('reader').opacity);
  sendToReader('updateSetting', { key: 'stealthMode', value: isStealth });
  if (controlWindow) {
    controlWindow.webContents.send('stealth-changed', isStealth);
  }
}

function changeOpacity(delta) {
  if (!readerWindow || readerWindow.isDestroyed()) return;
  if (isStealth) return;
  const cfg = store.get('reader');
  cfg.opacity = Math.max(0.1, Math.min(1.0, cfg.opacity + delta));
  readerWindow.setOpacity(cfg.opacity);
  store.set('reader', cfg);
  sendToReader('updateSetting', { key: 'opacity', value: cfg.opacity });
  if (controlWindow) {
    controlWindow.webContents.send('opacity-changed', cfg.opacity);
  }
}

function sendToReader(channel, data) {
  if (readerWindow && !readerWindow.isDestroyed() && readerWindow.webContents) {
    readerWindow.webContents.send(channel, data);
  }
}

function sendReaderContent() {
  if (!novelData.chapters.length) return;
  const ch = novelData.chapters[novelData.currentChapter];
  if (!ch) return;
  const pages = splitIntoPages(ch.content, store.get('reader').linesPerPage);
  if (novelData.currentPage >= pages.length) novelData.currentPage = 0;
  sendToReader('loadContent', {
    chapterTitle: ch.title,
    chapterIndex: novelData.currentChapter,
    totalChapters: novelData.chapters.length,
    pageIndex: novelData.currentPage,
    totalPages: pages.length,
    content: pages[novelData.currentPage] || '',
    novelTitle: novelData.title
  });
}

function createTray() {
  let iconPath = getAssetPath('icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
    icon = icon.resize({ width: 16, height: 16 });
  } catch (e) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示/隐藏阅读窗口', click: toggleReader },
    { label: '打开控制台', click: () => { if (controlWindow) controlWindow.show(); else createControlWindow(); } },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('隐读');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', toggleReader);
}

function setupIPC() {
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(controlWindow || readerWindow, {
      title: '选择小说文件',
      filters: [
        { name: '文本文件', extensions: ['txt', 'csv', 'text', 'log'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    return result;
  });

  ipcMain.handle('file:read', async (event, filePath) => {
    try {
      const { parseChapters } = require('./modules/parser');
      const { readTextFile } = require('./modules/parser');
      const { text, encoding } = readTextFile(filePath);
      const chapters = parseChapters(text);
      const name = path.basename(filePath);
      return { success: true, name, chapters, encoding, totalChars: text.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reader:open', () => {
    if (!readerWindow || readerWindow.isDestroyed()) {
      createReaderWindow();
    } else {
      readerWindow.show();
      readerWindow.focus();
    }
    return true;
  });

  ipcMain.handle('reader:close', () => {
    if (readerWindow && !readerWindow.isDestroyed()) {
      readerWindow.hide();
    }
    return true;
  });

  ipcMain.handle('reader:loadNovel', (event, data) => {
    novelData = {
      chapters: data.chapters || [],
      currentChapter: data.currentChapter || 0,
      currentPage: data.currentPage || 0,
      source: data.source || 'local',
      title: data.title || '未命名'
    };
    if (!readerWindow || readerWindow.isDestroyed()) {
      createReaderWindow();
    } else {
      readerWindow.show();
      readerWindow.focus();
    }
    setTimeout(() => sendReaderContent(), 300);
    return { success: true };
  });

  ipcMain.handle('reader:navigate', (event, direction) => {
    const chCount = novelData.chapters.length;
    if (!chCount) return { success: false };

    const ch = novelData.chapters[novelData.currentChapter];
    const pages = splitIntoPages(ch.content, store.get('reader').linesPerPage);

    switch (direction) {
      case 'nextPage':
        if (novelData.currentPage < pages.length - 1) {
          novelData.currentPage++;
        } else if (novelData.currentChapter < chCount - 1) {
          novelData.currentChapter++;
          novelData.currentPage = 0;
        }
        break;
      case 'prevPage':
        if (novelData.currentPage > 0) {
          novelData.currentPage--;
        } else if (novelData.currentChapter > 0) {
          novelData.currentChapter--;
          const prevCh = novelData.chapters[novelData.currentChapter];
          const prevPages = splitIntoPages(prevCh.content, store.get('reader').linesPerPage);
          novelData.currentPage = prevPages.length - 1;
        }
        break;
      case 'nextChapter':
        if (novelData.currentChapter < chCount - 1) {
          novelData.currentChapter++;
          novelData.currentPage = 0;
        }
        break;
      case 'prevChapter':
        if (novelData.currentChapter > 0) {
          novelData.currentChapter--;
          novelData.currentPage = 0;
        }
        break;
    }
    sendReaderContent();
    return { success: true };
  });

  ipcMain.handle('reader:gotoChapter', (event, index) => {
    if (index >= 0 && index < novelData.chapters.length) {
      novelData.currentChapter = index;
      novelData.currentPage = 0;
      sendReaderContent();
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('settings:get', () => {
    return {
      reader: store.get('reader'),
      shortcuts: store.get('shortcuts'),
      library: store.get('library')
    };
  });

  ipcMain.handle('settings:set', (event, { category, key, value }) => {
    const data = store.get(category);
    data[key] = value;
    store.set(category, data);
    return { success: true };
  });

  ipcMain.handle('settings:setReader', (event, data) => {
    store.set('reader', data);
    if (readerWindow && !readerWindow.isDestroyed()) {
      if (data.opacity !== undefined) readerWindow.setOpacity(data.opacity);
      if (data.alwaysOnTop !== undefined) readerWindow.setAlwaysOnTop(data.alwaysOnTop, 'screen-saver');
      if (data.width && data.height) {
        readerWindow.setSize(data.width, data.height);
      }
      if (data.x !== undefined && data.y !== undefined) {
        readerWindow.setPosition(data.x, data.y);
      }
      if (data.fontSize !== undefined || data.fontFamily !== undefined ||
          data.bgColor !== undefined || data.textColor !== undefined ||
          data.linesPerPage !== undefined || data.pageMode !== undefined ||
          data.showBorder !== undefined || data.borderGlow !== undefined) {
        sendToReader('updateSetting', { key: 'config', value: data });
      }
    }
    return { success: true };
  });

  ipcMain.handle('shortcuts:get', () => store.get('shortcuts'));
  ipcMain.handle('shortcuts:set', (event, newShortcuts) => {
    store.set('shortcuts', newShortcuts);
    unregisterShortcuts();
    registerShortcuts();
    return { success: true };
  });

  ipcMain.handle('shortcuts:reset', () => {
    const defaults = {
      toggleVisible: 'Alt+`',
      nextPage: 'Right',
      prevPage: 'Left',
      nextChapter: 'Ctrl+Right',
      prevChapter: 'Ctrl+Left',
      lockPosition: 'Ctrl+L',
      toggleStealth: 'Ctrl+B',
      increaseOpacity: 'Ctrl+Up',
      decreaseOpacity: 'Ctrl+Down'
    };
    store.set('shortcuts', defaults);
    unregisterShortcuts();
    registerShortcuts();
    return { success: true, shortcuts: defaults };
  });

  ipcMain.handle('browser:open', (event, url) => {
    createBrowserWindow(url);
    return { success: true };
  });

  ipcMain.handle('browser:extract', async () => {
    if (!browserWindow || browserWindow.isDestroyed()) {
      return { success: false, error: '浏览器窗口未打开' };
    }
    try {
      const result = await browserWindow.webContents.executeJavaScript(EXTRACT_SCRIPT);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('browser:extractChapters', async () => {
    if (!browserWindow || browserWindow.isDestroyed()) {
      return { success: false, error: '浏览器窗口未打开' };
    }
    try {
      const script = buildFigureOutChaptersScript();
      const result = await browserWindow.webContents.executeJavaScript(script);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('browser:clean', async () => {
    if (!browserWindow || browserWindow.isDestroyed()) {
      return { success: false, error: '浏览器窗口未打开' };
    }
    try {
      const script = buildCleanScript();
      const result = await browserWindow.webContents.executeJavaScript(script);
      return { success: true, content: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('library:get', () => store.get('library'));
  ipcMain.handle('library:save', (event, item) => {
    const lib = store.get('library');
    const existing = lib.findIndex(l => l.path === item.path || l.url === item.url);
    if (existing >= 0) {
      lib[existing] = { ...lib[existing], ...item, lastRead: new Date().toISOString() };
    } else {
      lib.push({ ...item, addedAt: new Date().toISOString(), lastRead: new Date().toISOString() });
    }
    store.set('library', lib);
    return { success: true, library: lib };
  });

  ipcMain.handle('library:remove', (event, id) => {
    const lib = store.get('library');
    store.set('library', lib.filter((_, i) => i !== id));
    return { success: true, library: store.get('library') };
  });

  ipcMain.handle('reader:getState', () => {
    return { ...novelData };
  });

  ipcMain.handle('reader:getLinesPerPage', () => {
    return store.get('reader').linesPerPage || 20;
  });

  ipcMain.handle('reader:hide', () => {
    if (readerWindow && !readerWindow.isDestroyed()) {
      readerWindow.hide();
    }
    return true;
  });

  ipcMain.handle('reader:toggleLock', () => {
    toggleLockPosition();
    return { success: true };
  });
}

app.whenReady().then(() => {
  setupIPC();
  createControlWindow();
  registerShortcuts();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    app.quit();
  }
});

app.on('will-quit', () => {
  unregisterShortcuts();
  isQuitting = true;
});

app.on('before-quit', () => {
  isQuitting = true;
});
