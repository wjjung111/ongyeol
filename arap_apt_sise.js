/* 아파트 실거래 시점수정 엔진 (아파트시점수정.html)
 * 화면과 분리한 순수 계산부. 브라우저에선 window.ArapAptSise, Node 테스트에선 module.exports.
 *  - 시점수정치 = 기준월 지수 / 계약월 지수 (한국부동산원 월간 아파트 매매가격지수 A_2024_00045, 소수점 원값)
 *  - 기준월 = 작성일 현재 공표된 최신월 (익월 15일 공표, 주말이나 공휴일이면 다음 영업일)
 *  - 지수 지역 = 구 → 시 → 시도 순으로 계약월, 기준월 둘 다 있는 첫 지역
 *  - 본건 환산가 = 시점수정 ㎡단가 × 본건 전용면적, 표기는 만원 반올림
 *  - 집계 = 본건 면적 ±3% 사례(없으면 ±15%, 없으면 전체), 해제, 2년 초과, 이상치(같은 시기 ±6개월 중위 대비 -20% 이하) 제외
 * 원본: 로컬 파이썬판 C:\Users\wjjun\AptSise\aptsise.py 와 같은 규칙. 검증: tests/apt_sise.cjs
 */
(function (g) {
  'use strict';

  const SAME_BAND = 0.03, NEAR_BAND = 0.15, OUTLIER_CUT = 0.80, OUTLIER_WINDOW = 6, LOOKBACK = 24;

  /* ── 날짜, 표기 ── */
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  function ymAdd(ym, n) { const t = (+ym.slice(0, 4)) * 12 + (+ym.slice(4)) - 1 + n; return pad(Math.floor(t / 12), 4) + pad(t % 12 + 1); }
  function ymDiff(a, b) { return ((+a.slice(0, 4)) * 12 + (+a.slice(4))) - ((+b.slice(0, 4)) * 12 + (+b.slice(4))); }
  const fmtYm = ym => ym.slice(0, 4) + '.' + ym.slice(4);
  const ymOf = iso => iso.slice(0, 4) + iso.slice(5, 7);
  function fmtWon(w) {
    if (w == null || !isFinite(w)) return '';
    const man = Math.floor(w / 10000 + 0.5), eok = Math.floor(man / 10000), rest = man % 10000;
    if (eok && rest) return eok + '억 ' + rest.toLocaleString('ko-KR') + '만원';
    if (eok) return eok + '억원';
    return rest.toLocaleString('ko-KR') + '만원';
  }
  const fmtEok = w => (w / 1e8).toFixed(2) + '억';

  // 매월 15일 전후에 걸리는 공휴일(대체공휴일 포함). 15일이 휴일이면 다음 영업일 공표.
  const HOLIDAYS = new Set([
    '2024-02-09', '2024-02-12', '2024-08-15', '2024-09-16', '2024-09-17', '2024-09-18', '2024-10-03', '2024-10-09',
    '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-03', '2025-05-05', '2025-05-06', '2025-06-03', '2025-06-06',
    '2025-08-15', '2025-10-03', '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09',
    '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-05', '2026-05-25', '2026-06-03',
    '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-05', '2026-10-09',
    '2027-02-08', '2027-02-09', '2027-03-01', '2027-05-05', '2027-05-13', '2027-08-16', '2027-09-14',
    '2027-09-15', '2027-09-16', '2027-10-04', '2027-10-11',
  ]);
  /** ym 월 지수 공표일 'YYYY-MM-DD' */
  function publishDate(ym) {
    const n = ymAdd(ym, 1);
    const d = new Date(Date.UTC(+n.slice(0, 4), +n.slice(4) - 1, 15));
    for (;;) {
      const s = d.toISOString().slice(0, 10), wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6 && !HOLIDAYS.has(s)) return s;
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  /** 작성일('YYYY-MM-DD')에 이미 공표된 최신월 */
  function baseMonthByRule(writeIso) {
    let c = ymAdd(ymOf(writeIso), -1);
    while (publishDate(c) > writeIso) c = ymAdd(c, -1);
    return c;
  }

  /* ── 주소 해석 ── */
  const SIDO = {
    '서울': ['서울특별시', '서울시', '서울'], '부산': ['부산광역시', '부산시', '부산'], '대구': ['대구광역시', '대구시', '대구'],
    '인천': ['인천광역시', '인천시', '인천'], '광주': ['광주광역시', '광주'], '대전': ['대전광역시', '대전시', '대전'],
    '울산': ['울산광역시', '울산시', '울산'], '세종': ['세종특별자치시', '세종시', '세종'], '경기': ['경기도', '경기'],
    '강원': ['강원특별자치도', '강원도', '강원'], '충북': ['충청북도', '충북'], '충남': ['충청남도', '충남'],
    '전북': ['전북특별자치도', '전라북도', '전북'], '전남': ['전라남도', '전남'], '경북': ['경상북도', '경북'],
    '경남': ['경상남도', '경남'], '제주': ['제주특별자치도', '제주도', '제주'],
  };
  function sidoShort(full) {
    for (const [s, al] of Object.entries(SIDO)) if (al.includes(full)) return s;
    for (const [s, al] of Object.entries(SIDO)) if (full && full.startsWith(al[0].slice(0, 2))) return s;
    return (full || '').slice(0, 2);
  }
  const stripSuffix = t => t.replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구|도)$/, '');
  function partMatch(t, p) {
    if (t === p) return true;
    const sp = stripSuffix(p);
    return sp.length >= 2 && stripSuffix(t) === sp;
  }

  /** 법정동 이름 → 시군구 목록 (주소에서 시도, 시군구를 뺐을 때 찾기용) */
  let _umdIdx = null, _umdSrc = null;
  function umdIndex(SGG) {
    if (_umdIdx && _umdSrc === SGG) return _umdIdx;
    _umdIdx = new Map(); _umdSrc = SGG;
    for (const e of SGG) for (const u of e.umd || []) { if (!_umdIdx.has(u)) _umdIdx.set(u, []); _umdIdx.get(u).push(e); }
    return _umdIdx;
  }

  /** '경기 파주시 동패동 1234', '마북동 524-8' → {code, sido, sgg, umd, jibun, keyword}. 같은 이름 동이 여러 곳이면 err.candidates */
  function resolveAddress(text, SGG) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('주소를 넣어주세요 (예: 파주시 동패동 1234)');
    const toks = raw.split(/[\s,]+/).filter(Boolean);
    let sido = null;
    let rest = [];
    for (const t of toks) {
      let hit = null;
      if (!sido) for (const [s, al] of Object.entries(SIDO)) if (al.includes(t)) { hit = s; break; }
      if (hit && !(hit === '광주' && toks.some(x => x.startsWith('광주시')))) sido = hit; else rest.push(t);
    }
    let ent;
    const codeTok = rest.find(t => /^\d{5}$/.test(t));
    if (codeTok) {
      ent = SGG.find(e => e.code === codeTok) || { code: codeTok, sido: '', sgg: codeTok, umd: [] };
      rest = rest.filter(t => t !== codeTok);
    } else {
      // 시군구 이름이 맞는 정도(전부/일부) + 법정동 이름으로 좁히기. 시도, 시군구를 빼도("마북동 524-8") 법정동으로 찾는다.
      const scored = [];
      for (const e of SGG) {
        if (sido && sidoShort(e.sido) !== sido) continue;
        const parts = e.sgg.split(' ');
        const used = [];
        for (const p of parts) {
          const m = rest.find(t => !used.includes(t) && partMatch(t, p));
          if (m != null) used.push(m);
        }
        if (used.length) scored.push({ e, n: used.length, full: used.length === parts.length, used });
      }
      const idx = umdIndex(SGG);
      const umdTok = rest.find(t => idx.has(t) && !scored.some(c => c.used.includes(t)));
      let cands = scored;
      if (umdTok) {
        const withUmd = idx.get(umdTok).filter(e => !sido || sidoShort(e.sido) === sido);
        const narrowed = scored.filter(c => withUmd.includes(c.e));
        cands = narrowed.length ? narrowed : (scored.length ? scored : withUmd.map(e => ({ e, n: 0, full: false, used: [] })));
      }
      if (!cands.length) throw new Error(`시군구나 법정동을 못 찾았어요: '${raw}'. 예) 마북동 524-8, 파주시 동패동, 서울 강남구 일원동`);
      const rank = c => (c.full ? 100 : 0) + c.n;
      const top = Math.max(...cands.map(rank));
      cands = cands.filter(c => rank(c) === top);
      if (cands.length > 1) {
        // 같은 이름 동이 여러 곳 → 화면에서 고르게 후보를 붙여 던짐
        const tail = rest.filter(t => !cands.some(c => c.used.includes(t)) && t !== umdTok).join(' ');
        const err = new Error(`'${umdTok || raw}'이(가) 여러 곳에 있어요. 아래에서 고르세요.`);
        err.candidates = cands.slice(0, 30).map(c => ({ label: [c.e.sido, c.e.sgg, umdTok].filter(Boolean).join(' '), address: [c.e.sido, c.e.sgg, umdTok, tail].filter(Boolean).join(' ') }));
        throw err;
      }
      ent = cands[0].e;
      rest = rest.filter(t => !cands[0].used.includes(t));
    }
    let umd = rest.find(t => (ent.umd || []).includes(t)) || null;
    if (!umd && !(ent.umd || []).length) umd = rest.find(t => /^\D.*(동|읍|면|리|가)$/.test(t)) || null;
    if (umd) rest = rest.filter(t => t !== umd);
    // 읍면 지역: 국토부 실거래 법정동(umdNm)은 '별내면 청학리'처럼 읍면 + 리. 뒤에 리가 오면 붙인다
    if (umd && /(읍|면)$/.test(umd)) { const ri = rest.find(t => /^\D+리$/.test(t)); if (ri) { umd += ' ' + ri; rest = rest.filter(t => t !== ri); } }
    let jibun = null;
    for (const t of rest) {
      const m = t.match(/^(산\s?)?(\d+)(-(\d+))?(번지)?$/);
      if (m) { jibun = (m[1] || '').trim() + m[2] + (m[4] ? '-' + m[4] : ''); rest = rest.filter(x => x !== t); break; }
    }
    return { code: ent.code, sido: ent.sido, sgg: ent.sgg, umd, jibun, keyword: rest.join(' ') || null };
  }

  /**
   * 건축물대장 조회와 같은 주소 검색(ArapBldrgst.search, V-World)에서 고른 필지 {id: PNU 19자리, addr} →
   * {code(실거래 LAWD 5자리), sido, sgg, umd, jibun, keyword:null, parcel}
   */
  function addrFromParcel(c, SGG) {
    const pnu = String(c.id || '');
    if (!/^\d{19}$/.test(pnu)) throw new Error('필지 번호(PNU)가 이상해요: ' + pnu);
    const code = pnu.slice(0, 5);
    const parcelAddr = String(c.addr || '').replace(/^.*→\s*/, '').trim();
    const toks = parcelAddr.split(/\s+/).filter(Boolean);
    const bun = +pnu.slice(11, 15), ji = +pnu.slice(15, 19);
    const jibun = (pnu.charAt(10) === '2' ? '산' : '') + bun + (ji ? '-' + ji : '');
    let ui = toks.findIndex((t, i) => i > 0 && /^\D.*(동|읍|면|가)$/.test(t));
    const ent = (SGG || []).find(e => e.code === code);
    let umd = ui > 0 ? toks[ui] : null;
    // 읍면 지역은 '별내면 청학리'처럼 리까지 (국토부 umdNm과 같은 모양)
    if (umd && /(읍|면)$/.test(umd) && /^\D+리$/.test(toks[ui + 1] || '')) umd += ' ' + toks[ui + 1];
    return {
      code, umd, jibun, keyword: null, parcel: parcelAddr, pnu,
      sido: ent ? ent.sido : (toks[0] || ''),
      sgg: ent ? ent.sgg : (ui > 1 ? toks.slice(1, ui).join(' ') : ''),
    };
  }

  /** 지수 지역 순서: 구 → 시 → 시도. clsList = [{cls, path}] (R-ONE 기준월 전체 행) */
  function roneChain(sidoFull, sggName, clsList) {
    const s = sidoFull ? sidoShort(sidoFull) : '';
    const parts = (sggName || '').split(' ').filter(Boolean);
    const segs = p => p.split('>');
    const rootOk = p => { const x = segs(p); return x[0] === s || (x[0] === '전남광주' && x[1] === s); };
    const chain = [];
    const add = c => { if (c && !chain.includes(c)) chain.push(c); };
    if (parts.length) {
      const leaf = parts[parts.length - 1];
      if (parts.length >= 2) add(clsList.find(c => rootOk(c.path) && c.path.endsWith('>' + parts[0] + '>' + leaf)));
      add(clsList.find(c => rootOk(c.path) && segs(c.path).length > 1 && segs(c.path).slice(-1)[0] === leaf));
      if (parts.length >= 2) add(clsList.find(c => rootOk(c.path) && segs(c.path).slice(-1)[0] === parts[0]));
    }
    add(clsList.find(c => c.path === s || c.path === '전남광주>' + s));
    if (!chain.length) add(clsList.find(c => c.path === '전국'));
    return chain;
  }

  /* ── 붙여넣기 파싱 ── */
  function priceFrom(text) {
    const t = text.replace(/\s/g, '');
    let m = t.match(/(\d+(?:\.\d+)?)억(?:([\d,]+)(?:만)?)?(?:원)?/);
    if (m) {
      let won = parseFloat(m[1]) * 1e8;
      if (m[2]) won += parseInt(m[2].replace(/,/g, ''), 10) * 1e4;
      return { price: Math.round(won), hit: true };
    }
    m = t.match(/([\d,]{4,})만(?:원)?/);
    if (m) return { price: parseInt(m[1].replace(/,/g, ''), 10) * 10000, hit: true };
    return { price: null, hit: false };
  }
  /**
   * 한 줄 = 한 거래, 순서 자유.
   *   2026.08.20  4.3억  124.985㎡  12층 / 26.05.19 26억 6,000 84.73㎡ 3층 직거래 / 2026-08-20,43000,124.985,12 (만원)
   * 줄에 면적이 없으면 defaultArea(보통 본건 면적).
   */
  function parsePaste(text, defaultArea) {
    const trades = [], warns = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      const ln = i + 1, s = line.trim();
      if (!s || s.startsWith('#')) return;
      let work = s.replace(/\t/g, ' ');
      const m = work.match(/(^|[^\d])(\d{4}|\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})일?/);
      if (!m) { if (!/(계약일|거래금액|전용|면적)/.test(work)) warns.push(`${ln}줄: 날짜를 못 찾아 건너뜀 (${s.slice(0, 40)})`); return; }
      let y = +m[2]; if (y < 100) y += 2000;
      const mo = +m[3], dd = +m[4];
      const dt = new Date(Date.UTC(y, mo - 1, dd));
      if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== dd) { warns.push(`${ln}줄: 날짜 오류`); return; }
      const iso = `${pad(y, 4)}-${pad(mo)}-${pad(dd)}`;
      work = work.slice(0, m.index + m[1].length) + ' ' + work.slice(m.index + m[0].length);
      const cancelled = /(해제|취소)/.test(work), direct = /직거래/.test(work);
      let floor = null, area = null;
      const fm = work.match(/(-?\d{1,3})\s*층/);
      if (fm) { floor = +fm[1]; work = work.replace(fm[0], ' '); }
      const am = work.match(/(\d{2,3}(?:\.\d+)?)\s*(㎡|m2|m²|제곱미터)/);
      if (am) { area = parseFloat(am[1]); work = work.replace(am[0], ' '); }
      let { price } = priceFrom(work);
      if (price != null) work = work.replace(/\d+(?:\.\d+)?\s*억\s*[\d,]*\s*만?\s*원?|[\d,]{4,}\s*만\s*원?/, ' ');
      let nums = (work.match(/\d[\d,]*(?:\.\d+)?/g) || []).map(n => ({ n, v: parseFloat(n.replace(/,/g, '')) }));
      if (price == null) {
        const big = nums.find(x => x.v >= 1000);
        if (big) { price = big.v < 1e6 ? Math.round(big.v * 10000) : Math.round(big.v); nums = nums.filter(x => x !== big); }
      }
      if (area == null) {
        const c = nums.find(x => x.n.includes('.') && x.v >= 10 && x.v <= 400) || nums.find(x => x.v >= 15 && x.v <= 400 && x.v !== floor);
        if (c) { area = c.v; nums = nums.filter(x => x !== c); }
      }
      if (floor == null) { const c = nums.find(x => !x.n.includes('.') && x.v >= 1 && x.v <= 99); if (c) floor = c.v; }
      if (price == null) { warns.push(`${ln}줄: 거래금액을 못 찾아 건너뜀 (${s.slice(0, 40)})`); return; }
      if (area == null) {
        if (!defaultArea) { warns.push(`${ln}줄: 면적이 없어 건너뜀. '사례 면적'을 넣거나 줄에 ㎡를 적어주세요.`); return; }
        area = +defaultArea;
      }
      trades.push({ date: iso, price, area, floor, cancelled, direct, apt: '', dong: '', src: `붙여넣기 ${ln}줄` });
    });
    return { trades, warns };
  }

  /* ── 국토부 실거래 (XML item 객체 배열) → 단지 거르기 ── */
  const norm = s => String(s || '').replace(/[\s()\-.,·]/g, '').toLowerCase();
  /** 실거래 umdNm('별내면 청학리', '동패동')과 주소 법정동 비교. 읍면만 넣었으면 그 읍면의 리 전부, 리만 넣었으면 끝 리로 */
  function umdMatch(rowUmd, umd) {
    const r = norm(rowUmd), u = norm(umd);
    if (r === u) return true;
    if (/(읍|면)$/.test(umd) && r.startsWith(u)) return true;
    const last = String(rowUmd || '').trim().split(/\s+/).pop();
    return /리$/.test(umd) && !/\s/.test(String(umd).trim()) && norm(last) === u;
  }
  function filterRtms(items, addr, aptPick) {
    let cand = items;
    if (addr.umd) cand = cand.filter(r => umdMatch(r.umdNm, addr.umd));
    if (addr.jibun) cand = cand.filter(r => String(r.jibun || '').trim() === addr.jibun);
    if (addr.keyword) { const kw = norm(addr.keyword); cand = cand.filter(r => norm(r.aptNm).includes(kw)); }
    if (aptPick) cand = cand.filter(r => r.aptNm === aptPick);
    const cx = {};
    for (const r of cand) { const k = r.aptNm || ''; (cx[k] = cx[k] || { name: k, umd: r.umdNm, jibun: r.jibun, n: 0, built: r.buildYear }).n++; }
    let complexes = Object.values(cx).sort((a, b) => b.n - a.n);
    if (complexes.length > 1 && !aptPick && !addr.jibun && addr.keyword) {
      // 키워드가 여러 단지에 걸리면(가람마을1 → 1단지, 10단지, 11단지) 이름이 정확히 같은 단지만, 아니면 후보 고르기
      const exact = complexes.filter(c => norm(c.name) === norm(addr.keyword));
      if (exact.length === 1) { cand = cand.filter(r => r.aptNm === exact[0].name); complexes = exact; }
    }
    if (!addr.jibun && !aptPick && complexes.length > 1)
      return { trades: [], complexes, message: `단지가 ${complexes.length}개예요. 지번이나 단지명을 넣거나 아래 후보에서 고르세요.` };
    const trades = [];
    for (const r of cand) {
      const y = +r.dealYear, mo = +r.dealMonth, d = +r.dealDay;
      const price = parseInt(String(r.dealAmount || '').replace(/,/g, ''), 10) * 10000, area = parseFloat(r.excluUseAr);
      if (!y || !mo || !d || !isFinite(price) || !isFinite(area)) continue;
      trades.push({
        date: `${pad(y, 4)}-${pad(mo)}-${pad(d)}`, price, area,
        floor: /^-?\d+$/.test(String(r.floor || '').trim()) ? +r.floor : null,
        cancelled: String(r.cdealType || '').trim().toUpperCase() === 'O',
        direct: String(r.dealingGbn || '').trim() === '직거래',
        apt: r.aptNm || '', dong: r.aptDong || '', src: '국토부 실거래',
      });
    }
    trades.sort((a, b) => (a.date < b.date ? 1 : -1));
    return { trades, complexes, message: null };
  }

  /* ── 계산 ── */
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

  /**
   * idx(cls, ym) → 지수값 또는 null. chain = roneChain 결과. baseYm = 실제 쓰는 기준월.
   */
  /** 호수 → 층: 1105 → 11, 203 → 2 (숫자 3자리 이상일 때 끝 두 자리를 뺀 앞부분) */
  function floorFromHo(ho) {
    const d = String(ho || '').replace(/\D/g, '');
    return d.length >= 3 ? parseInt(d.slice(0, -2), 10) || null : null;
  }
  /** 거래들의 전용면적 종류 [{area, n}] (해제 제외, 신고 면적 그대로, 작은 면적부터) */
  function areaTypes(trades) {
    const m = new Map();
    for (const t of trades) { if (t.cancelled) continue; const k = +t.area; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].map(([a, n]) => ({ area: a, n })).sort((x, y) => x.area - y.area);
  }

  /**
   * subjectArea 없으면(면적 미정) 시점수정까지만 하고 본건 환산가, 집계는 비움.
   * opts.subjectFloor: 본건 층 → 같은 층대 사례 비고(보정에는 안 씀)
   */
  function calculate(trades, subjectArea, writeIso, chain, baseYm, idx, opts) {
    opts = opts || {};
    subjectArea = subjectArea ? +subjectArea : null;
    const sf = opts.subjectFloor != null && opts.subjectFloor !== '' && isFinite(+opts.subjectFloor) ? +opts.subjectFloor : null;
    const firstYm = ymAdd(ymOf(writeIso), -LOOKBACK);
    const rows = trades.map((t, i) => {
      const r = Object.assign({}, t, { no: i + 1, ym: ymOf(t.date), notes: [] });
      let used = null;
      if (r.ym > baseYm) {
        Object.assign(r, { iCon: null, iBase: null, ratio: 1 });
        r.notes.push(`기준월(${fmtYm(baseYm)}) 이후 계약, 보정 없음`);
      } else {
        for (const c of chain) {
          const a = idx(c.cls, r.ym), b = idx(c.cls, baseYm);
          if (a && b) { used = c; Object.assign(r, { iCon: a, iBase: b, ratio: b / a }); break; }
        }
        if (!used) { Object.assign(r, { iCon: null, iBase: null, ratio: null }); r.notes.push('지수 없음'); }
        else if (used !== chain[0]) r.notes.push(`지수 ${used.path.split('>').slice(-1)[0]} 사용`);
      }
      r.idxRegion = used ? used.path : '';
      r.adjPrice = r.ratio ? r.price * r.ratio : null;
      r.unit = r.adjPrice ? r.adjPrice / r.area : null;
      r.subjectPrice = r.unit && subjectArea ? r.unit * subjectArea : null;
      if (subjectArea) {
        const dev = Math.abs(r.area / subjectArea - 1);
        r.band = dev <= SAME_BAND ? '동일' : dev <= NEAR_BAND ? '유사' : '상이';
      } else r.band = '';
      if (r.cancelled) r.notes.push('해제');
      if (r.direct) r.notes.push('직거래');
      if (r.floor != null && r.floor <= 2) r.notes.push('저층');
      if (sf != null && r.floor != null) {
        if (sf <= 2 && r.floor <= 2) r.notes.push('본건과 같은 저층');
        else if (sf > 2 && r.floor > 2 && Math.abs(r.floor - sf) <= 2) r.notes.push('본건 층 ±2');
      }
      if (r.ym < firstYm) r.notes.push('2년 초과');
      return r;
    });
    const usable = rows.filter(r => r.subjectPrice && !r.cancelled && r.ym >= firstYm);
    let pool = [], bandUsed = subjectArea ? '없음' : '면적 미정';
    for (const band of ['동일', '유사', null]) {
      const p = usable.filter(r => band == null || r.band === band);
      if (p.length) { pool = p; bandUsed = band || '전체'; break; }
    }
    for (const r of pool) {
      let others = pool.filter(o => o !== r && Math.abs(ymDiff(o.ym, r.ym)) <= OUTLIER_WINDOW);
      if (others.length < 2) others = pool.filter(o => o !== r);
      const ref = others.length >= 2 ? median(others.map(o => o.unit)) : null;
      r.outlier = !!(ref && r.unit <= ref * OUTLIER_CUT);
      if (r.outlier) r.notes.push(`이상치(중위 대비 ${Math.round((r.unit / ref - 1) * 100)}%, 특수관계 의심)`);
    }
    for (const r of rows) {
      r.outlier = !!r.outlier;
      r.include = pool.includes(r) && !r.outlier;
      if (subjectArea && usable.includes(r) && !pool.includes(r)) r.notes.push(`면적대 ${r.band}, 집계 제외`);
    }
    return { rows, bandUsed, subjectArea, subjectFloor: sf, writeDate: writeIso, baseYm, chain };
  }

  function summarize(rows) {
    const v = rows.filter(r => r.include && r.subjectPrice).map(r => r.subjectPrice).sort((a, b) => a - b);
    return v.length ? { n: v.length, total: rows.length, min: v[0], mid: median(v), max: v[v.length - 1] } : { n: 0, total: rows.length, min: null, mid: null, max: null };
  }

  const api = { umdMatch, ymAdd, ymDiff, fmtYm, fmtWon, fmtEok, publishDate, baseMonthByRule, sidoShort, resolveAddress, roneChain, parsePaste, filterRtms, calculate, summarize, floorFromHo, areaTypes, addrFromParcel, LOOKBACK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.ArapAptSise = api;
})(typeof window !== 'undefined' ? window : globalThis);
