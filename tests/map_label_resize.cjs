// 위치도 이름표(말풍선) 크기 조절 검증(2026-11-13) — 집건 위치도(arap_map.js, Leaflet)
//  - 이름표 오른쪽 아래 손잡이를 끌면 커지고(배율 저장), 새로 그려도 유지 / 줄이면 작아짐 / 두 번 누르면 원래 크기·자리
//  - 손잡이를 끄는 동안 이름표 자리(labOff)는 바뀌지 않음
// 실제 Leaflet 사본이 필요: LEAFLET_TEST_DIR(기본 ../map-test-vendor)에 leaflet.js·leaflet.css
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/map_label_resize.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),vendor=process.env.LEAFLET_TEST_DIR||path.join(root,'..','map-test-vendor');
const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
const adapter=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes("var KEY='arap-jiphap-map-v1'"))[1];
const server=http.createServer((req,res)=>{const n=req.url.split('?')[0];res.setHeader('Content-Type',n.endsWith('.css')?'text/css':n.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
if(n==='/')return res.end('<link rel="stylesheet" href="/leaflet.css"><script src="/leaflet.js"></script><div id="mapBox" style="height:650px;width:900px"></div><script src="/arap_jiphap_parcels.js"></script><script src="/arap_map.js"></script><script>'+adapter+'</script>');
const f=path.join(n.startsWith('/leaflet.')?vendor:root,n.slice(1));if(!fs.existsSync(f)){res.statusCode=404;return res.end();}res.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1000,height:750}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.addInitScript(()=>{if(localStorage.getItem('arap-jiphap-map-v1'))return;const x=126.91,y=37.53,addr='서울특별시 영등포구 당산동6가 280-1';
    localStorage.setItem('arap-jiphap-map-v1',JSON.stringify({[addr]:{_xy:{x:x+.0005,y:y+.0005,addr,q:addr,geom:{type:'Polygon',coordinates:[[[x,y],[x+.001,y],[x+.001,y+.001],[x,y+.001],[x,y]]]}}}}));});
  const show=async()=>{await page.evaluate(()=>ArapJiphapMap.show('',{jibun:'서울특별시 영등포구 당산동6가 280-1'}));await page.locator('#mapBox .lab').waitFor();};
  const stored=()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('arap-jiphap-map-v1')))[0]._xy);
  await page.goto(base);await show();
  const lab=page.locator('#mapBox .lab'),grip=lab.locator('.lgrip');
  const w0=(await lab.boundingBox()).width;
  assert.equal(await grip.count(),1,'손잡이 있음');
  await lab.hover();await page.waitForTimeout(200);
  assert.equal(await grip.evaluate(e=>getComputedStyle(e).opacity),'1','올리면 손잡이가 보임');
  // 키우기
  let g=await grip.boundingBox();await page.mouse.move(g.x+g.width/2,g.y+g.height/2);await page.mouse.down();
  await page.mouse.move(g.x+60,g.y+30,{steps:6});await page.mouse.up();
  const w1=(await lab.boundingBox()).width;assert.ok(w1>w0*1.3,`커져야 함 ${w0} → ${w1}`);
  if(process.env.SHOT){await lab.hover();await page.screenshot({path:process.env.SHOT,clip:{x:0,y:0,width:900,height:650}});}
  let xy=await stored();assert.ok(xy.labScale>1.3,'배율 저장 '+xy.labScale);assert.equal(xy.labOff,undefined,'크기 조절은 자리를 바꾸지 않음');
  // 다시 그려도 유지
  await page.reload();await show();
  const w2=(await lab.boundingBox()).width;assert.ok(Math.abs(w2-w1)<3,`새로 그려도 크기 유지 ${w1} vs ${w2}`);
  // 줄이기
  await lab.hover();g=await grip.boundingBox();await page.mouse.move(g.x+g.width/2,g.y+g.height/2);await page.mouse.down();
  await page.mouse.move(g.x-80,g.y-20,{steps:6});await page.mouse.up();
  const w3=(await lab.boundingBox()).width;assert.ok(w3<w2*0.8,`작아져야 함 ${w2} → ${w3}`);
  // 두 번 누르면 원래대로
  const b=await lab.boundingBox();await page.mouse.dblclick(b.x+8,b.y+b.height/2);await page.waitForTimeout(300);
  await page.locator('#mapBox .lab').waitFor();
  const w4=(await page.locator('#mapBox .lab').boundingBox()).width;assert.ok(Math.abs(w4-w0)<3,`두 번 누르면 원래 크기 ${w0} vs ${w4}`);
  xy=await stored();assert.equal(xy.labScale,undefined,'배율 지움');
  assert.deepEqual(errors,[]);console.log('PASS 이름표 크기 조절');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
