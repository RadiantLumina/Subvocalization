const api = window.electronAPI;
let currentNovel = null;
let appSettings = null;
let isRecordingShortcut = false;
let recordingKeyId = null;

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const tab = document.getElementById('tab-' + name);
  if (tab) tab.classList.add('active');
  const nav = document.querySelector('[data-tab="' + name + '"]');
  if (nav) nav.classList.add('active');
  if (name === 'library') loadLibrary();
  if (name === 'settings') loadSettings();
  if (name === 'source') {
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('statusBar').textContent = '';
  }
}

async function handleLocalFile() {
  const statusBar = document.getElementById('statusBar');
  statusBar.textContent = '正在选择文件...';
  const result = await api.openFile();
  if (result.canceled || !result.filePaths.length) {
    statusBar.textContent = '已取消';
    return;
  }
  const filePath = result.filePaths[0];
  statusBar.textContent = '正在读取文件...';
  const data = await api.readFile(filePath);
  if (!data.success) {
    statusBar.textContent = '读取失败: ' + data.error;
    return;
  }
  currentNovel = {
    title: data.name,
    path: filePath,
    source: 'local',
    chapters: data.chapters,
    encoding: data.encoding,
    totalChars: data.totalChars
  };
  document.getElementById('fileName').textContent = data.name;
  document.getElementById('fileSize').textContent = formatSize(currentNovel.totalChars);
  document.getElementById('fileEncoding').textContent = '编码: ' + data.encoding;
  document.getElementById('fileChapters').textContent = data.chapters.length + ' 章';
  document.getElementById('startReadBtn').style.display = 'inline-block';
  document.getElementById('fileInfo').style.display = 'block';
  if (data.chapters.length > 1) {
    document.getElementById('chapterListContainer').style.display = 'block';
    const ul = document.getElementById('chapterList');
    ul.innerHTML = data.chapters.map((ch, i) =>
      '<li onclick="selectChapter(' + i + ')">' + escapeHtml(ch.title) + '</li>'
    ).join('');
  }
  statusBar.textContent = '文件加载成功，共 ' + data.chapters.length + ' 章';

  await api.saveToLibrary({
    title: data.name,
    path: filePath,
    source: 'local',
    chapters: data.chapters.length
  });
}

async function handleWebSource(site) {
  const urls = {
    fanqie: 'https://fanqienovel.com/',
    qidian: 'https://www.qidian.com/',
    qqread: 'https://book.qq.com/'
  };
  const url = urls[site];
  if (!url) return;
  const statusBar = document.getElementById('statusBar');
  statusBar.textContent = '正在打开浏览器窗口，请在浏览器中登录账号...';
  await api.browser.open(url);
  statusBar.textContent = '浏览器窗口已打开，请登录后找到小说章节页面，点击右上角"提取内容"按钮';
}

function selectChapter(index) {
  document.querySelectorAll('.chapter-list li').forEach(li => li.classList.remove('active'));
  const allLi = document.querySelectorAll('.chapter-list li');
  if (allLi[index]) allLi[index].classList.add('active');
  if (currentNovel) {
    currentNovel.startChapter = index;
    startReading();
  }
}

async function startReading() {
  if (!currentNovel) return;
  const startCh = currentNovel.startChapter || 0;
  await api.loadNovel({
    title: currentNovel.title,
    chapters: currentNovel.chapters,
    currentChapter: startCh,
    currentPage: 0,
    source: currentNovel.source
  });
  document.getElementById('statusBar').textContent = '阅读窗口已打开';
}

async function loadLibrary() {
  const lib = await api.getLibrary();
  const grid = document.getElementById('libraryGrid');
  if (!lib.length) {
    grid.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><p>还没有添加任何小说</p><p class="sub">从左侧来源中选择文件或网页来添加</p></div>';
    return;
  }
  grid.innerHTML = lib.map((item, i) => {
    const tag = item.source === 'local'
      ? '<span class="source-tag local">本地</span>'
      : '<span class="source-tag web">网页</span>';
    return '<div class="library-item" style="position:relative" onclick="openFromLibrary(' + i + ')">' +
      '<button class="remove-btn" onclick="event.stopPropagation();removeFromLibrary(' + i + ')">x</button>' +
      '<h4>' + escapeHtml(item.title) + '</h4>' +
      '<div class="meta">' + (item.chapters || '') + ' 章</div>' +
      tag +
      '</div>';
  }).join('');
}

async function openFromLibrary(index) {
  const lib = await api.getLibrary();
  const item = lib[index];
  if (!item) return;
  if (item.source === 'local' && item.path) {
    const data = await api.readFile(item.path);
    if (data.success) {
      currentNovel = {
        title: item.title,
        path: item.path,
        source: 'local',
        chapters: data.chapters,
        encoding: data.encoding,
        totalChars: data.totalChars
      };
      document.getElementById('fileName').textContent = item.title;
      document.getElementById('fileSize').textContent = formatSize(data.totalChars);
      document.getElementById('fileEncoding').textContent = '编码: ' + data.encoding;
      document.getElementById('fileChapters').textContent = data.chapters.length + ' 章';
      document.getElementById('startReadBtn').style.display = 'inline-block';
      document.getElementById('fileInfo').style.display = 'block';
      if (data.chapters.length > 1) {
        document.getElementById('chapterListContainer').style.display = 'block';
        document.getElementById('chapterList').innerHTML = data.chapters.map((ch, i) =>
          '<li onclick="selectChapter(' + i + ')">' + escapeHtml(ch.title) + '</li>'
        ).join('');
      }
      switchTab('source');
      document.getElementById('statusBar').textContent = '已加载: ' + item.title;
    }
  } else if (item.url) {
    await api.browser.open(item.url);
  }
}

async function removeFromLibrary(index) {
  await api.removeFromLibrary(index);
  loadLibrary();
}

async function loadSettings() {
  appSettings = await api.getSettings();
  const r = appSettings.reader;
  document.getElementById('setWidth').value = r.width || 600;
  document.getElementById('setHeight').value = r.height || 400;
  document.getElementById('setOpacity').value = Math.round((r.opacity || 0.85) * 100);
  document.getElementById('setFontSize').value = r.fontSize || 16;
  document.getElementById('setFontFamily').value = r.fontFamily || 'Microsoft YaHei, SimSun, serif';
  document.getElementById('setPageMode').value = r.pageMode || 'scroll';
  document.getElementById('setLinesPerPage').value = r.linesPerPage || 20;
  document.getElementById('setBgColor').value = r.bgColor || '#1a1a2e';
  document.getElementById('setTextColor').value = r.textColor || '#e0e0e0';
  updateSizeLabel();
  updateOpacityLabel();
  updateFontSizeLabel();
  loadShortcutSettings(appSettings.shortcuts);

  document.getElementById('setLinesPerPage').oninput = function() {
    document.getElementById('setLinesPerPageVal').textContent = this.value + '行';
  };
  document.getElementById('setLinesPerPageVal').textContent = r.linesPerPage + '行';
}

function updateSizeLabel() {
  document.getElementById('setWidthVal').textContent = document.getElementById('setWidth').value + 'px';
  document.getElementById('setHeightVal').textContent = document.getElementById('setHeight').value + 'px';
}

function updateOpacityLabel() {
  document.getElementById('setOpacityVal').textContent = document.getElementById('setOpacity').value + '%';
}

function updateFontSizeLabel() {
  document.getElementById('setFontSizeVal').textContent = document.getElementById('setFontSize').value + 'px';
}

function loadShortcutSettings(shortcuts) {
  const container = document.getElementById('shortcutSettings');
  const labels = {
    toggleVisible: '显示/隐藏阅读窗',
    nextPage: '下一页',
    prevPage: '上一页',
    nextChapter: '下一章',
    prevChapter: '上一章',
    lockPosition: '锁定/解锁位置',
    toggleStealth: '切换隐身模式',
    increaseOpacity: '增加透明度',
    decreaseOpacity: '减少透明度'
  };
  container.innerHTML = Object.keys(shortcuts).map(key =>
    '<div class="shortcut-item">' +
    '<label>' + (labels[key] || key) + '</label>' +
    '<span class="key-input" id="key-' + key + '" onclick="startRecordShortcut(\'' + key + '\')">' +
    (shortcuts[key] || '未设置') +
    '</span>' +
    '</div>'
  ).join('');
}

function startRecordShortcut(keyId) {
  if (isRecordingShortcut) return;
  isRecordingShortcut = true;
  recordingKeyId = keyId;
  const el = document.getElementById('key-' + keyId);
  el.classList.add('recording');
  el.textContent = '按下组合键...';
  document.addEventListener('keydown', recordShortcut);
}

function recordShortcut(e) {
  e.preventDefault();
  e.stopPropagation();
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');
  const key = e.key;
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return;
  let keyName = key;
  if (key === ' ') keyName = 'Space';
  else if (key.length === 1) keyName = key.toUpperCase();
  else if (key === 'ArrowUp') keyName = 'Up';
  else if (key === 'ArrowDown') keyName = 'Down';
  else if (key === 'ArrowLeft') keyName = 'Left';
  else if (key === 'ArrowRight') keyName = 'Right';
  parts.push(keyName);
  const combo = parts.join('+');
  const el = document.getElementById('key-' + recordingKeyId);
  el.textContent = combo;
  el.classList.remove('recording');
  document.removeEventListener('keydown', recordShortcut);
  isRecordingShortcut = false;
  recordingKeyId = null;
}

async function saveAllSettings() {
  const readerSettings = {
    width: parseInt(document.getElementById('setWidth').value),
    height: parseInt(document.getElementById('setHeight').value),
    opacity: parseInt(document.getElementById('setOpacity').value) / 100,
    fontSize: parseInt(document.getElementById('setFontSize').value),
    fontFamily: document.getElementById('setFontFamily').value,
    pageMode: document.getElementById('setPageMode').value,
    linesPerPage: parseInt(document.getElementById('setLinesPerPage').value),
    bgColor: document.getElementById('setBgColor').value,
    textColor: document.getElementById('setTextColor').value
  };
  await api.setReaderSettings(readerSettings);

  const shortcutInputs = document.querySelectorAll('.key-input');
  const shortcuts = {};
  shortcutInputs.forEach(el => {
    const keyId = el.id.replace('key-', '');
    shortcuts[keyId] = el.textContent;
  });
  if (Object.keys(shortcuts).length > 0) {
    await api.setShortcuts(shortcuts);
  }
  alert('设置已保存');
}

async function resetShortcuts() {
  if (!confirm('确定恢复默认快捷键设置？')) return;
  const result = await api.resetShortcuts();
  if (result.success) {
    loadShortcutSettings(result.shortcuts);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatSize(chars) {
  if (chars > 1000000) return (chars / 1000000).toFixed(1) + 'M 字';
  if (chars > 10000) return (chars / 10000).toFixed(1) + '万字';
  return chars + ' 字';
}

api.onOpacityChanged((v) => {
  if (document.getElementById('setOpacity')) {
    document.getElementById('setOpacity').value = Math.round(v * 100);
    updateOpacityLabel();
  }
});

api.onLockChanged((locked) => {
  document.getElementById('statusBar').textContent = locked ? '位置已锁定' : '位置已解锁';
});

api.onStealthChanged((stealth) => {
  document.getElementById('statusBar').textContent = stealth ? '已进入隐身模式' : '已退出隐身模式';
});

switchTab('source');
loadLibrary();
