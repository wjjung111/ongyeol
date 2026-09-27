// 위치도 카카오맵 바탕 — 실제 Chromium + 실제 Leaflet, 카카오 SDK와 브이월드는 가짜로 물린다.
// 확인: 카카오 기본 선택 · 필지 테두리 2개 + 묶음 이름표 1개 · 화살촉이 바깥 경계 · 지적선 → 지적편집도 ·
//       이름표 끌기 저장 · 브이월드로 전환 · 사용자가 고른 브이월드는 OSM으로 멋대로 안 바뀜 · SDK 실패 시 브이월드로 복귀
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),vendor=process.env.LEAFLET_TEST_DIR||path.join(root,'..','map-test-vendor');
const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
const adapter=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes("var KEY='arap-jiphap-map-v1'"))[1];
const sel=html.match(/<select id=\{"mapBaseSel"\+sfx\}[^>]*>([\s\S]*?)<\/select>/)[1];
// 가짜 카카오 SDK — 웹 메르카토르(줌 = 20 - 레벨)로 화면 점을 계산하고, 오버레이는 지도 div에 절대 위치로 붙인다
const FAKE_KAKAO=`(function(){
  function LatLng(a,b){this.a=a;this.b=b;}LatLng.prototype.getLat=function(){return this.a;};LatLng.prototype.getLng=function(){return this.b;};
  function wp(ll,level){var s=256*Math.pow(2,20-level),x=(ll.b+180)/360*s,r=ll.a*Math.PI/180,y=(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*s;return {x:x,y:y};}
  var ev={addListener:function(t,type,fn){(t._l=t._l||{})[type]=(t._l[type]||[]).concat(fn);},trigger:function(t,type,a){((t._l||{})[type]||[]).forEach(function(f){f(a);});}};
  function Map(div,o){this.div=div;this.c=o.center;this.l=o.level;this.ov=[];this.type=1;this.drag=true;window.__kmap=this;}
  Map.prototype={getProjection:function(){var m=this;return {containerPointFromCoords:function(ll){var p=wp(ll,m.l),c=wp(m.c,m.l);return {x:p.x-c.x+m.div.clientWidth/2,y:p.y-c.y+m.div.clientHeight/2};}};},
    setCenter:function(c){this.c=c;},getCenter:function(){return this.c;},setLevel:function(l){if(l!==this.l){this.l=l;ev.trigger(this,'zoom_changed');}},getLevel:function(){return this.l;},
    setMapTypeId:function(t){this.type=t;},addOverlayMapTypeId:function(t){this.ov.push(t);},removeOverlayMapTypeId:function(t){this.ov=this.ov.filter(function(x){return x!==t;});},
    addControl:function(){},relayout:function(){},setDraggable:function(d){this.drag=d;}};
  function Polygon(o){this.o=o;this.setMap(o.map);}Polygon.prototype.setMap=function(m){this.m=m;if(m){m.polys=(m.polys||[]).filter(function(p){return p.m;});m.polys.push(this);}};
  function CustomOverlay(o){this.o=o;this.setMap(o.map);}
  CustomOverlay.prototype.setMap=function(m){var c=this.o.content;if(!m){if(c.parentNode)c.parentNode.removeChild(c);return;}
    var p=m.getProjection().containerPointFromCoords(this.o.position);c.style.cssText='position:absolute;left:'+p.x+'px;top:'+p.y+'px;z-index:'+this.o.zIndex;c.className='kov';m.div.appendChild(c);};
  function InfoWindow(){this.d=document.createElement('div');this.d.className='kinfo';}
  InfoWindow.prototype={setContent:function(h){this.d.innerHTML=h;},setPosition:function(p){this.p=p;},open:function(m){m.div.appendChild(this.d);},close:function(){if(this.d.parentNode)this.d.parentNode.removeChild(this.d);}};
  window.kakao={maps:{load:function(cb){setTimeout(cb,0);},LatLng:LatLng,Map:Map,Polygon:Polygon,CustomOverlay:CustomOverlay,InfoWindow:InfoWindow,
    ZoomControl:function(){},ControlPosition:{RIGHT:1},MapTypeId:{ROADMAP:1,HYBRID:3,USE_DISTRICT:9},event:ev}};
})();`;
const page0=`<link rel="stylesheet" href="/leaflet.css"><script src="/leaflet.js"></script>
<input type="checkbox" id="mapCadastre" checked><input type="checkbox" id="mapZoning"><select id="mapBaseSel">${sel}</select>
<div id="mapBox" style="height:650px;width:900px"></div><div id="mapStatus"></div>
<script src="/arap_jiphap_parcels.js"></script><script src="/arap_map.js"></script><script>${adapter}</script>`;
const server=http.createServer((req,res)=>{const n=req.url.split('?')[0];res.setHeader('Content-Type',n.endsWith('.css')?'text/css':n.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
  if(n==='/')return res.end(page0);
  const f=path.join(n.startsWith('/leaflet.')?vendor:root,n.slice(1));if(!fs.existsSync(f)){res.statusCode=404;return res.end();}res.end(fs.readFileSync(f));});
const seed=()=>{const store={};for(let i=0;i<2;i++){const x=126.91+i*.001,y=37.53,addr='서울특별시 영등포구 당산동6가 '+(i?'280-9':'280-1');store[addr]={_xy:{x:x+.0005,y:y+.0005,addr,q:addr,geom:{type:'Polygon',coordinates:[[[x,y],[x+.001,y],[x+.001,y+.001],[x,y+.001],[x,y]]]}}};}localStorage.setItem('arap-jiphap-map-v1',JSON.stringify(store));};
const OV={jibun:'서울특별시 영등포구 당산동6가 280-1, 280-9'};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});try{
  // ── 1. 카카오맵(기본) ──
  let page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[],sdkUrl='';page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const u=r.request().url();if(u.startsWith(base))return r.continue();
    if(u.startsWith('https://dapi.kakao.com/')){sdkUrl=u;return r.fulfill({contentType:'text/javascript',body:FAKE_KAKAO});}return r.abort();});
  await page.addInitScript(seed);await page.goto(base);
  assert.equal(await page.inputValue('#mapBaseSel'),'kakao','카카오맵이 기본 선택');
  await page.evaluate(ov=>ArapJiphapMap.show('',ov),OV);
  await page.locator('#mapBox .arap-kmap .lab').waitFor();
  assert.match(sdkUrl,/appkey=e87432a91ba0c8c347a82ea98805c1b5/);assert.match(sdkUrl,/autoload=false/);
  assert.equal(await page.locator('#mapBox .arap-kmap .lab').count(),1);assert.equal(await page.locator('#mapBox .arap-kmap .lab').textContent(),'[본건]');
  const k=()=>page.evaluate(()=>({polys:__kmap.polys.filter(p=>p.m).length,ov:__kmap.ov.slice(),type:__kmap.type,vis:getComputedStyle(document.querySelector('.arap-kmap')).display}));
  assert.deepEqual(await k(),{polys:2,ov:[9],type:1,vis:'block'});
  // 화살촉이 두 필지 묶음의 바깥 경계 위(가짜 투영으로 직접 계산)
  const tipCheck=()=>page.evaluate(()=>{const m=__kmap,pr=m.getProjection(),ov=document.querySelector('.arap-kmap .kov'),
    t=ov.querySelector('svg polygon').getAttribute('points').split(' ')[0].split(',').map(Number),
    p={x:parseFloat(ov.style.left)+t[0]-210,y:parseFloat(ov.style.top)+t[1]-210},
    nw=pr.containerPointFromCoords(new kakao.maps.LatLng(37.531,126.91)),se=pr.containerPointFromCoords(new kakao.maps.LatLng(37.53,126.912));
    return Math.min(Math.abs(p.x-nw.x),Math.abs(p.x-se.x),Math.abs(p.y-nw.y),Math.abs(p.y-se.y))<1;});
  assert.ok(await tipCheck(),'화살촉 = 바깥 경계');
  await page.evaluate(()=>__kmap.setLevel(__kmap.getLevel()+1));assert.ok(await tipCheck(),'축소 후에도 경계');
  // 지적선 끄기 → 지적편집도 빠짐
  await page.evaluate(()=>{document.getElementById('mapCadastre').checked=false;ArapJiphapMap.view('').toggleOverlay();});
  assert.deepEqual((await k()).ov,[]);
  await page.evaluate(()=>{document.getElementById('mapCadastre').checked=true;ArapJiphapMap.view('').toggleOverlay();});
  // 이름표 끌기 → 저장, 끄는 동안 지도 끌기 잠금 해제 확인
  const lab=page.locator('#mapBox .arap-kmap .lab'),b=await lab.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+70,b.y+b.height/2+40,{steps:6});await page.mouse.up();
  assert.ok(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('arap-jiphap-map-v1'))).some(o=>o._xy.labOff)),'이름표 위치 저장');
  assert.ok(await tipCheck(),'끈 뒤에도 경계');assert.equal(await page.evaluate(()=>__kmap.drag),true);
  // 이름표 클릭 → 설명창
  await lab.click();await page.locator('.kinfo').waitFor();assert.match(await page.locator('.kinfo').textContent(),/\[본건\]/);
  // 스카이뷰
  await page.selectOption('#mapBaseSel','kakaoSky');await page.evaluate(()=>ArapJiphapMap.view('').setBase());
  await page.waitForFunction(()=>__kmap.type===3);
  // 브이월드로 → 카카오 덮개 숨김 + Leaflet 이름표
  await page.selectOption('#mapBaseSel','Base');await page.evaluate(()=>ArapJiphapMap.view('').setBase());
  assert.equal((await k()).vis,'none');assert.equal(await page.locator('#mapBox .leaflet-marker-icon .lab').count(),1);
  // 사용자가 고른 브이월드는 타일이 막혀도(여기선 전부 차단) OSM으로 안 바뀐다
  await page.waitForFunction(()=>/카카오맵/.test(document.getElementById('mapStatus').textContent),null,{timeout:15000});
  assert.equal(await page.inputValue('#mapBaseSel'),'Base','직접 고른 지도 유지');
  assert.deepEqual(errors,[]);console.log('PASS kakao default · 2 parcels 1 label · edge tip · 지적편집도 · drag saved · info · skyview · switch to vworld keeps user choice');
  await page.close();

  // ── 2. 카카오 SDK 실패 → 브이월드로 복귀(자동이므로 막히면 OSM까지) ──
  page=await browser.newPage({viewport:{width:1000,height:800}});errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.addInitScript(seed);await page.goto(base);
  await page.evaluate(ov=>ArapJiphapMap.show('',ov),OV);
  await page.waitForFunction(()=>document.getElementById('mapBaseSel').value==='osm',null,{timeout:20000});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.arap-kmap')).display),'none');
  assert.equal(await page.locator('#mapBox .leaflet-marker-icon .lab').count(),1);
  assert.deepEqual(errors,[]);console.log('PASS kakao SDK failure falls back to vworld → OSM automatically');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
