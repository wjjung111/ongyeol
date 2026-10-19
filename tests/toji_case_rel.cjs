// 토지건물 거래·평가사례 「외」 필지 입력 + 위치도 묶음 표시 + 사례 도로교통(칸·자동 채움·말풍선) 검증.
// PLAYWRIGHT_MODULE=/path/to/playwright LEAFLET_DIST=/path/to/leaflet/dist node tests/toji_case_rel.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'), LF=process.env.LEAFLET_DIST||'';
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
// 가짜 브이월드: 질의문마다 다른 PNU·좌표 + 네모 필지, 토지특성은 세로한면(가)
const pnuOf={};let seq=0;
function pnu(q){if(!pnuOf[q])pnuOf[q]='41590340'+String(++seq).padStart(11,'0');return pnuOf[q];}
const queries=[];
function fakeSearch(q){queries.push(q);const id=pnu(q),i=Number(id.slice(-3));
  return {response:{status:'OK',result:{items:[{id:id,title:q,address:{parcel:q},point:{x:String(126.9+i*0.002),y:String(37.1+i*0.002)}}]}}};}
function fakeData(id){const i=Number(String(id).slice(-3))||1,x=126.9+i*0.002,y=37.1+i*0.002,d=0.0004;
  return {response:{status:'OK',result:{featureCollection:{type:'FeatureCollection',features:[{type:'Feature',properties:{pnu:id},
    geometry:{type:'Polygon',coordinates:[[[x-d,y-d],[x+d,y-d],[x+d,y+d],[x-d,y+d],[x-d,y-d]]]}}]}}}};}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const ctx=await browser.newContext({viewport:{width:1500,height:1000}});const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  page.on('dialog',d=>d.accept());
  await ctx.route('**/*',r=>{
    const u=r.request().url(),J=b=>r.fulfill({body:JSON.stringify(b),contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'}});
    if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.includes('leaflet.js'))return LF?r.fulfill({body:fs.readFileSync(LF+'/leaflet.js','utf8'),contentType:'text/javascript'}):r.continue();
    if(u.includes('leaflet.css'))return LF?r.fulfill({body:fs.readFileSync(LF+'/leaflet.css','utf8'),contentType:'text/css'}):r.continue();
    if(u.includes('api.vworld.kr/req/search'))return J(fakeSearch(new URL(u).searchParams.get('query')||''));
    if(u.includes('api.vworld.kr/req/data'))return J(fakeData(((new URL(u).searchParams.get('attrFilter')||'').split(':').pop()||'1').trim()));
    if(u.includes('getLandCharacteristics'))return J({landCharacteristicss:{field:[{stdrYear:'2026',roadSideCodeNm:'세로한면(가)',ldCodeNm:'경기도 화성시 팔탄면 율암리',mnnmSlno:'1'}]}});
    if(u.includes('vworld.kr')||u.includes('tile.openstreetmap')||u.includes('kakao'))return r.fulfill({status:200,body:'',contentType:'image/png'});
    if(u.startsWith(base))return r.continue();
    return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.mapItems&&window.renderTrade);
  await page.evaluate(()=>{
    document.getElementById('jb_region').value='경기도 화성시';
    LANDS=[{소재지:'율암리',지번:'500',fullAddr:'경기도 화성시 팔탄면 율암리 500',지목:'대',면적:'300',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
    STDS=[];
    TRADES=[{loc:'팔탄면 율암리 134-1',total:'3300000000',landA:'2537',date:'2026.05.18'},{loc:'팔탄면 율암리 35-3'},{}];
    APPRS=[{no:'a',loc:'팔탄면 구장리 127-75',unit:'755,000',base:'2025.05.08',purp:'법원경매'},{},{}];
    renderLands();renderTrade();renderAppr();syncPick();calcGongsi();
    showTab('land');
  });

  // ① 「외」가 없으면 버튼 없음 → 소재지에 「외」를 치면 버튼이 나타난다
  const btn=page.locator('#relbtn_t_0');
  assert.equal(await btn.isVisible(),false,'외 없으면 버튼 숨김');
  const locIn=page.locator('#tblTrade .loc-w input').first();
  await locIn.fill('팔탄면 율암리 134-1 외');
  assert.equal(await btn.isVisible(),true,'외 치면 버튼 보임');
  assert.equal((await btn.innerText()).trim(),'＋지번');
  assert.equal(await locIn.evaluate(el=>el===document.activeElement),true,'입력 중 포커스 유지');
  console.log('① 버튼 표시 OK');

  // ② 창에서 지번 입력: 한 칸에 여러 개 + 마을 이름부터 적은 지번
  await btn.click();
  await page.waitForSelector('#relModal .rrow input');
  const ins=page.locator('#relModal .rrow input');
  await ins.nth(0).fill('134-2, 134-3');
  await ins.nth(1).fill('산 12');
  await page.click('#relModal >> text=＋ 지번 추가');
  await page.locator('#relModal .rrow input').nth(2).fill('구장리 9');
  const pv=await page.locator('#relModal .rrow .pv').allInnerTexts();
  console.log('미리보기',pv);
  assert.equal(pv[1],'팔탄면 율암리 산 12');
  assert.equal(pv[2],'팔탄면 구장리 9');
  await page.locator('#relModal').getByRole('button',{name:'저장',exact:true}).click();
  const rel=await page.evaluate(()=>TRADES[0].rel.map(p=>p.jibun));
  assert.deepEqual(rel,['134-2','134-3','산 12','구장리 9']);
  assert.equal((await page.locator('#relbtn_t_0').innerText()).trim(),'외 4필지');
  assert.equal(await page.locator('#relModal').count(),0,'창 닫힘');
  console.log('② 저장',rel);

  // ③ 평가사례: 지번을 넣으면 소재지에 「외」가 자동으로 붙는다(버튼은 직접 열기)
  await page.evaluate(()=>{relOpen('a',0);});
  await page.locator('#relModal .rrow input').nth(0).fill('127-76');
  await page.locator('#relModal').getByRole('button',{name:'저장',exact:true}).click();
  assert.equal(await page.evaluate(()=>APPRS[0].loc),'팔탄면 구장리 127-75 외');
  assert.equal(await page.evaluate(()=>document.getElementById('relbtn_a_0').style.display),'');
  assert.equal((await page.locator('#relbtn_a_0').textContent()).trim(),'외 1필지');
  console.log('③ 평가사례 외 자동');

  // ④ 다시 열면 저장된 지번이 그대로, 하나 빼고 저장해도 남은 지번의 좌표(_xy)는 유지
  await page.evaluate(()=>{TRADES[0].rel[0]._xy={x:1,y:2,q:'keep'};relOpen('t',0);});
  assert.equal(await page.locator('#relModal .rrow').count(),4);
  await page.locator('#relModal .rrow').nth(3).locator('button').click();
  await page.locator('#relModal').getByRole('button',{name:'저장',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>TRADES[0].rel.map(p=>p.jibun)),['134-2','134-3','산 12']);
  assert.equal(await page.evaluate(()=>TRADES[0].rel[0]._xy.q),'keep');
  await page.evaluate(()=>{delete TRADES[0].rel[0]._xy;});
  console.log('④ 다시 열기·빼기 OK');

  // ⑤ 도로교통: 거래사례 행·평가사례 열 + 자동 채움(빈 칸만)
  assert.ok(await page.locator('#tblTrade th.rowh',{hasText:'도로교통'}).count(),'거래사례 도로교통 행');
  assert.ok((await page.locator('#tblAppr tr').first().innerText()).includes('도로'),'평가사례 도로교통 열');
  await page.evaluate(()=>{TRADES[1].road='광대한면';renderTrade();});
  await page.locator('#tblTrade th.rowh',{hasText:'도로교통'}).locator('button').click();
  await page.waitForFunction(()=>/채움/.test(document.getElementById('pTradeMsg').textContent));
  assert.deepEqual(await page.evaluate(()=>TRADES.map(c=>c.road||'')),['세로(가)','광대한면','']);
  assert.ok(queries.includes('경기도 화성시 팔탄면 율암리 134-1'),'외 떼고 본건 시군구 붙여 조회');
  await page.getByRole('button',{name:'평가사례',exact:true}).click();
  await page.locator('#tblAppr th',{hasText:'도로'}).locator('button').click();
  await page.waitForFunction(()=>/채움/.test(document.getElementById('pApprMsg').textContent));
  assert.equal(await page.evaluate(()=>APPRS[0].road),'세로(가)');
  console.log('⑤ 도로교통 자동',await page.evaluate(()=>document.getElementById('pTradeMsg').textContent));

  // ⑥ 위치도 항목: 대표 + 외 필지 = 한 묶음(이름표 하나), 소재지 「외」는 떼고 조회, 말풍선에 「외 N필지」·도로교통
  await page.evaluate(()=>{mapLabSet('거래사례','road',true);mapLabSet('평가사례','road',true);});
  const items=await page.evaluate(()=>mapItems().filter(i=>i.kind!=='본건').map(i=>({label:i.label,loc:i.loc,g:i.labelGroup,lead:!!i.boundaryLeader,lines:i.lines})));
  console.log('mapItems',JSON.stringify(items));
  const t1=items.filter(i=>i.label==='거래 #1');
  assert.deepEqual(t1.map(i=>i.loc),['팔탄면 율암리 134-1','팔탄면 율암리 134-2','팔탄면 율암리 134-3','팔탄면 율암리 산 12']);
  assert.ok(t1.every(i=>i.g==='trade0'&&i.lead));
  assert.equal(t1[0].lines[0],'율암리 134-1 외 3필지');
  assert.ok(t1[0].lines.includes('세로(가)'),'거래 말풍선 도로교통');
  const t2=items.filter(i=>i.label==='거래 #2');
  assert.equal(t2.length,1);assert.equal(t2[0].g,'');
  assert.ok(t2[0].lines.includes('광대한면'));
  const a1=items.filter(i=>i.label==='평가 a');
  assert.deepEqual(a1.map(i=>i.loc),['팔탄면 구장리 127-75','팔탄면 구장리 127-76']);
  assert.ok(a1[0].lines.includes('세로(가)'),'평가 말풍선 도로교통');

  // ⑦ 실제 지도: 거래 #1 필지 4개 + 이름표 하나
  await page.evaluate(()=>showTab('jido'));
  await page.waitForFunction(()=>document.querySelectorAll('#mapBox path.leaflet-interactive').length>=7,{timeout:20000});
  const labs=await page.evaluate(()=>[...document.querySelectorAll('#mapBox .mkr .lab')].map(e=>(e.querySelector('b')||e).innerText.trim()));
  console.log('이름표',labs,'필지',await page.evaluate(()=>document.querySelectorAll('#mapBox path.leaflet-interactive').length));
  assert.equal(labs.filter(t=>t==='거래 #1').length,1,'거래 #1 이름표 하나');
  assert.equal(labs.filter(t=>t==='평가 a').length,1,'평가 a 이름표 하나');

  // ⑧ 저장·복원
  const back=await page.evaluate(()=>{saveForm();const o=collect();return {rel:o.TRADES?o.TRADES[0].rel:null,raw:JSON.stringify(o).includes('134-3')};});
  assert.ok(back.raw,'저장 데이터에 외 필지 포함');
  assert.deepEqual(errs,[]);
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
