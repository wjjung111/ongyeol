// 거래사례 위치도(p9v3xk2m.html) — 사례 말풍선. 실제 Leaflet(LEAFLET_TEST_DIR 사본) + 가짜 브이월드.
// 확인: 말풍선 = 「사례 #n」/지번/표 머리에서 체크한 칸 · 체크 바꾸면 내용 바뀜(화면 위치 그대로) ·
//       말풍선 ✕ → 그 사례만 꺼짐(필지는 그대로) · 칩 💬로 다시 켬 · 모두 끄기/켜기 · 집건 점 말풍선 · 새로고침해도 유지
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),vendor=process.env.LEAFLET_TEST_DIR||path.join(root,'..','map-test-vendor');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);
  const f=n.startsWith('/leaflet.')?path.join(vendor,n.slice(1)):path.join(root,n.slice(1));
  if(!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(f));});
const json=o=>({contentType:'application/json',body:JSON.stringify(o)});
const XY={'15-22':[126.920,37.528],'15-23':[126.923,37.529],'44':[126.926,37.527]};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
try{
  const page=await browser.newPage({viewport:{width:1300,height:1400}});
  page.on('pageerror',e=>{console.error('pageerror',e.message);process.exitCode=1;});
  await page.route(/unpkg\.com\/leaflet@[^/]+\/dist\/(leaflet\.(js|css))/,r=>r.fulfill({path:path.join(vendor,r.request().url().match(/(leaflet\.(js|css))$/)[1])}));
  await page.route(/dapi\.kakao|openstreetmap|xdworld|vworld\.kr\/req\/wmts|req\/image|\/req\/wms/,r=>r.abort());
  await page.route(/api\.vworld\.kr\/req\/search/,r=>{const q=new URL(r.request().url()).searchParams.get('query');
    const k=Object.keys(XY).find(k=>q.endsWith(' '+k));
    r.fulfill(json({response:{status:'OK',result:{items:k?[{id:'11560110001'+k.split('-')[0].padStart(4,'0')+(k.split('-')[1]||'0').padStart(4,'0'),
      point:{x:String(XY[k][0]),y:String(XY[k][1])},address:{parcel:'서울특별시 영등포구 여의도동 '+k}}]:[]}}}));});
  await page.route(/api\.vworld\.kr\/req\/data/,r=>{const u=new URL(r.request().url()),pnu=(u.searchParams.get('attrFilter')||'').split(':').pop();
    const k=Object.keys(XY).find(k=>pnu.endsWith(k.split('-')[0].padStart(4,'0')+(k.split('-')[1]||'0').padStart(4,'0')));
    const [x,y]=k?XY[k]:[0,0],d=.0006;
    r.fulfill(json({response:{status:'OK',result:{featureCollection:{features:k?[{geometry:{type:'Polygon',coordinates:[[[x,y],[x+d,y],[x+d,y+d],[x,y+d],[x,y]]]}}]:[]}}}}));});
  await page.route(/workers\.dev|ned\/data/,r=>r.fulfill(json({})));
  await page.goto(base+'/p9v3xk2m.html');
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('arap-user-name','테스트');localStorage.setItem('arap-map-cases-v1',JSON.stringify({base:'',land:[
    {loc:'여의도동 15-22',use:'일반상업지역',jimok:'대',landA:'100',total:'4350000000',date:'2026.04.23',gongsi:'14450000',show:true},
    {loc:'여의도동 15-23',use:'일반상업지역',jimok:'대',landA:'200',show:true}],
    jip:[{location:'서울특별시 영등포구 여의도동',jibun:'44',aptName:'광장',floor:'7',exclusiveArea:'84.9',price:'1500000000',unitPrice:'17667844',tradeDate:'2026.05.01',show:true}]}));});
  await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('#mapBox .lab.bub').length===3,null,{timeout:20000});
  const bubs=()=>page.$$eval('#mapBox .lab.bub',a=>a.map(x=>[...x.querySelectorAll('b,.ln')].map(y=>y.textContent)));
  let b=await bubs();
  assert.deepEqual(b.find(x=>x[0]==='사례 #1'),['사례 #1','여의도동 15-22','일반상업지역','대','2026.04.23','43,500,000 원/㎡']);
  assert.deepEqual(b.find(x=>x[0]==='사례 #2'),['사례 #2','여의도동 15-23','일반상업지역','대']);   // 거래금액 없으면 단가 줄 없음
  assert.deepEqual(b.find(x=>x[0]==='집건 #1'),['집건 #1','여의도동 44 광장','7층','84.9 ㎡','17,667,844 원/㎡','2026.05.01']);
  await page.screenshot({path:process.env.SHOT||'/dev/null',clip:{x:0,y:560,width:1300,height:700}}).catch(()=>{});
  // 체크 바꾸기: 지목 끄고 공시지가 켬 — 화면 위치는 그대로
  const c0=await page.evaluate(()=>MAPV.leaflet().getCenter());
  await page.evaluate(()=>MAPV.leaflet().panBy([60,40],{animate:false}));
  const c1=await page.evaluate(()=>MAPV.leaflet().getCenter());
  const ck=t=>page.locator('#tblLand th label',{hasText:t}).locator('input');
  await ck('지목').uncheck();await ck('개별공시지가').check();
  await page.waitForTimeout(200);
  b=await bubs();assert.deepEqual(b.find(x=>x[0]==='사례 #1'),['사례 #1','여의도동 15-22','일반상업지역','14,450,000 원/㎡','2026.04.23','43,500,000 원/㎡']);
  const c2=await page.evaluate(()=>MAPV.leaflet().getCenter());assert.deepEqual(c2,c1);assert.notDeepEqual(c1,c0);
  // 말풍선 ✕ → 사례 #1만 꺼짐(필지 테두리는 그대로), 칩 💬 off
  const polys=()=>page.$$eval('#mapBox path.leaflet-interactive',a=>a.length);
  const p0=await polys();
  await page.locator('#mapBox .lab.bub',{hasText:'사례 #1'}).locator('.lx').click();
  await page.waitForTimeout(200);
  b=await bubs();assert.deepEqual(b.map(x=>x[0]).sort(),['사례 #2','집건 #1']);assert.equal(await polys(),p0);
  assert.equal(await page.evaluate(()=>DATA.land[0].labOff),true);
  assert.equal(await page.locator('#pickChips .chip',{hasText:'사례 #1'}).locator('.bub.off').count(),1);
  assert.equal(await page.$$eval('.leaflet-popup',a=>a.length),0);   // ✕가 설명창을 열지 않음
  // 칩 💬로 다시 켬
  await page.locator('#pickChips .chip',{hasText:'사례 #1'}).locator('.bub').click();await page.waitForTimeout(200);
  assert.equal((await bubs()).length,3);
  // 모두 끄기 / 켜기
  await page.click('text=말풍선 모두 끄기');await page.waitForTimeout(200);
  assert.equal((await bubs()).length,0);assert.equal(await polys(),p0);
  await page.click('text=💬 말풍선 모두 켜기');await page.waitForTimeout(200);
  assert.equal((await bubs()).length,3);
  // 하나 끄고 새로고침해도 유지, 체크 목록도 유지
  await page.locator('#pickChips .chip',{hasText:'집건 #1'}).locator('.bub').click();await page.waitForTimeout(500);
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#mapBox .lab.bub').length===2,null,{timeout:20000});
  assert.equal(await ck('지목').isChecked(),false);assert.equal(await ck('개별공시지가').isChecked(),true);
  console.log('OK map_case_bubble');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
