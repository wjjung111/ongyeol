// 토지건물 「일단지」 체크 → 사정면적 「묶기」 자동 (2026-11-22)
// 일단지를 체크하면 개별요인비교(본건/표준지)·시산가액이 「일단지」 한 줄, 체크를 끄면 원래 모드(직접·지분)로 되돌림.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_ildanji_auto_group.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
    page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>{errs.push('dialog: '+d.message());d.dismiss();});
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.renderLands&&window.calcGongsi);
    const setup=(mode)=>page.evaluate((mode)=>{
      const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
      LANDS=[{소재지:'발산리',지번:'406-1',지목:'대',면적:'500',용도지역:'1종일주',stdIdx:0,gf:[1,1,1,1.05,1,1],지분:'1/2'},
             {소재지:'발산리',지번:'407-9',지목:'대',면적:'300',용도지역:'1종일주',stdIdx:0,gf:[1,1,1,1,1,1],지분:'1/2'}];
      STDS=[{소재지:'발산리',지번:'500',지목:'대',면적:'300',공시지가:'1512000',용도지역:'1종일주',etcDecide:'1.13'}];
      TRADES=[];APPRS=[];ETC={type:'t',idx:0};GA={idx:0};ILDANJI=false;GROUP_AREA='';SAJ_MODE.land='direct';
      for(const [k,v] of Object.entries({base_gijun:'2026.11.22',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1'}))set(k,v);
      renderStds();renderLands();calcGongsi();
      if(mode!=='direct')setSajMode('land',mode);
    },mode);
    const state=()=>page.evaluate(()=>({mode:SAJ_MODE.land,ild:ILDANJI,box:document.getElementById('ov_ildanji').checked,
      sel:document.getElementById('landSajMode').value,
      facFirst:[...document.querySelectorAll('#tblGaebyeol tr')].slice(1).filter(tr=>tr.querySelector('input.fac')).map(tr=>tr.cells[0].textContent),
      sisanFirst:[...document.querySelectorAll('#tblSisan tr')].slice(1).map(tr=>tr.cells[0].textContent),size:GONGSI_RESULT.size}));
    const click=()=>page.click('#ov_ildanji');

    // ① 직접입력에서 일단지 체크 → 묶기 자동, 개별요인·시산가액 「일단지」 한 줄
    await setup('direct');
    let s=await state();assert.deepEqual(s.facFirst,['1','2'],'체크 전 개별요인 필지별 두 줄');
    await click();s=await state();console.log('① 체크',s);
    assert.equal(s.mode,'group');assert.equal(s.sel,'group');assert.equal(s.ild,true);assert.equal(s.box,true);
    assert.deepEqual(s.facFirst,['일단지'],'개별요인 한 줄');
    assert.deepEqual(s.sisanFirst,['일단지'],'시산가액 한 줄');
    assert.equal(s.size,800,'묶은 면적 = 공부면적 합계');
    // 체크 끔 → 직접입력으로 되돌아가 필지별 두 줄
    await click();s=await state();console.log('① 끔',s);
    assert.equal(s.mode,'direct');assert.equal(s.ild,false);assert.deepEqual(s.facFirst,['1','2']);

    // ② 지분입력에서 체크 → 묶기, 끄면 지분입력으로
    await setup('share');assert.equal((await state()).mode,'share');
    await click();assert.equal((await state()).mode,'group');
    await click();s=await state();assert.equal(s.mode,'share','지분입력으로 복귀');assert.equal(s.size,400,'지분 사정면적 다시 계산(250+150)');

    // ③ 이미 묶기였던 건은 일단지를 꺼도 묶기 그대로(사용자가 직접 고른 묶기)
    await setup('group');await click();assert.equal((await state()).mode,'group');
    await click();s=await state();assert.equal(s.mode,'group','직접 고른 묶기는 유지');assert.equal(s.ild,false);

    // ④ 저장·불러오기 — 일단지·묶기 함께 남음
    await setup('direct');await click();
    const r=await page.evaluate(()=>{doSave();const o=JSON.parse(localStorage.getItem(FORM_STORAGE));clearForm();applyForm(o);refreshAfterLoad();
      return {mode:SAJ_MODE.land,ild:ILDANJI};});
    assert.deepEqual(r,{mode:'group',ild:true});

    assert.deepEqual(errs,[]);
    console.log('✅ 일단지 → 묶기 자동 검증 통과');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
