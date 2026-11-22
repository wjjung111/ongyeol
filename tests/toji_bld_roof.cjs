// 토지건물 본건 건물 — 건축물대장 표제부 주구조·지붕을 불러와 보여 주고, 요항표 「1. 건물의 구조」에 주구조 + 지붕 + 층수 (2026-11-22)
// 건축물대장은 가짜 응답(프록시 /bld). PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_bld_roof.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
const TITLE={strctCdNm:'벽돌구조',etcStrct:'벽돌구조',roofCdNm:'(철근)콘크리트',etcRoof:'평슬래브',mainPurpsCdNm:'단독주택',grndFlrCnt:'2',ugrndFlrCnt:'1',useAprDay:'19880907',newPlatPlc:'서울특별시 성동구 성덕정길 103-19'};
const FLR=[{flrGbCd:'10',flrGbCdNm:'지하',flrNo:'1',flrNoNm:'지1층',strctCdNm:'벽돌구조',mainPurpsCdNm:'단독주택',etcPurps:'주택',area:'73.62',mainAtchGbCdNm:'주건축물'},
           {flrGbCd:'20',flrGbCdNm:'지상',flrNo:'1',flrNoNm:'1층',strctCdNm:'벽돌구조',mainPurpsCdNm:'단독주택',etcPurps:'주택',area:'81.72',mainAtchGbCdNm:'주건축물'},
           {flrGbCd:'20',flrGbCdNm:'지상',flrNo:'2',flrNoNm:'2층',strctCdNm:'벽돌구조',mainPurpsCdNm:'단독주택',etcPurps:'주택',area:'81.72',mainAtchGbCdNm:'주건축물'}];
const wrap=items=>({response:{header:{resultCode:'00',resultMsg:'NORMAL SERVICE.'},body:{items:{item:items},totalCount:items.length,pageNo:1}}});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({viewport:{width:1400,height:900}});const page=await ctx.newPage();const errs=[];
    page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>{errs.push('dialog: '+d.message());d.dismiss();});
    await ctx.route('**/*',r=>{const u=new URL(r.request().url());
      if(u.href.includes('arap_access.js')||u.href.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
      if(u.href.startsWith(base))return r.continue();
      if(u.pathname.includes('/bld')||u.pathname.includes('getBr')){
        const op=u.searchParams.get('op')||u.pathname.split('/').pop(),cb=u.searchParams.get('callback');
        const body=op==='getBrTitleInfo'?wrap([TITLE]):op==='getBrFlrOulnInfo'?wrap(FLR):wrap([]);
        return r.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:cb?'text/javascript':'application/json',body:cb?cb+'('+JSON.stringify(body)+')':JSON.stringify(body)});}
      return r.abort();});
    await ctx.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.renderLands&&window.fillYohangFromData);
    await page.evaluate(()=>{
      LANDS=[{소재지:'서울특별시 성동구 성수동1가',지번:'103-19',pnu:'1120011400101030019',지목:'대',면적:'150',용도지역:'2종일주',이용상황:'단독',공시지가:'5000000',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1],roadAddr:'서울특별시 성동구 성덕정길 103-19'}];
      renderLands();
    });
    // ① 건축물대장 불러오기 → 주구조·지붕 칸
    await page.click('#btnFetchBld');
    await page.waitForFunction(()=>document.getElementById('bt_mainStrct').value,null,{timeout:15000});
    const f=await page.evaluate(()=>({main:cgVal('bt_mainStrct'),roof:cgVal('bt_roof'),strct:cgVal('bt_strct'),flrs:cgVal('bt_flrs'),
      labels:[...document.querySelectorAll('.fld label')].map(l=>l.textContent).filter(t=>/대장\)/.test(t))}));
    console.log('① 대장',f);
    assert.equal(f.main,'벽돌구조','주구조(기타구조 같으면 한 번)');
    assert.equal(f.roof,'(철근)콘크리트(평슬래브)','지붕(기타지붕)');
    assert.equal(f.strct,'벽돌구조');assert.equal(f.flrs,'2/1');
    assert.deepEqual(f.labels,['주구조(대장)','지붕(대장)']);
    // ② 요항표 1. 건물의 구조 = 주구조 + 지붕(기타지붕 평슬래브) + 층수
    const y=await page.evaluate(()=>{fillYohangFromData();return cgVal('y_struct');});
    assert.equal(y,'벽돌구조 평슬래브 지하 1층 지상 2층');
    // 지붕에 기타지붕이 없으면 「지붕」을 붙인다
    const y2=await page.evaluate(()=>{document.getElementById('bt_roof').value='(철근)콘크리트';fillYohangFromData();return cgVal('y_struct');});
    assert.equal(y2,'벽돌구조 (철근)콘크리트지붕 지하 1층 지상 2층','자동값은 따라 바뀜');
    // 지붕 넣기 전 옛 자동값(구조 + 층수)이 남은 건은 새 자동값으로
    const y3=await page.evaluate(()=>{const st=document.getElementById('y_struct');st.value='벽돌구조 지하 1층 지상 2층';delete st.dataset.autoStruct;
      document.getElementById('bt_roof').value='(철근)콘크리트(평슬래브)';fillYohangFromData();return st.value;});
    assert.equal(y3,'벽돌구조 평슬래브 지하 1층 지상 2층','옛 자동값 → 새 자동값');
    // 직접 고친 문구는 그대로
    const y4=await page.evaluate(()=>{const st=document.getElementById('y_struct');st.value='연와조 슬래브지붕 2층';fillYohangFromData();return st.value;});
    assert.equal(y4,'연와조 슬래브지붕 2층','직접 쓴 문구 유지');
    // ③ 요항표 한글 파일 본문
    const out=await page.evaluate(async()=>{const st=document.getElementById('y_struct');st.value='';fillYohangFromData();
      const bytes=await ArapTojiDocuments.buildYohang();const es=await ArapCheonggu.parseZip(bytes.buffer);
      return new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data).replace(/<[^>]+>/g,'');});
    assert.ok(out.includes('벽돌구조 평슬래브 지하 1층 지상 2층 건물로서'),'요항표 hwpx 건물 구조');
    // ④ 저장·복원, 옛 건(주구조·지붕 없음)은 빈칸
    const rt=await page.evaluate(()=>{const o=JSON.parse(JSON.stringify(collect()));
      document.getElementById('bt_mainStrct').value='x';document.getElementById('bt_roof').value='y';applyForm(o);
      const a={main:cgVal('bt_mainStrct'),roof:cgVal('bt_roof')};
      delete o.bt.bt_mainStrct;delete o.bt.bt_roof;applyForm(o);
      return {a,b:{main:cgVal('bt_mainStrct'),roof:cgVal('bt_roof')}};});
    assert.deepEqual(rt,{a:{main:'벽돌구조',roof:'(철근)콘크리트(평슬래브)'},b:{main:'',roof:''}});
    // 주구조가 비면 종전처럼 구조 칸(bt_strct)
    assert.equal(await page.evaluate(()=>yohangStructAuto()),'벽돌구조 지하 1층 지상 2층');
    assert.deepEqual(errs,[]);
    console.log('✅ 주구조·지붕 검증 통과');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
