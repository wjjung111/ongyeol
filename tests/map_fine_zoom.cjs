// 환경 주의: Leaflet을 CDN이 아닌 로컬 폴더(../map-test-vendor 또는 LEAFLET_TEST_DIR)에서 읽음 — 그 폴더가 없으면 'L is not defined'(앱 문제 아님). leaflet@1.9.4의 dist/leaflet.js·leaflet.css를 넣고 실행
// 위치도 세밀 확대(2026-11-23) — 실제 Chromium + 실제 Leaflet, 카카오 SDK는 가짜(웹 메르카토르 투영).
// 확인: 카카오 +/− 한 번 = 0.25단계(레벨 + CSS 배율) · 이름표 화면 크기 그대로 · 화살촉 = 필지 경계(화면 기준) ·
//       휠 한 칸 = 0.25단계 + 커서 아래 지점 고정 · 배율 상태에서 지도 끌기 = 커서만큼 · 이름표 끌기 저장 ·
//       브이월드(Leaflet)도 +/−·휠 0.25단계 · 카카오↔브이월드 오갈 때 세밀 줌값 유지
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),vendor=process.env.LEAFLET_TEST_DIR||path.join(root,'..','map-test-vendor');
const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
const adapter=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes("var KEY='arap-jiphap-map-v1'"))[1];
const sel=html.match(/<select id=\{"mapBaseSel"\+sfx\}[^>]*>([\s\S]*?)<\/select>/)[1];
const FAKE_KAKAO=`(function(){
  function LatLng(a,b){this.a=a;this.b=b;}LatLng.prototype.getLat=function(){return this.a;};LatLng.prototype.getLng=function(){return this.b;};
  function Point(x,y){this.x=x;this.y=y;}
  function wp(ll,level){var s=256*Math.pow(2,20-level),x=(ll.b+180)/360*s,r=ll.a*Math.PI/180,y=(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*s;return {x:x,y:y};}
  function inv(p,level){var s=256*Math.pow(2,20-level),ln=p.x/s*360-180,n=Math.PI*(1-2*p.y/s);return new LatLng(180/Math.PI*Math.atan(Math.sinh(n)),ln);}
  var ev={addListener:function(t,type,fn){(t._l=t._l||{})[type]=(t._l[type]||[]).concat(fn);},trigger:function(t,type,a){((t._l||{})[type]||[]).forEach(function(f){f(a);});}};
  function Map(div,o){this.div=div;this.c=o.center;this.l=o.level;this.ov=[];this.drag=true;this.objs=[];window.__kmap=this;}
  Map.prototype={getProjection:function(){var m=this;return {
      containerPointFromCoords:function(ll){var p=wp(ll,m.l),c=wp(m.c,m.l);return new Point(p.x-c.x+m.div.clientWidth/2,p.y-c.y+m.div.clientHeight/2);},
      coordsFromContainerPoint:function(pt){var c=wp(m.c,m.l);return inv({x:pt.x-m.div.clientWidth/2+c.x,y:pt.y-m.div.clientHeight/2+c.y},m.l);}};},
    setCenter:function(c){this.c=c;this.redraw();},getCenter:function(){return this.c;},
    setLevel:function(l){if(l!==this.l){this.l=l;this.redraw();ev.trigger(this,'zoom_changed');}},getLevel:function(){return this.l;},
    setMapTypeId:function(){},addOverlayMapTypeId:function(t){this.ov.push(t);},removeOverlayMapTypeId:function(){},
    addControl:function(){},relayout:function(){this.redraw();},setDraggable:function(d){this.drag=d;},
    redraw:function(){this.objs.forEach(function(o){o.place&&o.place();});}};
  function Polygon(o){this.o=o;this.setMap(o.map);}Polygon.prototype.setMap=function(m){this.m=m;};
  function CustomOverlay(o){this.o=o;this.setMap(o.map);}
  CustomOverlay.prototype.place=function(){if(!this.m)return;var c=this.o.content,p=this.m.getProjection().containerPointFromCoords(this.o.position);c.style.cssText='position:absolute;left:'+p.x+'px;top:'+p.y+'px;z-index:'+this.o.zIndex;};
  CustomOverlay.prototype.setMap=function(m){var c=this.o.content;if(!m){if(this.m)this.m.objs=this.m.objs.filter(x=>x!==this);this.m=null;if(c.parentNode)c.parentNode.removeChild(c);return;}
    this.m=m;m.objs.push(this);c.className='kov';m.div.appendChild(c);this.place();};
  function InfoWindow(){this.d=document.createElement('div');this.d.className='kinfo';}
  InfoWindow.prototype={setContent:function(h){this.d.innerHTML=h;},setPosition:function(p){this.p=p;},open:function(m){m.div.appendChild(this.d);},close:function(){if(this.d.parentNode)this.d.parentNode.removeChild(this.d);}};
  window.kakao={maps:{load:function(cb){setTimeout(cb,0);},LatLng:LatLng,Point:Point,Map:Map,Polygon:Polygon,CustomOverlay:CustomOverlay,InfoWindow:InfoWindow,
    ZoomControl:function(){},ControlPosition:{RIGHT:1},MapTypeId:{ROADMAP:1,HYBRID:3,USE_DISTRICT:9},event:ev}};
})();`;
const page0=`<link rel="stylesheet" href="/leaflet.css"><script src="/leaflet.js"></script>
<input type="checkbox" id="mapCadastre"><input type="checkbox" id="mapZoning"><select id="mapBaseSel">${sel}</select>
<div id="mapBox" style="height:600px;width:900px;margin:20px"></div><div id="mapStatus"></div>
<script src="/arap_jiphap_parcels.js"></script><script src="/arap_map.js"></script><script>${adapter}</script>`;
const server=http.createServer((req,res)=>{const n=req.url.split('?')[0];res.setHeader('Content-Type',n.endsWith('.css')?'text/css':n.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
  if(n==='/')return res.end(page0);
  const f=path.join(n.startsWith('/leaflet.')?vendor:root,n.slice(1));if(!fs.existsSync(f)){res.statusCode=404;return res.end();}res.end(fs.readFileSync(f));});
const seed=()=>{const store={};for(let i=0;i<2;i++){const x=126.91+i*.001,y=37.53,addr='서울특별시 영등포구 당산동6가 '+(i?'280-9':'280-1');store[addr]={_xy:{x:x+.0005,y:y+.0005,addr,q:addr,geom:{type:'Polygon',coordinates:[[[x,y],[x+.001,y],[x+.001,y+.001],[x,y+.001],[x,y]]]}}};}localStorage.setItem('arap-jiphap-map-v1',JSON.stringify(store));};
const OV={jibun:'서울특별시 영등포구 당산동6가 280-1, 280-9'};
const near=(a,b,eps,msg)=>assert.ok(Math.abs(a-b)<=eps,msg+` (${a} vs ${b})`);
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});try{
  const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const u=r.request().url();if(u.startsWith(base))return r.continue();
    if(u.startsWith('https://dapi.kakao.com/'))return r.fulfill({contentType:'text/javascript',body:FAKE_KAKAO});return r.abort();});
  await page.addInitScript(seed);await page.goto(base);
  await page.evaluate(ov=>ArapJiphapMap.show('',ov),OV);
  await page.locator('#mapBox .arap-kmap .lab').waitFor();
  const V='ArapJiphapMap.view("")';
  const st=()=>page.evaluate(V=>{const v=eval(V),k=document.querySelector('.arap-kmap');return {z:v.zoom(),level:__kmap.getLevel(),
    s:+(k.style.getPropertyValue('--kzs')||1),w:k.style.width,drag:__kmap.drag};},V);
  // 화면 좌표 ↔ 가짜 카카오 내부 좌표(덮개는 지도 칸 왼쪽 위에서 scale(배율))
  const screenOf=(lat,lng)=>page.evaluate(([lat,lng])=>{const k=document.querySelector('.arap-kmap'),r=document.getElementById('mapBox').getBoundingClientRect(),
    s=1/+(k.style.getPropertyValue('--kzs')||1),p=__kmap.getProjection().containerPointFromCoords(new kakao.maps.LatLng(lat,lng));return {x:r.left+p.x*s,y:r.top+p.y*s};},[lat,lng]);
  const tipOk=()=>page.evaluate(()=>{const k=document.querySelector('.arap-kmap'),r=document.getElementById('mapBox').getBoundingClientRect(),s=1/+(k.style.getPropertyValue('--kzs')||1),
    pr=__kmap.getProjection(),poly=k.querySelector('.kov svg polygon'),pt=poly.getBoundingClientRect(),
    sc=ll=>{const p=pr.containerPointFromCoords(ll);return {x:r.left+p.x*s,y:r.top+p.y*s};},
    nw=sc(new kakao.maps.LatLng(37.531,126.91)),se=sc(new kakao.maps.LatLng(37.53,126.912)),
    // 화살촉 꼭짓점 중 하나가 바깥 경계 위(화면 픽셀 1.5 이내)
    pts=poly.getAttribute('points').trim().split(/\s+/).map(q=>q.split(',').map(Number)),
    svg=poly.ownerSVGElement,m=svg.getScreenCTM();
    return pts.some(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(m);return Math.min(Math.abs(p.x-nw.x),Math.abs(p.x-se.x),Math.abs(p.y-nw.y),Math.abs(p.y-se.y))<1.5;});});

  // ── 1. +/− 단추: 0.25단계 ──
  assert.equal(await page.locator('#mapBox .arap-kzoom button').count(),2,'세밀 확대 단추 2개');
  await page.evaluate(V=>eval(V).zoomTo(17),V);
  let a=await st();assert.deepEqual([a.z,a.level,a.s],[17,3,1]);assert.equal(a.drag,true,'배율 1이면 카카오 끌기 그대로');
  const w0=(await page.locator('#mapBox .arap-kmap .lab').boundingBox()).width;
  assert.ok(await tipOk(),'배율 1 화살촉 = 경계');
  const plus=page.locator('#mapBox .arap-kzoom button[data-kz="1"]'),minus=page.locator('#mapBox .arap-kzoom button[data-kz="-1"]');
  const expect=[[17.25,3,Math.pow(2,.25)],[17.5,3,Math.pow(2,.5)],[17.75,2,Math.pow(2,-.25)],[18,2,1]];
  for(const [z,l,sc] of expect){
    await plus.click();a=await st();
    assert.equal(a.z,z,'+ 한 번 = 0.25');assert.equal(a.level,l,'레벨 '+z);near(1/a.s,sc,1e-6,'배율 '+z);
    near((await page.locator('#mapBox .arap-kmap .lab').boundingBox()).width,w0,1,'이름표 화면 크기 그대로 '+z);
    assert.ok(await tipOk(),'화살촉 = 경계 '+z);
  }
  await minus.click();await minus.click();a=await st();assert.equal(a.z,17.5);assert.equal(a.drag,false,'배율 상태에선 카카오 끌기 끄고 직접 옮김');
  console.log('PASS kakao +/- = 0.25 step (level + CSS scale) · label size constant · tip on boundary');

  // ── 2. 휠 한 칸 = 0.25단계, 커서 아래 지점 고정 ──
  const box=await page.locator('#mapBox').boundingBox(),cx=box.x+250,cy=box.y+180;
  const under=()=>page.evaluate(([cx,cy])=>{const k=document.querySelector('.arap-kmap'),r=document.getElementById('mapBox').getBoundingClientRect(),s=1/+(k.style.getPropertyValue('--kzs')||1),
    ll=__kmap.getProjection().coordsFromContainerPoint(new kakao.maps.Point((cx-r.left)/s,(cy-r.top)/s));return [ll.getLat(),ll.getLng()];},[cx,cy]);
  const ll0=await under();
  await page.mouse.move(cx,cy);await page.mouse.wheel(0,-100);await page.waitForTimeout(50);
  a=await st();assert.equal(a.z,17.75,'휠 위로 한 칸 = 확대 0.25');
  let p=await screenOf(ll0[0],ll0[1]);near(p.x,cx,1,'커서 아래 지점 고정 x');near(p.y,cy,1,'커서 아래 지점 고정 y');
  await page.mouse.wheel(0,100);await page.waitForTimeout(50);await page.mouse.wheel(0,100);await page.waitForTimeout(50);
  a=await st();assert.equal(a.z,17.25,'휠 아래로 두 칸 = 축소 0.5');
  p=await screenOf(ll0[0],ll0[1]);near(p.x,cx,1,'축소 후에도 고정 x');near(p.y,cy,1,'축소 후에도 고정 y');
  console.log('PASS wheel notch = 0.25 step, point under cursor stays put');

  // ── 3. 배율 상태 지도 끌기 = 커서만큼 ──
  const g0=await screenOf(37.5305,126.911);
  await page.mouse.move(box.x+600,box.y+450);await page.mouse.down();await page.mouse.move(box.x+520,box.y+400,{steps:5});await page.mouse.up();
  const g1=await screenOf(37.5305,126.911);near(g1.x-g0.x,-80,1.5,'끈 만큼 x');near(g1.y-g0.y,-50,1.5,'끈 만큼 y');
  console.log('PASS pan at fractional zoom follows the cursor 1:1');

  // ── 4. 배율 상태에서 이름표 끌기 → 저장, 끈 뒤 잠금 풀림 ──
  const lab=page.locator('#mapBox .arap-kmap .lab'),b=await lab.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+60,b.y+b.height/2+30,{steps:6});await page.mouse.up();
  const b2=await lab.boundingBox();near(b2.x-b.x,60,1.5,'이름표가 커서만큼 이동 x');near(b2.y-b.y,30,1.5,'이름표가 커서만큼 이동 y');
  assert.ok(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('arap-jiphap-map-v1'))).some(o=>o._xy.labOff)),'이름표 위치 저장');
  assert.ok(await tipOk(),'끈 뒤에도 경계');
  const g2=await screenOf(37.5305,126.911);
  await page.mouse.move(box.x+600,box.y+450);await page.mouse.down();await page.mouse.move(box.x+640,box.y+450,{steps:4});await page.mouse.up();
  near((await screenOf(37.5305,126.911)).x-g2.x,40,1.5,'이름표 끈 뒤에도 지도 끌기 됨');
  console.log('PASS label drag at fractional zoom moves 1:1 and saves; map drag unlocked afterwards');

  // ── 5. 브이월드(Leaflet) — 세밀 줌값 넘겨받기 + +/−·휠 0.25 ──
  await page.selectOption('#mapBaseSel','Base');await page.evaluate(V=>eval(V).setBase(),V);
  assert.equal(await page.evaluate(V=>eval(V).zoom(),V),17.25,'카카오 줌값을 Leaflet이 그대로');
  assert.equal(await page.locator('#mapBox .arap-kzoom').evaluate(e=>getComputedStyle(e).display),'none','카카오 단추는 숨김');
  await page.locator('#mapBox .leaflet-control-zoom-in').click();await page.waitForTimeout(400);
  assert.equal(await page.evaluate(V=>eval(V).zoom(),V),17.5,'Leaflet + 한 번 = 0.25');
  await page.mouse.move(cx,cy);await page.mouse.wheel(0,100);await page.waitForTimeout(600);
  assert.equal(await page.evaluate(V=>eval(V).zoom(),V),17.25,'Leaflet 휠 한 칸 = 0.25');
  await page.selectOption('#mapBaseSel','kakao');await page.evaluate(V=>eval(V).setBase(),V);
  await page.waitForFunction(V=>eval(V).zoom()===17.25,V);
  a=await st();assert.equal(a.level,3);near(1/a.s,Math.pow(2,.25),1e-6,'다시 카카오로 = 같은 세밀 줌');
  assert.deepEqual(errors,[]);
  console.log('PASS Leaflet +/- and wheel = 0.25 step · fine zoom carried between kakao and vworld');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
