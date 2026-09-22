// 사례별 입력 기억 검증 — 거래사례비교법 채택 사례·그 밖의 요인 적용사례를 바꿔도 각 사례에 넣어 둔
// 보정치·개별요인·의견이 남고, 되돌아오면 복구된다. 저장 후 새로고침해도 유지.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_case_memory.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiDocuments);
    await page.evaluate(()=>{
      const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
      LANDS=[{소재지:'가동',지번:'1-1',지목:'대',면적:'100',용도지역:'2종일주',공시지가:'800000',stdIdx:0},{소재지:'가동',지번:'1-2',지목:'대',면적:'50',용도지역:'2종일주',공시지가:'800000',stdIdx:0}];
      STDS=[{소재지:'표준동',지번:'20-1',지목:'대',면적:'150',공시지가:'1000000',용도지역:'2종일주'}];
      TRADES=[{loc:'가동 1-1',landA:'100',total:'500000000',date:'2025.01.10'},{loc:'나동 2-2',landA:'200',total:'800000000',date:'2025.02.20'}];
      APPRS=[{no:'a',loc:'다동 3-3',unit:'5000000',date:'2025.03.01'}];ETC={type:'t',idx:0};GA={idx:0};
      for(const [k,v] of Object.entries({base_gijun:'2026.01.01',base_gongsi:'2026.01.01',jb_factor:'1'}))set(k,v);
      renderStds();renderLands();renderTrade();renderAppr();syncPick();calcGongsi();
    });
    const set=(id,v)=>page.evaluate(([id,v])=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},[id,v]);
    const val=id=>page.evaluate(id=>document.getElementById(id).value,id);
    // ── 거래사례비교법: #1에 입력 → #2로 → 다른 값 → #1로 복귀 ──
    await set('ga_sajeong','0.95');await set('ga_area','1.02');await set('ga_opinion','사례1 의견');
    await page.evaluate(()=>{LANDS[0].gaf=['1.05','1','1','1','1','1'];LANDS[1].gaf=['0.98','1','1','1','1','1'];LANDS[0].gaApply='1234000';calcGeorae();});
    await page.evaluate(()=>document.querySelectorAll('input[name="pickTradeGa"]')[1].click());   // 거래사례 표 라디오 → pickGa(1)
    assert.equal(await page.evaluate(()=>GA.idx),1);
    assert.equal(await val('ga_sajeong'),'0.95','기억 없는 사례로 바꾸면 지금 값이 그대로 남는다');
    await set('ga_sajeong','1.10');await set('ga_area','0.90');await set('ga_opinion','사례2 의견');
    await page.evaluate(()=>{LANDS[0].gaf=['0.80','1','1','1','1','1'];LANDS[0].gaApply='';calcGeorae();});
    await page.evaluate(()=>pickGa(0));
    assert.deepEqual([await val('ga_sajeong'),await val('ga_area'),await val('ga_opinion')],['0.95','1.02','사례1 의견'],'#1 보정치·의견 복구');
    assert.deepEqual(await page.evaluate(()=>[LANDS[0].gaf[0],LANDS[1].gaf[0],LANDS[0].gaApply]),['1.05','0.98','1234000'],'#1 필지별 개별요인·적용단가 복구');
    await page.evaluate(()=>pickGa(1));
    assert.deepEqual([await val('ga_sajeong'),await val('ga_area'),await val('ga_opinion')],['1.10','0.90','사례2 의견'],'#2 값도 남아 있다');
    assert.equal(await page.evaluate(()=>LANDS[0].gaf[0]),'0.80');
    // ── 그 밖의 요인: 거래사례 #1 → 평가사례 a → 거래사례 #1 복귀 ──
    await set('eSaj1','0.9');await set('e_f1','1.10');await set('eInd2','1.05');await set('e_opinion','그밖 사례1');
    await page.evaluate(()=>document.querySelector('input[name="pickAppr"]').click());   // 평가사례 표 라디오 → pickEtc('a',0)
    assert.deepEqual(await page.evaluate(()=>[ETC.type,ETC.idx]),['a',0]);
    await set('eSaj1','1');await set('e_f1','0.95');await set('eInd2','1');await set('e_opinion','그밖 평가사례');
    await page.evaluate(()=>{const s=document.getElementById('etcPick');s.value='t0';s.dispatchEvent(new Event('change'));});   // 드롭다운 → pickEtc('t',0)
    assert.deepEqual(await page.evaluate(()=>[ETC.type,ETC.idx]),['t',0]);
    assert.deepEqual([await val('eSaj1'),await val('e_f1'),await val('eInd2'),await val('e_opinion')],['0.9','1.10','1.05','그밖 사례1'],'그밖의요인 #1 복구');
    await page.evaluate(()=>pickEtc('a',0));
    assert.deepEqual([await val('eSaj1'),await val('e_f1'),await val('e_opinion')],['1','0.95','그밖 평가사례'],'평가사례 값도 남아 있다');
    // ── 저장 → 새로고침 → 기억 유지 ──
    await page.evaluate(()=>doSave());
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ArapTojiDocuments);
    assert.deepEqual(await page.evaluate(()=>[GA.idx,ETC.type,ETC.idx,!!TRADES[0].gaMem,!!TRADES[1].gaMem,!!TRADES[0].etcMem,!!APPRS[0].etcMem]),[1,'a',0,true,true,true,true]);
    await page.evaluate(()=>pickGa(0));
    assert.deepEqual([await val('ga_sajeong'),await val('ga_opinion'),await page.evaluate(()=>LANDS[0].gaf[0])],['0.95','사례1 의견','1.05'],'새로고침 뒤에도 #1 복구');
    await page.evaluate(()=>pickEtc('t',0));
    assert.deepEqual([await val('eSaj1'),await val('e_opinion')],['0.9','그밖 사례1'],'새로고침 뒤에도 그밖의요인 #1 복구');
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
