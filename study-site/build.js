// Build a single self-contained HTML study site from notes + question data.
// Usage: node build.js
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
marked.setOptions({ gfm: true, breaks: false });

const ROOT = __dirname;
const NOTES = path.join(ROOT, '..', 'notes');
const OUT = path.join(ROOT, '..', 'HUMA1710_Midterm_Study.html');

const topics = [
  { id: 'm21', file: 'M2-1_語理分析通論.md', code: 'M2-1', mod: 2, name: '語理分析通論', src: 'Lecture notes 2.1（李天命 第I篇）' },
  { id: 'm2a', file: 'M2-2a_Classification_of_Questions.md', code: 'M2-2a', mod: 2, name: '語理分析步驟 & 問題分類', src: 'Reading 2a（講者 slides）' },
  { id: 'm22', file: 'M2-2_語言的陷阱.md', code: 'M2-2', mod: 2, name: '語言的陷阱（李天命 6 陷阱）', src: 'Lecture notes 2.2（李天命 第II篇）' },
  { id: 'm2b', file: 'M2-2b_Pitfalls_of_Language_slides.md', code: 'M2-2b', mod: 2, name: '語言的陷阱（講者 4 陷阱 + 謬誤）', src: 'Reading 2b（講者 slides）' },
  { id: 'm23', file: 'M2-3_Language_Copi.md', code: 'M2-3', mod: 2, name: 'Language: Emotive Language & Disputes', src: 'Reading 2.3（Copi，英文）' },
  { id: 'm31', file: 'M3-1_定義_Definition.md', code: 'M3-1', mod: 3, name: '定義 Definition', src: 'Lecture notes 3a + Reading 3.1（Copi 第二章）' },
  { id: 'm32', file: 'M3-2_意義判準_Meaning_Criterion.md', code: 'M3-2', mod: 3, name: '意義判準 Meaning Criterion', src: 'Lecture notes 3b（講者 slides）' },
  { id: 'm33', file: 'M3-3_兩個基要的方法學區分.md', code: 'M3-3', mod: 3, name: '兩個基要的方法學區分', src: 'Reading 3.2（李天命 第III篇）' },
];

const inline = (s) => marked.parseInline(String(s).trim());

// Add ids to headings so the in-page TOC can link to them.
function addHeadingIds(html, prefix) {
  let n = 0;
  const toc = [];
  html = html.replace(/<h([1-4])>([\s\S]*?)<\/h\1>/g, (m, lvl, inner) => {
    const id = `${prefix}-h${++n}`;
    if (lvl === '2' || lvl === '3') toc.push({ id, lvl: +lvl, text: inner.replace(/<[^>]+>/g, '') });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
  return { html, toc };
}

// Turn the "考試速攻" T/F tables into quiz questions; mark the tables so answers are hidden in the notes view.
function extractTF(md, topicId) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{1,4} .*考試速攻/.test(l));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.startsWith('|')) continue;
    const cells = l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.length < 2) continue;
    if (/^:?-{2,}/.test(cells[0])) continue; // separator row
    const m = cells[1].match(/^\*\*(T|F)\*\*\s*(.*)$/);
    if (!m) continue; // header row or non-answer row
    const extra = [m[2], cells[2] || ''].map((x) => x.replace(/^（|）$/g, '').trim()).filter(Boolean).join('；');
    out.push({
      type: 'tf',
      topic: topicId,
      q: inline(cells[0]),
      ans: m[1] === 'T' ? 0 : 1,
      exp: extra ? inline(extra) : '',
      src: 'notes',
    });
  }
  return out;
}

const notes = {};
const tocs = {};
let questions = [];
for (const t of topics) {
  const md = fs.readFileSync(path.join(NOTES, t.file), 'utf8');
  let html = marked.parse(md);
  // hide answers inside the 考試速攻 section tables (click to reveal)
  const idx = html.search(/<h[1-4]>[^<]*考試速攻/);
  if (idx >= 0) {
    const head = html.slice(0, idx);
    const tail = html.slice(idx).replace(/<table>/g, '<table class="selftest">');
    html = head + tail;
  }
  const r = addHeadingIds(html, t.id);
  notes[t.id] = r.html;
  tocs[t.id] = r.toc;
  questions.push(...extractTF(md, t.id));
}

// Hand-written MC / extra TF questions.
const mc = require('./data/mc.js');
for (const row of mc) {
  const [topic, q, opts, ans, exp, tags] = row;
  questions.push({ type: 'mc', topic, q: inline(q), opts: opts.map(inline), ans, exp: inline(exp || ''), tags: tags || [], src: 'mc' });
}

// Lecture-derived questions (if any).
const dataDir = path.join(ROOT, 'data');
for (const f of fs.readdirSync(dataDir).filter((f) => /^lecture_q_.*\.json$/.test(f)).sort()) {
  const date = f.replace(/^lecture_q_|\.json$/g, '');
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch (e) { console.warn('skip bad json', f, e.message); continue; }
  for (const x of arr) {
    if (!topics.find((t) => t.id === x.topic)) continue;
    if (x.type === 'tf') {
      questions.push({ type: 'tf', topic: x.topic, q: inline(x.q), ans: x.ans === true || x.ans === 'T' || x.ans === 0 ? 0 : 1, exp: inline(x.exp || ''), tags: ['lecture'], src: 'lecture ' + date });
    } else if (x.type === 'mc' && Array.isArray(x.opts) && x.opts.length >= 2 && Number.isInteger(x.ans) && x.ans < x.opts.length) {
      questions.push({ type: 'mc', topic: x.topic, q: inline(x.q), opts: x.opts.map(inline), ans: x.ans, exp: inline(x.exp || ''), tags: ['lecture'], src: 'lecture ' + date });
    }
  }
}

// Stable ids: topic + type + running number.
const counters = {};
questions = questions.map((q) => {
  // Lecture questions get their own counter per file so adding notes/MC rows never shifts their ids (and vice versa).
  const lec = q.src && q.src.startsWith('lecture') ? 'L' + q.src.slice(8).replace(/-/g, '') : '';
  const k = q.topic + q.type + lec;
  counters[k] = (counters[k] || 0) + 1;
  return { id: `${q.topic}-${q.type}${lec}-${counters[k]}-${hash(q.q)}`, ...q };
});
// Drop items the lecturer said will not be examined (ids above stay stable).
questions = questions.filter((q) => !(q.tags || []).includes('notest') && !/〔唔考〕/.test(q.q));
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) >>> 0; return h.toString(36).slice(0, 5); }

const cards = require('./data/cards.js').map(([topic, front, back], i) => ({ id: `c${i}-${hash(front)}`, topic, front: inline(front), back: marked.parse(back) }));

function page(file) {
  const p = path.join(ROOT, 'content', file);
  return fs.existsSync(p) ? marked.parse(fs.readFileSync(p, 'utf8')) : '';
}
const pages = { method: page('method.md'), cheat: page('cheat.md'), confuse: page('confuse.md') };

// Lecture insights: concatenate per-lecture files in date order.
const lecDir = path.join(ROOT, 'content', 'lecture');
const lecFiles = fs.existsSync(lecDir) ? fs.readdirSync(lecDir).filter((f) => f.endsWith('.md')).sort() : [];
const lecIntro = page('lecture_intro.md');
const lec = addHeadingIds(lecIntro + lecFiles.map((f) => marked.parse(fs.readFileSync(path.join(lecDir, f), 'utf8'))).join('\n<hr>\n'), 'lec');
pages.lecture = lec.html;
tocs.lecture = lec.toc;

const DATA = { built: new Date().toISOString(), topics: topics.map(({ file, ...t }) => t), notes, tocs, questions, cards, pages };

const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const json = JSON.stringify(DATA).split('</script').join('<\\/script').split(LS).join('\\u2028').split(PS).join('\\u2029');

const tpl = fs.readFileSync(path.join(ROOT, 'src', 'template.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src', 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
const html = tpl
  .replace('/*__CSS__*/', () => css)
  .replace('/*__DATA__*/', () => 'window.DATA=' + json + ';')
  .replace('/*__APP__*/', () => js);
fs.writeFileSync(OUT, html);

const byTopic = {};
for (const q of questions) { byTopic[q.topic] = byTopic[q.topic] || { tf: 0, mc: 0 }; byTopic[q.topic][q.type]++; }
console.log('wrote', OUT, (html.length / 1024).toFixed(0) + ' KB');
console.log('questions', questions.length, JSON.stringify(byTopic));
console.log('cards', cards.length, 'lecture files', lecFiles.length);

// Also emit a copy for local preview serving (dist/ contains only the page).
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), html);

// GitHub Pages entry point (repo root).
fs.writeFileSync(path.join(ROOT, '..', 'index.html'), html);
