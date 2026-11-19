/* 인근 유사 신축 아파트 실거래 엔진 (apt_nearby.html)
 * 신축, 재건축, 재개발, 입주권 평가 때 준공 후 가치의 근거 사례 찾기. 화면과 분리한 순수 계산부.
 * 브라우저에선 window.ArapAptNearby, Node 테스트에선 module.exports.
 *  - 범위 = 본건 좌표 반경 원. 원 둘레 8방향 + 절반 지점 4방향이 속한 시군구(인접 구)도 실거래 수집
 *  - 대상 = 전용 본건 ± 허용폭(㎡), 준공 N년 이내(기준연도 - N 이후), 계약일 기준일 이전 M개월
 *  - 규모 = 대단지 300세대 이상, 중규모 100~299, 소규모 100 미만 (건축물대장 세대수)
 *  - 집계 = 해제 제외, 직거래는 선택. 시점수정 없는 원 거래가
 *  - 분양권, 입주권 전매 실거래(프록시 /rtms svc=silv, 5판)도 같이: 입주 직후 신축은 등기 전까지 전매로만 신고됨
 *  - 본건 단지 = 본건과 같은 필지(PNU)이거나 좌표 60m 이내. 맨 위에 따로 보여주고, 없으면 경고
 *  - 입주권 = 권리가액 + 납입액 + 프레미엄(준공 후 가치 - 분양가)
 * 원본: 로컬 파이썬판 C:\Users\wjjun\AptSise\nearby.py 와 같은 규칙. 검증: tests/apt_nearby.cjs
 */
(function (g) {
  'use strict';

  const SCALES = ['대단지', '중규모', '소규모', '세대수 미확인'];
  const BANDS = ['저층 (1~4층)', '중층 (5~14층)', '고층 (15~24층)', '초고층 (25층~)', '층 미상'];
  const pad = n => String(n).padStart(2, '0');

  /** 두 좌표(경도 x, 위도 y) 사이 거리 m */
  function distM(x1, y1, x2, y2) {
    const R = 6371000, r = Math.PI / 180;
    const a = Math.sin((y2 - y1) * r / 2) ** 2 + Math.cos(y1 * r) * Math.cos(y2 * r) * Math.sin((x2 - x1) * r / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /** 반경 원 둘레 8방향 + 절반 지점 4방향 [{x, y}] - 인접 시군구 찾기용 */
  function ringPoints(x, y, radiusM) {
    const out = [];
    for (const [frac, n] of [[1, 8], [0.5, 4]]) {
      for (let i = 0; i < n; i++) {
        const th = 2 * Math.PI * i / n;
        out.push({ x: x + radiusM * frac * Math.sin(th) / (111320 * Math.cos(y * Math.PI / 180)), y: y + radiusM * frac * Math.cos(th) / 111320 });
      }
    }
    return out;
  }

  /** 둘레 점들의 시군구 코드 → 본건 구를 맨 앞에, 많이 걸친 순으로 최대 max곳 */
  function pickSggs(own, codes, max) {
    const cnt = {};
    for (const c of codes) if (c && c !== own && /^\d{5}$/.test(c)) cnt[c] = (cnt[c] || 0) + 1;
    return [own].concat(Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, (max || 5) - 1));
  }

  /** 기준일('YYYY-MM-DD')에서 months개월 전 날짜 */
  function cutDate(writeIso, months) {
    const d = new Date(writeIso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - Math.round(months * 30.4375));
    return d.toISOString().slice(0, 10);
  }

  /**
   * lists = [{code, items: 국토부 실거래 item 객체들, kind: 'trade'(매매) | 'silv'(분양권, 입주권 전매)}] → 조건에 맞는 단지 묶음
   * p = {area, tol, minYear, from, to}
   * 반환 [{id, code, umd, jibun, name, built(전매만 있으면 null), allN(기간 내 전 평형 건수), trades[{kind, date, price, area, floor, dong, direct, cancelled}]}]
   */
  function collect(lists, p) {
    const groups = new Map(), allN = new Map();
    for (const { code, items, kind } of lists) {
      const silv = kind === 'silv'; // 분양권, 입주권 전매 자료: 준공연도가 없음(준공 전후 신축) → 준공 조건 없이 포함
      for (const r of items || []) {
        const y = +r.dealYear, mo = +r.dealMonth, d = +r.dealDay;
        const price = parseInt(String(r.dealAmount || '').replace(/,/g, ''), 10) * 10000, area = parseFloat(r.excluUseAr);
        if (!y || !mo || !d || !isFinite(price) || !isFinite(area)) continue;
        const date = `${y}-${pad(mo)}-${pad(d)}`;
        if (date < p.from || date > p.to) continue;
        const umd = String(r.umdNm || '').trim(), jibun = String(r.jibun || '').trim(), name = String(r.aptNm || '').trim();
        const id = [code, umd, jibun].join('|'); // 단지 = 시군구 + 법정동 + 지번 (매매와 전매의 단지명 표기가 달라도 한 단지)
        allN.set(id, (allN.get(id) || 0) + 1);
        const built = silv ? null : (parseInt(r.buildYear, 10) || 0);
        if ((built != null && built < p.minYear) || Math.abs(area - p.area) > p.tol + 1e-9) continue;
        if (!groups.has(id)) groups.set(id, { id, code, umd, jibun, name, built, trades: [] });
        const grp = groups.get(id);
        if (built) { grp.built = built; grp.name = name || grp.name; }
        grp.trades.push({
          kind: silv ? (String(r.ownershipGbn || '').trim() || '전매') : '매매',
          date, price, area,
          floor: /^-?\d+$/.test(String(r.floor || '').trim()) ? +r.floor : null,
          dong: String(r.aptDong || '').trim(),
          direct: String(r.dealingGbn || '').trim() === '직거래',
          cancelled: String(r.cdealType || '').trim().toUpperCase() === 'O',
        });
      }
    }
    const out = [...groups.values()].filter(c => c.jibun);
    for (const c of out) { c.allN = allN.get(c.id) || 0; c.trades.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); }
    return out;
  }

  /** 건축물대장 총괄표제부, 표제부 항목 → {hhld, flr, dongs} (못 구하면 null) */
  function bldInfo(recap, titles) {
    const n = v => { const x = parseInt(v, 10); return isFinite(x) ? x : 0; };
    let hh = (recap || []).reduce((s, r) => s + n(r.hhldCnt), 0);
    const apt = (titles || []).filter(t => n(t.hhldCnt) > 0);
    if (!hh) hh = apt.reduce((s, t) => s + n(t.hhldCnt), 0);
    const flr = (titles || []).reduce((m, t) => Math.max(m, n(t.grndFlrCnt)), 0);
    return { hhld: hh || null, flr: flr || null, dongs: apt.length || null };
  }

  const scale = h => h == null ? '세대수 미확인' : h >= 300 ? '대단지' : h >= 100 ? '중규모' : '소규모';
  const band = f => f == null ? '층 미상' : f <= 4 ? BANDS[0] : f <= 14 ? BANDS[1] : f <= 24 ? BANDS[2] : BANDS[3];
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return !n ? null : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

  /** 거래가 배열 → {n, min, mid, max} */
  function stat(prices) {
    return prices.length ? { n: prices.length, min: Math.min(...prices), mid: median(prices), max: Math.max(...prices) } : { n: 0, min: null, mid: null, max: null };
  }

  /** 입주권(원) = 권리가액 + 납입액 + (준공 후 가치 - 분양가). 권리가액, 분양가, 납입액은 억원. 못 구하면 null */
  function ipj(valueWon, kwonEok, bunEok, paidEok) {
    const k = parseFloat(kwonEok), b = parseFloat(bunEok), pd = parseFloat(paidEok) || 0;
    if (!isFinite(k) || !isFinite(b) || valueWon == null) return null;
    return Math.round((k + pd) * 1e8 + (valueWon - b * 1e8));
  }

  const OWN_DIST_M = 60;
  /** 본건 단지 여부: 같은 필지이거나 좌표 60m 이내 */
  const isOwn = (subjPnu, cxPnu, dist) => !!(subjPnu && cxPnu && subjPnu === cxPnu) || dist <= OWN_DIST_M;

  const api = { SCALES, BANDS, OWN_DIST_M, isOwn, distM, ringPoints, pickSggs, cutDate, collect, bldInfo, scale, band, median, stat, ipj };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.ArapAptNearby = api;
})(typeof window !== 'undefined' ? window : globalThis);
