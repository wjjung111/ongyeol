// 거래사례 위치도(p9v3xk2m.html) — 본건 일단지 관련지번
// 확인: 본건 주소 → PNU → 프록시 부속지번(getBrAtchJibunInfo) → 관련지번 칩 · 지도 항목이 「본건」 한 묶음 ·
//       다른 법정동 관련지번은 연속지적도 주소 · 직접 추가/빼기 · 같은 주소면 다시 안 물음 · 옛 프록시(2판) 안내
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n.slice(1));
  if(!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(f));});
const PNU='1156011000100170006';
const atch=(bjd,bun,ji,gb='0')=>({atchSigunguCd:'11560',atchBjdongCd:bjd,atchPlatGbCd:gb,atchBun:bun,atchJi:ji,bldNm:'광복회관'});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
let proxyCalls=0,oldProxy=false;
try{
  const page=await browser.newPage();
  page.on('pageerror',e=>console.error('pageerror',e.message));
  await page.route(/unpkg\.com|dapi\.kakao|openstreetmap|xdworld/,r=>r.abort());
  await page.route(/api\.vworld\.kr\/req\/search/,r=>{const q=new URL(r.request().url()).searchParams.get('query');
    r.fulfill({contentType:'application/json',body:JSON.stringify({response:{status:'OK',result:{items:[{id:PNU,point:{x:'126.92',y:'37.53'},address:{parcel:'서울특별시 영등포구 여의도동 17-6'}}]}}})});});
  await page.route(/api\.vworld\.kr\/req\/data/,r=>{const u=r.request().url();
    const addr=u.includes('1156011100')?'서울특별시 영등포구 당산동 5':'';
    r.fulfill({contentType:'application/json',body:JSON.stringify({response:{status:'OK',result:{featureCollection:{features:[{properties:{addr}}]}}}})});});
  await page.route(/workers\.dev\/bld/,r=>{proxyCalls++;const u=new URL(r.request().url());
    assert.equal(u.searchParams.get('op'),'getBrAtchJibunInfo');assert.equal(u.searchParams.get('pnu'),PNU);
    const item=oldProxy?[{flrNo:'1',flrGbCdNm:'지상'}]:[atch('11000','0017','0021'),atch('11000','0017','0022'),atch('11000','0017','0023'),atch('11000','0017','0022'),atch('11000','0017','0006'),atch('11100','0005','0000')];
    r.fulfill({contentType:'application/json',body:JSON.stringify({response:{header:{resultCode:'00'},body:{items:{item},totalCount:item.length}}})});});
  await page.goto(base+'/p9v3xk2m.html');
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('arap-user-name','테스트');});await page.reload();
  await page.fill('#baseLoc','여의도동 17-6');await page.click('text=지도에 표시');
  await page.waitForFunction(()=>window.DATA.rel&&window.DATA.rel.done);
  // 1. 대장 부속지번 → 칩 (본건 자신·중복 제외, 다른 동은 동 이름까지)
  const chips=await page.$$eval('#relRow .chip label',a=>a.map(x=>x.textContent));
  assert.deepEqual(chips,['17-21','17-22','17-23','당산동 5']);
  const locs=await page.evaluate(()=>DATA.rel.list.map(p=>p.loc));
  assert.deepEqual(locs,['서울특별시 영등포구 여의도동 17-21','서울특별시 영등포구 여의도동 17-22','서울특별시 영등포구 여의도동 17-23','서울특별시 영등포구 당산동 5']);
  // 2. 지도 항목: 본건 + 관련 4 = 한 묶음, 이름표 '본건', 모두 kind 본건(거리 기준은 첫 항목)
  let it=await page.evaluate(()=>mapItems().filter(x=>x.kind==='본건').map(x=>({g:x.labelGroup,l:x.label,loc:x.loc,b:x.boundaryLeader})));
  assert.equal(it.length,5);assert.ok(it.every(x=>x.g==='subject'&&x.l==='본건'&&x.b));assert.equal(it[0].loc,'여의도동 17-6');
  // 칩 목록 본건에 '외 4필지'
  assert.match(await page.textContent('#pickChips'),/외 4필지/);
  // 3. 체크 끄면 지도에서 빠짐
  await page.uncheck('#rl3');
  it=await page.evaluate(()=>mapItems().filter(x=>x.kind==='본건').length);assert.equal(it,4);
  // 4. 직접 추가(쉼표 여러 개, 중복 무시) · ✕ 빼기
  await page.fill('#relRow input.box','17-24, 17-21번지');await page.press('#relRow input.box','Enter');
  let l=await page.evaluate(()=>DATA.rel.list.map(p=>p.jibun+':'+p.src));
  assert.deepEqual(l,['17-21:대장','17-22:대장','17-23:대장','당산동 5:대장','17-24:직접']);   // 17-21은 이미 있어 무시
  await page.click('#relRow .chip:last-of-type .x');
  l=await page.evaluate(()=>DATA.rel.list.map(p=>p.jibun));assert.deepEqual(l,['17-21','17-22','17-23','당산동 5']);
  await page.fill('#relRow input.box','17-24');await page.press('#relRow input.box','Enter');
  // 5. 다시 열어도 같은 주소면 프록시 다시 안 부름, 저장 유지
  await page.waitForTimeout(400);const before=proxyCalls;await page.reload();await page.waitForTimeout(500);
  assert.equal(proxyCalls,before);assert.equal(await page.$$eval('#relRow .chip',a=>a.length),5);
  // 6. 다시 조회: 직접 넣은 지번·끈 체크는 유지
  await page.click('text=↻ 대장 다시 조회');await page.waitForFunction(n=>window.DATA.rel.done&&true,before);
  await page.waitForTimeout(300);
  l=await page.evaluate(()=>DATA.rel.list.map(p=>p.jibun+(p.show===false?'(끔)':'')));
  assert.deepEqual(l,['17-21','17-22','17-23','당산동 5(끔)','17-24']);
  // 7. 옛 프록시(층별개요가 돌아옴) → 안내, done 아님
  oldProxy=true;await page.fill('#baseLoc','여의도동 17-6 ');await page.fill('#baseLoc','서울 영등포구 여의도동 17-6');await page.click('text=지도에 표시');
  await page.waitForFunction(()=>DATA.rel&&DATA.rel.msg==='old');
  assert.match(await page.textContent('#relRow'),/옛 판/);
  assert.equal(await page.evaluate(()=>DATA.rel.done),false);
  // 8. 관련지번 없으면 묶음 없이 종전대로
  it=await page.evaluate(()=>mapItems().filter(x=>x.kind==='본건').map(x=>x.labelGroup));assert.deepEqual(it,['']);
  console.log('OK map_related_jibun');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
