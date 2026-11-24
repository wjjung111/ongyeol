/* arap_tblcopy.js — 표에서 여러 행을 드래그해 Ctrl+C 하면 머리줄을 붙여 스프레드시트 모양으로 복사 (2026-11-24)
   - 대상: data-copy 속성이 있는 표(또는 그 안의 표). thead 머리줄 1줄 + 선택에 걸친 tbody 행 전체(모든 칸)
   - 한 칸 안에서만 고른 경우는 브라우저 기본 복사 그대로
   - 클립보드에 text/plain(탭 구분) + text/html(표) 둘 다 → 구글 시트, 엑셀에 칸 맞춰 붙음
   - 금액 「13억 8,000만원」 → 1,380,000,000 (원) 숫자로(td data-v 있으면 원 단위 정확한 값), 머리말에 (원). 체크칸 → ○ / 제외. 비고 태그 → 쉼표로 이음
   - 정렬 표시(▲▼)는 머리말에서 뺌 */
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
  function onCopy(e) {
    const sel = window.getSelection && window.getSelection();
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
  window.ArapTblCopy = {grab, toTsv, toHtml, wonOf};
})();
