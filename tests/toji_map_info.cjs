// 위치도 설명창(라벨 클릭) — 계산된 단가·시점 표시 검증. 실제 Leaflet(로컬 사본) + 가짜 브이월드 응답.
// PLAYWRIGHT_MODULE=/path/to/playwright LEAFLET_DIST=/path/to/leaflet/dist node tests/toji_map_info.cjs
//   LEAFLET_DIST를 주면 그 사본을 쓰고, 없으면 unpkg에서 내려받는다(인터넷 필요).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'), LF=process.env.LEAFLET_DIST||'';
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
// 가짜 브이월드: 주소마다 조금씩 다른 좌표 + 네모 필지
let searched=0;
function fakeSearch(q){
  searched++;
  const x=127.0+searched*0.002,y=37.4+searched*0.002;
  return {response:{status:'OK',result:{items:[{id:'11110101001'+String(searched).padStart(8,'0'),title:q,point:{x:String(x),y:String(y)}}]}}};
}
function fakeData(pnu){
  const i=Number(String(pnu).slice(-2))||1,x=127.0+i*0.002,y=37.4+i*0.002,d=0.0004;
  return {response:{status:'OK',result:{featureCollection:{type:'FeatureCollection',features:[{type:'Feature',properties:{pnu:pnu},
    geometry:{type:'Polygon',coordinates:[[[x-d,y-d],[x+d,y-d],[x+d,y+d],[x-d,y+d],[x-d,y-d]]]}}]}}}};
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const ctx=await browser.newContext({viewport:{width:1400,height:1000}});const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await ctx.route('**/*',r=>{
    const u=r.request().url();
    if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.includes('leaflet.js'))return LF?r.fulfill({body:fs.readFileSync(LF+'/leaflet.js','utf8'),contentType:'text/javascript'}):r.continue();
    if(u.includes('leaflet.css'))return LF?r.fulfill({body:fs.readFileSync(LF+'/leaflet.css','utf8'),contentType:'text/css'}):r.continue();
    if(u.includes('api.vworld.kr/req/search')){
      const q=new URL(u).searchParams.get('query')||'';
      return r.fulfill({body:JSON.stringify(fakeSearch(q)),contentType:'application/json'});}
    if(u.includes('api.vworld.kr/req/data')){
      const at=new URL(u).searchParams.get('attrFilter')||'';
      return r.fulfill({body:JSON.stringify(fakeData((at.split(':').pop()||'1').trim())),contentType:'application/json'});}
    if(u.includes('vworld.kr')||u.includes('tile.openstreetmap'))return r.fulfill({status:200,body:'',contentType:'image/png'});
    if(u.startsWith(base))return r.continue();
    return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.mapItems&&window.renderTrade);

  await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    LANDS=[{소재지:'관양동',지번:'1443-5',지목:'대',면적:'271.3',용도지역:'2종일주',공시지가:'3,200,000',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
    STDS=[{소재지:'관양동',지번:'1445-1',지목:'대',면적:'150',공시지가:'3,500,000',용도지역:'2종일주',etcDecide:'1'}];
    TRADES=[{loc:'평촌동 33-4',landA:'92.3',bldA:'139.76',total:'900000000',date:'2025.03.30',appr:'1989.08.17',reCost:'800,000',life:'40'}];
    APPRS=[{no:'a',loc:'비산동 55-1',unit:'4,100,000',base:'2025.06.01'}];
    ETC={type:'t',idx:0};GA={idx:0};
    for(const [k,v] of Object.entries({base_gijun:'2026.01.01',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,1);
    renderStds();renderLands();renderTrade();renderAppr();syncPick();calcGongsi();
  });

  const items=await page.evaluate(()=>mapItems().map(i=>({label:i.label,kind:i.kind,info:i.info})));
  console.log('mapItems', items);
  assert.equal(items[0].info,'적용단가 3,500,000원/㎡ · 기준시점 2026.01.01');
  assert.equal(items[1].info,'공시지가 3,500,000원/㎡ · 공시기준일 2026.01.01');
  assert.equal(items[2].info,'토지단가 9,599,393원/㎡ · 거래시점 2025.03.30');   // (9억 − 건물금액) ÷ 92.3, 원 미만 절사
  assert.equal(items[3].info,'사례단가 4,100,000원/㎡ · 기준시점 2025.06.01');

  // 지도 탭을 열고 실제로 이름표를 눌러 설명창을 확인
  await page.evaluate(()=>showTab('jido'));
  await page.waitForFunction(()=>document.querySelectorAll('#mapBox .mkr .lab').length>=4,{timeout:20000});
  const labels=page.locator('#mapBox .mkr .lab');
  const n=await labels.count();
  const popups=[];
  for(let i=0;i<n;i++){
    await page.evaluate(()=>{try{mapView().leaflet().closePopup();}catch(e){}});
    await page.waitForTimeout(250);
    const name=(await labels.nth(i).innerText()).trim();
    await labels.nth(i).click({force:true});   // 실제 누름-뗌 (이름표는 mouseup 때 설명창을 연다)
    await page.waitForFunction(t=>{const p=document.querySelector('.leaflet-popup-content');return !!p&&p.innerText.trim().indexOf(t)===0;},name,{timeout:5000});
    popups.push((await page.locator('.leaflet-popup-content').first().innerText()).replace(/\n/g,' | '));
  }
  console.log('설명창\n - '+popups.join('\n - '));
  assert.ok(popups.some(t=>t.includes('토지단가 9,599,393원/㎡')&&t.includes('거래시점 2025.03.30')),'거래사례 설명창');
  assert.ok(popups.some(t=>t.includes('적용단가 3,500,000원/㎡')&&t.includes('기준시점 2026.01.01')),'본건 설명창');
  assert.ok(popups.some(t=>t.includes('공시지가 3,500,000원/㎡')),'표준지 설명창');
  assert.ok(popups.some(t=>t.includes('사례단가 4,100,000원/㎡')),'평가사례 설명창');

  // ⑤ 필지 채우기는 선정된 것(본건·채택 사례)에만, 나머지는 테두리만 — 그래도 안쪽 클릭은 먹는다
  const fills=await page.evaluate(()=>[...document.querySelectorAll('#mapBox path.leaflet-interactive')].map(p=>({
    stroke:p.getAttribute('stroke'),fill:p.getAttribute('fill'),fo:Number(p.getAttribute('fill-opacity')),w:p.getAttribute('stroke-width')})));
  console.log('필지 스타일',fills);
  const picked=await page.evaluate(()=>mapItems().filter(i=>i.pick).length);
  assert.equal(fills.filter(p=>p.fo>0).length,picked,'채워진 필지 수 = 선정된 항목 수');
  assert.ok(fills.some(p=>p.fo===0),'선정 안 된 필지는 테두리만');
  assert.ok(fills.every(p=>p.fill&&p.fill!=='none'),'fill 자체는 남겨 둬야 안쪽 클릭이 먹는다');

  const spot=await page.evaluate(()=>{
    const ps=[...document.querySelectorAll('#mapBox path.leaflet-interactive')];
    const p=ps.find(p=>Number(p.getAttribute('fill-opacity'))===0),r=p.getBoundingClientRect();
    try{mapView().leaflet().closePopup();}catch(e){}
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  });
  await page.waitForTimeout(250);
  await page.mouse.click(spot.x,spot.y);
  await page.waitForSelector('.leaflet-popup-content',{timeout:5000});
  const inside=(await page.locator('.leaflet-popup-content').first().innerText()).replace(/\n/g,' | ');
  console.log('테두리만 칠한 필지 안쪽 클릭 →',inside);
  assert.ok(inside.length>0,'테두리만 칠한 필지도 안쪽을 누르면 설명창이 뜬다');

  // ⑥ 비교표준지도 **본건이 고른 것만** 채운다 — 표준지를 둘로 늘리고 본건이 B를 고르면 B만 칠해진다
  await page.evaluate(()=>{
    STDS=[{소재지:'관양동',지번:'1445-1',지목:'대',면적:'150',공시지가:'3,500,000',용도지역:'2종일주',etcDecide:'1'},
          {소재지:'관양동',지번:'1450-2',지목:'대',면적:'160',공시지가:'3,300,000',용도지역:'2종일주'}];
    LANDS[0].stdIdx=1;
    renderStds();renderLands();calcGongsi();
  });
  const stdPick=await page.evaluate(()=>mapItems().filter(i=>i.kind==='비교표준지').map(i=>({label:i.label,pick:!!i.pick})));
  console.log('표준지 선정',stdPick);
  assert.deepEqual(stdPick,[{label:'표준지 A',pick:false},{label:'표준지 B',pick:true}]);
  await page.evaluate(()=>mapRefresh(false));
  await page.waitForTimeout(400);
  const blue=await page.evaluate(()=>[...document.querySelectorAll('#mapBox path.leaflet-interactive')]
    .filter(p=>p.getAttribute('stroke')==='#2563eb').map(p=>Number(p.getAttribute('fill-opacity'))).sort());
  console.log('표준지 필지 fill-opacity',blue);
  assert.deepEqual(blue,[0,0.16],'고른 표준지 한 곳만 채워진다');

  if(errs.length){console.log('페이지 오류',errs);throw new Error('page errors');}
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
