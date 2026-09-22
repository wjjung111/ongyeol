// 건물 기준시가 엔진(arap_gijunsiga.js) — 국세청 「2026년 건물 기준시가 계산방법 해설서」 계산사례(p.54~72) 원 단위 대조.
// 해설서 파일: 02.하이테크/문서, 양식/2026년 건물 기준시가 계산방법 해설서_국세청.pdf
// 사례는 해설서가 실제로 적용한 지수·조정률 그대로 입력한다. 해설서 사례가 고시 조문과 어긋나는 곳은 각 사례 주석에 적어 둠.
// 실행: node tests/gijunsiga.cjs  (이 PC처럼 Node가 없으면 저장소 폴더를 로컬 서버로 열고 tests/run.html 을 브라우저로 — 같은 파일을 돌린다)
// ※ 해설서 단순 사례(p.54~66)는 건물 전체를 한 줄로 계산하고 조정률Ⅳ(상가 1·2층)를 넣지 않는다 → ftype 'none'으로 입력.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.join(__dirname,'..');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'arap_gijunsiga.js'),'utf8'),context);
const G=context.window.ArapGijunsiga;

// tax: 'SJ'(상속·증여, 조정률 적용) | 'YD'(양도, 조정률 미적용). units·total은 해설서 금액.
function check(name,tax,input,units,total){
  const r=G.compute(Object.assign({year:2026,remodel:0,intel:0,roof:'1'},input));
  assert.ok(r.ready,`${name}: 입력 누락 ${r.missing}`);
  const got=r.lines.map(l=>tax==='SJ'?l.unitSJ:l.unitYD);
  assert.deepEqual(got,units,`${name}: ㎡당 가액`);
  assert.equal(Math.round((tax==='SJ'?r.totSJ:r.totYD)*100)/100,total,`${name}: 기준시가`);
}
const one=(use,area,ftype='none',extra={})=>[Object.assign({floor:'전체',use,useOvr:'',area,ftype,extra:'1'},extra)];

// ── 1. 2026년 개정사항 반영 사례 (p.54~58) ──
// p.54 목구조 115(2026 하향). 패널지붕이지만 구조지수 100 이상이라 조정률Ⅰ 미적용.
check('p54 목구조','SJ',{structNo:2,built:2009,top:1,landPrice:964000,roof:'0.8',rows:one(41,95)},[598000],56810000);
// p.55 직업훈련소 102. 해설서 표의 신축가격기준액 "850,000"은 오기 — 결과 350,000원은 860,000으로 계산한 값.
check('p55 직업훈련소','YD',{structNo:6,built:1998,top:2,landPrice:3500000,rows:one(33,518.82)},[350000],181587000);
check('p56 양로원·위치 104','YD',{structNo:4,built:2004,top:7,landPrice:1115000,rows:one(35,850.72)},[459000],390480480);
check('p57 경로당·위치 106','SJ',{structNo:4,built:2004,top:1,landPrice:1450000,roof:'0.8',rows:one(35,75.3)},[421000],31701300);
check('p58 유흥주점·위치 108','YD',{structNo:9,built:2001,top:3,landPrice:1730000,rows:one(15,1200.34)},[238000],285680920);

// ── 2. 일반 계산 사례 (p.59~66) ──
check('p59 자원순환','YD',{structNo:5,built:2009,top:5,landPrice:47300,rows:one(54,660)},[343000],226380000);
// p.60 창고: 철골조(95)+샌드위치판넬지붕인데 해설서는 조정률Ⅰ(패널 80)을 넣지 않고 0.90만 적용.
//   고시 표(p.39)상 패널지붕·구조지수 100 미만이면 80 대상 → 해설서 사례 쪽 불일치. 여기선 해설서 적용대로 roof '1'.
check('p60 창고','SJ',{structNo:5,built:2005,top:1,landPrice:859000,roof:'1',rows:one(52,432)},[296000],127872000);
check('p61 단독주택 265㎡ (Ⅲ 120)','SJ',{structNo:9,built:2003,top:1,landPrice:960700,rows:one(2,265,'res_s1')},[257000],68105000);
check('p62 근린생활','SJ',{structNo:4,built:1996,top:3,landPrice:2177000,rows:one(41,65.42)},[385000],25186700);
check('p63 운동시설 1,289㎡ (Ⅱ 100)','SJ',{structNo:4,built:2015,top:4,landPrice:1123000,rows:one(24,1289.83)},[896000],1155687680);
check('p64 동식물·철파이프 슬레이트','SJ',{structNo:11,built:1995,top:1,landPrice:165000,roof:'0.8',rows:one(59,137.15)},[18000],2468700);
check('p65 판매시설','YD',{structNo:6,built:1962,top:3,landPrice:1922000,rows:one(11,138.15)},[79000],10913850);
// p.66 공장: 시멘트블록조 → 구조지수 90(6번)이지만 내용연수는 Ⅲ그룹(30년). 6번 안에서도 시멘트벽돌·와이어패널은 Ⅱ, 블록·황토는 Ⅲ.
check('p66 공장·시멘트블록 Ⅲ그룹','SJ',{structNo:6,structText:'시멘트블록조',built:1987,top:1,landPrice:1810900,roof:'0.8',rows:one(48,250)},[46000],11500000);

// ── 3. 기타 계산 사례 (p.67~72) ──
// p.67 리모델링: 통나무조 단독주택 342㎡(Ⅲ 140). 할증 잔가율 0.46+0.0648=0.5248 → 767,000원(해설서 본문의 0.5428은 오기, 각주 산식은 0.5248).
check('p67 리모델링 전','SJ',{structNo:1,built:1996,top:1,landPrice:152000,rows:one(2,342,'res_s2')},[672000],229824000);
check('p67 리모델링 후(상속)','SJ',{structNo:1,built:1996,remodel:2008,top:1,landPrice:152000,rows:one(2,342,'res_s2')},[767000],262314000);
// 리모델링 할증은 상속·증여에만 적용, 양도는 신축연도 잔가율 그대로(해설서 p.30 (3)).
check('p67 리모델링 후(양도)','YD',{structNo:1,built:1996,remodel:2008,top:1,landPrice:152000,rows:one(2,342,'res_s2')},[480000],164160000);
// p.68 층별 구조 상이: 1층 RC 공장 2,100 / 2층 경량철골·패널지붕 "공장의 부속창고" 1,300 — 부속창고는 주용도(공장 78) 지수, 조정률 60 없음.
check('p68 층별 구조 상이','SJ',{structNo:4,built:1998,top:2,landPrice:560000,roof:'0.8',rows:[
  {floor:'1층',use:48,useOvr:'',area:2100,ftype:'none',extra:'1'},
  {floor:'2층',use:48,useOvr:'',area:1300,ftype:'none',extra:'1',strctNo:9}]},[322000,65000],760700000);
// p.69 사무소 6,000 + 지하주차장 2,000: 주차장은 부속 면적 2,000 기준 Ⅱ 100 × 60 (연면적 8,000 기준이면 110이 됨).
check('p69 사무소+지하주차장','SJ',{structNo:4,built:1997,top:5,landPrice:(1000*2500000+2000*3000000+3000*1500000)/6000,rows:[
  {floor:'1~5층',use:29,useOvr:'',area:6000,ftype:'none',extra:'1'},
  {floor:'지1층',use:29,useOvr:'',area:2000,ftype:'park',extra:'1'}]},[592000,323000],4198000000);
// p.70 위치지수: 잔가율 0.2125(해설서 표시 0.213은 반올림) — 0.213으로 계산하면 2026.5.31 이후분이 191,000이 돼 틀린다.
check('p70 공시지가 변경 전','SJ',{structNo:6,built:1991,top:2,landPrice:2430000,rows:one(2,115.16,'res')},[187000],21534920);
check('p70 공시지가 변경 후','SJ',{structNo:6,built:1991,top:2,landPrice:2690000,rows:one(2,115.16,'res')},[190000],21880400);
// p.71~72 주거+상업 복합, 공용 부속(주차장 60·보일러실 30)을 주용도 면적비(100:200)로 안분 → 슈퍼 귀속 30 / 주택 귀속 60.
const mixed=[
  {floor:'1층 슈퍼',use:41,useOvr:'',area:100,ftype:'shop1',extra:'1'},
  {floor:'2~3층 주택',use:2,useOvr:'',area:200,ftype:'res',extra:'1'},
  {floor:'지1 슈퍼귀속',use:41,useOvr:'',area:30,ftype:'park',extra:'1'},
  {floor:'지1 주택귀속',use:2,useOvr:'',area:60,ftype:'res_att',extra:'1'}];
check('p71 복합건물(상속)','SJ',{structNo:4,built:2000,top:3,landPrice:2500000,rows:mixed},[544000,530000,272000,318000],187640000);
// p.73~74 같은 건물 양도 계산서: 조정률(부속 60 포함) 전부 미적용.
check('p73 복합건물(양도)','YD',{structNo:4,built:2000,top:3,landPrice:2500000,rows:mixed},[504000,530000,504000,530000],203320000);

// ── 대장 매핑·자동판정 ──
{ // 단독주택 265㎡ → Ⅲ 120 자동 (p.61)
  const rows=one(2,265,'res');G.applyDandok(rows,'단독주택');assert.equal(rows[0].ftype,'res_s1');}
{ // 신원동 390-2: 주택 199.07 + 지하 부속창고 93.88 → 주택 부분 264㎡ 미만이라 Ⅲ 미적용
  const rows=[{ftype:'res',area:199.07},{ftype:'res_att',area:93.88}];G.applyDandok(rows,'단독주택');assert.equal(rows[0].ftype,'res');}
assert.equal(G.structGroup(6,'시멘트블록조'),3);
assert.equal(G.structGroup(6,'황토조'),3);
assert.equal(G.structGroup(6,'시멘트벽돌조'),2);
assert.equal(G.structGroup(4,'목조'),2);
assert.equal(G.structGroup(4,'철근콘크리트조'),1);
assert.equal(G.structGroup(4,''),1);
assert.equal(G.mapStructure('시멘트블록조')[0],6);
assert.equal(G.mapStructure('목구조')[0],2,'목구조는 2번(115), 철근콘크리트 100 아님');
assert.equal(G.mapStructure('목조')[0],4);
assert.equal(G.mapStructure('보강블록조')[0],5,'보강블록조는 5번(95), 시멘트블록 90 아님');
assert.equal(G.mapStructure('철근콘크리트구조')[0],4);
{ // 대장 구조 텍스트가 compute까지 전달되는지 — 시멘트블록조 공장(p.66)을 대장 행으로
  const row=G.rowFromRegister({gb:'지상',no:1,name:'1층',purps:'공장',area:250,attach:'주건축물',strct:'시멘트블록조'},'공장',1,250);
  const r=G.compute({year:2026,structNo:6,structText:'시멘트블록조',built:1987,top:1,landPrice:1810900,roof:'0.8',rows:[row]});
  assert.equal(r.group,3);assert.equal(r.lines[0].group,3);}
{ // 통나무조는 조정률Ⅱ 제외 (p.39 비고): 비주거 2,000㎡ 5층 이하 — Ⅱ가 들어가면 100, 빠지면 조정 없음
  const r=G.compute({year:2026,structNo:1,built:2016,top:2,landPrice:1000000,rows:one(41,2000)});
  assert.equal(r.lines[0].adjII,1);}
{ // 리모델링 경과연수 ⓝ은 내용연수 N 이하 (p.36 산식 단서)
  assert.equal(G.residual(2026,1970,1,2025),G.residual(2026,1970,1,2020));}

console.log('gijunsiga: 해설서 계산사례 전부 일치');
