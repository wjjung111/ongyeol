// 위치도 범례 토글 — 본건·비교표준지·거래사례·평가사례를 종류별로 켜고 끄기 + 모두 체크/해제 검증.
// 실제 Leaflet(로컬 사본 또는 unpkg) + 가짜 브이월드 응답.
// PLAYWRIGHT_MODULE=/path/to/playwright LEAFLET_DIST=/path/to/leaflet/dist node tests/toji_map_toggle.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'), LF=process.env.LEAFLET_DIST||'';
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
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
const labelsOf=page=>page.evaluate(()=>[...document.querySelectorAll('#mapBox .mkr .lab')].map(e=>e.innerText.trim()).sort());

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
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
    TRADES=[{loc:'평촌동 33-4',landA:'92.3',bldA:'139.76',total:'900000000',date:'2025.03.30',appr:'1989.08.17',reCost:'800,000',life:'40'},
            {loc:'평촌동 40-1',landA:'80',bldA:'100',total:'700000000',date:'2025.04.10',appr:'1990.01.01',reCost:'800,000',life:'40'}];
    APPRS=[{no:'a',loc:'비산동 55-1',unit:'4,100,000',base:'2025.06.01'}];
    ETC={type:'t',idx:0};GA={idx:0};
    for(const [k,v] of Object.entries({base_gijun:'2026.01.01',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,1);
    renderStds();renderLands();renderTrade();renderAppr();syncPick();calcGongsi();
  });

  await page.evaluate(()=>showTab('jido'));
  await page.waitForFunction(()=>document.querySelectorAll('#mapBox .mkr .lab').length>=5,{timeout:20000});
  const all=await labelsOf(page);
  console.log('처음(모두 체크)', all);
  assert.deepEqual(all,['거래 #1','거래 #2','본건','평가 a','표준지 A']);

  // 범례 체크박스 4개 — 색 점·이름 다음(오른쪽)에 온다
  const boxes=await page.evaluate(()=>[...document.querySelectorAll('#mapLegend label.kindchk')].map(l=>({
    kind:l.querySelector('input').getAttribute('data-kind'),
    text:l.innerText.trim(),
    inputLast:l.lastElementChild.tagName==='INPUT'})));
  console.log('범례',boxes);
  assert.deepEqual(boxes.map(b=>b.kind),['본건','비교표준지','거래사례','평가사례']);
  assert.ok(boxes.every(b=>b.inputLast),'토글 박스는 이름 오른쪽');

  // ① 거래사례 끄기 → 거래 핀만 사라지고 나머지는 그대로
  const geomBefore=await page.evaluate(()=>mapItems().length&&JSON.stringify(TRADES.map(t=>t._xy&&t._xy.x)));
  await page.uncheck('#mapLegend input[data-kind="거래사례"]');
  await page.waitForTimeout(200);
  const off1=await labelsOf(page);
  console.log('거래사례 끔', off1, await page.locator('#mapStatus').innerText());
  assert.deepEqual(off1,['본건','평가 a','표준지 A']);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#mapBox path.leaflet-interactive')].length),3,'필지 도형도 같이 감춰진다');
  assert.equal(await page.evaluate(()=>JSON.stringify(TRADES.map(t=>t._xy&&t._xy.x))),geomBefore,'끈다고 좌표가 지워지지 않는다');

  // ② 다시 켜기 → 있던 대로 돌아온다
  await page.check('#mapLegend input[data-kind="거래사례"]');
  await page.waitForTimeout(200);
  assert.deepEqual(await labelsOf(page),all,'다시 켜면 그대로');

  // ③ 모두 체크해제 → 하나도 안 보임
  await page.click('#mapLegend button:has-text("모두 체크해제")');
  await page.waitForTimeout(200);
  console.log('모두 해제', await labelsOf(page), await page.locator('#mapStatus').innerText());
  assert.deepEqual(await labelsOf(page),[]);
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#mapLegend input.kindbox')].every(b=>!b.checked)),'체크박스 전부 꺼짐');

  // ④ 모두 체크 → 전부 복귀
  await page.click('#mapLegend button:has-text("모두 체크")');
  await page.waitForTimeout(200);
  assert.deepEqual(await labelsOf(page),all,'모두 체크로 전부 복귀');

  // ⑤ 본건만 남기고 껐다가 「주소 다시 찾기」를 해도 숨김이 유지된다
  await page.uncheck('#mapLegend input[data-kind="비교표준지"]');
  await page.uncheck('#mapLegend input[data-kind="거래사례"]');
  await page.uncheck('#mapLegend input[data-kind="평가사례"]');
  await page.waitForTimeout(200);
  assert.deepEqual(await labelsOf(page),['본건']);
  await page.evaluate(()=>mapRefresh(false));
  await page.waitForTimeout(500);
  const afterRefresh=await labelsOf(page);
  const st=await page.locator('#mapStatus').innerText();
  console.log('다시 그린 뒤', afterRefresh, st);
  assert.deepEqual(afterRefresh,['본건']);
  assert.ok(/숨김/.test(st),'상태줄에 숨긴 개수 안내');

  if(errs.length){console.log('페이지 오류',errs);throw new Error('page errors');}
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
