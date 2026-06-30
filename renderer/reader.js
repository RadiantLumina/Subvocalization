const api = window.electronAPI;
let state = {
  chapterTitle: '',
  chapterIndex: 0,
  totalChapters: 0,
  pageIndex: 0,
  totalPages: 0,
  novelTitle: '',
  content: ''
};

let readerConfig = {
  opacity: 0.85,
  fontSize: 16,
  fontFamily: 'Microsoft YaHei, SimSun, serif',
  bgColor: '#1a1a2e',
  textColor: '#e0e0e0',
  pageMode: 'scroll',
  linesPerPage: 20,
  positionLocked: false,
  stealthMode: false
};

api.onLoadContent((data) => {
  state = { ...state, ...data };
  document.getElementById('loading').style.display = 'none';
  document.getElementById('readerContent').style.display = 'block';
  document.getElementById('novelTitle').textContent = data.novelTitle || '隐读';
  document.getElementById('chapterTitle').textContent = data.chapterTitle;
  document.getElementById('textContent').textContent = data.content;
  document.getElementById('pageInfo').textContent = (data.pageIndex + 1) + ' / ' + data.totalPages;
  const chapterPct = data.totalChapters > 0
    ? Math.round((data.chapterIndex + 1) / data.totalChapters * 100)
    : 0;
  document.getElementById('chapterProgress').textContent = '进度 ' + chapterPct + '%';
  document.getElementById('chapterInfo').textContent =
    '第' + (data.chapterIndex + 1) + '/' + data.totalChapters + '章';

  const contentArea = document.getElementById('readerContent');
  contentArea.scrollTop = 0;
});

api.onUpdateSetting((data) => {
  if (data.key === 'config') {
    applyConfig(data.value);
  } else if (data.key === 'positionLocked') {
    readerConfig.positionLocked = data.value;
    updateLockButton();
  } else if (data.key === 'stealthMode') {
    readerConfig.stealthMode = data.value;
  } else if (data.key === 'opacity') {
    readerConfig.opacity = data.value;
  }
});

api.onNav((direction) => {
  navigate(direction);
});

function navigate(direction) {
  api.navigate(direction);
}

function toggleLock() {
  api.toggleLock();
}

function updateLockButton() {
  const btn = document.getElementById('btnLock');
  if (readerConfig.positionLocked) {
    btn.classList.add('locked');
  } else {
    btn.classList.remove('locked');
  }
}

function showQuickSettings() {
  const qs = document.getElementById('quickSettings');
  qs.style.display = 'block';
  document.getElementById('qsOpacity').value = Math.round(readerConfig.opacity * 100);
  document.getElementById('qsFontSize').value = readerConfig.fontSize;
  document.getElementById('qsBgColor').value = readerConfig.bgColor;
  document.getElementById('qsTextColor').value = readerConfig.textColor;
  document.getElementById('qsPageMode').value = readerConfig.pageMode;
  document.getElementById('qsOpacityVal').textContent = Math.round(readerConfig.opacity * 100) + '%';
  document.getElementById('qsFontSizeVal').textContent = readerConfig.fontSize + 'px';
}

function hideQuickSettings() {
  document.getElementById('quickSettings').style.display = 'none';
}

function qsSetOpacity(val) {
  const opacity = parseInt(val) / 100;
  readerConfig.opacity = opacity;
  document.getElementById('qsOpacityVal').textContent = val + '%';
}

function qsSetFontSize(val) {
  readerConfig.fontSize = parseInt(val);
  document.getElementById('qsFontSizeVal').textContent = val + 'px';
  document.getElementById('textContent').style.fontSize = val + 'px';
  document.documentElement.style.setProperty('--reader-font-size', val + 'px');
}

function qsSetBgColor(val) {
  readerConfig.bgColor = val;
  document.getElementById('reader-app').style.background = val;
  document.documentElement.style.setProperty('--reader-bg', val);
}

function qsSetTextColor(val) {
  readerConfig.textColor = val;
  document.getElementById('textContent').style.color = val;
  document.getElementById('chapterTitle').style.color = val;
  document.documentElement.style.setProperty('--reader-text', val);
}

function qsSetPageMode(val) {
  readerConfig.pageMode = val;
}

function applyConfig(config) {
  if (config.fontSize) {
    readerConfig.fontSize = config.fontSize;
    document.getElementById('textContent').style.fontSize = config.fontSize + 'px';
    document.documentElement.style.setProperty('--reader-font-size', config.fontSize + 'px');
  }
  if (config.fontFamily) {
    readerConfig.fontFamily = config.fontFamily;
    document.documentElement.style.setProperty('--reader-font', config.fontFamily);
  }
  if (config.bgColor) {
    readerConfig.bgColor = config.bgColor;
    document.getElementById('reader-app').style.background = config.bgColor;
    document.documentElement.style.setProperty('--reader-bg', config.bgColor);
  }
  if (config.textColor) {
    readerConfig.textColor = config.textColor;
    document.getElementById('textContent').style.color = config.textColor;
    document.getElementById('chapterTitle').style.color = config.textColor;
    document.documentElement.style.setProperty('--reader-text', config.textColor);
  }
  if (config.pageMode !== undefined) {
    readerConfig.pageMode = config.pageMode;
  }
  if (config.linesPerPage !== undefined) {
    readerConfig.linesPerPage = config.linesPerPage;
  }
  if (config.opacity !== undefined) {
    readerConfig.opacity = config.opacity;
  }
  if (config.positionLocked !== undefined) {
    readerConfig.positionLocked = config.positionLocked;
    updateLockButton();
  }
  if (config.showBorder !== undefined) {
    readerConfig.showBorder = config.showBorder;
  }
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (readerConfig && readerConfig.positionLocked && (
    e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
    e.key === 'ArrowUp' || e.key === 'ArrowDown'
  )) {
    return;
  }
});

document.addEventListener('click', (e) => {
  const qs = document.getElementById('quickSettings');
  if (qs.style.display === 'block' && !qs.contains(e.target) && e.target.id !== 'btnSettings') {
    hideQuickSettings();
  }
});
