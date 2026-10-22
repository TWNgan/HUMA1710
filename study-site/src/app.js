(function () {
  'use strict';
  const D = window.DATA;
  const KEY = 'huma1710_mid_v1';
  const EXAM_AT = new Date('2026-10-23T09:30:00+08:00');
  const blank = () => ({ q: {}, c: {}, plan: {}, exams: [], settings: {}, active: null, lastResult: null });
  let S = (() => { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return blank(); } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or disabled */ } };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const app = $('#app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const T = Object.fromEntries(D.topics.map((t) => [t.id, t]));
  const TIDS = D.topics.map((t) => t.id);
  const QS = D.questions;
  const QBY = Object.fromEntries(QS.map((q) => [q.id, q]));
  const CBY = Object.fromEntries(D.cards.map((c) => [c.id, c]));
  const pill = (tid) => `<span class="pill m${T[tid].mod}">${esc(T[tid].code)}</span>`;
  const typePill = (q) => (q.type === 'tf' ? '<span class="pill tf">T/F</span>' : '<span class="pill">MC</span>') + (q.tags && q.tags.includes('lecture') ? ' <span class="pill lec">課堂</span>' : '');
  function toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 1900); }

  // ---------- settings ----------
  function applySettings() {
    const dark = S.settings.theme ? S.settings.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--fs', (S.settings.fs || 16) + 'px');
  }
  $('#themeBtn').onclick = () => { S.settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; save(); applySettings(); };
  $('#fontUp').onclick = () => { S.settings.fs = Math.min(22, (S.settings.fs || 16) + 1); save(); applySettings(); };
  $('#fontDown').onclick = () => { S.settings.fs = Math.max(13, (S.settings.fs || 16) - 1); save(); applySettings(); };

  // ---------- progress model ----------
  // per question: a=attempts c=correct w=wrong k=current correct streak r=last right x=last wrong
  function record(id, ok) {
    const st = S.q[id] || (S.q[id] = { a: 0, c: 0, w: 0, k: 0 });
    st.a++;
    if (ok) { st.c++; st.k++; st.r = Date.now(); } else { st.w++; st.k = 0; st.x = Date.now(); }
    save();
  }
  // A question stays in the wrong-book until answered right twice in a row.
  const isWrongNow = (st) => !!(st && st.w > 0 && st.k < 2);
  function topicStats(tid) {
    const qs = QS.filter((q) => q.topic === tid);
    let seen = 0, att = 0, cor = 0, solid = 0, wrongNow = 0;
    for (const q of qs) {
      const st = S.q[q.id];
      if (!st) continue;
      seen++; att += st.a; cor += st.c;
      if (st.k > 0) solid++;
      if (isWrongNow(st)) wrongNow++;
    }
    return { total: qs.length, seen, att, cor, solid, wrongNow };
  }

  // ---------- router ----------
  let onKey = null;
  let cleanup = null;
  const views = { home, plan: () => pageView('method', '🧭 讀書方法 & 衝刺計劃'), notes, cheat: () => pageView('cheat', '⚡ 速記表 High-yield'), confuse: () => pageView('confuse', '🔀 易混淆概念對照'), lecture, quiz, exam, cards, wrong, search };
  function route() {
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    onKey = null;
    const parts = location.hash.replace(/^#\/?/, '').split('/').map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
    const name = views[parts[0]] ? parts[0] : 'home';
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.r === name));
    views[name](...parts.slice(1));
    if (!route.keepScroll) window.scrollTo(0, 0);
    route.keepScroll = false;
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', (e) => {
    if (!onKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    onKey(e);
  });
  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#searchInput').value.trim();
    if (v) location.hash = '#/search/' + encodeURIComponent(v);
  });

  // ---------- home ----------
  const PLAN = [
    { id: 'pre', when: '今晚', min: 10, text: '🎯 <b>診斷測驗 Pretest</b>（20 題混合）——未溫都照做，估錯都會令之後記得更牢（pretesting effect）', href: '#/quiz/pre' },
    { id: 'frame', when: '今晚', min: 20, text: '⚡ 讀 <b>速記表</b> + 🔀 <b>易混淆對照</b>，先搭好成科嘅框架', href: '#/cheat' },
    { id: 'm2', when: '今晚', min: 60, text: '📚 <b>Module 2 逐章</b>：每章先睇「一頁總覽」→ 撳「測試呢章」做 15 題 → 睇錯題解釋', href: '#/notes/m21' },
    { id: 'm3', when: '今晚', min: 50, text: '📚 <b>Module 3 逐章</b>：同上（定義、意義判準、析合區分）', href: '#/notes/m31' },
    { id: 'lec', when: '今晚', min: 10, text: '🎙️ 睇 <b>課堂補充</b>：講者喺堂上講過嘅考試提示同例子', href: '#/lecture' },
    { id: 'mock', when: '今晚', min: 45, text: '⏱️ <b>模擬考</b> 40 題 / 50 分鐘（同真考試一樣格式）', href: '#/exam' },
    { id: 'redo', when: '今晚', min: 20, text: '❌ <b>錯題本</b>：重做所有錯題，直到每題連續答啱兩次', href: '#/wrong' },
    { id: 'sleep', when: '今晚', min: 0, text: '😴 <b>瞓覺！</b>（最少 6–7 個鐘）——瞓覺會鞏固今晚記嘅嘢；通頂反而蝕底', href: '#/plan' },
    { id: 'am-cards', when: '明早', min: 15, text: '🃏 <b>閃卡</b>：只溫「未熟」嘅卡', href: '#/cards' },
    { id: 'am-wrong', when: '明早', min: 15, text: '❌ 錯題本最後一 round + ⚡ 速記表最後掃一次', href: '#/wrong' },
    { id: 'am-go', when: '明早', min: 0, text: '🎒 帶 <b>Student ID、鉛筆、擦膠</b>；09:30 開考（LT-B），<b>09:45 後唔准入場</b>', href: '#/home' },
  ];
  function home() {
    const att = QS.reduce((s, q) => s + (S.q[q.id] ? S.q[q.id].a : 0), 0);
    const cor = QS.reduce((s, q) => s + (S.q[q.id] ? S.q[q.id].c : 0), 0);
    const seen = QS.filter((q) => S.q[q.id]).length;
    const wrongN = QS.filter((q) => isWrongNow(S.q[q.id])).length;
    const known = D.cards.filter((c) => (S.c[c.id] || 0) >= 3).length;
    const last = S.exams[S.exams.length - 1];
    const rows = D.topics.map((t) => {
      const s = topicStats(t.id);
      const cov = pct(s.seen, s.total), acc = pct(s.cor, s.att);
      return `<div class="topicrow"><div>${pill(t.id)} <a href="#/notes/${t.id}">${esc(t.name)}</a></div>
        <div><div class="bar" title="做過 ${s.seen}/${s.total}"><i style="width:${cov}%"></i></div>
        <div class="small muted">做過 ${s.seen}/${s.total} · 準確率 ${s.att ? acc + '%' : '—'}${s.wrongNow ? ` · <span style="color:var(--bad)">錯題 ${s.wrongNow}</span>` : ''}</div></div>
        <a class="btn small" href="#/quiz/topic/${t.id}">練 ▶</a></div>`;
    }).join('');
    const planHtml = ['今晚', '明早'].map((w) => `<h3>${w}</h3><ul class="checklist">${PLAN.filter((p) => p.when === w).map((p) => `
        <li><input type="checkbox" data-plan="${p.id}" ${S.plan[p.id] ? 'checked' : ''} aria-label="完成">
        <div class="${S.plan[p.id] ? 'done' : ''}">${p.text}${p.min ? ` <span class="muted small">≈${p.min} 分鐘</span>` : ''} <a href="${p.href}" class="small">前往 →</a></div></li>`).join('')}</ul>`).join('');
    app.innerHTML = `
      <div class="card hero">
        <h1>HUMA1710 Midterm 衝刺站</h1>
        <div>Modules 2 & 3 · MC + True/False · 50 分鐘 · LT-B</div>
        <div class="countdown" id="cd"></div>
        <div class="small" style="opacity:.9">考試：2026年10月23日（五）09:30–10:20 · 09:45 後唔准入場 · 09:45 前 / 10:15 後唔准提早離場</div>
        <div class="row" style="margin-top:.8rem">
          <a class="btn primary big" href="#/quiz/pre">🎯 由診斷測驗開始</a>
          <a class="btn" href="#/quiz">✍️ 智能練習</a>
          <a class="btn" href="#/exam">⏱️ 模擬考</a>
          <a class="btn" href="#/plan">🧭 點樣用最有效？</a>
        </div>
      </div>
      <div class="card" style="border-color:var(--warn);background:var(--warn-soft)">
        <b>⭐ 講者堂上講過嘅考試提示</b>（<a href="#/lecture">詳情 → 課堂補充</a>）
        <ul style="margin:.4rem 0 0">
          <li><b>少過 50 題、50 分鐘</b>；題型：<b>T/F</b>、<b>問題分類（概念/事實/評價 三選一）</b>、<b>ABCD 四選一</b>（冇 ABCDE）；<b>T/F 每題分數較少</b>。</li>
          <li><b>答錯唔扣分</b>（答對有分、答錯冇分）→ 每題都要答，唔好留白。</li>
          <li>⚠️ <b>「內涵固定則外延固定」（slides 打 * 嗰條）唔考</b>；水嘅化學式等有爭議例子會避開。</li>
          <li>事實問題<b>冇標年份 = 講緊考試當日（現在）</b>嘅事實。</li>
          <li><b>睇清楚句號定問號</b>：「4+5=8。」係錯嘅陳述；「4+5=8？」係一條概念問題。</li>
          <li>問題分類題：選項只有 <b>概念／事實／評價</b>，一條問題只屬一類；次序：<b>先試概念 → 再試事實 → 先至評價</b>；<b>數學一律係概念問題</b>。</li>
          <li>考試範圍：<b>Module 2 + 3</b>；東西方哲學史背景<b>唔考</b>。</li>
        </ul>
      </div>
      <div class="grid">
        <div class="card"><div class="muted small">題庫</div><div class="stat">${seen}<span class="muted" style="font-size:1rem"> / ${QS.length} 題做過</span></div><div class="bar"><i style="width:${pct(seen, QS.length)}%"></i></div></div>
        <div class="card"><div class="muted small">整體準確率</div><div class="stat">${att ? pct(cor, att) + '%' : '—'}</div><div class="bar ok"><i style="width:${pct(cor, att)}%"></i></div></div>
        <div class="card"><div class="muted small">錯題本（未掌握）</div><div class="stat" style="color:var(--bad)">${wrongN}</div><a href="#/wrong">重做錯題 →</a></div>
        <div class="card"><div class="muted small">閃卡已熟（盒 ≥ 3）</div><div class="stat">${known}<span class="muted" style="font-size:1rem"> / ${D.cards.length}</span></div><a href="#/cards">溫閃卡 →</a></div>
        <div class="card"><div class="muted small">最近模擬考</div><div class="stat">${last ? pct(last.correct, last.n) + '%' : '—'}</div><div class="small muted">${last ? `${last.correct}/${last.n} · ${new Date(last.at).toLocaleString('zh-HK')}` : '未做過'}</div></div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
        <div class="card"><h2 style="margin-top:0">🗓️ 衝刺計劃（撳完剔走）</h2>${planHtml}</div>
        <div class="card"><h2 style="margin-top:0">📈 各課題進度</h2>${rows}
          <div class="row" style="margin-top:.8rem"><button class="btn danger small" id="resetBtn">重設所有進度</button></div></div>
      </div>`;
    const cd = $('#cd');
    const tick = () => {
      const ms = EXAM_AT - Date.now();
      if (ms <= 0) { cd.textContent = '考試已開始／完結 — 加油！'; return; }
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
      cd.textContent = `距離開考 ${h} 小時 ${m} 分`;
    };
    tick();
    const iv = setInterval(tick, 20000);
    cleanup = () => clearInterval(iv);
    $$('[data-plan]').forEach((cb) => cb.addEventListener('change', () => { S.plan[cb.dataset.plan] = cb.checked; save(); cb.nextElementSibling.classList.toggle('done', cb.checked); }));
    $('#resetBtn').onclick = () => { if (confirm('真係要清除所有練習記錄、閃卡同計劃進度？')) { S = blank(); save(); applySettings(); home(); toast('已重設'); } };
  }

  // ---------- simple content pages ----------
  function pageView(key, title) {
    const html = D.pages[key] || '<p class="muted">（未有內容）</p>';
    app.innerHTML = `<div class="row no-print" style="justify-content:space-between"><h1>${title}</h1>
      <button class="btn" onclick="window.print()">🖨️ 列印 / 存 PDF</button></div><div class="card prose">${html}</div>`;
    wireSelfTest(app);
  }

  // ---------- notes ----------
  let pendingFind = null;
  function sideNav(active, tocKey) {
    const list = (mod) => D.topics.filter((t) => t.mod === mod).map((t) => `<a href="#/notes/${t.id}" class="${t.id === active ? 'active' : ''}">${esc(t.code)} ${esc(t.name)}</a>`).join('');
    const toc = (D.tocs[tocKey] || []).map((h) => `<a href="javascript:void 0" data-goto="${h.id}" class="l${h.lvl}">${esc(h.text)}</a>`).join('');
    return `<aside class="card notes-side"><h4>Module 2</h4>${list(2)}<h4>Module 3</h4>${list(3)}<h4>其他</h4>
      <a href="#/lecture" class="${active === 'lecture' ? 'active' : ''}">🎙️ 課堂補充</a><a href="#/cheat">⚡ 速記表</a><a href="#/confuse">🔀 易混淆</a>
      ${toc ? `<h4>本頁目錄</h4><div class="toc">${toc}</div>` : ''}</aside>`;
  }
  function wireToc() {
    $$('[data-goto]').forEach((a) => a.addEventListener('click', () => { const el = document.getElementById(a.dataset.goto); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  }
  function wireSelfTest(root) {
    $$('table.selftest td', root).forEach((td) => td.addEventListener('click', () => td.classList.toggle('shown')));
  }
  function notes(tid) {
    if (!T[tid]) tid = 'm21';
    const t = T[tid];
    const nq = QS.filter((q) => q.topic === tid).length;
    const idx = D.topics.findIndex((x) => x.id === tid);
    const prev = D.topics[idx - 1], next = D.topics[idx + 1];
    app.innerHTML = `<div class="notes-layout">${sideNav(tid, tid)}
      <div><div class="card"><div class="row" style="justify-content:space-between">
        <div>${pill(tid)} <span class="muted small">${esc(t.src)}</span></div>
        <div class="row"><a class="btn primary" href="#/quiz/topic/${tid}">✍️ 測試呢章（${nq} 題）</a><button class="btn small" id="revealAll">👁️ 顯示/隱藏 T/F 答案</button></div></div>
        <p class="selftest-hint">💡 先自己諗答案再睇：章尾「考試速攻」表嘅答案已模糊化，撳一下先顯示（active recall）。</p></div>
        <article class="card prose">${D.notes[tid]}</article>
        <div class="card row" style="justify-content:space-between">
          ${prev ? `<a class="btn" href="#/notes/${prev.id}">◀ ${esc(prev.code)}</a>` : '<span></span>'}
          <a class="btn primary big" href="#/quiz/topic/${tid}">讀完？即刻做 15 題 ▶</a>
          ${next ? `<a class="btn" href="#/notes/${next.id}">${esc(next.code)} ▶</a>` : '<span></span>'}</div></div></div>`;
    wireToc();
    wireSelfTest(app);
    let shown = false;
    $('#revealAll').onclick = () => { shown = !shown; $$('table.selftest td').forEach((td) => td.classList.toggle('shown', shown)); };
    if (pendingFind && pendingFind.where === tid) jumpToHit(pendingFind.k);
    pendingFind = null;
  }
  function lecture() {
    const html = D.pages.lecture;
    const nq = QS.filter((q) => q.tags && q.tags.includes('lecture')).length;
    app.innerHTML = `<div class="notes-layout">${sideNav('lecture', 'lecture')}
      <div><div class="card"><h1 style="margin:0">🎙️ 課堂補充（由課堂錄音整理）</h1>
      <p class="muted small">由 10 堂錄音（廣東話）自動轉錄再整理：考試提示、堂上例子、講者強調嘅重點。轉錄可能有錯字，以 slides/readings 為準。</p>
      ${nq ? `<a class="btn primary" href="#/quiz/lecture">✍️ 做課堂題（${nq} 題）</a>` : ''}</div>
      <article class="card prose">${html || '<p class="muted">錄音整理中，稍後更新。</p>'}</article></div></div>`;
    wireToc();
    if (pendingFind && pendingFind.where === 'lecture') jumpToHit(pendingFind.k);
    pendingFind = null;
  }
  const BLOCKS = 'h1,h2,h3,h4,p,li,td,th,blockquote,pre';
  const blocksOf = (root) => $$(BLOCKS, root).filter((el) => !(el.tagName === 'LI' && el.querySelector('p')) && !(el.tagName === 'BLOCKQUOTE' && el.querySelector('p')));
  function jumpToHit(k) {
    const el = blocksOf($('article.prose'))[k];
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background .3s'; el.style.background = 'var(--warn-soft)';
      if (el.tagName === 'TD') el.classList.add('shown');
      setTimeout(() => { el.style.background = ''; }, 2500);
    }, 60);
  }

  // ---------- search ----------
  let SIDX = null;
  function buildIndex() {
    SIDX = [];
    const add = (where, html, label) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      blocksOf(div).forEach((el, k) => SIDX.push({ where, k, label, text: el.textContent }));
    };
    D.topics.forEach((t) => add(t.id, D.notes[t.id], t.code + ' ' + t.name));
    if (D.pages.lecture) add('lecture', D.pages.lecture, '課堂補充');
  }
  function search(term) {
    term = (term || '').trim();
    $('#searchInput').value = term;
    if (!term) { app.innerHTML = '<h1>🔎 搜尋</h1><p class="muted">喺上面輸入關鍵字。</p>'; return; }
    if (!SIDX) buildIndex();
    const lc = term.toLowerCase();
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const mark = (s) => esc(s).replace(new RegExp(esc(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
    const snip = (s) => { const i = s.toLowerCase().indexOf(lc); const a = Math.max(0, i - 40); return (a ? '…' : '') + s.slice(a, i + lc.length + 90) + (i + lc.length + 90 < s.length ? '…' : ''); };
    const hits = SIDX.filter((x) => x.text.toLowerCase().includes(lc)).slice(0, 80);
    const qh = QS.filter((q) => (q.q + ' ' + (q.opts || []).join(' ') + ' ' + q.exp).replace(/<[^>]+>/g, '').toLowerCase().includes(lc)).slice(0, 40);
    app.innerHTML = `<h1>🔎「${esc(term)}」</h1>
      <div class="card"><h2 style="margin-top:0">筆記（${hits.length}${hits.length === 80 ? '+' : ''}）</h2>
      ${hits.map((h, i) => `<div class="hit"><span class="pill">${esc(h.label)}</span> ${mark(snip(h.text))} <a href="javascript:void 0" data-hit="${i}" class="small">前往 →</a></div>`).join('') || '<p class="muted">冇結果</p>'}</div>
      <div class="card"><h2 style="margin-top:0">題目（${qh.length}）</h2>
      ${qh.map((q) => `<div class="hit">${pill(q.topic)} ${typePill(q)} ${q.q}<div class="small"><b>答案：</b>${q.type === 'tf' ? (q.ans === 0 ? '正確 T' : '錯誤 F') : q.opts[q.ans]}${q.exp ? ' — ' + q.exp : ''}</div></div>`).join('') || '<p class="muted">冇結果</p>'}</div>`;
    void re;
    $$('[data-hit]').forEach((a) => a.addEventListener('click', () => {
      const h = hits[+a.dataset.hit];
      pendingFind = h;
      location.hash = h.where === 'lecture' ? '#/lecture' : '#/notes/' + h.where;
    }));
  }

  // ---------- practice quiz ----------
  let sess = null;
  function quiz(a, b) {
    if (a === 'topic' && T[b]) return startQuiz({ topics: [b], type: 'all', count: 15, mode: 'smart', title: `✍️ ${T[b].code} ${T[b].name}` });
    if (a === 'pre') return startQuiz({ topics: TIDS, type: 'all', count: 20, mode: 'unseen', title: '🎯 診斷測驗 Pretest' });
    if (a === 'wrong') {
      const ids = QS.filter((q) => isWrongNow(S.q[q.id])).map((q) => q.id);
      if (!ids.length) { toast('錯題本係空嘅 👍'); return renderSetup(); }
      return startQuiz({ ids: shuffle(ids), title: '❌ 重做錯題', mode: 'wrong' });
    }
    if (a === 'lecture') {
      const ids = QS.filter((q) => q.tags && q.tags.includes('lecture')).map((q) => q.id);
      if (!ids.length) { toast('課堂題整理中'); return renderSetup(); }
      return startQuiz({ ids: shuffle(ids), title: '🎙️ 課堂題', mode: 'smart' });
    }
    if (a === 'run' && sess) return renderQ();
    renderSetup();
  }
  function renderSetup() {
    const st = Object.assign({ topics: TIDS, type: 'all', count: 20, mode: 'smart' }, S.settings.quiz || {});
    const tchk = (mod) => D.topics.filter((t) => t.mod === mod).map((t) => `<label class="chk"><input type="checkbox" name="t" value="${t.id}" ${st.topics.includes(t.id) ? 'checked' : ''}> ${pill(t.id)} ${esc(t.name)} <span class="muted small">(${QS.filter((q) => q.topic === t.id).length})</span></label>`).join('<br>');
    const seg = (name, items, val) => `<div class="seg">${items.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${String(val) === String(v) ? 'checked' : ''}>${l}</label>`).join('')}</div>`;
    app.innerHTML = `<h1>✍️ 練習 Practice</h1>
      <p class="muted">做題（retrieval practice）係研究證實最有效嘅溫書方法；答錯嘅題目會喺幾題之後自動再出現（spaced re-test）。快捷鍵：<span class="kbd">1</span>–<span class="kbd">4</span>/<span class="kbd">A</span>–<span class="kbd">D</span> 揀答案、<span class="kbd">T</span>/<span class="kbd">F</span> 判斷題、<span class="kbd">Enter</span> 下一題。</p>
      <div class="row" style="margin-bottom:1rem"><a class="btn primary" href="#/quiz/pre">🎯 診斷測驗（20 題）</a><a class="btn" href="#/quiz/wrong">❌ 重做錯題</a><a class="btn" href="#/quiz/lecture">🎙️ 課堂題</a></div>
      <form class="card setup" id="qsetup">
        <fieldset><legend>課題 Topics</legend>
          <div class="row small" style="margin-bottom:.4rem"><button type="button" class="btn small" data-sel="all">全選</button><button type="button" class="btn small" data-sel="none">全不選</button><button type="button" class="btn small" data-sel="2">只揀 Module 2</button><button type="button" class="btn small" data-sel="3">只揀 Module 3</button></div>
          <b class="small">Module 2</b><br>${tchk(2)}<br><b class="small">Module 3</b><br>${tchk(3)}
        </fieldset>
        <fieldset><legend>題型</legend>${seg('type', [['all', '全部'], ['mc', 'MC 多項選擇'], ['tf', 'T/F 判斷']], st.type)}</fieldset>
        <fieldset><legend>題數</legend>${seg('count', [[10, '10'], [20, '20'], [30, '30'], [50, '50'], [9999, '全部']], st.count)}</fieldset>
        <fieldset><legend>模式</legend>${seg('mode', [['smart', '🧠 智能（錯題＋未做優先）'], ['random', '🎲 隨機'], ['unseen', '🆕 未做過'], ['wrong', '❌ 只做錯題']], st.mode)}</fieldset>
        <button class="btn primary big" type="submit">開始 ▶</button>
      </form>`;
    const f = $('#qsetup');
    $$('[data-sel]', f).forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.sel;
      $$('input[name=t]', f).forEach((c) => { c.checked = v === 'all' ? true : v === 'none' ? false : T[c.value].mod === +v; });
    }));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const o = {
        topics: $$('input[name=t]:checked', f).map((c) => c.value),
        type: f.type.value, count: +f.count.value, mode: f.mode.value,
      };
      if (!o.topics.length) { toast('揀最少一個課題'); return; }
      S.settings.quiz = o; save();
      startQuiz(o);
    });
  }
  function interleave(arr) {
    arr = shuffle(arr);
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].topic !== arr[i - 1].topic) continue;
      const j = arr.findIndex((x, k) => k > i && x.topic !== arr[i - 1].topic);
      if (j > 0) [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function pickSmart(pool, n, mode) {
    if (mode === 'random') return shuffle(pool).slice(0, n);
    const scored = pool.map((q) => {
      const st = S.q[q.id];
      const p = !st ? 2 : isWrongNow(st) ? 3 : 1 - Math.min(st.k, 4) * 0.2;
      return { q, p: p + Math.random() * 0.9 };
    });
    scored.sort((x, y) => y.p - x.p);
    return interleave(scored.slice(0, n).map((x) => x.q));
  }
  function startQuiz(o) {
    let ids = o.ids;
    if (!ids) {
      let pool = QS.filter((q) => o.topics.includes(q.topic) && (o.type === 'all' || q.type === o.type));
      if (o.mode === 'wrong') pool = pool.filter((q) => isWrongNow(S.q[q.id]));
      if (o.mode === 'unseen') { const un = pool.filter((q) => !S.q[q.id]); if (un.length) pool = un; }
      if (!pool.length) { toast(o.mode === 'wrong' ? '呢個範圍冇錯題 👍' : '冇符合條件嘅題目'); return renderSetup(); }
      ids = pickSmart(pool, Math.min(o.count, pool.length), o.mode).map((q) => q.id);
    }
    sess = { title: o.title || '✍️ 練習', list: ids.slice(), i: 0, orders: {}, attempted: {}, requeued: {}, done: 0, correct: 0, wrongIds: [], cur: null };
    if (location.hash === '#/quiz/run') renderQ(); else location.hash = '#/quiz/run';
  }
  function renderQ() {
    if (!sess) return renderSetup();
    if (sess.i >= sess.list.length) return renderEnd();
    const id = sess.list[sess.i], q = QBY[id];
    if (!q) { sess.i++; return renderQ(); }
    sess.cur = null;
    const order = q.type === 'tf' ? [0, 1] : (sess.orders[sess.i] = sess.orders[sess.i] || shuffle(q.opts.map((_, k) => k)));
    const labels = q.type === 'tf' ? ['⭕ 正確 True', '❌ 錯誤 False'] : order.map((k) => q.opts[k]);
    const keys = q.type === 'tf' ? ['T', 'F'] : ['A', 'B', 'C', 'D', 'E', 'F'];
    const again = sess.attempted[id];
    const uniq = new Set(sess.list).size;
    app.innerHTML = `<div class="qbox">
      <div class="qhead"><b>${esc(sess.title)}</b><span class="muted small">第 ${sess.i + 1} / ${sess.list.length} 題 · 首答啱 ${sess.correct}/${sess.done}</span></div>
      <div class="progress"><i style="width:${pct(sess.done, uniq)}%"></i></div>
      <div class="card">
        <div class="row">${pill(q.topic)} ${typePill(q)} ${again ? '<span class="pill lec">🔁 再試</span>' : ''}</div>
        <div class="qtext">${q.q}</div>
        <div class="opts ${q.type === 'tf' ? 'tfopts' : ''}">${labels.map((l, i) => `<button class="opt" data-orig="${order[i]}"><span class="key">${keys[i]}</span><span>${l}</span></button>`).join('')}</div>
        <div id="fb"></div>
      </div>
      <div class="sticky-actions"><button class="btn" id="quitBtn">結束</button><button class="btn primary big" id="nextBtn" style="display:none">下一題 ▶</button></div></div>`;
    $$('.opt').forEach((b) => b.addEventListener('click', () => answerQ(+b.dataset.orig)));
    $('#nextBtn').onclick = nextQ;
    $('#quitBtn').onclick = () => { sess.list = sess.list.slice(0, sess.i + (sess.cur ? 1 : 0)); renderEnd(); };
    onKey = (e) => {
      const k = e.key.toUpperCase();
      if (!sess.cur) {
        let idx = -1;
        if (q.type === 'tf') idx = k === 'T' || k === '1' ? 0 : k === 'F' || k === '2' ? 1 : -1;
        else { idx = '1234'.indexOf(k); if (idx < 0) idx = 'ABCD'.indexOf(k); }
        if (idx >= 0 && idx < labels.length) { e.preventDefault(); answerQ(order[idx]); }
      } else if (k === 'ENTER' || k === ' ' || k === 'ARROWRIGHT') { e.preventDefault(); nextQ(); }
    };
  }
  function answerQ(orig) {
    if (!sess || sess.cur) return;
    const id = sess.list[sess.i], q = QBY[id];
    const ok = orig === q.ans;
    sess.cur = { orig, ok };
    record(id, ok);
    if (!sess.attempted[id]) { sess.attempted[id] = true; sess.done++; if (ok) sess.correct++; else sess.wrongIds.push(id); }
    if (!ok && !sess.requeued[id]) { sess.requeued[id] = true; sess.list.splice(Math.min(sess.list.length, sess.i + 4), 0, id); }
    $$('.opt').forEach((b) => {
      b.disabled = true;
      const o = +b.dataset.orig;
      if (o === q.ans) b.classList.add('correct');
      else if (o === orig) b.classList.add('wrong');
    });
    const right = q.type === 'tf' ? (q.ans === 0 ? '正確 True' : '錯誤 False') : q.opts[q.ans];
    $('#fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}">
      <div class="verdict">${ok ? '✅ 答啱！' : '❌ 答錯——呢題會喺幾題之後再出現'}</div>
      ${ok ? '' : `<div>正確答案：<b>${right}</b></div>`}
      ${q.exp ? `<div style="margin-top:.3rem">💡 ${q.exp}</div>` : ''}
      <div class="small muted" style="margin-top:.4rem">${esc(T[q.topic].code)} ${esc(T[q.topic].name)} · <a href="#/notes/${q.topic}">睇返筆記</a>${q.src && q.src.startsWith('lecture') ? ' · ' + esc(q.src) : ''}</div></div>`;
    $('#nextBtn').style.display = '';
    $('#nextBtn').focus({ preventScroll: true });
  }
  function nextQ() { if (!sess || !sess.cur) return; sess.i++; renderQ(); window.scrollTo(0, 0); }
  function renderEnd() {
    onKey = null;
    const s = sess;
    const wl = s.wrongIds.map((id) => QBY[id]).filter(Boolean);
    app.innerHTML = `<div class="qbox"><div class="card"><h1>🏁 完成：${esc(s.title)}</h1>
      <div class="stat">${s.done ? pct(s.correct, s.done) : 0}%</div><div class="muted">首次作答答啱 ${s.correct} / ${s.done} 題</div>
      <div class="row" style="margin-top:1rem">${wl.length ? '<button class="btn primary" id="redoBtn">🔁 即刻重做今輪錯題</button>' : ''}<a class="btn" href="#/quiz">新一輪</a><a class="btn" href="#/home">返首頁</a></div></div>
      ${wl.length ? `<div class="card"><h2 style="margin-top:0">今輪錯題（${wl.length}）</h2>${wl.map((q) => reviewHtml(q, null)).join('')}</div>` : '<div class="card">全中 🎉 好嘢！試吓模擬考或者揀第二個課題。</div>'}</div>`;
    const r = $('#redoBtn');
    if (r) r.onclick = () => startQuiz({ ids: shuffle(s.wrongIds), title: '🔁 重做錯題', mode: 'wrong' });
  }
  function reviewHtml(q, mine, num) {
    const lab = (k) => (q.type === 'tf' ? (k === 0 ? '正確 True' : '錯誤 False') : q.opts[k]);
    const opts = q.type === 'tf' ? [0, 1] : q.opts.map((_, k) => k);
    return `<div class="review-item"><div class="row">${num ? `<b>${num}.</b>` : ''}${pill(q.topic)} ${typePill(q)}</div>
      <div style="margin:.3rem 0;font-weight:600">${q.q}</div>
      ${q.type === 'mc' ? `<ol type="A" class="small" style="margin:.2rem 0 .4rem">${opts.map((k) => `<li ${k === q.ans ? 'style="color:var(--ok);font-weight:700"' : ''}>${lab(k)}${k === q.ans ? ' ✔' : ''}${mine === k && k !== q.ans ? ' <span style="color:var(--bad)">← 你揀</span>' : ''}</li>`).join('')}</ol>` : ''}
      ${mine !== null && mine !== undefined ? `<div class="small mine ${mine === q.ans ? 'ok' : 'bad'}">你答：${lab(mine)}</div>` : ''}
      ${q.type === 'tf' ? `<div class="small"><b>答案：${lab(q.ans)}</b></div>` : ''}
      ${q.exp ? `<div class="small">💡 ${q.exp}</div>` : ''}</div>`;
  }

  // ---------- mock exam ----------
  let examTimer = null;
  function exam(a) {
    if (S.active && !S.active.submitted) return renderExam();
    if (a === 'result' && S.lastResult) return renderResult(S.lastResult);
    renderExamSetup();
  }
  function renderExamSetup() {
    const seg = (name, items, val) => `<div class="seg">${items.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${String(val) === String(v) ? 'checked' : ''}>${l}</label>`).join('')}</div>`;
    const hist = S.exams.slice(-8).reverse();
    app.innerHTML = `<h1>⏱️ 模擬考 Mock Exam</h1>
      <p class="muted">仿真考試：MC + T/F、計時、期間<b>唔會</b>顯示答案或課題（要自己認出係邊個概念），交卷後先有詳細解釋。練習同真考試格式一致，效果最好。</p>
      <form class="card setup" id="esetup">
        <fieldset><legend>題數</legend>${seg('n', [[30, '30'], [40, '40'], [50, '50']], 40)}</fieldset>
        <fieldset><legend>時間（分鐘）</legend>${seg('min', [[30, '30'], [40, '40'], [50, '50']], 50)}</fieldset>
        <fieldset><legend>範圍</legend>${seg('scope', [['all', 'Module 2 + 3'], ['2', '只 Module 2'], ['3', '只 Module 3']], 'all')}</fieldset>
        <button class="btn primary big" type="submit">開始考試 ▶</button>
      </form>
      ${hist.length ? `<div class="card"><h2 style="margin-top:0">過往成績</h2>${hist.map((h) => `<div class="topicrow"><div>${new Date(h.at).toLocaleString('zh-HK')}</div><div><div class="bar ok"><i style="width:${pct(h.correct, h.n)}%"></i></div></div><b>${h.correct}/${h.n}（${pct(h.correct, h.n)}%）</b></div>`).join('')}
        ${S.lastResult ? '<a class="btn" href="#/exam/result" style="margin-top:.6rem">睇上次詳細結果</a>' : ''}</div>` : ''}`;
    $('#esetup').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      startExam(+f.n.value, +f.min.value, f.scope.value);
    });
  }
  function roundRobin(pool, n) {
    const by = {};
    for (const q of shuffle(pool)) (by[q.topic] = by[q.topic] || []).push(q);
    const out = [];
    const keys = Object.keys(by);
    while (out.length < n && keys.some((k) => by[k].length)) {
      for (const k of shuffle(keys)) if (by[k].length && out.length < n) out.push(by[k].pop());
    }
    return out;
  }
  function startExam(n, min, scope) {
    const pool = QS.filter((q) => scope === 'all' || T[q.topic].mod === +scope);
    const nTF = Math.round(n * 0.45);
    const tf = roundRobin(pool.filter((q) => q.type === 'tf'), nTF);
    const mc = roundRobin(pool.filter((q) => q.type === 'mc'), n - tf.length);
    const list = [...shuffle(tf), ...shuffle(mc)];
    S.active = { ids: list.map((q) => q.id), orders: list.map((q) => (q.type === 'mc' ? shuffle(q.opts.map((_, k) => k)) : [0, 1])), ans: {}, flags: {}, cur: 0, start: Date.now(), dur: min * 60000, submitted: false };
    save();
    renderExam();
  }
  function renderExam() {
    clearInterval(examTimer);
    const A = S.active;
    const q = QBY[A.ids[A.cur]];
    const order = A.orders[A.cur];
    const keys = q.type === 'tf' ? ['T', 'F'] : ['A', 'B', 'C', 'D', 'E'];
    const labels = q.type === 'tf' ? ['⭕ 正確 True', '❌ 錯誤 False'] : order.map((k) => q.opts[k]);
    const nTF = A.ids.filter((id) => QBY[id] && QBY[id].type === 'tf').length;
    const section = A.cur < nTF ? 'Part A：True / False' : 'Part B：Multiple Choice';
    app.innerHTML = `<div class="exam-top"><div><b>⏱️ 模擬考</b> <span class="muted small">${section} · 第 ${A.cur + 1}/${A.ids.length} 題 · 已答 ${Object.keys(A.ans).length}</span></div>
        <div class="timer" id="timer">--:--</div><button class="btn primary" id="submitBtn">交卷</button></div>
      <div class="card qbox"><div class="row">${q.type === 'tf' ? '<span class="pill tf">T/F</span>' : '<span class="pill">MC</span>'}${A.flags[A.cur] ? ' <span class="pill lec">🚩</span>' : ''}</div>
        <div class="qtext">${A.cur + 1}. ${q.q}</div>
        <div class="opts ${q.type === 'tf' ? 'tfopts' : ''}">${labels.map((l, i) => `<button class="opt ${A.ans[A.cur] === order[i] ? 'picked' : ''}" data-orig="${order[i]}"><span class="key">${keys[i]}</span><span>${l}</span></button>`).join('')}</div>
        <div class="row" style="margin-top:1rem;justify-content:space-between"><button class="btn" id="prevBtn" ${A.cur === 0 ? 'disabled' : ''}>◀ 上一題</button>
        <button class="btn" id="flagBtn">${A.flags[A.cur] ? '🚩 取消標記' : '🏳️ 標記（遲啲再睇）'}</button>
        <button class="btn primary" id="nextBtn" ${A.cur === A.ids.length - 1 ? 'disabled' : ''}>下一題 ▶</button></div></div>
      <div class="card"><div class="small muted" style="margin-bottom:.4rem">題目導航（藍＝已答、黃＝標記）</div><div class="qgrid">${A.ids.map((_, i) => `<button data-go="${i}" class="${A.ans[i] !== undefined ? 'ans' : ''} ${A.flags[i] ? 'flag' : ''} ${i === A.cur ? 'cur' : ''}">${i + 1}</button>`).join('')}</div></div>`;
    const go = (i) => { A.cur = Math.max(0, Math.min(A.ids.length - 1, i)); save(); renderExam(); window.scrollTo(0, 0); };
    $$('.opt').forEach((b) => b.addEventListener('click', () => { A.ans[A.cur] = +b.dataset.orig; save(); if (A.cur < A.ids.length - 1) setTimeout(() => go(A.cur + 1), 180); else renderExam(); }));
    $('#prevBtn').onclick = () => go(A.cur - 1);
    $('#nextBtn').onclick = () => go(A.cur + 1);
    $('#flagBtn').onclick = () => { A.flags[A.cur] = !A.flags[A.cur]; save(); renderExam(); };
    $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(+b.dataset.go)));
    $('#submitBtn').onclick = () => submitExam(false);
    onKey = (e) => {
      const k = e.key.toUpperCase();
      let idx = -1;
      if (q.type === 'tf') idx = k === 'T' || k === '1' ? 0 : k === 'F' || k === '2' ? 1 : -1;
      else { idx = '1234'.indexOf(k); if (idx < 0) idx = 'ABCD'.indexOf(k); }
      if (idx >= 0 && idx < labels.length) { e.preventDefault(); A.ans[A.cur] = order[idx]; save(); if (A.cur < A.ids.length - 1) go(A.cur + 1); else renderExam(); }
      else if (k === 'ARROWRIGHT') go(A.cur + 1);
      else if (k === 'ARROWLEFT') go(A.cur - 1);
    };
    const tick = () => {
      const ms = A.start + A.dur - Date.now();
      const el = $('#timer');
      if (ms <= 0) { submitExam(true); return; }
      if (el) { const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000); el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; el.classList.toggle('low', ms < 5 * 60000); }
    };
    tick();
    examTimer = setInterval(tick, 1000);
    cleanup = () => clearInterval(examTimer);
  }
  function submitExam(auto) {
    const A = S.active;
    if (!A || A.submitted) return;
    if (!auto) {
      const un = A.ids.length - Object.keys(A.ans).length;
      if (!confirm(`確定交卷？${un ? `仲有 ${un} 題未答。` : ''}`)) return;
    }
    clearInterval(examTimer);
    const end = Date.now();
    let correct = 0;
    const per = {};
    A.ids.forEach((id, i) => {
      const q = QBY[id];
      if (!q) return;
      const ok = A.ans[i] === q.ans;
      if (ok) correct++;
      per[q.topic] = per[q.topic] || { n: 0, c: 0 };
      per[q.topic].n++;
      if (ok) per[q.topic].c++;
      record(id, ok);
    });
    const res = { at: end, n: A.ids.length, correct, used: Math.min(end - A.start, A.dur), per, ids: A.ids, ans: A.ans, auto };
    S.exams.push({ at: end, n: res.n, correct, used: res.used });
    S.lastResult = res;
    S.active = null;
    save();
    if (auto) toast('時間到，已自動交卷');
    if (location.hash === '#/exam/result') renderResult(res); else location.hash = '#/exam/result';
  }
  function renderResult(res) {
    const mins = Math.round(res.used / 60000);
    const per = Object.entries(res.per).sort((a, b) => TIDS.indexOf(a[0]) - TIDS.indexOf(b[0]));
    app.innerHTML = `<div class="card"><h1>📊 模擬考結果</h1><div class="stat">${pct(res.correct, res.n)}%</div>
      <div class="muted">${res.correct} / ${res.n} 題 · 用時 ${mins} 分鐘${res.auto ? '（時間到自動交卷）' : ''}</div>
      <div class="row" style="margin-top:.8rem"><a class="btn primary" href="#/quiz/wrong">❌ 重做錯題</a><button class="btn" id="newExam">再考一次</button><a class="btn" href="#/home">返首頁</a></div></div>
      <div class="card"><h2 style="margin-top:0">各課題表現（最弱嗰啲要返去睇筆記）</h2>${per.map(([t, v]) => `<div class="topicrow"><div>${pill(t)} <a href="#/notes/${t}">${esc(T[t].name)}</a></div><div class="bar ${pct(v.c, v.n) < 60 ? 'bad' : 'ok'}"><i style="width:${pct(v.c, v.n)}%"></i></div><b>${v.c}/${v.n}</b></div>`).join('')}</div>
      <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">逐題檢討</h2><div class="seg"><label><input type="radio" name="rv" value="wrong" checked>只睇錯題</label><label><input type="radio" name="rv" value="all">全部</label></div></div><div id="rvList"></div></div>`;
    const draw = (mode) => {
      $('#rvList').innerHTML = res.ids.map((id, i) => ({ q: QBY[id], mine: res.ans[i], i })).filter((x) => x.q && (mode === 'all' || x.mine !== x.q.ans))
        .map((x) => reviewHtml(x.q, x.mine === undefined ? null : x.mine, x.i + 1) + (x.mine === undefined ? '<div class="small" style="color:var(--bad)">（未作答）</div>' : '')).join('') || '<p>全中！🎉</p>';
    };
    draw('wrong');
    $$('input[name=rv]').forEach((r) => r.addEventListener('change', () => draw(r.value)));
    $('#newExam').onclick = () => renderExamSetup();
  }

  // ---------- flashcards (Leitner boxes 1-5) ----------
  let cs = null;
  function cards(a) {
    if (a === 'run' && cs) return renderCard();
    renderCardSetup();
  }
  function renderCardSetup() {
    const boxes = [0, 1, 2, 3, 4, 5].map((b) => D.cards.filter((c) => (S.c[c.id] || 0) === b).length);
    const tchk = D.topics.map((t) => `<label class="chk"><input type="checkbox" name="t" value="${t.id}" checked> ${pill(t.id)} ${esc(t.name)} <span class="muted small">(${D.cards.filter((c) => c.topic === t.id).length})</span></label>`).join('<br>');
    app.innerHTML = `<h1>🃏 閃卡 Flashcards</h1>
      <p class="muted">睇正面 → <b>喺心入面講出答案</b> → 先揭開對答案（主動回憶，唔係被動睇）。唔記得嘅卡會喺幾張之後再出現；記得嘅升盒，盒數越高越少出現（Leitner system）。快捷鍵：<span class="kbd">Space</span> 揭卡、<span class="kbd">1</span>/<span class="kbd">2</span>/<span class="kbd">3</span> 評分。</p>
      <div class="card"><div class="boxes">${boxes.map((n, b) => `<span>${b === 0 ? '未溫' : '盒 ' + b} : <b>${n}</b></span>`).join('')}</div></div>
      <form class="card setup" id="csetup"><fieldset><legend>課題</legend>${tchk}</fieldset>
        <fieldset><legend>範圍</legend><label class="chk"><input type="checkbox" name="weak" checked> 只溫未熟（盒 &lt; 3）</label></fieldset>
        <fieldset><legend>張數</legend><div class="seg">${[[20, '20'], [40, '40'], [999, '全部']].map(([v, l], i) => `<label><input type="radio" name="n" value="${v}" ${i === 0 ? 'checked' : ''}>${l}</label>`).join('')}</div></fieldset>
        <button class="btn primary big" type="submit">開始 ▶</button></form>`;
    $('#csetup').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const topics = $$('input[name=t]:checked', f).map((c) => c.value);
      let pool = D.cards.filter((c) => topics.includes(c.topic));
      if (f.weak.checked) pool = pool.filter((c) => (S.c[c.id] || 0) < 3);
      if (!pool.length) { toast('呢個範圍全部已熟 👍（剔走「只溫未熟」可以再溫）'); return; }
      pool = shuffle(pool).sort((x, y) => (S.c[x.id] || 0) - (S.c[y.id] || 0)).slice(0, +f.n.value);
      cs = { list: interleave(pool).map((c) => c.id), i: 0, flipped: false, re: {}, n: { 1: 0, 2: 0, 3: 0 } };
      if (location.hash === '#/cards/run') renderCard(); else location.hash = '#/cards/run';
    });
  }
  function renderCard() {
    if (cs.i >= cs.list.length) {
      onKey = null;
      app.innerHTML = `<div class="card qbox"><h1>🏁 閃卡完成</h1><p>😵 唔記得 ${cs.n[1]} · 🙂 記得 ${cs.n[2]} · 😎 好熟 ${cs.n[3]}</p>
        <div class="row"><a class="btn primary" href="#/cards">再嚟一輪</a><a class="btn" href="#/quiz">去做題</a></div></div>`;
      return;
    }
    const c = CBY[cs.list[cs.i]];
    const box = S.c[c.id] || 0;
    app.innerHTML = `<div class="qbox"><div class="qhead"><b>🃏 閃卡</b><span class="muted small">${cs.i + 1} / ${cs.list.length} · ${box ? '盒 ' + box : '新卡'}</span></div>
      <div class="progress"><i style="width:${pct(cs.i, cs.list.length)}%"></i></div>
      <div class="flash ${cs.flipped ? 'flipped' : ''}" id="flash"><div class="flash-inner">
        <div class="flash-face front"><div>${pill(c.topic)}</div><div style="margin-top:.6rem">${c.front}</div><div class="small muted" style="margin-top:1rem">（撳一下或者 Space 揭開）</div></div>
        <div class="flash-face back prose">${c.back}</div></div></div>
      <div class="row" style="justify-content:center;margin-top:1rem" id="grades">${cs.flipped ? `
        <button class="btn" data-g="1">😵 唔記得 <span class="kbd">1</span></button>
        <button class="btn" data-g="2">🙂 記得 <span class="kbd">2</span></button>
        <button class="btn primary" data-g="3">😎 好熟 <span class="kbd">3</span></button>` : '<button class="btn primary big" id="flipBtn">揭開 ↻</button>'}</div></div>`;
    const flip = () => { cs.flipped = true; renderCard(); };
    $('#flash').addEventListener('click', () => { if (!cs.flipped) flip(); });
    const fb = $('#flipBtn'); if (fb) fb.onclick = flip;
    $$('[data-g]').forEach((b) => b.addEventListener('click', () => gradeCard(+b.dataset.g)));
    onKey = (e) => {
      if (!cs.flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flip(); }
      else if (cs.flipped && '123'.includes(e.key)) { e.preventDefault(); gradeCard(+e.key); }
    };
  }
  function gradeCard(g) {
    const id = cs.list[cs.i];
    let b = S.c[id] || 0;
    if (g === 1) { b = 1; if (!cs.re[id]) { cs.re[id] = 1; cs.list.splice(Math.min(cs.list.length, cs.i + 4), 0, id); } }
    else b = Math.min(5, Math.max(b, 1) + (g === 3 ? 2 : 1));
    S.c[id] = b;
    cs.n[g]++;
    save();
    cs.i++;
    cs.flipped = false;
    renderCard();
  }

  // ---------- wrong book ----------
  function wrong() {
    const items = QS.filter((q) => isWrongNow(S.q[q.id]));
    const fixed = QS.filter((q) => S.q[q.id] && S.q[q.id].w > 0 && !isWrongNow(S.q[q.id])).length;
    const groups = D.topics.map((t) => ({ t, qs: items.filter((q) => q.topic === t.id) })).filter((g) => g.qs.length);
    app.innerHTML = `<h1>❌ 錯題本</h1>
      <p class="muted">答錯過、而未試過<b>連續答啱兩次</b>嘅題目會留喺度。考試前最有效率嘅溫習 = 重做呢度嘅題目。已攻克：${fixed} 題。</p>
      <div class="row" style="margin-bottom:1rem"><a class="btn primary big" href="#/quiz/wrong">🔁 重做全部錯題（${items.length}）</a></div>
      ${groups.map((g) => `<div class="card"><h2 style="margin-top:0">${pill(g.t.id)} ${esc(g.t.name)}（${g.qs.length}）</h2>${g.qs.map((q) => reviewHtml(q, null)).join('')}</div>`).join('') || '<div class="card">暫時冇錯題 👍 去<a href="#/quiz">做多啲題</a>先！</div>'}`;
  }

  applySettings();
  route();
})();
