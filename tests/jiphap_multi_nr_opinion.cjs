// 여러 호수 한글 의견서 — 주거·비주거 섞인 건의 「4. 시점수정」(2026-11-16)
//  가. 매매가격지수(주거 사례) / 나. 자본수익률(근생 사례: 거래·기준시점, 분기내역·산식, 상승률) / 다. 결정(주거·상업 문장)
//  주거만이면 자본수익률 블록 빠지고 「나. 시점수정치의 결정」, 근생만이면 매매가격지수 블록 빠지고 가·나로
// OUT_DIR을 주면 섞인 건 파일을 거기 저장(한글에서 열어 보기용)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}let data=fs.readFileSync(f);if(f.endsWith('s3r86w8a.html'))data=data.toString().replace("ReactDOM.createRoot(document.getElementById('root-multi'))","window.multiHelpers={applyR,getUV,parseTimeAdjDetail,numberToKoreanMoney,assembleToice,parseZip,createZipStored};ReactDOM.createRoot(document.getElementById('root-multi'))");res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(data);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url().includes('arap_access.js')?r.fulfill({body:''}):r.request().url().startsWith(base)?r.continue():r.abort());
await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','multi');sessionStorage.setItem('arap-jiphap-mode','multi');});
await page.goto(base+'/s3r86w8a.html');await page.waitForFunction(()=>window.multiHelpers);
const run=variant=>page.evaluate(async variant=>{
  const res={id:'r1',symbol:1,isShown:true,isSelected:true,location:'서울특별시 강동구 성내동',jibun:'524-1',aptName:'퍼브릭 하우스',floor:'5',ho:'502',exclusiveArea:53.36,price:231000000,unitPrice:4329085,tradeDate:'2026.06.29',approvalDate:'2002.05.10',useKind:'연립/다세대',timeAdj:1.03532,timeAdjDetail:'연립다세대\n지역 : 서울 동남권\n매매가격지수 : 2026.06 ~ 2026.09\n시점수정치 : 103.53/100.00≒1.03532'};
  const nr={id:'n1',symbol:2,isShown:true,isSelected:true,location:'서울특별시 강동구 성내동',jibun:'174-58',aptName:'LAPUTA 174 101호 (근생)',floor:'1',ho:'101',exclusiveArea:45.57,price:400000000,unitPrice:8777704,tradeDate:'2025.06.10',approvalDate:'2022.10.28',timeAdj:1.04935,timeAdjDetail:'집합상가\n2025년 2분기 : 0.80%\n2025년 3분기 : 1.10%\n2025년 4분기 : 1.20%\n2026년 1분기 : 1.00%\n2026년 2분기 : 0.70%\n2026년 3분기 : 0.70% (2026년 2분기 자료)\n(1+0.0080*21/91)*(1+0.0110)*(1+0.0120)*(1+0.0100)*(1+0.0070)*(1+0.0070*39/92)≒1.04935'};
  const cases=variant==='res'?[res]:variant==='nr'?[nr]:[res,nr];
  const U=(id,ho,use,cid)=>({id,floor:ho[0],ho,area:'50',commonArea:'10',landArea:'12',mainUseJeonyu:use,extFactor:'1',intFactor:'1',hoFactor:'1',etcFactor:'1',appliedCaseId:cid});
  const units=variant==='res'?[U(1,'201','다세대주택','r1')]:variant==='nr'?[U(1,'101','제2종근린생활시설','n1')]:[U(1,'101','제2종근린생활시설','n1'),U(2,'201','다세대주택','r1'),U(3,'301','다세대주택','r1')];
  const ov={caseNo:'MIX',client:'검증',owner:'검증',jibun:'서울특별시 강동구 성내동 420-5',buildingName:'검증빌',kind:'다세대주택',mainUse:'공동주택(다세대주택), 제2종근린생활시설',structure:'철근콘크리트구조',floors:'4/0',approvalDate:'2003.07.09',purpose:'일반거래(시가참고)',baseDate:'2026.10.26',surveyDate:'2026.10.26',writeDate:'2026.10.26',baseDateBasis:'의뢰일인',units};
  const r=await ArapMultiHwpx.build({ov,cases,uD:'만원',uM:'round',tD:'백만원',tM:'round'},multiHelpers,'opinion');
  const entries=await multiHelpers.parseZip(r.bytes.buffer),dec=new TextDecoder(),x=dec.decode(entries.find(e=>e.name==='Contents/section0.xml').data);
  const d=new DOMParser().parseFromString(x,'application/xml');if(d.querySelector('parsererror'))throw Error('xml');
  const HP='http://www.hancom.co.kr/hwpml/2011/paragraph',vis=n=>Array.from(n.getElementsByTagNameNS(HP,'t')).map(t=>t.textContent).join('');
  const all=vis(d.documentElement),i=all.indexOf('4. 시점수정'),j=all.indexOf('5. 지역요인');
  const paras=Array.from(d.documentElement.children).filter(p=>p.localName==='p').map(vis);
  const hdr=d.querySelector('*');
  const header=dec.decode(entries.find(e=>e.name==='Contents/header.xml').data);
  // 파란 글씨(플레이스홀더 색) 남았는지
  const hd=new DOMParser().parseFromString(header,'application/xml'),blue=new Set(Array.from(hd.getElementsByTagNameNS('*','charPr')).filter(c=>/^#?0000FF$/i.test(c.getAttribute('textColor')||'')).map(c=>c.getAttribute('id')));
  const blueRuns=Array.from(d.getElementsByTagNameNS(HP,'run')).filter(r=>blue.has(r.getAttribute('charPrIDRef'))&&vis(r).trim()).length;
  const tables=d.getElementsByTagNameNS(HP,'tbl').length;
  const k6=all.indexOf('6. 개별요인'),k7=all.indexOf('7. 전유면적당');
  return {fac:all.slice(k6,k7),sec:all.slice(i,j),paras,left:(all.match(/\{\{[^}]+\}\}/g)||[]),blueRuns,tables,bytes:Array.from(r.bytes)};
},variant);
// 섞인 건
const mix=await run('mix');
assert.deepEqual(mix.left,[],'남은 토큰 '+mix.left);
assert.ok(mix.sec.includes('가. 연립다세대 매매가격지수'),mix.sec);
assert.ok(mix.sec.includes('나. 자본수익률(집합 상가)'),mix.sec);
assert.ok(mix.sec.includes('[출처: 한국부동산원 임대동향조사]'));
assert.ok(mix.sec.includes('다. 시점수정치의 결정'));
assert.ok(mix.sec.includes('본건 중 주거용부동산은')&&mix.sec.includes('본건 중 상업용부동산은')&&mix.sec.includes('자본수익률(집합 상가)을 기준으로'),mix.sec);
assert.ok(mix.sec.includes('거래시점2025.06.10')&&mix.sec.includes('기준시점2026.10.26'),mix.sec);
assert.ok(mix.sec.includes('2025.2Q(91일) : 0.80')&&mix.sec.includes('2026.3Q(92일) : 0.70 (2026.2Q 자료)'),mix.sec);
assert.ok(mix.sec.includes('(1+0.00800×21/91)×(1+0.01100)×')&&mix.sec.includes('4.935(1.04935)'),mix.sec);
assert.ok(mix.sec.includes('3.532(1.03532)'),'주거 사례 표 '+mix.sec);
assert.ok(!mix.sec.includes('##'),'기호 # 두 번 '+mix.sec);assert.ok(mix.sec.includes('거래사례#1')&&mix.sec.includes('거래사례#2'),mix.sec);
assert.ok(!/자본수익률[^]*#1[^]*기준시점/.test(mix.sec.slice(mix.sec.indexOf('나. 자본'))),'주거 사례는 자본수익률 표에 없음');
assert.equal(mix.blueRuns,0,'파란 글씨 남음');
assert.equal(mix.tables,13);
// 6. 개별요인 비교항목: 주거 호수 → 주거용, 근생 호수 → 상업용(둘 다)
assert.ok(mix.fac.includes('개별요인 비교항목(주거용)')&&mix.fac.includes('개별요인 비교항목(상업용)')&&mix.fac.includes('상권의 특성')&&mix.fac.includes('공실률 및 입점업체 구성')&&mix.fac.includes('교육환경'),mix.fac.slice(0,400));
// 분기내역 줄마다 문단
assert.ok(mix.paras.length>0);
// 주거만
const res=await run('res');
assert.deepEqual(res.left,[]);assert.ok(!res.sec.includes('자본수익률')&&res.sec.includes('나. 시점수정치의 결정')&&res.sec.includes('본건은 주거용부동산으로서'),res.sec);assert.equal(res.tables,10);assert.ok(res.fac.includes('(주거용)')&&!res.fac.includes('(상업용)'));
// 근생만
const nr=await run('nr');
assert.deepEqual(nr.left,[]);assert.ok(!nr.sec.includes('매매가격지수')&&nr.sec.includes('가. 자본수익률(집합 상가)')&&nr.sec.includes('나. 시점수정치의 결정')&&nr.sec.includes('본건은 상업용부동산으로서'),nr.sec);assert.equal(nr.tables,10);assert.ok(nr.fac.includes('(상업용)')&&!nr.fac.includes('(주거용)')&&nr.fac.includes('상권의 특성'),nr.fac.slice(0,300));
if(process.env.OUT_DIR)fs.writeFileSync(path.join(process.env.OUT_DIR,'multi_mixed_opinion.hwpx'),Buffer.from(mix.bytes));
assert.deepEqual(errors,[]);console.log('PASS jiphap_multi_nr_opinion');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
