// 사례단가 메모 검증 — '34,705,000(평균단가)'처럼 숫자 뒤에 적은 글자가 의견서에도 그대로 나가고,
// 계산에는 앞쪽 숫자만 쓰인다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_unit_note.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.calcGongsi);

  const r=await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    LANDS=[{소재지:'신사동',지번:'565-18',지목:'대',면적:'745.9',용도지역:'2종일주',공시지가:'19510000',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
    STDS=[{소재지:'신사동',지번:'500',지목:'대',면적:'300',공시지가:'20000000',용도지역:'2종일주'}];
    TRADES=[];
    APPRS=[{no:'a',loc:'신사동 554-1',jimok:'대',use:'2종일주',cond:'주거기타',unit:'36,400,000',base:'2025-02-07',purp:'시가참고'},
           {no:'b',loc:'신사동 586-9',jimok:'대',use:'3종일주',cond:'상업용',unit:'34,705,000(평균단가)',base:'2023-04-25',purp:'시가참고'},
           {no:'c',loc:'신사동 576-1',jimok:'대',use:'2종일주',cond:'상업용',unit:'33,300,000',base:'2024-09-25',purp:'시가참고'}];
    ETC={type:'a',idx:1};GA={idx:0};   // 그 밖의 요인에 '평균단가' 사례를 채택
    for(const [k,v] of Object.entries({base_gijun:'2026.04.24',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,1);
    renderStds();renderLands();document.getElementById('bldBody').innerHTML='';renderAppr();syncPick();calcGongsi();
    const d=ArapTojiOpinion.data();
    return {units:d.appraisals.map(a=>a['평사1_단가']),src:srcUnit(),etcSource:GONGSI_RESULT.etc.source,
      map:mapItems().filter(i=>i.kind==='평가사례').map(i=>i.info)};
  });
  console.log('의견서 평가사례 단가',r);
  assert.deepEqual(r.units,['36,400,000','34,705,000(평균단가)','33,300,000']);
  assert.equal(r.src,34705000);            // 계산에는 앞쪽 숫자만
  assert.equal(r.etcSource,34705000);
  assert.ok(/34,705,000/.test(r.map[1]),'지도 설명창 단가: '+r.map[1]);

  // 메모에 숫자가 섞여 있어도 단가가 어그러지지 않는다
  const r2=await page.evaluate(()=>{
    APPRS[1].unit='34,705,000 (2필지 평균)';renderAppr();calcGongsi();
    return {unit:ArapTojiOpinion.data().appraisals[1]['평사1_단가'],src:srcUnit()};
  });
  console.log('메모에 숫자 포함',r2);
  assert.equal(r2.unit,'34,705,000 (2필지 평균)');
  assert.equal(r2.src,34705000);

  // 거래사례 채택 문장 — '#2'가 아니라 '거래사례#2'(아래 표 머리와 같은 말)
  const pick=await page.evaluate(()=>{
    TRADES=[{loc:'신사동 500-1',total:'1,000,000,000',landA:'100',date:'2025-01-02'},
            {loc:'신사동 500-2',total:'2,000,000,000',landA:'100',date:'2025-02-02'}];
    GA={idx:1};renderTrade();syncPick();calcGongsi();
    const g=ArapTojiOpinion.data().global;
    return {pick:g['거래_채택기호'],etc:g['그밖_채택사례']};
  });
  console.log('거래사례 채택 표기',pick);
  assert.equal(pick.pick,'거래사례#2');

  // 숫자가 없는 값('-')은 종전대로 그대로
  const r3=await page.evaluate(()=>{APPRS[1].unit='-';renderAppr();return ArapTojiOpinion.data().appraisals[1]['평사1_단가'];});
  assert.equal(r3,'-');

  assert.deepEqual(errs,[],'페이지 오류: '+errs.join(' / '));
  console.log('\n✅ 사례단가 메모 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
