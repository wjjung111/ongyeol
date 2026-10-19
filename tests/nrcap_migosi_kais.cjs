// 비주거용 자본수익률 시점수정 — 미공표 분기가 둘 이상이면 카이스처럼 한 항으로 묶는지
//   (1+최근공표율 × 미공표 일수 합 / 최근공표분기 일수). 카이스 「집합건물 시점수정」 화면 값 그대로(2026-10-19 사용자 캡처)
// 4벌(집건 단일·여러호수, 입주권, 시점수정 계산기)의 buildNrCapText를 파일에서 잘라 Node에서 실행
// node tests/nrcap_migosi_kais.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
// 서울 집합상가 — 2025.4Q 0.74 / 2026.1Q 0.89 / 2026.2Q 1.09, 최근 공표 2026.2Q (3Q 미발표)
const window={ARAP_INDEX_DATA:{capReturn:{types:{"집합상가":{latest:"20262",regions:{"서울":{"20253":0.58,"20254":0.74,"20261":0.89,"20262":1.09}}}}}}};
const CASES=[
  ["2025.12.27","2026.10.15","1.03338","(1+0.0074*5/92)*(1+0.0089)*(1+0.0109)*(1+0.0109*107/91)"],
  ["2025.11.03","2026.10.15","1.03787","(1+0.0074*59/92)*(1+0.0089)*(1+0.0109)*(1+0.0109*107/91)"],
  // 미공표 분기 하나(종전 검증 방식과 같음) · 미공표 분기 안 거래
  ["2026.01.10","2026.08.20","1.02522","(1+0.0089*81/90)*(1+0.0109)*(1+0.0109*51/91)"],
  ["2026.07.05","2026.10.15","1.01234","(1+0.0109*103/91)"],
  // 모두 공표 구간이면 종전 그대로
  ["2025.08.01","2026.05.10","1.02516","(1+0.0058*61/92)*(1+0.0074)*(1+0.0089)*(1+0.0109*40/91)"],
];
let n=0;
for(const f of ['s3r86w8a.html','입주권.html','arm_시점수정.html']){
  const src=fs.readFileSync(path.join(root,f),'utf8');
  const re=/const buildNrCapText=\(kind,region,tradeDate,baseDate\)=>\{[\s\S]*?\n\};/g;let m,k=0;
  while((m=re.exec(src))){k++;n++;
    const fn=new Function('window',`const capData=()=>(window.ARAP_INDEX_DATA&&window.ARAP_INDEX_DATA.capReturn)||null;${m[0]};return buildNrCapText;`)(window);
    for(const [t0,t1,adj,formula] of CASES){const r=fn("집합상가","서울",t0,t1);assert.ok(!r.err,r.err);
      const got=(r.산식||r.text.split('\n').pop());
      assert.ok(got.startsWith(formula+' ≒ '),`${f}#${k} ${t0}~${t1}: ${got}`);assert.ok(got.endsWith(adj),`${f}#${k} ${t0}~${t1}: ${got}`);}
    console.log(f,'#'+k,'OK');}
  assert.ok(k>0,f+' 함수 못 찾음');}
assert.equal(n,4,'4벌');console.log('PASS');
