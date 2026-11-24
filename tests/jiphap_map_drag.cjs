// 집건 ③ 위치도 — 사례·전례 말풍선을 토건처럼 끌어 옮기고, 말풍선 → 점 화살표(2026-11-24)
//  - 엔진(arap_map.js) leaderLabel: 점 핀도 필지 이름표와 같은 dragLabel·leader·_xy.labOff 저장
//  - 단일(#root, sfx '') · 여러 호수(#root-multi, sfx 'M') 둘 다 같은 어댑터(ArapJiphapMap) → 같은 동작
//  - 카카오(기본 바탕지도)는 네트워크가 막혀 있어 kakao.maps를 흉내 낸 가짜로, Leaflet은 로컬 사본으로 확인
//  - 옮긴 자리는 'arap-jiphap-map-v1'에 저장돼 다시 그려도 유지, 두 번 누르면 제자리, ✕(말풍선 끔)·모두 켜기 그대로
//  - 점(마커)을 직접 옮겨도(Leaflet) 이름표 자리는 남는다. 토건 항목엔 leaderLabel을 안 붙인다(토건 동작 그대로)
// 실행: PLAYWRIGHT_MODULE=/path/to/playwright LEAFLET_TEST_DIR=/path/to/leaflet/dist node tests/jiphap_map_drag.cjs
//   (LEAFLET_TEST_DIR 없으면 ../map-test-vendor — tests/jiphap_map_cases.cjs와 같은 규칙)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),vendor=process.env.LEAFLET_TEST_DIR||process.env.LEAFLET_DIST||path.join(root,'..','map-test-vendor');
const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
const adapter=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes("var KEY='arap-jiphap-map-v1'"))[1];

// ── 정적 확인 ──
// 어댑터가 사례·전례 항목에 leaderLabel을 붙이고, 두 Babel 블록(단일·여러 호수)의 StepMap이 모두 그 어댑터를 부른다
assert.match(adapter,/kind:g\.kind[\s\S]*?leaderLabel:true/,'사례·전례 항목에 leaderLabel');
const babel=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const withMap=babel.filter(b=>b.includes('function StepMap('));
assert.equal(withMap.length,2,'StepMap이 단일·여러 호수 두 블록에 하나씩');
const stepMap=b=>b.slice(b.indexOf('function StepMap('),b.indexOf('\n}\n',b.indexOf('function StepMap(')));
assert.equal(stepMap(withMap[0]),stepMap(withMap[1]),'두 StepMap이 똑같다');
assert.ok(stepMap(withMap[0]).includes('ArapJiphapMap.show(sfx,ov,cases,precs)'));
// 토건은 필지 이름표를 그대로 쓴다(leaderLabel 안 붙임)
assert.ok(!fs.readFileSync(path.join(root,'토지건물.html'),'utf8').includes('leaderLabel'),'토건 항목은 손대지 않음');

// 카카오맵 가짜 — 엔진이 쓰는 것만(좌표 → 화면 픽셀은 단순 비례)
const KAKAO_STUB=`(function(){
  function LatLng(a,b){this.a=a;this.b=b;}LatLng.prototype.getLat=function(){return this.a;};LatLng.prototype.getLng=function(){return this.b;};
  function Point(x,y){this.x=x;this.y=y;}
  function Map(div,o){this.div=div;this.c=o.center;this.lv=o.level;this._ev={};}
  Map.prototype={
    getCenter:function(){return this.c;},setCenter:function(c){this.c=c;},getLevel:function(){return this.lv;},
    setLevel:function(l){if(l===this.lv)return;this.lv=l;if(this._ev.zoom_changed)this._ev.zoom_changed();},
    relayout:function(){},setDraggable:function(on){this.draggable=on;},setMapTypeId:function(){},addOverlayMapTypeId:function(){},removeOverlayMapTypeId:function(){},
    getProjection:function(){var m=this,sc=function(){return 400000/Math.pow(2,m.lv-1);},W=function(){return m.div.clientWidth||900;},H=function(){return m.div.clientHeight||650;};
      return {containerPointFromCoords:function(ll){return new Point((ll.b-m.c.b)*sc()+W()/2,-(ll.a-m.c.a)*sc()+H()/2);},
              coordsFromContainerPoint:function(p){return new LatLng(m.c.a-(p.y-H()/2)/sc(),m.c.b+(p.x-W()/2)/sc());}};}
  };
  function CustomOverlay(o){this.o=o;this.el=null;if(o.map)this.setMap(o.map);}
  CustomOverlay.prototype.setMap=function(m){
    if(this.el){this.el.remove();this.el=null;}
    if(!m)return;
    var p=m.getProjection().containerPointFromCoords(this.o.position),el=document.createElement('div');
    el.className='kov';el.style.cssText='position:absolute;left:'+p.x+'px;top:'+p.y+'px;z-index:'+(this.o.zIndex||1);
    el.appendChild(this.o.content);m.div.appendChild(el);this.el=el;
  };
  function InfoWindow(){}InfoWindow.prototype={setContent:function(c){window.__kinfo=c;},setPosition:function(){},open:function(){window.__kinfoOpen=(window.__kinfoOpen||0)+1;},close:function(){}};
  function Polygon(){}Polygon.prototype.setMap=function(){};
  window.kakao={maps:{LatLng:LatLng,Point:Point,Map:Map,CustomOverlay:CustomOverlay,InfoWindow:InfoWindow,Polygon:Polygon,
    MapTypeId:{ROADMAP:1,HYBRID:2,USE_DISTRICT:3},event:{addListener:function(t,ev,fn){(t._ev||(t._ev={}))[ev]=fn;}},load:function(cb){cb();}}};
})();`;

const boxes=sfx=>'<select id="mapBaseSel'+sfx+'"><option value="kakao">카카오</option><option value="Base">브이월드</option></select>'+
  '<div id="mapBox'+sfx+'" style="height:650px;width:900px;position:relative"></div><div id="mapStatus'+sfx+'"></div>';
const server=http.createServer((req,res)=>{const n=req.url.split('?')[0];res.setHeader('Content-Type',n.endsWith('.css')?'text/css':n.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
if(n==='/')return res.end('<meta charset="utf-8"><link rel="stylesheet" href="/leaflet.css"><script src="/leaflet.js"></script><script>'+KAKAO_STUB+'</script>'+
  boxes('')+boxes('M')+'<script src="/arap_jiphap_parcels.js"></script><script src="/arap_map.js"></script><script>'+adapter+'</script>');
const f=path.join(n.startsWith('/leaflet.')?vendor:root,n.slice(1));if(!fs.existsSync(f)){res.statusCode=404;return res.end();}res.end(fs.readFileSync(f));});

(async()=>{
  if(!fs.existsSync(path.join(vendor,'leaflet.js'))){console.error('Leaflet 로컬 사본 없음: '+vendor+' (LEAFLET_TEST_DIR로 leaflet@1.9.4 dist 폴더 지정)');process.exitCode=1;return;}
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1000,height:1600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const SUBJ='서울특별시 강동구 성내동 420-5',A='서울특별시 강동구 성내동 524-1',B='서울특별시 강동구 성내동 437',P='서울특별시 강동구 성내동 219-1';
  await page.addInitScript(({SUBJ,A,B,P})=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');
    const st={},pt=(x,y,addr)=>({_xy:{x,y,addr,q:addr}});
    const poly=(x,y,addr)=>({_xy:{x:x+.0003,y:y+.0003,addr,q:addr,geom:{type:'Polygon',coordinates:[[[x,y],[x+.0006,y],[x+.0006,y+.0006],[x,y+.0006],[x,y]]]}}});
    st[SUBJ]=poly(127.125,37.53,SUBJ);st['거래사례|'+A]=pt(127.1262,37.5308,A);st['거래사례|'+B]=pt(127.121,37.528,B);st['평가전례|'+P]=pt(127.127,37.526,P);
    localStorage.setItem('arap-jiphap-map-v1',JSON.stringify(st));},{SUBJ,A,B,P});
  await page.goto(base);
  const cases=[
    {id:1,location:'서울특별시 강동구 성내동',jibun:'524-1',aptName:'퍼브릭 하우스',floor:'5',ho:'502',tradeDate:'2026.06.29',unitPrice:4329085,isShown:true,isSelected:true},
    {id:4,location:'서울특별시 강동구 성내동',jibun:'437',aptName:'그린빌라',floor:'4',ho:'401',tradeDate:'2026.08.10',unitPrice:7000000,isShown:true,isSelected:false}];
  const precs=[{id:9,location:'서울특별시 강동구 성내동',jibun:'219-1',buildingName:'무궁화연립',floor:'4',ho:'401',baseDate:'2025.06.11',unitPrice:4936321,isShown:true}];
  const store=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arap-jiphap-map-v1')));
  const show=sfx=>page.evaluate(([sfx,SUBJ,cases,precs])=>ArapJiphapMap.show(sfx,{jibun:SUBJ},cases,precs),[sfx,SUBJ,cases,precs]);
  const labOf=(id,prefix)=>page.locator(id+' .mkr.dl .lab').filter({hasText:prefix});
  // 화살표 꼬리(말풍선 쪽 끝) = 말풍선 자리. line x1 - svg 가운데(210)
  const tailOf=lab=>lab.evaluate(l=>{const ln=l.parentNode.querySelector('svg.ldr line');return [+ln.getAttribute('x1')-210,+ln.getAttribute('y1')-210];});
  async function drag(lab,dx,dy){
    const b=await lab.boundingBox(),x=b.x+b.width/2,y=b.y+8;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx/2,y+dy/2,{steps:3});await page.mouse.move(x+dx,y+dy,{steps:3});await page.mouse.up();
  }

  for(const [mode,sel] of [['카카오','kakao'],['Leaflet','Base']]){
    for(const sfx of ['','M']){
      const id='#mapBox'+sfx,tag=mode+' sfx='+(sfx||"''");
      await page.selectOption('#mapBaseSel'+sfx,sel);
      if(mode==='Leaflet'&&await page.evaluate(sfx=>!!ArapJiphapMap.view(sfx),sfx))await page.evaluate(sfx=>ArapJiphapMap.view(sfx).setBase(),sfx);
      await show(sfx);
      const scope=mode==='카카오'?id+' .arap-kmap':id+' .leaflet-marker-pane';
      await page.waitForFunction(s=>document.querySelectorAll(s+' .mkr.dl').length===3,scope);
      const S=scope;
      // 사례·전례 3곳 모두 점 + 화살표 + 끌 수 있는 말풍선, 본건은 필지 이름표 그대로
      assert.equal(await page.locator(S+' .mkr.dl svg.ldr').count(),3,tag+' 화살표 3개');
      assert.equal(await page.locator(S+' .mkr.dl .dot').count(),3,tag+' 점 3개');
      assert.equal(await page.locator(S+' .mkr.par:not(.dl) .lab').allTextContents().then(a=>a.join()),'[본건]',tag);
      const g=labOf(S,'거래 ㉡').or(labOf(S,'거래 #2'));
      assert.equal(await g.count(),1,tag+' 그린빌라 말풍선');
      assert.equal(await g.evaluate(l=>getComputedStyle(l).cursor),'move',tag+' 끌기 커서');
      const before=await tailOf(g);
      // 말풍선 방향이 서로 다르다(기본 자리)
      const tails=await page.locator(S+' .mkr.dl .lab').evaluateAll(ls=>ls.map(l=>l.style.left+','+l.style.top));
      assert.equal(new Set(tails).size,3,tag+' 기본 자리 겹치지 않음 '+tails);
      // 끌기 → 말풍선과 화살표 꼬리가 같이 움직이고 저장
      await drag(g,120,-90);
      const after=await tailOf(g);
      assert.ok(Math.abs(after[0]-before[0]-120)<=2&&Math.abs(after[1]-before[1]+90)<=2,tag+' 끈 만큼 이동 '+before+' → '+after);
      let st=await store();
      assert.deepEqual(st['거래사례|'+B]._xy.labOff,after,tag+' labOff 저장');
      assert.equal(await g.evaluate(l=>l.style.left+','+l.style.top),after[0]+'px,'+after[1]+'px');
      // 화살촉은 점 가장자리(점 중심에서 11px) 그대로
      const tip=await g.evaluate(l=>l.parentNode.querySelector('svg.ldr polygon').getAttribute('points').split(' ')[0].split(',').map(Number));
      assert.ok(Math.abs(Math.hypot(tip[0]-210,tip[1]-210)-11)<0.6,tag+' 화살촉 = 점 가장자리 '+tip);
      // 다시 그려도(내용 바뀜·restyle) 옮긴 자리 유지
      await page.evaluate(sfx=>ArapJiphapMap.restyle(sfx),sfx);
      await page.waitForFunction(s=>document.querySelectorAll(s+' .mkr.dl').length===3,S);
      assert.deepEqual(await tailOf(labOf(S,'거래 ㉡').or(labOf(S,'거래 #2'))),after,tag+' 다시 그려도 유지');
      // ✕ 끄기 → 그 말풍선만 사라지고 점은 남음, 모두 켜기 → 옮긴 자리 그대로 돌아옴
      await labOf(S,'전례 a').locator('.lx').click();
      await page.waitForFunction(s=>document.querySelectorAll(s+' .mkr.dl').length===2,S);
      assert.equal(await page.locator(S+' .dot').count(),3,tag+' 끈 말풍선의 점은 남음');
      await page.evaluate(sfx=>ArapJiphapMap.bubbles(sfx,true),sfx);
      await page.waitForFunction(s=>document.querySelectorAll(s+' .mkr.dl').length===3,S);
      assert.deepEqual(await tailOf(labOf(S,'거래 ㉡').or(labOf(S,'거래 #2'))),after,tag+' 켜도 자리 유지');
      // 크기 손잡이도 그대로 붙음
      assert.equal(await labOf(S,'거래 ㉡').or(labOf(S,'거래 #2')).locator('.lgrip').count(),1,tag+' 크기 손잡이');
      // 두 번 누르기 → 제자리, 저장에서도 지움
      await labOf(S,'거래 ㉡').or(labOf(S,'거래 #2')).dblclick();
      await page.waitForFunction(([s,t])=>{const l=[...document.querySelectorAll(s+' .mkr.dl .lab')].find(x=>x.textContent.includes('그린빌라'));return l&&l.style.left+','+l.style.top!==t;},[S,after[0]+'px,'+after[1]+'px']);
      assert.deepEqual(await tailOf(labOf(S,'거래 ㉡').or(labOf(S,'거래 #2'))),before,tag+' 두 번 누르면 제자리');
      st=await store();
      assert.equal(st['거래사례|'+B]._xy.labOff,undefined,tag+' labOff 지움');
      // 말풍선 끔 표시(o.labOff = true/false)와 이름표 자리(o._xy.labOff = [x,y])는 다른 칸
      assert.equal(st['평가전례|'+P].labOff,false,tag);
    }
  }
  // Leaflet: 점(마커)을 끌어 위치를 고쳐도 사용자가 옮긴 이름표 자리는 남는다
  {
    const S='#mapBox .leaflet-marker-pane',g=labOf(S,'거래 ㉡');
    await drag(g,-80,60);const off=await tailOf(g);
    await page.evaluate(()=>{const v=ArapJiphapMap.view(''),m=v.markers().find(m=>(m.options.title||'').startsWith('거래 ㉡'));
      const p=m.getLatLng();m.setLatLng([p.lat+.0002,p.lng+.0002]);m.fire('dragend');});
    const st=await store();
    assert.equal(st['거래사례|'+B]._xy.manual,true,'점 옮김 저장');
    assert.deepEqual(st['거래사례|'+B]._xy.labOff,off,'점을 옮겨도 이름표 자리 유지');
  }
  await page.locator('#mapBox').screenshot({path:path.join(vendor,'..','jiphap_map_drag.png')}).catch(()=>{});
  assert.deepEqual(errors,[]);console.log('PASS jiphap_map_drag');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
