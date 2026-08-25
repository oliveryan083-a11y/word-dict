// dict.js —— 单词小词典：查询逻辑（纯函数）+ DOM 渲染 + 发音
// 纯函数部分（Task 2），DOM/发音部分（Task 5）会在后面追加。

function buildIndex(words) {
  const byWord = {};
  const byZh = {};
  for (const w of words) {
    byWord[w.word.toLowerCase()] = w;
    const keywords = String(w.translation || '').split(/[，,;；、\s/]+/).filter(Boolean);
    for (const kw of keywords) {
      if (!byZh[kw]) byZh[kw] = [];
      byZh[kw].push(w);
    }
  }
  return { byWord, byZh };
}

function searchEn(query, index) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { exact: null, suggestions: [] };
  if (index.byWord[q]) return { exact: index.byWord[q], suggestions: [] };
  const suggestions = Object.keys(index.byWord)
    .filter((w) => w.startsWith(q))
    .slice(0, 20)
    .map((w) => index.byWord[w]);
  return { exact: null, suggestions };
}

function searchZh(query, index) {
  const q = String(query || '').trim();
  if (!q) return [];
  if (index.byZh[q]) return index.byZh[q];
  const seen = new Set();
  const results = [];
  for (const kw of Object.keys(index.byZh)) {
    if (kw.includes(q)) {
      for (const w of index.byZh[kw]) {
        if (!seen.has(w.word)) { seen.add(w.word); results.push(w); }
      }
    }
  }
  return results.slice(0, 20);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildIndex, searchEn, searchZh };
}

// ===== 浏览器运行部分（Node 测试环境不执行） =====
let INDEX = null;
let VOICES = [];

function formatExchange(ex) {
  if (!ex) return '';
  const map = { p: '过去式', d: '过去分词', i: '现在分词', '3': '第三人称单数', s: '复数', r: '比较级', t: '最高级' };
  return ex.split('/').map((seg) => {
    const idx = seg.indexOf(':');
    if (idx < 0) return seg;
    const k = seg.slice(0, idx), v = seg.slice(idx + 1);
    return map[k] ? `${map[k]}：${v}` : seg;
  }).join('；');
}

function renderWord(e) {
  const r = document.getElementById('result');
  const starStr = '★'.repeat(e.star || 0) + '☆'.repeat(Math.max(0, 5 - (e.star || 0)));
  const phParts = [];
  if (e.phonetic) phParts.push('英 [' + e.phonetic + ']');
  if (e.usphone) phParts.push('美 [' + e.usphone + ']');
  const phHtml = phParts.length ? `<span class="phonetic">${phParts.join(' ')}</span>` : '';
  const exHtml = e.example
    ? `<div class="example"><div class="en">${e.example}</div><div class="cn">${e.example_cn || ''}</div></div>`
    : '';
  const exText = e.exchange ? `🔁 词形变化：${formatExchange(e.exchange)}` : '';
  const phrases = e.phrases || [];
  const phraseHtml = phrases.length
    ? `<div class="meta-line phrase-list">💬 常用搭配：${phrases.slice(0, 5).map((p) => `<span class="phrase-item">${p.en}（${p.cn}）</span>`).join('')}</div>`
    : '';
  const faved = isFav(e.word);
  r.innerHTML = `
    <div class="word-row">
      <span class="word">${e.word}</span>
      ${phHtml}
      <button class="speak-btn" onclick="speakUK('${e.word}')">英 🔊</button>
      <button class="speak-btn" onclick="speakUS('${e.word}')">美 🔊</button>
      <button class="fav-btn ${faved ? 'faved' : ''}" onclick="toggleFav('${e.word}')">${faved ? '✅ 已收藏' : '⭐ 收藏'}</button>
    </div>
    <div class="pos-line">📖 ${e.translation || ''} · ${e.pos ? e.pos + '.' : ''}</div>
    ${exHtml}
    ${exText ? `<div class="meta-line">${exText}</div>` : ''}
    ${phraseHtml}
    <div class="meta-line">⭐ 重要度：<span class="star">${starStr}</span></div>`;
}

function renderSuggestions(list) {
  const r = document.getElementById('result');
  const items = list.map((e) =>
    `<button class="suggest-item" onclick="doSearchWord('${e.word}')">${e.word} — ${e.translation}</button>`
  ).join('');
  r.innerHTML = `<p class="empty-tip">你要找的是不是：</p>${items}`;
}

function doSearchWord(word) {
  const res = searchEn(word, INDEX);
  if (res.exact) renderWord(res.exact);
}

function renderEmpty() {
  document.getElementById('result').innerHTML =
    '<p class="empty-tip">没找到这个单词 😢，检查一下拼写吧</p>';
}

function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  if (/[一-龥]/.test(q)) {
    const list = searchZh(q, INDEX);
    list.length ? renderSuggestions(list) : renderEmpty();
  } else {
    const res = searchEn(q, INDEX);
    if (res.exact) renderWord(res.exact);
    else if (res.suggestions.length) renderSuggestions(res.suggestions);
    else renderEmpty();
  }
}

function speak(word, lang) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = lang;
  u.rate = 0.9;
  const v = VOICES.find((x) => x.lang.replace('_', '-') === lang)
    || VOICES.find((x) => x.lang.toLowerCase().startsWith('en'));
  if (v) u.voice = v;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
function speakUK(w) { speak(w, 'en-GB'); }
function speakUS(w) { speak(w, 'en-US'); }

const FAV_KEY = 'dict_favs';
function getFavs() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
  catch (err) { return []; }
}
function saveFavs(favs) { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }
function isFav(word) { return getFavs().some((f) => f.word === word); }
function toggleFav(word) {
  let favs = getFavs();
  if (favs.some((f) => f.word === word)) {
    favs = favs.filter((f) => f.word !== word);
  } else {
    const entry = INDEX.byWord[word.toLowerCase()];
    if (entry) favs.push(entry);
  }
  saveFavs(favs);
  const res = searchEn(word, INDEX);
  if (res.exact) renderWord(res.exact);
}
function showFavList() {
  const favs = getFavs();
  const r = document.getElementById('result');
  if (!favs.length) {
    r.innerHTML = '<p class="empty-tip">生词本还是空的，去查单词收藏吧 ⭐</p>';
    return;
  }
  const items = favs.map((f) =>
    `<div class="fav-item"><button class="suggest-item" onclick="doSearchWord('${f.word}')">${f.word} — ${f.translation}</button><button class="fav-del" onclick="removeFav('${f.word}')">🗑</button></div>`
  ).join('');
  r.innerHTML = `<p class="fav-title">📚 生词本（${favs.length} 个）</p>${items}`;
}
function removeFav(word) {
  saveFavs(getFavs().filter((f) => f.word !== word));
  showFavList();
}

function initDict() {
  INDEX = buildIndex(window.DICT || []);
  document.getElementById('search-btn').addEventListener('click', doSearch);
  document.getElementById('search-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') doSearch();
  });
  const favBtn = document.getElementById('fav-list-btn');
  if (favBtn) favBtn.addEventListener('click', showFavList);
  if ('speechSynthesis' in window) {
    VOICES = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => { VOICES = window.speechSynthesis.getVoices(); };
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initDict);
}
