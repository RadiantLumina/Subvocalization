const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

function detectEncoding(buffer) {
  const result = jschardet.detect(buffer);
  if (result && result.encoding && result.confidence > 0.5) {
    const enc = result.encoding.toLowerCase();
    if (enc === 'gb2312' || enc === 'gbk' || enc === 'gb18030') return 'gbk';
    if (enc === 'big5') return 'big5';
    if (enc === 'utf-8' || enc === 'ascii') return 'utf-8';
    return 'utf-8';
  }
  return 'utf-8';
}

function readTextFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const encoding = detectEncoding(buffer);
  let text;
  try {
    text = iconv.decode(buffer, encoding);
  } catch (e) {
    text = iconv.decode(buffer, 'utf-8');
  }
  return { text, encoding };
}

const CHAPTER_PATTERNS = [
  /^[第序][\u0000-\uFFFF]*?[章节回卷部集篇](\s|$)/,
  /^[Cc][Hh][Aa][Pp][Tt][Ee][Rr]\s*\d+/,
  /^[0-9０-９]+[\.、．\s]+.+$/,
  /^[（(][一二三四五六七八九十百千万0-9０-９]+[)）].*$/,
  /^第[一二三四五六七八九十百千万零0-9０-９]+[章节回].*/,
  /^\s*第[0-9０-９]+\s*[章节回卷].*/,
  /^[〇一二三四五六七八九十百千万]+、/,
  /^\s*[（(]\s*[一二三四五六七八九十百千万0-9０-９]+\s*[)）]/,
];

function isChapterTitle(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 50 || trimmed.length < 2) return false;
  return CHAPTER_PATTERNS.some(p => p.test(trimmed));
}

function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u3000/g, '  ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/^\s*\n/gm, '');
}

function parseChapters(text) {
  const cleaned = cleanText(text);
  const lines = cleaned.split('\n');
  const chapters = [];
  let currentChapter = null;
  let preContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isChapterTitle(line) && chapters.length < 2000) {
      if (currentChapter) {
        currentChapter.content = currentChapter.content.join('\n').trim();
      }
      currentChapter = {
        title: line.trim(),
        content: [],
        index: chapters.length
      };
      chapters.push(currentChapter);
    } else if (currentChapter) {
      const trimmed = line.trim();
      if (trimmed) {
        currentChapter.content.push(trimmed);
      } else if (currentChapter.content.length > 0) {
        currentChapter.content.push('');
      }
    } else {
      preContent.push(line);
    }
  }

  if (currentChapter) {
    currentChapter.content = currentChapter.content.join('\n').trim();
  }

  if (chapters.length === 0 && preContent.length > 0) {
    chapters.push({
      title: '全文',
      content: preContent.join('\n').trim().split('\n').filter(l => l.trim()).join('\n'),
      index: 0
    });
  }

  if (chapters.length === 0) {
    chapters.push({
      title: '正文',
      content: cleaned.split('\n').filter(l => l.trim()).join('\n'),
      index: 0
    });
  }

  if (preContent.length > 0 && chapters.length > 0) {
    const preText = preContent.filter(l => l.trim()).join('\n');
    if (preText.length > 50) {
      chapters.unshift({
        title: '前言/简介',
        content: preText,
        index: 0
      });
      chapters.forEach((ch, i) => { ch.index = i; });
    }
  }

  return chapters;
}

function splitIntoPages(content, linesPerPage) {
  if (!content) return [''];
  const lines = content.split('\n');
  const pages = [];

  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage).join('\n'));
  }

  if (pages.length === 0) pages.push('');
  return pages;
}

function getFileInfo(filePath) {
  const stats = fs.statSync(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    size: stats.size,
    ext: path.extname(filePath).toLowerCase(),
    mtime: stats.mtime
  };
}

module.exports = {
  readTextFile,
  parseChapters,
  splitIntoPages,
  getFileInfo,
  cleanText
};
