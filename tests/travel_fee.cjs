// 여비 기준표 주소 매칭 — 공용 엔진(arap_cheonggu.js) 동작 + 집합건물·입주권 원본과의 동일성.
// 기준표 키는 "경기도 성남분당구"처럼 시를 뺀 붙여쓰기이므로, 공부상 "경기도 성남시 분당구"를 맞추는
// 정규화가 세 곳(집건 2벌·입주권·엔진)에 똑같이 들어 있어야 한다. 한쪽만 고치면 그 화면의 여비가 40,000으로 떨어진다.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.join(__dirname,'..');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'arap_cheonggu.js'),'utf8'),context);
const fee=context.window.ArapCheonggu.arapTravelFee;
for(const address of ['경기도 성남시 중원구 여수동 457','경기도 성남중원구','경기도 성남시 분당구','경기도 성남시 수정구','경기 성남시 중원구'])assert.equal(fee(address),95600,address);
assert.equal(fee('경기도 수원시 영통구'),105000);
assert.equal(fee('경기도 고양시 일산동구'),99600);
assert.equal(fee('서울특별시 중구'),40000);
assert.equal(fee('여수동 457'),null);
assert.equal(fee(''),null);

// ── 세 파일의 arapTravelFee 가 같은 결과를 내는지 (구판이 남아 있으면 여기서 걸린다) ──
function grab(file,name){const s=fs.readFileSync(path.join(root,file),'utf8');
  const i=s.indexOf('function '+name+'(');assert.ok(i>=0,`${file} 에 ${name} 없음`);
  let d=0,k=s.indexOf('{',i);
  for(;;k++){if(s[k]==='{')d++;else if(s[k]==='}'&&--d===0)break;}
  return s.slice(i,k+1);}
const table=(()=>{const s=fs.readFileSync(path.join(root,'arap_cheonggu.js'),'utf8');
  const i=s.indexOf('const ARAP_TRAVEL_FEES=');return s.slice(i,s.indexOf('};',i)+2);})();
const build=(src)=>vm.runInNewContext(`${table}\n${src.join('\n')}\nthis`);
const jip=build([grab('s3r86w8a.html','arapTravelFee')]);
const ipj=build([grab('입주권.html','arapTravelFee'),grab('입주권.html','arapTravelFeeBySgg')]);
// 집합건물은 단일호수(#root)·여러호수(#root-multi) 두 벌이라 같은 함수가 두 번 있어야 한다
const jipSrc=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
assert.equal(jipSrc.split('function arapTravelFee(addr){').length-1,2,'집합건물의 arapTravelFee 는 두 벌(#root·#root-multi) 이어야 함');
const norm=s=>s.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'').replace(/'/g,'"');
assert.equal(norm(grab('s3r86w8a.html','arapTravelFee')),norm(grab('arap_cheonggu.js','arapTravelFee')),
  '집합건물과 공용 엔진의 arapTravelFee 가 다르다 — 한쪽만 고쳐졌다');
assert.equal(norm(grab('입주권.html','arapTravelFee')),norm(grab('arap_cheonggu.js','arapTravelFee')),
  '입주권과 공용 엔진의 arapTravelFee 가 다르다 — 한쪽만 고쳐졌다');
for(const [addr,want] of [
  ['서울특별시 강남구 압구정동 429',40000],['경기도 수원시 영통구 이의동 1265',105000],
  ['경기도 성남시 분당구 정자동 178',95600],['경기도 고양시 일산동구 장항동 880',99600],
  ['경기도 용인시 수지구 풍덕천동 1',105000],['충청북도 청주시 상당구 용암동 1',269600],
  ['충청남도 천안시 서북구 불당동 1',256800],['전라북도 전주시 완산구 효자동 1',291800],
  ['경상북도 포항시 북구 장성동 1',323400],['대구광역시 수성구 범어동 1',319600],
  ['부산광역시 해운대구 우동 1',345800],['경상남도 창원시 성산구 상남동 1',330800],
  ['경기도 화성시 동탄 1',108400],['제주특별자치도 제주시 연동 1',251000],
  // 토지건물의 건명 꼬리("외 N필지 토지 및 건물")가 붙어도 같아야 한다
  ['경기도 성남시 분당구 정자동 178 외 2필지 토지 및 건물',95600],
]){
  assert.equal(jip.arapTravelFee(addr),want,`집합건물: ${addr}`);
  assert.equal(ipj.arapTravelFee(addr),want,`입주권: ${addr}`);
  assert.equal(fee(addr),want,`공용 엔진: ${addr}`);
}
// ── 입주권 보조 조회: 사업위치에 시도명이 없어 시군구만 있을 때, 금액이 하나로 좁혀질 때만 쓴다 ──
for(const [q,want] of [['서초구',40000],['수성구',319600],['분당구',95600],['해운대구',345800],
  ['일산동구',99600],['성남시 분당구',95600],
  ['중구',null],['강서구',null],['',null],['구',null]])
  assert.equal(ipj.arapTravelFeeBySgg(q),want,`입주권 보조 조회: ${JSON.stringify(q)}`);

console.log('Travel fee address matching passed (engine + 집합건물 2벌 + 입주권 · 보조 조회)');
