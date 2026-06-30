const api = window.electronAPI;
let extractedContent = null;
let chapterLinks = [];

const webview = document.getElementById('webview');
const urlInput = document.getElementById('urlInput');
const statusText = document.getElementById('statusText');
const statusUrl = document.getElementById('statusUrl');

webview.addEventListener('did-start-loading', () => {
  statusText.textContent = '加载中...';
  updateNavButtons();
});

webview.addEventListener('did-stop-loading', () => {
  statusText.textContent = '就绪';
  updateUrl();
  updateNavButtons();
});

webview.addEventListener('did-navigate', (e) => {
  updateUrl();
});

webview.addEventListener('did-navigate-in-page', (e) => {
  if (e.isMainFrame) updateUrl();
});

webview.addEventListener('page-title-updated', (e) => {
  document.title = e.title + ' - 隐读';
});

webview.addEventListener('did-fail-load', (e) => {
  if (e.errorCode !== -3) {
    statusText.textContent = '加载失败: ' + e.errorDescription;
  }
});

function updateUrl() {
  try {
    const url = webview.getURL();
    if (url && url !== 'about:blank') {
      urlInput.value = url;
      statusUrl.textContent = url;
    }
  } catch (e) {}
}

function updateNavButtons() {
  try {
    document.getElementById('btnBack').style.opacity = webview.canGoBack() ? '1' : '0.3';
    document.getElementById('btnForward').style.opacity = webview.canGoForward() ? '1' : '0.3';
  } catch (e) {}
}

function navTo(url) {
  webview.loadURL(url);
}

function goBack() {
  if (webview.canGoBack()) webview.goBack();
}

function goForward() {
  if (webview.canGoForward()) webview.goForward();
}

function goRefresh() {
  webview.reload();
}

function handleUrlKeydown(e) {
  if (e.key === 'Enter') {
    let url = urlInput.value.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    webview.loadURL(url);
  }
}

function toggleExtractPanel() {
  const panel = document.getElementById('extractPanel');
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
}

function toggleChapterPanel() {
  const panel = document.getElementById('chapterListPanel');
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
}

async function extractContent() {
  statusText.textContent = '正在提取内容...';
  try {
    const result = await api.browser.extract();
    if (result.success) {
      extractedContent = result;
      document.getElementById('epTitle').textContent = result.title || '无标题';
      document.getElementById('epLen').textContent = (result.content || '').length + ' 字';
      document.getElementById('epUrl').textContent = result.host || '';
      document.getElementById('epContent').textContent = result.content;
      document.getElementById('extractPanel').style.display = 'flex';
      statusText.textContent = '内容提取成功';
    } else {
      alert('提取失败: ' + (result.error || '未知错误'));
      statusText.textContent = '提取失败';
    }
  } catch (err) {
    alert('提取出错: ' + err.message);
    statusText.textContent = '提取出错';
  }
}

async function extractChapters() {
  statusText.textContent = '正在扫描目录...';
  try {
    const result = await api.browser.extractChapters();
    if (result.success && result.links && result.links.length > 0) {
      chapterLinks = result.links;
      const list = document.getElementById('chapterPanelList');
      list.innerHTML = result.links.map((link, i) =>
        '<a onclick="openChapter(' + i + ')" title="' + escapeAttr(link.url) + '">' +
        escapeHtml(link.title) +
        '</a>'
      ).join('');
      document.getElementById('chapterListPanel').style.display = 'flex';
      statusText.textContent = '找到 ' + result.links.length + ' 个章节链接';
    } else {
      alert('未找到章节链接，请确保已打开小说目录页');
      statusText.textContent = '未找到章节';
    }
  } catch (err) {
    alert('目录提取出错: ' + err.message);
    statusText.textContent = '目录提取出错';
  }
}

function openChapter(index) {
  if (chapterLinks[index]) {
    webview.loadURL(chapterLinks[index].url);
  }
}

async function cleanContent() {
  statusText.textContent = '正在清洗数据...';
  try {
    const result = await api.browser.clean();
    if (result.success && result.content) {
      extractedContent = {
        title: document.title.replace(' - 隐读', ''),
        content: result.content,
        url: webview.getURL(),
        host: new URL(webview.getURL()).hostname
      };
      document.getElementById('epTitle').textContent = extractedContent.title;
      document.getElementById('epLen').textContent = result.content.length + ' 字';
      document.getElementById('epUrl').textContent = extractedContent.host;
      document.getElementById('epContent').textContent = result.content;
      document.getElementById('extractPanel').style.display = 'flex';
      statusText.textContent = '数据清洗完成';
    } else {
      alert('清洗失败');
      statusText.textContent = '清洗失败';
    }
  } catch (err) {
    alert('清洗出错: ' + err.message);
    statusText.textContent = '清洗出错';
  }
}

async function startReadExtracted() {
  if (!extractedContent || !extractedContent.content) {
    alert('请先提取内容');
    return;
  }
  const lines = extractedContent.content.split('\n').filter(l => l.trim());
  const chapters = [{
    title: extractedContent.title || '网页内容',
    content: lines.join('\n'),
    index: 0
  }];
  await api.loadNovel({
    title: extractedContent.title || '网页小说',
    chapters: chapters,
    currentChapter: 0,
    currentPage: 0,
    source: 'web'
  });
  await api.saveToLibrary({
    title: extractedContent.title || '网页小说',
    url: extractedContent.url,
    source: 'web',
    chapters: 1
  });
  statusText.textContent = '已在阅读窗口中打开';
}

function copyExtracted() {
  if (!extractedContent || !extractedContent.content) {
    alert('请先提取内容');
    return;
  }
  navigator.clipboard.writeText(extractedContent.content).then(() => {
    statusText.textContent = '已复制到剪贴板';
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = extractedContent.content;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    statusText.textContent = '已复制到剪贴板';
  });
}

async function saveExtracted() {
  if (!extractedContent) {
    alert('请先提取内容');
    return;
  }
  await api.saveToLibrary({
    title: extractedContent.title || '网页内容',
    url: extractedContent.url,
    source: 'web',
    chapters: 1
  });
  alert('已加入书库');
  statusText.textContent = '已加入书库';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

api.onNavigateTo(url => {
  if (url) navTo(url);
});
