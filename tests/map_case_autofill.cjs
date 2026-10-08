// 거래사례 위치도(p9v3xk2m.html) — 소재지만으로 토지 사례 추가 + 빈칸 자동 채우기 + 토지 배분
// 확인: '여의도동 15-22, 15-23' → 2건 추가(동 이름 이어 붙임) · 토지특성(최신 연도)·건축물대장(연면적 합·주건물 사용승인일) 채움 ·
//       KAIS/직접 값은 안 덮어씀 · 토지금액 = 거래금액 − 건물금액, 토지단가 절사 · 직접 적으면 우선 · 소재지 칸 수정 시 자동 채움
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n.slice(1));
  if(!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(f));});
const PNU={'15-22':'1156011000100150022','15-23':'1156011000100150023','1-1':'1156011000100010001'};
const json=o=>({contentType:'application/json',body:JSON.stringify(o)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
try{
  const page=await browser.newPage();
  page.on('pageerror',e=>console.error('pageerror',e.message));
  await page.route(/unpkg\.com|dapi\.kakao|openstreetmap|xdworld/,r=>r.abort());
  await page.route(/api\.vworld\.kr\/req\/search/,r=>{const q=new URL(r.request().url()).searchParams.get('query');
    const k=Object.keys(PNU).find(k=>q.endsWith(' '+k));
    r.fulfill(json({response:{status:'OK',result:{items:k?[{id:PNU[k],point:{x:'126.92',y:'37.53'},address:{parcel:'서울특별시 영등포구 여의도동 '+k}}]:[]}}}));});
  await page.route(/api\.vworld\.kr\/ned\/data\/getLandCharacteristics/,r=>{const pnu=new URL(r.request().url()).searchParams.get('pnu');
    const f=(y,p)=>({stdrYear:y,lastUpdtDt:y+'-01-01',lndcgrCodeNm:'대',lndpclAr:'661.2',pblntfPclnd:p,prposArea1Nm:'일반상업지역',prposArea2Nm:'지정되지않음'});
    r.fulfill(json({landCharacteristicss:{field:pnu.endsWith('0022')?[f('2025','30000000'),f('2026','31500000')]:[f('2026','28000000')]}}));});
  await page.route(/api\.vworld\.kr\/req\/data/,r=>r.fulfill(json({response:{status:'OK',result:{featureCollection:{features:[]}}}})));
  await page.route(/workers\.dev\/bld/,r=>{const u=new URL(r.request().url());
    if(u.searchParams.get('op')!=='getBrTitleInfo')return r.fulfill(json({response:{header:{resultCode:'00'},body:{items:''}}}));
    const pnu=u.searchParams.get('pnu');
    const item=pnu.endsWith('0022')?[{mainAtchGbCdNm:'부속건축물',totArea:'20.5',useAprDay:'19900101'},{mainAtchGbCdNm:'주건축물',totArea:'3300.25',useAprDay:'20050312'}]:[];
    r.fulfill(json({response:{header:{resultCode:'00'},body:{items:item.length?{item}:''}}}));});
  await page.goto(base+'/p9v3xk2m.html');
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('arap-user-name','테스트');});await page.reload();
  // 1. 소재지만으로 2건 추가
  await page.fill('#addLoc','여의도동 15-22, 15-23');await page.click('.addloc .btn.pri');
  await page.waitForFunction(()=>/건 중/.test(document.getElementById('msgAuto').textContent));
  let rows=await page.evaluate(()=>DATA.land.map(r=>({loc:r.loc,use:r.use,jimok:r.jimok,landA:r.landA,gongsi:r.gongsi,y:r.gongsiYear,bldA:r.bldA,appr:r.appr})));
  assert.deepEqual(rows[0],{loc:'여의도동 15-22',use:'일반상업지역',jimok:'대',landA:'661.2',gongsi:'31500000',y:'2026',bldA:'3320.75',appr:'2005.03.12'});
  assert.equal(rows[1].loc,'여의도동 15-23');assert.equal(rows[1].bldA,undefined);assert.equal(rows[1].gongsi,'28000000');
  assert.equal(await page.evaluate(()=>DATA.land.some(r=>r._busy)),false);
  // 2. 표 머리 · 공시지가 쉼표
  const heads=await page.$$eval('#tblLand th.rh',a=>a.map(x=>x.textContent));
  assert.deepEqual(heads.slice(1),['소재지','용도지역','지목','토지면적(㎡)','개별공시지가(원/㎡)','건물면적(㎡)','사용승인일','거래금액(원)','거래일자','건물금액(원)','토지금액(원)','토지단가(원/㎡)','비고']);
  const LK=['loc','use','jimok','landA','gongsi','bldA','appr','total','date','bldAmt','landAmt','landUnit','memo'];   // 세로 표 — 칸은 data-i(사례)·data-k(항목)로 찾는다
  const cell=(i,col)=>page.$eval(`#tblLand td[data-i="${i}"][data-k="${LK[col]}"] input`,x=>x.value);
  assert.equal(await cell(0,4),'31,500,000');
  // 3. 토지 배분: 거래금액 50억 − 건물금액 10억 → 토지금액 40억, 단가 = trunc(40억/661.2)
  const set=async(i,col,v)=>{const s=`#tblLand td[data-i="${i}"][data-k="${LK[col]}"] input`;await page.fill(s,v);await page.$eval(s,x=>x.blur());};
  await set(0,7,'5000000000');
  assert.equal(await cell(0,10),'5,000,000,000');            // 건물금액 없으면 거래금액 = 토지금액
  await set(0,9,'1000000000');
  assert.equal(await cell(0,10),'4,000,000,000');assert.equal(await cell(0,11),Math.trunc(4e9/661.2).toLocaleString('ko-KR'));
  assert.equal(await page.$eval('#tblLand td[data-i="0"][data-k="landUnit"]',x=>x.className.includes('calc')),true);
  // 직접 적으면 그 값 우선(파란 글씨 아님), 지우면 다시 자동
  await set(0,11,'6000000');assert.equal(await cell(0,11),'6,000,000');
  assert.equal(await page.$eval('#tblLand td[data-i="0"][data-k="landUnit"]',x=>x.className.includes('calc')),false);
  await set(0,11,'');assert.equal(await cell(0,11),Math.trunc(4e9/661.2).toLocaleString('ko-KR'));
  // 4. 직접 적은 값은 안 덮어씀
  await set(1,1,'준주거지역');
  await page.click('text=⚡ 빈칸 자동 채우기');await page.waitForFunction(()=>/2건 중/.test(document.getElementById('msgAuto').textContent));
  assert.equal(await page.evaluate(()=>DATA.land[1].use),'준주거지역');
  // 5. 빈 행에 소재지 적으면 자동
  await page.click('text=+ 빈 행');await set(2,0,'여의도동 1-1');
  await page.waitForFunction(()=>DATA.land[2]&&DATA.land[2].jimok==='대');
  // 6. 못 찾는 주소 → 안내
  await page.fill('#addLoc','없는동 999');await page.click('.addloc .btn.pri');
  await page.waitForFunction(()=>/못 찾음/.test(document.getElementById('msgAuto').textContent));
  console.log('OK map_case_autofill');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
