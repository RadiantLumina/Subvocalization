const EXTRACT_SCRIPT = `
(function() {
  const selectors = {
    fanqie: [
      '.muye-reader-content',
      '.reader-content',
      '.chapter-content',
      '.content',
      'article'
    ],
    qidian: [
      '.read-content',
      '.chapter-content',
      '.content',
      '.text',
      'article'
    ],
    qqread: [
      '.read-chapter-wrapper',
      '.reader-content',
      '.chapter-content',
      '.content',
      'article'
    ]
  };

  const host = location.hostname;
  let site = null;
  if (host.includes('fanqienovel') || host.includes('fanqie')) site = 'fanqie';
  else if (host.includes('qidian')) site = 'qidian';
  else if (host.includes('qq.com') && host.includes('read')) site = 'qqread';

  let text = '';
  if (site && selectors[site]) {
    for (const sel of selectors[site]) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 200) {
        text = el.textContent;
        break;
      }
    }
  }

  if (!text) {
    const allSelectors = Object.values(selectors).flat();
    for (const sel of allSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 200) {
        text = el.textContent;
        break;
      }
    }
  }

  if (!text) {
    const candidates = document.querySelectorAll('p');
    let best = '';
    let bestLen = 0;
    for (const p of candidates) {
      const t = p.textContent.trim();
      if (t.length > bestLen) bestLen = t.length;
    }
    if (bestLen > 500) {
      best = Array.from(candidates)
        .filter(p => p.textContent.trim().length > 20)
        .map(p => p.textContent.trim())
        .join('\\n\\n');
      text = best;
    }
  }

  if (!text) {
    const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.querySelector('.main') || document.body;
    text = main.textContent;
  }

  const titleEl = document.querySelector('h1') || document.querySelector('h2') || document.querySelector('.title') || document.querySelector('[class*="title"]');
  const title = titleEl ? titleEl.textContent.trim() : document.title;

  return {
    title: title || '未命名',
    content: text.trim(),
    url: location.href,
    host: location.hostname
  };
})();
`;

function buildFigureOutChaptersScript() {
  return `
(function() {
  const links = [];
  const seen = new Set();
  const anchors = document.querySelectorAll('a');
  for (const a of anchors) {
    const text = a.textContent.trim();
    const href = a.href;
    if (!href || seen.has(href)) continue;
    const url = new URL(href, location.href);
    if (url.hostname !== location.hostname) continue;
    if (text.length < 2 || text.length > 50) continue;
    const chPattern = /[第序]?[\\\\s]*[0-9０-９一二三四五六七八九十百千万]+[\\\\s]*[章节回卷]|[Cc]hapter\\\\s*\\\\d+|^[0-9０-９]+[\\\\s\\\\.、．]/;
    if (!chPattern.test(text) && text.length < 5) continue;
    seen.add(href);
    links.push({ title: text, url: href });
    if (links.length >= 500) break;
  }
  return { links, total: links.length };
})();
`;
}

function buildCleanScript() {
  return `
(function() {
  let text = '';
  const badSelectors = [
    'script', 'style', 'iframe', 'noscript', 'svg',
    '.advertisement', '.ad', '.ads', '[class*="ad-"]', '[id*="ad"]',
    '.comment', '.comments', '.footer', '.header', '.nav', '.sidebar',
    '.share', '.like', '.vote', '.recommend', '.related',
    '.toolbar', '.menu', '.popup', '.modal', '.overlay',
    '[class*="banner"]', '[class*="notice"]'
  ];

  const main = document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('.read-content') ||
    document.querySelector('.reader-content') ||
    document.querySelector('.chapter-content') ||
    document.querySelector('.content') ||
    document.querySelector('article') ||
    document.body;

  const clone = main.cloneNode(true);
  for (const sel of badSelectors) {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  }

  text = clone.textContent;

  return text
    .replace(/[\\\\u3000]/g, '  ')
    .replace(/\\\\s*\\\\n\\\\s*/g, '\\\\n')
    .replace(/\\\\n{3,}/g, '\\\\n\\\\n')
    .trim();
})();
`;
}

module.exports = {
  EXTRACT_SCRIPT,
  buildFigureOutChaptersScript,
  buildCleanScript
};
