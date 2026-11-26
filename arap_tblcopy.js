/* arap_tblcopy.js — 표 줄 선택 → 머리줄을 붙여 스프레드시트 모양으로 복사 (2026-11-24)
   - 줄 선택(data-rowsel 표): 마우스 올리면 줄 색, 누르면 선택, Shift+누르기 범위 → 아래 막대 「📋 복사」 또는 Ctrl+C (아래 「줄 선택」 절)
   - 글자 끌어 고르기 복사도 그대로 — 대상: data-copy 속성이 있는 표(또는 그 안의 표). thead 머리줄 1줄 + 선택에 걸친 tbody 행 전체(모든 칸)
   - 한 칸 안에서만 고른 경우는 브라우저 기본 복사 그대로
   - 클립보드에 text/plain(탭 구분) + text/html(표) 둘 다 → 구글 시트, 엑셀에 칸 맞춰 붙음
   - 금액 「13억 8,000만원」 → 1,380,000,000 (원) 숫자로(td data-v 있으면 원 단위 정확한 값), 머리말에 (원). 체크칸 → ○ / 제외. 비고 태그 → 쉼표로 이음
   - 정렬 표시(▲▼)는 머리말에서 뺌
   - 칸 안 입력칸(가치형성요인 등)은 넣은 값 그대로(2026-11-26) */
(function () {
  'use strict';
  const WON = /^(?:(\d+)억(?: ([\d,]+)만원|원)|([\d,]+)만원)$/;
  const NUM = /^-?[\d,]+(?:\.\d+)?$/;
  const DATE = /^\d{4}\.\d{2}(?:\.\d{2})?$/;

  function wonOf(s) {
    const m = WON.exec(s); if (!m) return null;
    if (m[3] != null) return +m[3].replace(/,/g, '') * 1e4;
    return +m[1] * 1e8 + (m[2] ? +m[2].replace(/,/g, '') * 1e4 : 0);
  }
  function headText(th) {
    const c = th.cloneNode(true); c.querySelectorAll('.ar').forEach(e => e.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function cellText(td) {
    const cb = td.querySelector('input[type=checkbox]');
    if (cb) return cb.checked ? '○' : '제외';
    const ti = td.querySelector('input'); // 직접 넣는 칸(가치형성요인 등)은 넣은 값
    if (ti) return ti.value.trim();
    if (td.classList.contains('note')) return [...td.querySelectorAll('.tag')].map(t => t.textContent.trim()).filter(Boolean).join(', ');
    return td.textContent.replace(/\s+/g, ' ').trim();
  }
  // 표 → {head:[], rows:[[]], kind:['won'|'num'|'date'|'text']}
  function grab(table, trs) {
    const ths = [...table.querySelectorAll('thead tr:first-child > th')];
    const head = ths.map(headText);
    const rows = trs.map(tr => [...tr.children].map(cellText));
    // 화면은 만원까지 반올림 — td data-v(원 단위 정확한 값)가 있으면 그 값으로
    const exact = trs.map(tr => [...tr.children].map(td => { const v = td.getAttribute('data-v'); return v != null && v !== '' && isFinite(+v) ? Math.round(+v) : null; }));
    const n = Math.max(head.length, ...rows.map(r => r.length));
    const kind = [];
    for (let j = 0; j < n; j++) {
      const vals = rows.map(r => r[j]).filter(v => v != null && v !== '');
      if (vals.length && vals.some(v => wonOf(v) != null) && vals.every(v => wonOf(v) != null || v === '-')) {
        kind[j] = 'won';
        rows.forEach((r, i) => { const w = wonOf(r[j] || ''); if (w != null) r[j] = (exact[i][j] != null ? exact[i][j] : Math.round(w)).toLocaleString('en-US'); });
        if (head[j] != null && !/\(원\)$/.test(head[j])) head[j] += '(원)';
      } else if (vals.length && vals.every(v => NUM.test(v))) kind[j] = 'num';
      else if (vals.length && vals.every(v => DATE.test(v))) kind[j] = 'date';
      else kind[j] = 'text';
    }
    return {head, rows, kind};
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  function toTsv(g) {
    const clean = v => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ');
    return [g.head, ...g.rows].map(r => r.map(clean).join('\t')).join('\r\n');
  }
  function toHtml(g) {
    const bd = 'border:.5pt solid #BFBFBF;padding:2px 6px;white-space:nowrap;';
    const fmt = (k, v) => {
      if (k === 'won') return 'text-align:right;mso-number-format:"\\#\\,\\#\\#0";';
      if (k === 'num') return 'text-align:right;' + (/\.\d{5}$/.test(v) ? 'mso-number-format:"0\\.00000";' : /\.\d{2}$/.test(v) ? 'mso-number-format:"0\\.00";' : /,/.test(v) ? 'mso-number-format:"\\#\\,\\#\\#0";' : '');
      if (k === 'date') return 'text-align:center;mso-number-format:"\\@";';
      return '';
    };
    const th = g.head.map(h => `<th style="${bd}background:#F2F2F2;font-weight:bold;text-align:center;">${esc(h)}</th>`).join('');
    const body = g.rows.map(r => '<tr>' + g.head.map((_, j) => {
      const v = r[j] == null ? '' : r[j];
      return `<td style="${bd}${fmt(g.kind[j], v)}">${esc(v)}</td>`;
    }).join('') + '</tr>').join('');
    return `<meta charset="utf-8"><table style="border-collapse:collapse;font-size:10pt;"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
  }
  function cellOf(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return el ? el.closest('td,th') : null;
  }
  /* ── 줄 선택(2026-11-24 2판): data-rowsel 표 — 마우스 올리면 줄 색, 누르면 선택(다시 누르면 해제), Shift+누르기 = 범위
        → 화면 아래 막대 「📋 N줄 복사」(또는 Ctrl+C) = 제목 줄 + 고른 줄. Esc = 선택 해제. 체크칸·버튼 누르기는 원래 동작 */
  const ROWSEL = 'table[data-rowsel], [data-rowsel] table';
  let anchor = null, pending = null, bar = null, toastT = 0;
  const css = `${ROWSEL.split(', ').map(s => s + ' tbody tr').join(',')}{cursor:pointer}
${ROWSEL.split(', ').map(s => s + ' tbody tr:hover>td').join(',')}{background:#f1f5f9}
${ROWSEL.split(', ').map(s => s + ' tbody tr.rsel>td').join(',')}{background:#dbeafe!important}
${ROWSEL.split(', ').map(s => s + ' tbody tr.rsel>td:first-child').join(',')}{box-shadow:inset 3px 0 0 #2563eb}
#arapRowBar{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:8px;background:#0f172a;color:#fff;border-radius:12px;padding:8px 10px 8px 16px;box-shadow:0 8px 28px rgba(15,23,42,.35);font-size:14px;white-space:nowrap}
#arapRowBar[hidden]{display:none}
#arapRowBar .n{font-weight:700;margin-right:4px}
#arapRowBar button{font:inherit;font-size:13px;border-radius:8px;padding:7px 12px;cursor:pointer;border:1px solid #cbd5e1;background:#fff;color:#0f172a}
#arapRowBar button.p{background:#2563eb;border-color:#2563eb;color:#fff;font-weight:700}
#arapRowBar .k{font-size:11px;color:#94a3b8;margin-left:2px}`;
  function ensureBar() {
    if (bar) return bar;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    bar = document.createElement('div'); bar.id = 'arapRowBar'; bar.hidden = true;
    bar.innerHTML = '<span class="n"></span><button type="button" class="p" data-a="copy">📋 복사 (제목 줄 포함)</button><span class="k">Ctrl+C</span><button type="button" data-a="all">전체 선택</button><button type="button" data-a="clear">✕ 선택 해제</button>';
    bar.addEventListener('mousedown', e => e.preventDefault()); // 누를 때 글자 선택, 포커스 안 바뀌게
    bar.addEventListener('click', e => {
      const a = e.target.closest('button') && e.target.closest('button').dataset.a;
      if (a === 'copy') copySelected();
      else if (a === 'all') { const t = selTable(); if (t) rowsOf(t).forEach(tr => tr.classList.add('rsel')); update(); }
      else if (a === 'clear') clearSel();
    });
    document.body.appendChild(bar);
    return bar;
  }
  const rowsOf = t => [...t.tBodies].flatMap(b => [...b.rows]);
  const picked = () => [...document.querySelectorAll('tbody tr.rsel')];
  const selTable = () => { const r = picked()[0]; return r ? r.closest('table') : null; };
  function clearSel() { picked().forEach(tr => tr.classList.remove('rsel')); anchor = null; update(); }
  function update() {
    if (!bar) return;
    const n = picked().length;
    if (!toastT) bar.querySelector('.n').textContent = n + '줄 선택';
    bar.hidden = !n && !toastT;
  }
  function toast(msg) {
    ensureBar(); clearTimeout(toastT);
    bar.querySelector('.n').textContent = msg; bar.hidden = false;
    toastT = setTimeout(() => { toastT = 0; update(); }, 1800);
  }
  function copySelected() {
    const t = selTable(); if (!t) return false;
    const trs = rowsOf(t).filter(tr => tr.classList.contains('rsel')); // 화면 순서대로
    pending = grab(t, trs);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    if (!ok && pending && navigator.clipboard) {
      const g = pending;
      try {
        navigator.clipboard.write([new ClipboardItem({'text/plain': new Blob([toTsv(g)], {type: 'text/plain'}), 'text/html': new Blob([toHtml(g)], {type: 'text/html'})})])
          .catch(() => navigator.clipboard.writeText(toTsv(g)));
      } catch (_) { navigator.clipboard.writeText(toTsv(g)); }
      ok = true;
    }
    pending = null;
    if (ok) toast(`✓ ${trs.length}줄 복사됨 — 엑셀, 구글 시트에 Ctrl+V`);
    return ok;
  }
  document.addEventListener('mousedown', e => { // Shift+누르기로 범위 고를 때 글자 선택 막기
    if (e.shiftKey && e.target.closest && e.target.closest(ROWSEL.split(', ').map(s => s + ' tbody tr').join(','))) e.preventDefault();
  });
  document.addEventListener('click', e => {
    const tr = e.target.closest && e.target.closest('tbody tr'); if (!tr) return;
    const t = tr.closest('table'); if (!t || !t.matches(ROWSEL)) return;
    if (e.target.closest('input,button,a,select,label,textarea')) return; // 집계 체크 등은 원래 동작
    const s = window.getSelection(); if (s && !s.isCollapsed && String(s).trim() && !e.shiftKey) return; // 글자 끌어 고른 경우
    ensureBar();
    const cur = selTable(); if (cur && cur !== t) clearSel(); // 다른 표 선택은 해제
    const rows = rowsOf(t);
    if (e.shiftKey && anchor && rows.includes(anchor)) {
      const [i, j] = [rows.indexOf(anchor), rows.indexOf(tr)].sort((a, b) => a - b);
      rows.slice(i, j + 1).forEach(r => r.classList.add('rsel'));
      if (s) s.removeAllRanges();
    } else { tr.classList.toggle('rsel'); anchor = tr; }
    update();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && picked().length) clearSel();
  });
  // 표를 다시 그리면(정렬, 다시 계산) 선택 줄이 사라짐 → 막대 숫자 맞춤
  let raf = 0;
  new MutationObserver(() => { if (!bar || raf) return; raf = requestAnimationFrame(() => { raf = 0; update(); }); })
    .observe(document.documentElement, {childList: true, subtree: true});

  function onCopy(e) {
    if (pending && e.clipboardData) { // 「📋 복사」 버튼
      e.preventDefault();
      e.clipboardData.setData('text/plain', toTsv(pending)); e.clipboardData.setData('text/html', toHtml(pending));
      return;
    }
    const sel = window.getSelection && window.getSelection();
    const ae = document.activeElement;
    if ((!sel || sel.isCollapsed || !String(sel).trim()) && picked().length && e.clipboardData && !(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.type !== 'checkbox')) {
      const t = selTable(), g = grab(t, rowsOf(t).filter(tr => tr.classList.contains('rsel')));
      e.preventDefault();
      e.clipboardData.setData('text/plain', toTsv(g)); e.clipboardData.setData('text/html', toHtml(g));
      setTimeout(() => toast(`✓ ${g.rows.length}줄 복사됨 — 엑셀, 구글 시트에 Ctrl+V`), 0);
      return;
    }
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    const a = cellOf(sel.anchorNode), f = cellOf(sel.focusNode);
    if (a && a === f) return; // 한 칸 안 → 기본 복사
    const tables = [...document.querySelectorAll('table[data-copy], [data-copy] table')]
      .filter(t => t.tBodies.length && sel.containsNode(t, true));
    if (!tables.length) return;
    const parts = [];
    for (const t of tables) {
      const trs = [...t.tBodies].flatMap(b => [...b.rows]).filter(tr => sel.containsNode(tr, true));
      if (trs.length) parts.push(grab(t, trs));
    }
    if (!parts.length || !e.clipboardData) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', parts.map(toTsv).join('\r\n\r\n'));
    e.clipboardData.setData('text/html', parts.map(toHtml).join('<br>'));
  }
  document.addEventListener('copy', onCopy);
  window.ArapTblCopy = {grab, toTsv, toHtml, wonOf, copySelected, clearSel};
})();
