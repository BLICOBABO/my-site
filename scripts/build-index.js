#!/usr/bin/env node
/**
 * 生成 Agent 知识索引 agent-index.json
 * 用法：node scripts/build-index.js
 * 输出：my-site/agent-index.json（随仓库发布为静态资源，供 Pages Functions 检索）
 *
 * 逻辑：解析站内 HTML → 去掉导航/页脚/脚本 → 转纯文本 → 按句切块 → 输出 JSON
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'agent-index.json');

// 索引入口：文件路径 + 展示名 + 发布后的相对 URL
const ENTRIES = [
  { file: 'index.html',            name: '首页',     url: '/' },
  { file: 'pages/resume.html',     name: '简历',     url: 'pages/resume.html' },
  { file: 'pages/works.html',      name: '作品',     url: 'pages/works.html' },
  { file: 'pages/articles.html',   name: '文章列表', url: 'pages/articles.html' },
  { file: 'pages/quantified.html', name: '量化自我', url: 'pages/quantified.html' },
  { file: 'pages/review.html',     name: '年度回顾', url: 'pages/review.html' },
  { file: 'articles/post1.html',   name: '文章',     url: 'articles/post1.html' },
  { file: 'articles/post2.html',   name: '文章',     url: 'articles/post2.html' },
];

/** 去掉 script / style / 导航 / 页脚 / noscript */
function stripNoise(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<header[^>]*class=["']site-nav["'][\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** HTML → 纯文本：块级标签换行，其余标签剥除，压缩空白 */
function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/li>|<\/h[1-6]>|<\/pre>|<\/div>|<\/tr>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** 按句切块，每块约 maxLen 字符，保留上下文 */
function chunkText(text, maxLen) {
  const sentences = text
    .split(/[。！？；\n]/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
  const chunks = [];
  let cur = '';
  for (const s of sentences) {
    if (cur && (cur + '。' + s).length > maxLen) {
      chunks.push(cur);
      cur = s;
    } else {
      cur = cur ? cur + '。' + s : s;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.filter(function (c) { return c.length >= 4; });
}

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : '';
}

function main() {
  const chunks = [];
  let id = 0;
  for (const entry of ENTRIES) {
    const filePath = path.join(ROOT, entry.file);
    let html;
    try {
      html = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      console.error('[warn] 文件不存在，跳过：' + entry.file);
      continue;
    }
    const clean = stripNoise(html);
    const text = htmlToText(clean);
    const title = extractTitle(html) || entry.name;
    for (const piece of chunkText(text, 280)) {
      chunks.push({
        id: id++,
        source: entry.name,
        title: title,
        url: entry.url,
        text: piece,
      });
    }
  }
  const index = {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    chunkCount: chunks.length,
    chunks: chunks,
  };
  fs.writeFileSync(OUT, JSON.stringify(index, null, 2), 'utf8');
  console.log('已生成 ' + OUT);
  console.log('  chunks: ' + chunks.length);
  console.log('  总字符: ' + chunks.reduce(function (n, c) { return n + c.text.length; }, 0));
}

main();
