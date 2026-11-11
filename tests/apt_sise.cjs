// 아파트 실거래 시점수정 엔진(arap_apt_sise.js) 검증 (2026-11-11)
// 우진 검증 케이스: 작성일 2026-11-11, 9월 지수 기준
//   파주 가람마을1단지 벽산한라 124.985㎡ 2026.08.20 4.3억 → 4억 2,968만원
//   강남 일원동 한솔마을 84.73㎡ 2026.05.19 26.6억 → 본건 91.81㎡ 28.75억
// 지수값은 R-ONE A_2024_00045 원값(2026-11-11 조회, 2026.06=100). 네트워크 없이 돈다.
const assert = require('assert/strict');
const path = require('path');
const A = require(path.join(__dirname, '..', 'arap_apt_sise.js'));
const SGG = require(path.join(__dirname, '..', 'arap_sgg_codes.js'));

const IDX = {
  '520046|202608': 99.3198569636739, '520046|202609': 99.2459433545941,
  '530038|202605': 98.757335309358, '530038|202609': 98.4989097493266,
};
const idx = (cls, ym) => IDX[cls + '|' + ym] || null;
const CLS = [
  {cls: 500008, path: '서울'}, {cls: 500009, path: '경기'}, {cls: 520046, path: '경기>경의권>파주시'},
  {cls: 530038, path: '서울>강남지역>동남권>강남구'}, {cls: 520026, path: '경기>경부2권>수원시'},
  {cls: 530063, path: '경기>경부2권>수원시>영통구'}, {cls: 500013, path: '전남광주>광주'}, {cls: 510045, path: '전남광주>광주>북구'},
];

// 공표일, 기준월
assert.equal(A.publishDate('202609'), '2026-10-15');
assert.equal(A.publishDate('202607'), '2026-08-18', '8/15 토, 8/17 대체공휴일 → 8/18');
assert.equal(A.baseMonthByRule('2026-11-11'), '202609');
assert.equal(A.baseMonthByRule('2026-11-16'), '202610');
assert.equal(A.baseMonthByRule('2026-10-06'), '202608', '메모: 10.6 작성이면 8월까지');

// 표기
assert.equal(A.fmtWon(429679995), '4억 2,968만원');
assert.equal(A.fmtWon(300000000), '3억원');

// 주소
let a = A.resolveAddress('경기 파주시 동패동', SGG);
assert.equal(a.code, '41480'); assert.equal(a.umd, '동패동');
a = A.resolveAddress('파주 동패동 1234', SGG);
assert.equal(a.code, '41480'); assert.equal(a.jibun, '1234');
a = A.resolveAddress('서울 강남구 일원동 한솔마을', SGG);
assert.equal(a.code, '11680'); assert.equal(a.umd, '일원동'); assert.equal(a.keyword, '한솔마을');
a = A.resolveAddress('수원시 영통구 매탄동', SGG);
assert.equal(a.code, '41117');
assert.deepEqual(A.roneChain(a.sido, a.sgg, CLS).map(c => c.cls), [530063, 520026, 500009]);
a = A.resolveAddress('광주 북구 운암동', SGG);
assert.equal(a.code, '29170');
assert.deepEqual(A.roneChain(a.sido, a.sgg, CLS).map(c => c.cls), [510045, 500013]);
assert.equal(A.resolveAddress('춘천시 퇴계동', SGG).code, '51110', '강원특별자치도 51');
assert.throws(() => A.resolveAddress('중구 1', SGG), /여러 곳/);

// 검증 케이스 1: 파주
a = A.resolveAddress('경기 파주시 동패동', SGG);
let chain = A.roneChain(a.sido, a.sgg, CLS);
let p = A.parsePaste('2026.08.20 4.3억 124.985㎡ 12층', 124.985);
let r = A.calculate(p.trades, 124.985, '2026-11-11', chain, '202609', idx);
assert.equal(A.fmtWon(r.rows[0].subjectPrice), '4억 2,968만원');

// 검증 케이스 2: 강남 (84.73㎡ 사례 → 91.81㎡ 본건)
a = A.resolveAddress('서울 강남구 일원동 한솔마을', SGG);
chain = A.roneChain(a.sido, a.sgg, CLS);
p = A.parsePaste('2026.05.19 26.6억 84.73㎡', 91.81);
r = A.calculate(p.trades, 91.81, '2026-11-11', chain, '202609', idx);
assert.equal(A.fmtEok(r.rows[0].subjectPrice), '28.75억');

// 붙여넣기 형식, 집계 규칙
p = A.parsePaste([
  '계약일 거래금액 층',
  '26.10.03 4억 4,000 15층',
  '2026.08.20 4.3억 124.985㎡ 12층',
  '2026-07-11\t43,500\t124.985\t8',
  '2026.06.02 3억 1,000 3층 직거래',
  '2025.12.08 4억 1,000 9층 해제',
  '2024.09.01 3억 9,000 7층',
  '2025.11.21 4억 800 99.84㎡ 10층',
].join('\n'), 124.985);
assert.equal(p.trades.length, 7); assert.deepEqual(p.warns, []);
assert.deepEqual(p.trades.map(t => t.price), [440000000, 430000000, 435000000, 310000000, 410000000, 390000000, 408000000]);
assert.equal(p.trades[2].floor, 8); assert.equal(p.trades[2].area, 124.985);
const flat = (cls, ym) => (ym <= '202609' ? 100 : null);
r = A.calculate(p.trades, 124.985, '2026-11-11', [{cls: 1, path: 'x'}], '202609', flat);
const inc = r.rows.map(x => x.include);
assert.deepEqual(inc, [true, true, true, false, false, false, false]);
assert.ok(r.rows[0].notes.some(n => /이후 계약/.test(n)));
assert.ok(r.rows[3].outlier, '3.1억 = 이상치');
assert.ok(r.rows[4].notes.includes('해제'));
assert.ok(r.rows[5].notes.includes('2년 초과'));
assert.ok(r.rows[6].notes.some(n => /면적대 상이/.test(n)));
assert.equal(r.bandUsed, '동일');
const s = A.summarize(r.rows);
assert.equal(s.n, 3); assert.equal(s.min, 430000000); assert.equal(s.max, 440000000);

// 국토부 실거래 단지 거르기
const items = [
  {aptNm: '가람마을1단지(벽산한라)', umdNm: '동패동', jibun: '1234', dealYear: '2026', dealMonth: '8', dealDay: '20', dealAmount: '43,000', excluUseAr: '124.985', floor: '12', cdealType: '', dealingGbn: '중개거래'},
  {aptNm: '가람마을1단지(벽산한라)', umdNm: '동패동', jibun: '1234', dealYear: '2026', dealMonth: '8', dealDay: '25', dealAmount: '45,000', excluUseAr: '124.985', floor: '14', cdealType: 'O', dealingGbn: '중개거래'},
  {aptNm: '다른단지', umdNm: '동패동', jibun: '999', dealYear: '2026', dealMonth: '8', dealDay: '3', dealAmount: '50,000', excluUseAr: '84.9', floor: '5', cdealType: '', dealingGbn: '직거래'},
];
let f = A.filterRtms(items, {umd: '동패동', jibun: null, keyword: null});
assert.equal(f.complexes.length, 2); assert.ok(f.message);
f = A.filterRtms(items, {umd: '동패동', jibun: '1234', keyword: null});
assert.equal(f.trades.length, 2); assert.equal(f.trades[0].cancelled, true); assert.equal(f.trades[1].price, 430000000);
f = A.filterRtms(items, {umd: '동패동', jibun: null, keyword: null}, '다른단지');
assert.equal(f.trades.length, 1); assert.equal(f.trades[0].direct, true);

// 키워드가 여러 단지에 걸리면 후보 고르기 (실제 파주 와동동: 가람마을1 → 1단지, 10단지)
const g2 = [
  Object.assign({}, items[0], {aptNm: '가람마을1단지벽산한라(1308)', umdNm: '와동동', jibun: '1308'}),
  Object.assign({}, items[0], {aptNm: '가람마을10단지월드메르디앙(1356)', umdNm: '와동동', jibun: '1356'}),
];
f = A.filterRtms(g2, {umd: null, jibun: null, keyword: '가람마을1'});
assert.equal(f.complexes.length, 2); assert.ok(f.message);
f = A.filterRtms(g2, {umd: null, jibun: '1308', keyword: null});
assert.equal(f.trades.length, 1); assert.equal(f.message, null);

// 입력 유연화: 호 → 층, 면적 미정, 층 비고, 면적 종류
assert.equal(A.floorFromHo('1105'), 11); assert.equal(A.floorFromHo('203호'), 2); assert.equal(A.floorFromHo('12'), null); assert.equal(A.floorFromHo(''), null);
const tt = A.parsePaste('2026.08.20 4.3억 124.985㎡ 12층\n2026.07.11 2억 84.9㎡ 1층\n2026.06.02 4억 124.985㎡ 13층 해제\n2026.05.02 4.2억 124.985㎡ 2층', null).trades;
assert.deepEqual(A.areaTypes(tt), [{area: 84.9, n: 1}, {area: 124.985, n: 2}]);
r = A.calculate(tt, null, '2026-11-11', [{cls: 1, path: 'x'}], '202609', flat, {subjectFloor: 11});
assert.equal(r.bandUsed, '면적 미정'); assert.equal(A.summarize(r.rows).n, 0);
assert.ok(r.rows.every(x => x.subjectPrice == null && x.unit > 0 && !x.include));
assert.ok(r.rows[0].notes.includes('본건 층 ±2')); assert.ok(!r.rows[1].notes.includes('본건 층 ±2'));
r = A.calculate(tt, 124.985, '2026-11-11', [{cls: 1, path: 'x'}], '202609', flat, {subjectFloor: 1});
assert.ok(r.rows[1].notes.includes('본건과 같은 저층')); assert.ok(r.rows[3].notes.includes('본건과 같은 저층'));
assert.equal(r.subjectFloor, 1);

// 시도, 시군구를 빼도 법정동으로 찾기 (우진: '마북동 524-8')
for (const q of ['마북동 524-8', '기흥구 마북동 524-8', '경기도 용인시 기흥구 마북동 524-8', '용인시 마북동 524-8', '기흥 마북동 524-8']) {
  const x = A.resolveAddress(q, SGG);
  assert.equal(x.code, '41463', q); assert.equal(x.umd, '마북동', q); assert.equal(x.jibun, '524-8', q); assert.equal(x.keyword, null, q);
}
assert.equal(A.resolveAddress('중구 신당동', SGG).code, '11140', '서울 중구에만 신당동');
assert.equal(A.resolveAddress('대치동 974', SGG).code, '11680');
// 같은 이름 동이 여러 곳이면 후보
let amb = null; try { A.resolveAddress('신사동 한양', SGG); } catch (e) { amb = e; }
assert.ok(amb && amb.candidates && amb.candidates.length >= 2, '신사동 후보');
assert.ok(amb.candidates.some(c => c.label === '서울특별시 강남구 신사동' && c.address === '서울특별시 강남구 신사동 한양'));
assert.equal(A.resolveAddress(amb.candidates[0].address, SGG).umd, '신사동');
assert.throws(() => A.resolveAddress('서울 신사동', SGG), e => e.candidates.length === 2);
assert.equal(A.resolveAddress('강남구 신사동', SGG).code, '11680');

// 건축물대장 주소 검색(V-World) 후보 → 실거래 주소
let pa = A.addrFromParcel({id: '4146311300105240008', addr: '경기도 용인시 기흥구 마북동 524-8'}, SGG);
assert.deepEqual([pa.code, pa.sido, pa.sgg, pa.umd, pa.jibun], ['41463', '경기도', '용인시 기흥구', '마북동', '524-8']);
pa = A.addrFromParcel({id: '1168010600109740000', addr: '서울특별시 강남구 대치동 974'}, SGG);
assert.deepEqual([pa.code, pa.umd, pa.jibun], ['11680', '대치동', '974']);
pa = A.addrFromParcel({id: '4159099999200120003', addr: '연원로 1 → 경기도 화성시 동탄구 오산동 산12-3'}, []);
assert.deepEqual([pa.code, pa.sido, pa.sgg, pa.umd, pa.jibun], ['41590', '경기도', '화성시 동탄구', '오산동', '산12-3']);

// 읍면 지역: 국토부 umdNm은 '별내면 청학리'(읍면 + 리)
pa = A.addrFromParcel({id: '4136031021104760000', addr: '경기도 남양주시 별내면 청학리 476'}, SGG);
assert.deepEqual([pa.code, pa.umd, pa.jibun], ['41360', '별내면 청학리', '476']);
const ra = A.resolveAddress('남양주시 별내면 청학리 동부일신', SGG);
assert.deepEqual([ra.code, ra.umd, ra.keyword], ['41360', '별내면 청학리', '동부일신']);
const eup = [
  {umdNm: '별내면 청학리', jibun: '476', aptNm: '동부일신'}, {umdNm: '별내면 청학리', jibun: '488', aptNm: '거성수락산'},
  {umdNm: '별내면 광전리', jibun: '1', aptNm: '다른리'}, {umdNm: '별내동', jibun: '476', aptNm: '별내동단지'},
];
assert.deepEqual(A.filterRtms(eup, {umd: '별내면 청학리', jibun: '476', keyword: null}).complexes.map(c => c.name), ['동부일신']);
assert.equal(A.filterRtms(eup, {umd: '별내면', jibun: null, keyword: null}).complexes.length, 3, '읍면만 넣으면 그 읍면 리 전부');
assert.ok(A.umdMatch('별내면 청학리', '청학리') && !A.umdMatch('별내동', '별내면') && A.umdMatch('동패동', '동패동'));

// 칩으로 여러 면적 고르기: 고른 면적은 전부 동일(±3%보다 우선), 안 고른 84.97은 ±3% 안이어도 유사로 빠짐
const mt = [84.94, 84.96, 84.99, 84.97, 59.93].map((area, i) => ({date: '2026-0' + (i + 3) + '-10', price: 2400000000, area, floor: 10, cancelled: false, direct: false}));
r = A.calculate(mt, 84.94, '2026-11-11', [{cls: 1, path: 'x'}], '202609', flat, {sameAreas: [84.94, 84.96, 84.99]});
assert.deepEqual(r.rows.map(x => x.band), ['동일', '동일', '동일', '유사', '상이']);
assert.deepEqual(r.rows.map(x => x.include), [true, true, true, false, false]);
assert.equal(r.bandUsed, '동일(고른 면적 84.94, 84.96, 84.99㎡)');
assert.deepEqual(r.sameAreas, [84.94, 84.96, 84.99]);
r = A.calculate(mt, 84.94, '2026-11-11', [{cls: 1, path: 'x'}], '202609', flat);
assert.deepEqual(r.rows.map(x => x.band), ['동일', '동일', '동일', '동일', '상이'], '고르지 않으면 ±3% 그대로');

console.log('apt_sise: OK');
