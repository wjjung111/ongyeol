// 거래사례 위치도(p9v3xk2m.html) — 좌우 배치. 실제 Leaflet(LEAFLET_TEST_DIR 사본).
// 확인: 지도 왼쪽 70% · 입력란 오른쪽 · 지도가 화면 높이를 채움 · 가운데 막대를 끌면 너비가 바뀌고 Leaflet 크기도 따라감 ·
//       새로고침해도 비율 유지 · 두 번 누르면 7:3 · 좁은 화면(900px 이하)은 위아래
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),vendor=process.env.LEAFLET_TEST_DIR||path.join(root,'..','map-test-vendor');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n.slice(1));
  if(!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(f));});
const json=o=>({contentType:'application/json',body:JSON.stringify(o)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
try{
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  page.on('pageerror',e=>{console.error('pageerror',e.message);process.exitCode=1;});
  await page.route(/unpkg\.com\/leaflet@[^/]+\/dist\/(leaflet\.(js|css))/,r=>r.fulfill({path:path.join(vendor,r.request().url().match(/(leaflet\.(js|css))$/)[1])}));
  await page.route(/dapi\.kakao|openstreetmap|xdworld|vworld\.kr\/req\/(wmts|image|wms)/,r=>r.abort());
  await page.route(/api\.vworld\.kr\/req\/search/,r=>r.fulfill(json({response:{status:'OK',result:{items:[{id:'1156011000100150022',point:{x:'126.92',y:'37.528'},address:{parcel:'서울특별시 영등포구 여의도동 15-22'}}]}}})));
  await page.route(/api\.vworld\.kr\/req\/data|workers\.dev|ned\/data/,r=>r.fulfill(json({})));
  await page.goto(base+'/p9v3xk2m.html');
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('arap-user-name','테스트');localStorage.setItem('arap-map-cases-v1',JSON.stringify({base:'',land:[{loc:'여의도동 15-22',show:true}],jip:[]}));});
  await page.reload();
  await page.waitForFunction(()=>window.MAPV&&MAPV.leaflet(),null,{timeout:20000});
  const box=sel=>page.$eval(sel,e=>{const r=e.getBoundingClientRect();return {x:r.left,w:r.width,y:r.top,h:r.height,b:r.bottom};});
  let m=await box('#paneMap'),sd=await box('#paneSide'),mb=await box('#mapBox');
  assert.ok(m.x<sd.x,'지도가 왼쪽');
  const ratio=m.w/(m.w+sd.w);assert.ok(Math.abs(ratio-0.7)<0.02,'7:3 '+ratio);
  assert.ok(mb.b>800&&mb.h>550,'지도가 화면 높이를 채움 '+JSON.stringify(mb));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+2),'페이지 전체 스크롤 없음');
  await page.screenshot({path:process.env.SHOT||'/dev/null'}).catch(()=>{});
  // 막대 끌기 → 50% 근처
  const sp=await box('#splitter');
  await page.mouse.move(sp.x+4,sp.y+200);await page.mouse.down();
  await page.mouse.move(800,sp.y+200,{steps:6});await page.mouse.up();
  await page.waitForTimeout(150);
  m=await box('#paneMap');assert.ok(Math.abs(m.w-780)<40,'끌어서 줄어듦 '+m.w);
  const sz=await page.evaluate(()=>[MAPV.leaflet().getSize().x,document.getElementById('mapBox').clientWidth]);
  assert.equal(sz[0],sz[1],'Leaflet 크기 따라감');
  const saved=await page.evaluate(()=>parseFloat(localStorage.getItem('arap-map-split')));assert.ok(saved>45&&saved<55,'저장 '+saved);
  await page.reload();await page.waitForFunction(()=>window.MAPV&&MAPV.leaflet(),null,{timeout:20000});
  m=await box('#paneMap');assert.ok(Math.abs(m.w-780)<40,'새로고침 유지 '+m.w);
  // 두 번 누르면 7:3
  await page.dblclick('#splitter');await page.waitForTimeout(100);
  m=await box('#paneMap');sd=await box('#paneSide');assert.ok(Math.abs(m.w/(m.w+sd.w)-0.7)<0.02);
  // 좁은 화면 → 위아래
  await page.setViewportSize({width:820,height:900});await page.waitForTimeout(200);
  m=await box('#paneMap');sd=await box('#paneSide');assert.ok(sd.y>=m.b-1,'좁으면 아래로');
  console.log('OK map_split_layout');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
