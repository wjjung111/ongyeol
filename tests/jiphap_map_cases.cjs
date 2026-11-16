// 집건 위치도에 거래사례·평가전례 표시(2026-11-16, 토건 위치도처럼)
//  - 표시(✔) 켠 사례만, 이름표 = 의견서 기호(단일 ㉠㉡…, 여러 호수 #1 #2…), 전례 a b…
//  - 같은 지번 사례는 점 하나·말풍선 하나(호마다 한 줄), 선정 사례 있으면 채움
//  - 말풍선 ✕ → 끔, 「모두 켜기」로 다시. 분류별 보이기(setVisible)
// 환경: Leaflet 로컬 폴더(LEAFLET_TEST_DIR 또는 ../map-test-vendor)에 leaflet@1.9.4 dist
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),vendor=process.env.LEAFLET_TEST_DIR||path.join(root,'..','map-test-vendor');
const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
const adapter=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes("var KEY='arap-jiphap-map-v1'"))[1];
const server=http.createServer((req,res)=>{const n=req.url.split('?')[0];res.setHeader('Content-Type',n.endsWith('.css')?'text/css':n.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
if(n==='/')return res.end('<link rel="stylesheet" href="/leaflet.css"><script src="/leaflet.js"></script><div id="mapBox" style="height:650px;width:900px"></div><div id="mapBoxM" style="height:650px;width:900px"></div><script src="/arap_jiphap_parcels.js"></script><script src="/arap_map.js"></script><script>'+adapter+'</script>');
const f=path.join(n.startsWith('/leaflet.')?vendor:root,n.slice(1));if(!fs.existsSync(f)){res.statusCode=404;return res.end();}res.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});try{
const page=await browser.newPage({viewport:{width:1000,height:1500}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
const SUBJ='서울특별시 강동구 성내동 420-5',A='서울특별시 강동구 성내동 524-1',B='서울특별시 강동구 성내동 437',P='서울특별시 강동구 성내동 219-1';
await page.addInitScript(({SUBJ,A,B,P})=>{const st={},pt=(x,y,addr)=>({_xy:{x,y,addr,q:addr}});
  const poly=(x,y,addr)=>({_xy:{x:x+.0003,y:y+.0003,addr,q:addr,geom:{type:'Polygon',coordinates:[[[x,y],[x+.0006,y],[x+.0006,y+.0006],[x,y+.0006],[x,y]]]}}});
  st[SUBJ]=poly(127.125,37.53,SUBJ);st['거래사례|'+A]=pt(127.1262,37.5308,A);st['거래사례|'+B]=pt(127.121,37.528,B);st['평가전례|'+P]=pt(127.127,37.526,P);
  localStorage.setItem('arap-jiphap-map-v1',JSON.stringify(st));},{SUBJ,A,B,P});
await page.goto(base);
const cases=[
  {id:1,symbol:'1',location:'서울특별시 강동구 성내동',jibun:'524-1',aptName:'퍼브릭 하우스',floor:'5',ho:'502',tradeDate:'2026.06.29',unitPrice:4329085,isShown:true,isSelected:true},
  {id:2,symbol:'2',location:'서울특별시 강동구 성내동',jibun:'524-1',aptName:'퍼브릭 하우스',floor:'3',ho:'301',tradeDate:'2026.03.02',unitPrice:4100000,isShown:true,isSelected:false},
  {id:3,symbol:'3',location:'서울특별시 강동구 성내동',jibun:'999',aptName:'숨김',isShown:false},
  {id:4,symbol:'4',location:'서울특별시 강동구 성내동',jibun:'437',aptName:'그린빌라',floor:'4',ho:'401',tradeDate:'2026.08.10',unitPrice:7000000,isShown:true,isSelected:false}];
const precs=[{id:9,location:'서울특별시 강동구 성내동',jibun:'219-1',buildingName:'무궁화연립',floor:'4',ho:'401',baseDate:'2025.06.11',unitPrice:4936321,isShown:true}];
for(const [sfx,s1,s2,s4] of [['','㉠','㉡','㉢'],['M','#1','#2','#3']]){
  const id='#mapBox'+sfx;
  await page.evaluate(([sfx,SUBJ,cases,precs])=>ArapJiphapMap.show(sfx,{jibun:SUBJ},cases,precs),[sfx,SUBJ,cases,precs]);
  await page.waitForFunction(id=>document.querySelectorAll(id+' .lab').length===4,id);
  const labs=(await page.locator(id+' .lab').allTextContents()).map(t=>t.replace(/^✕/,''));
  assert.ok(labs.some(t=>t==='[본건]'),labs);
  const a=labs.find(t=>t.startsWith('거래 '+s1+'·'+s2));assert.ok(a,'같은 지번 두 사례 한 말풍선 '+labs);
  assert.ok(a.includes('성내동 524-1')&&a.includes('5층 502호')&&a.includes('3층 301호')&&a.includes('@4,329,085'),a);
  assert.ok(labs.some(t=>t.startsWith('거래 '+s4)&&t.includes('그린빌라')),'숨긴 사례는 빼고 번호 다시 '+labs);
  assert.ok(labs.some(t=>t.startsWith('전례 a')&&t.includes('무궁화연립')&&t.includes('2025.06.11')),labs);
  assert.ok(!labs.some(t=>t.includes('숨김')));
  // 분류 감추기
  await page.evaluate(sfx=>ArapJiphapMap.view(sfx).setVisible({'평가전례':false}),sfx);
  await page.waitForFunction(id=>document.querySelectorAll(id+' .lab').length===3,id);
  await page.evaluate(sfx=>ArapJiphapMap.view(sfx).setVisible({'평가전례':true}),sfx);
  // 모두 끄기 → 본건만, 모두 켜기 → 4개
  await page.evaluate(sfx=>ArapJiphapMap.bubbles(sfx,false),sfx);
  await page.waitForFunction(id=>document.querySelectorAll(id+' .lab').length===1,id);
  await page.evaluate(sfx=>ArapJiphapMap.bubbles(sfx,true),sfx);
  await page.waitForFunction(id=>document.querySelectorAll(id+' .lab').length===4,id);
}
await page.locator('#mapBox').screenshot({path:path.join(vendor,'..','jiphap_map_cases.png')}).catch(()=>{});
assert.deepEqual(errors,[]);console.log('PASS jiphap_map_cases');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
