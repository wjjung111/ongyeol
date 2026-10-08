// 거래사례 위치도(p9v3xk2m.html) — 일단지 거래사례
// 확인: '여의도동 13-6' 추가 → 건축물대장 관련지번(13-31·13-30·13-29)까지 한 사례 · 소재지 '여의도동 13-6 외' ·
//       토지면적 = 네 필지 합 · 용도지역 모음 · 지도는 네 필지 테두리 + 이름표 하나 · 「외」를 지우면 대표 지번만(다시 안 붙음) ·
//       다른 지번으로 고치면 새로 조회 · KAIS '… 외 3필지'도 대표 지번으로 지도 조회
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n.slice(1));
  if(!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(f));});
const pnuOf=j=>{const [b,s]=j.split('-');return '11560110001'+String(b).padStart(4,'0')+String(s||0).padStart(4,'0');};
const AREA={'13-6':1000,'13-31':200.5,'13-30':150,'13-29':49.5,'9-1':300};
const json=o=>({contentType:'application/json',body:JSON.stringify(o)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
let atchCalls=0;
try{
  const page=await browser.newPage();
  page.on('pageerror',e=>console.error('pageerror',e.message));
  await page.route(/unpkg\.com|dapi\.kakao|openstreetmap|xdworld/,r=>r.abort());
  await page.route(/api\.vworld\.kr\/req\/search/,r=>{const q=new URL(r.request().url()).searchParams.get('query');
    const k=Object.keys(AREA).find(k=>q.endsWith(' '+k));
    r.fulfill(json({response:{status:'OK',result:{items:k?[{id:pnuOf(k),point:{x:'126.92',y:'37.53'},address:{parcel:'서울특별시 영등포구 여의도동 '+k}}]:[]}}}));});
  await page.route(/getLandCharacteristics/,r=>{const pnu=new URL(r.request().url()).searchParams.get('pnu');
    const k=Object.keys(AREA).find(k=>pnuOf(k)===pnu);
    r.fulfill(json({landCharacteristicss:{field:[{stdrYear:'2026',lndcgrCodeNm:'대',lndpclAr:String(AREA[k]),pblntfPclnd:k==='13-6'?'20000000':'1',
      prposArea1Nm:k==='13-29'?'준주거지역':'일반상업지역',prposArea2Nm:'지정되지않음'}]}}));});
  await page.route(/api\.vworld\.kr\/req\/data/,r=>r.fulfill(json({response:{status:'OK',result:{featureCollection:{features:[]}}}})));
  await page.route(/workers\.dev\/bld/,r=>{const u=new URL(r.request().url()),op=u.searchParams.get('op'),pnu=u.searchParams.get('pnu');
    let item=[];
    if(op==='getBrAtchJibunInfo'){atchCalls++;if(pnu===pnuOf('13-6'))item=['31','30','29'].map(j=>({atchSigunguCd:'11560',atchBjdongCd:'11000',atchPlatGbCd:'0',atchBun:'0013',atchJi:'00'+j}));}
    r.fulfill(json({response:{header:{resultCode:'00'},body:{items:item.length?{item}:''}}}));});
  await page.goto(base+'/p9v3xk2m.html');
  await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.fill('#addLoc','여의도동 13-6');await page.click('.addloc .btn.pri');
  await page.waitForFunction(()=>/건 중/.test(document.getElementById('msgAuto').textContent));
  let r=await page.evaluate(()=>{const r=DATA.land[0];return {loc:r.loc,landA:r.landA,use:r.use,gongsi:r.gongsi,rel:(r.rel||[]).map(p=>p.loc)};});
  assert.deepEqual(r,{loc:'여의도동 13-6 외',landA:'1400',use:'일반상업지역, 준주거지역',gongsi:'20000000',
    rel:['서울특별시 영등포구 여의도동 13-31','서울특별시 영등포구 여의도동 13-30','서울특별시 영등포구 여의도동 13-29']});
  assert.equal(await page.$eval('#tblLand tr:nth-child(2) td:nth-child(3) input',x=>x.value),'여의도동 13-6 외');
  // 지도: 네 필지 한 묶음, 대표 지번은 「외」 없이 조회
  let it=await page.evaluate(()=>mapItems().filter(x=>x.kind==='토지 거래사례').map(x=>[x.loc,x.labelGroup,x.label]));
  assert.equal(it.length,4);assert.deepEqual(it[0],['여의도동 13-6','land0','토지 #1']);assert.ok(it.every(x=>x[1]==='land0'&&x[2]==='토지 #1'));
  // ⚡ 다시 눌러도 「외」가 겹치지 않음
  await page.click('text=⚡ 빈칸 자동 채우기');await page.waitForFunction(()=>/✅ 1건 중/.test(document.getElementById('msgAuto').textContent));
  assert.equal(await page.evaluate(()=>DATA.land[0].loc),'여의도동 13-6 외');
  // 「외」를 지우면 대표 지번만 — 다시 채워도 안 붙음
  const set=async(i,col,v)=>{const s=`#tblLand tr:nth-child(${i+2}) td:nth-child(${col+3}) input`;await page.fill(s,v);await page.$eval(s,x=>x.blur());};
  await set(0,0,'여의도동 13-6');await page.waitForTimeout(400);
  it=await page.evaluate(()=>mapItems().filter(x=>x.kind==='토지 거래사례').length);assert.equal(it,1);
  assert.equal(await page.evaluate(()=>DATA.land[0].loc),'여의도동 13-6');
  // 다른 지번으로 고치면 새로 조회(관련지번 없음)
  await set(0,0,'여의도동 9-1');await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>[DATA.land[0].loc,(DATA.land[0].rel||[]).length]),['여의도동 9-1',0]);
  // KAIS식 '외 3필지' 소재지도 지도는 대표 지번으로
  await page.evaluate(()=>{DATA.land.push({loc:'여의도동 13-6 외 3필지',show:true});});
  assert.equal(await page.evaluate(()=>mapItems().filter(x=>x.kind==='토지 거래사례').pop().loc),'여의도동 13-6');
  console.log('OK map_case_ildanji');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
