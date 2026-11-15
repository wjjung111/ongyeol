// 도로명주소(「갯벌로 72」)로 넣어도 지번·PNU로 찾는지 — arap_addr.js + 토지건물 본건 토지 / 건축물대장 지번칸 / 기준시가 / 집합건물 기준시가
// 브이월드는 가짜 응답: 도로명 검색 → 지번 주소(송도동 7-14) → 지번 검색 → PNU
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/addr_road.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(f).pipe(res);});
const PNU='2818510600100070014';
const ROAD='인천광역시 연수구 갯벌로 72',PARCEL='인천광역시 연수구 송도동 7-14';
function vw(u){
  const q=u.searchParams.get('query')||'',cat=u.searchParams.get('category');
  let items=[];
  if(cat==='road'&&/갯벌로\s*72/.test(q))items=[{id:'281853200001',address:{road:ROAD,parcel:'송도동 7-14'},point:{x:'126.66',y:'37.38'}}];
  if(cat==='parcel'&&/송도동\s*7-14/.test(q))items=[{id:PNU,address:{parcel:PARCEL,road:ROAD},point:{x:'126.66',y:'37.38'}}];
  return items.length?{response:{status:'OK',result:{items}}}:{response:{status:'NOT_FOUND'}};
}
const LAND={landCharacteristicss:{field:[{pnu:PNU,stdrYear:'2026',stdrMt:'01',lastUpdtDt:'2026-05-01',ldCodeNm:'인천광역시 연수구 송도동',mnnmSlno:'7-14',lndcgrCodeNm:'대',lndpclAr:'3222.4',prposArea1Nm:'준주거지역',ladUseSittnNm:'공업용',pblntfPclnd:'1000000'}]}};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  const seen=[];
  const mk=async()=>{
    const ctx=await browser.newContext({viewport:{width:1400,height:900}});
    await ctx.route('**/*',r=>{const u=new URL(r.request().url());
      if(u.href.includes('arap_access.js')||u.href.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
      if(u.href.startsWith(base))return r.continue();
      const cb=u.searchParams.get('callback');let body=null;
      if(u.pathname.endsWith('/req/search')){seen.push(u.searchParams.get('category')+':'+u.searchParams.get('query'));body=vw(u);}
      else if(u.pathname.includes('getLandCharacteristics')){seen.push('land:'+u.searchParams.get('pnu'));body=LAND;}
      else if(u.pathname.includes('/bld')){seen.push('bld:'+u.searchParams.get('op')+':'+u.searchParams.get('pnu'));body={response:{body:{items:{item:[]},totalCount:0,pageNo:1}}};}
      if(!body)return r.abort();
      return r.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:cb?'text/javascript':'application/json',body:cb?cb+'('+JSON.stringify(body)+')':JSON.stringify(body)});});
    await ctx.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-vworld-key','TEST');localStorage.setItem('exact-vworld-key','TEST');}catch(e){}});
    const pg=await ctx.newPage(),errors=[];pg.on('pageerror',e=>errors.push(e.message));return {ctx,pg,errors};
  };
  try{
    // 1) 공용 도우미
    {const {ctx,pg}=await mk();await pg.goto(base+'/건축물대장.html',{waitUntil:'domcontentloaded'});
      const r=await pg.evaluate(()=>({
        road:[ArapAddr.looksRoad('갯벌로 72'),ArapAddr.looksRoad('연수구 갯벌로 72'),ArapAddr.looksRoad('세무서2길 64'),ArapAddr.looksRoad('테헤란로 123-4')],
        parcel:[ArapAddr.looksRoad('송도동 7-14'),ArapAddr.looksRoad('종로3가 12'),ArapAddr.looksRoad('신림동 산 12'),ArapAddr.looksRoad('관양동 1443-5')],
        fix:ArapAddr.parcelOf({address:{road:'인천광역시 연수구 갯벌로 72',parcel:'송도동 7-14'}}).parcel}));
      assert.deepEqual(r.road,[true,true,true,true]);assert.deepEqual(r.parcel,[false,false,false,false]);
      assert.equal(r.fix,'인천광역시 연수구 송도동 7-14','시·도 빠진 지번에 도로명 앞부분 붙임');
      await ctx.close();}

    // 2) 토지건물 본건 토지 — 도로명으로 조회 → 지번 필지가 표에 들어감
    {const {ctx,pg,errors}=await mk();await pg.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
      await pg.waitForSelector('#landQuery');seen.length=0;
      await pg.fill('#landQuery','갯벌로 72');await pg.click('#btnLand');
      await pg.waitForFunction(()=>/조회 완료|실패/.test(document.getElementById('landStatus').textContent),null,{timeout:15000});
      const st=await pg.textContent('#landStatus');
      assert.match(st,/조회 완료: 인천광역시 연수구 송도동 7-14/,st);assert.match(st,/도로명 인천광역시 연수구 갯벌로 72/);
      assert.ok(seen.includes('land:'+PNU),'PNU로 토지특성 조회 '+seen.join(' | '));
      assert.ok(seen[0].startsWith('road:'),'도로명이면 도로명 검색부터');
      // 지번은 예전처럼 지번 검색 한 번
      seen.length=0;await pg.fill('#landQuery','송도동 7-14');await pg.click('#btnLand');
      await pg.waitForFunction(()=>!document.getElementById('btnLand').disabled&&/조회 완료/.test(document.getElementById('landStatus').textContent));
      assert.ok(seen[0].startsWith('parcel:'),seen.join(' | '));assert.ok(!/도로명/.test(await pg.textContent('#landStatus')));
      assert.deepEqual(errors,[]);await ctx.close();}

    // 3) 건축물대장 — 지번 칸에 도로명을 넣어도 도로명 조회로 넘어가 PNU로 대장 조회
    {const {ctx,pg,errors}=await mk();await pg.goto(base+'/건축물대장.html',{waitUntil:'domcontentloaded'});
      seen.length=0;await pg.fill('#q','연수구 갯벌로 72');await pg.click('#btnGo');
      await pg.waitForFunction(()=>!document.getElementById('btnGo').disabled);
      await pg.waitForTimeout(300);
      assert.ok(seen.some(s=>s.startsWith('bld:')&&s.endsWith(':'+PNU)),'PNU로 대장 조회 '+seen.join(' | '));
      assert.equal(await pg.inputValue('#q'),PARCEL,'지번 칸에 바꾼 지번 표시');
      assert.deepEqual(errors,[]);await ctx.close();}

    // 4) 기준시가 건물 탭
    {const {ctx,pg,errors}=await mk();await pg.goto(base+'/기준시가.html',{waitUntil:'domcontentloaded'});
      seen.length=0;await pg.fill('#qDate','2026-11-15');await pg.fill('#qAddr','갯벌로 72');await pg.click('#qGo');
      await pg.waitForFunction(()=>!document.getElementById('qGo').disabled&&document.getElementById('qStatus').textContent.trim()&&!/불러오는 중/.test(document.getElementById('qStatus').textContent));
      assert.ok(seen.includes('land:'+PNU),'PNU로 토지특성 '+seen.join(' | '));
      assert.ok(seen.some(s=>s.startsWith('bld:')&&s.endsWith(':'+PNU)),'PNU로 건축물대장');
      assert.deepEqual(errors,[]);await ctx.close();}

    // 5) 집합건물 기준시가 — 후보에 지번 주소 + PNU
    {const {ctx,pg,errors}=await mk();await pg.goto(base+'/집합건물_기준시가.html',{waitUntil:'domcontentloaded'});
      await pg.selectOption('#mode','manual');seen.length=0;await pg.fill('#address','연수구 갯벌로 72');await pg.click('#search');
      await pg.waitForFunction(()=>!document.getElementById('search').disabled);
      assert.equal(await pg.inputValue('#candidates'),PNU);
      assert.match(await pg.$eval('#candidates',s=>s.selectedOptions[0].textContent),/송도동 7-14/);
      assert.deepEqual(errors,[]);await ctx.close();}
    console.log('addr_road OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
