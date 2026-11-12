// 인근 유사 신축 실거래 엔진(arap_apt_nearby.js) 검증 (2026-11-13). 네트워크 없이 돈다.
// 실데이터 대조: 대치동 624(남서울종합시장) 반경 2km, 전용 59.9±3㎡ → 로컬 파이썬판과 같은 값.
const assert = require('assert/strict');
const path = require('path');
const N = require(path.join(__dirname, '..', 'arap_apt_nearby.js'));

// 거리: 대치동 624 → 대치푸르지오써밋(대치동 1032) 약 926m
const d = N.distM(127.05988055485062, 37.493354667136465, 127.06170556418931, 37.50155789690592);
assert.ok(Math.abs(d - 926) < 3, '거리 ' + d);

// 둘레 점: 12개, 첫 점은 정북 2km
const ring = N.ringPoints(127.06, 37.49, 2000);
assert.equal(ring.length, 12);
assert.ok(Math.abs(N.distM(127.06, 37.49, ring[0].x, ring[0].y) - 2000) < 5);
assert.ok(Math.abs(N.distM(127.06, 37.49, ring[8].x, ring[8].y) - 1000) < 5);

// 인접 구: 본건 구 맨 앞, 많이 걸친 순, 실패(null)와 본건 구 중복은 뺌
assert.deepEqual(N.pickSggs('11680', ['11680', '11710', null, '11650', '11710', 'x'], 5), ['11680', '11710', '11650']);
assert.deepEqual(N.pickSggs('11680', ['11710', '11650', '11740', '11200', '11215'], 3).length, 3);

// 기간
assert.equal(N.cutDate('2026-11-13', 12), '2025-11-13');

// 수집: 면적, 준공, 기간, 해제, 직거래
const row = (o) => Object.assign({ umdNm: '대치동', jibun: '1032', aptNm: '대치푸르지오써밋', buildYear: '2023', dealYear: '2026', dealMonth: '8', dealDay: '28',
  dealAmount: '300,000', excluUseAr: '59.9885', floor: '13', aptDong: '', dealingGbn: '중개거래', cdealType: '' }, o);
const lists = [{ code: '11680', items: [
  row({}),
  row({ dealMonth: '3', dealDay: '5', dealAmount: '250,000', dealingGbn: '직거래', floor: '2' }),
  row({ excluUseAr: '84.99', dealAmount: '420,000' }),                         // 면적 밖 (전 평형 건수에는 들어감)
  row({ dealYear: '2025', dealMonth: '10', dealDay: '1' }),                    // 기간 밖
  row({ aptNm: '대치아이파크', jibun: '888', buildYear: '2008' }),               // 준공 오래됨
  row({ aptNm: '해제단지', jibun: '1', cdealType: 'O', dealAmount: '280,000' }),
  row({ aptNm: '지번없음', jibun: '' }),
] }];
const cx = N.collect(lists, { area: 59.9, tol: 3, minYear: 2016, from: '2025-11-13', to: '2026-11-13' });
assert.equal(cx.length, 2);
const s = cx.find(c => c.name === '대치푸르지오써밋');
assert.equal(s.id, '11680|대치동|1032');
assert.equal(s.trades[0].kind, '매매');
assert.equal(s.trades.length, 2);
assert.equal(s.allN, 3);
assert.equal(s.trades[0].date, '2026-08-28');
assert.equal(s.trades[0].price, 3000000000);
assert.equal(s.trades[1].direct, true);
assert.equal(cx.find(c => c.name === '해제단지').trades[0].cancelled, true);

// 분양권, 입주권 전매: 준공연도 없이 포함, 같은 지번이면 매매와 한 단지 (청담르엘 134-18, 111.97㎡ 83.8억 입주권)
const silvRow = { umdNm: '청담동', jibun: '134-18', aptNm: '청담르엘', dealYear: '2026', dealMonth: '4', dealDay: '7', dealAmount: '838,000',
  excluUseAr: '111.9779', floor: '22', ownershipGbn: '입주권', dealingGbn: '중개거래', cdealType: '' };
const cx2 = N.collect([
  { code: '11680', kind: 'silv', items: [silvRow, Object.assign({}, silvRow, { excluUseAr: '84.5' })] },
  { code: '11680', kind: 'trade', items: [row({ umdNm: '청담동', jibun: '134-18', aptNm: '청담르엘아파트', buildYear: '2025', excluUseAr: '111.76', dealAmount: '830,000', dealMonth: '9' })] },
], { area: 111.97, tol: 3, minYear: 2016, from: '2025-11-13', to: '2026-11-13' });
assert.equal(cx2.length, 1);
assert.equal(cx2[0].built, 2025);
assert.equal(cx2[0].name, '청담르엘아파트');
assert.equal(cx2[0].allN, 3);
assert.deepEqual(cx2[0].trades.map(t => t.kind), ['매매', '입주권']);
assert.equal(cx2[0].trades[1].price, 8380000000);
const cx3 = N.collect([{ code: '11680', kind: 'silv', items: [silvRow] }], { area: 111.97, tol: 3, minYear: 2016, from: '2025-11-13', to: '2026-11-13' });
assert.equal(cx3[0].built, null);

// 본건 단지: 같은 필지이거나 60m 이내
assert.equal(N.isOwn('1168010400101340018', '1168010400101340018', 400), true);
assert.equal(N.isOwn('1168010400101340018', '1168010400101340019', 40), true);
assert.equal(N.isOwn('1168010400101340018', '1168010400101340019', 182), false);
assert.equal(N.isOwn('', '', 182), false);

// 건축물대장 → 세대수, 최고층 (대치푸르지오써밋 총괄 489세대)
assert.deepEqual(N.bldInfo([{ hhldCnt: 489 }], [{ hhldCnt: 76, grndFlrCnt: 17 }, { hhldCnt: 83, grndFlrCnt: 18 }, { hhldCnt: 0, grndFlrCnt: 1 }]), { hhld: 489, flr: 18, dongs: 2 });
assert.deepEqual(N.bldInfo([], [{ hhldCnt: '40', grndFlrCnt: '7' }, { hhldCnt: '33', grndFlrCnt: '9' }]), { hhld: 73, flr: 9, dongs: 2 });
assert.deepEqual(N.bldInfo(null, null), { hhld: null, flr: null, dongs: null });

// 규모, 층 구간
assert.equal(N.scale(489), '대단지'); assert.equal(N.scale(300), '대단지'); assert.equal(N.scale(273), '중규모');
assert.equal(N.scale(99), '소규모'); assert.equal(N.scale(null), '세대수 미확인');
assert.equal(N.band(4), '저층 (1~4층)'); assert.equal(N.band(5), '중층 (5~14층)'); assert.equal(N.band(15), '고층 (15~24층)');
assert.equal(N.band(25), '초고층 (25층~)'); assert.equal(N.band(null), '층 미상');

// 집계
assert.deepEqual(N.stat([30e8, 25e8, 28e8, 33.7e8]), { n: 4, min: 25e8, mid: 29e8, max: 33.7e8 });
assert.deepEqual(N.stat([]), { n: 0, min: null, mid: null, max: null });

// 입주권: 권리가액 7.67억 + 납입 0 + (30억 - 16.96억) = 20.71억
assert.equal(N.ipj(30e8, '7.67', '16.96', ''), 2071000000);
assert.equal(N.ipj(38.29e8, 7.67, 16.96, 0), 2900000000);
assert.equal(N.ipj(30e8, '7.67', '16.96', '2'), 2271000000);
assert.equal(N.ipj(30e8, '', '16.96', ''), null);

console.log('apt_nearby OK');
