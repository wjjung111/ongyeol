// 건물 층 묶기(A·B·C) 검증 — 같은 글자끼리 재조달원가·내용연수를 공유
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_bld_group.cjs
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
  await page.waitForFunction(()=>window.renderBldCalc&&window.addBldRow);

  // 픽스처: 지하1층 주차장 / 1층 근생 / 2층 근생 / 옥탑 기계실
  await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    set('base_gijun','2026.04.24');set('bt_useApr','2006.04.24');
    document.getElementById('bldBody').innerHTML='';
    [{'층별':'지하1층','용도':'주차장','구조':'철근콘크리트구조','연면적':'159.84'},
     {'층별':'1층','용도':'소매점','구조':'철근콘크리트구조','연면적':'289.48'},
     {'층별':'2층','용도':'일반음식점','구조':'철근콘크리트구조','연면적':'373.95'},
     {'층별':'옥탑1층','용도':'기계실','구조':'철근콘크리트구조','연면적':'32.2'}].forEach(r=>addBldRow(r));
    window.BLD_STATE={};renderBldCalc();
  });

  // ① 1층·2층을 묶음 A로 → 한 칸만 입력해도 둘 다 1,300,000
  const a=await page.evaluate(()=>{
    bldSetGrp(1,'A');bldSetGrp(2,'A');
    bldSet(1,'reCost','1300000');
    return {states:[0,1,2,3].map(i=>({g:(BLD_STATE[i]||{}).grp||'',re:(BLD_STATE[i]||{}).reCost||''})),
      rowsRe:BLD_RESULT.rows.map(r=>r.reCost),
      cells:[...document.querySelectorAll('#tblBldCalc tr')].slice(1,5).map(tr=>tr.className)};
  });
  console.log('① 1·2층 묶음 A',a);
  assert.deepEqual(a.states.map(s=>s.g),['','A','A','']);
  assert.equal(a.states[1].re,'1,300,000');
  assert.equal(a.states[2].re,'1,300,000');          // 묶인 층에 같이 들어간다
  assert.deepEqual(a.rowsRe,[0,1300000,1300000,0]);

  // ② 묶음 안 아무 칸이나 고쳐도 전체가 바뀐다(내용연수도 공유)
  const b=await page.evaluate(()=>{
    bldSet(2,'reCost','1350000');bldSet(2,'life','40');
    return {re:[1,2].map(i=>BLD_STATE[i].reCost),life:[1,2].map(i=>BLD_STATE[i].life)};
  });
  console.log('② 묶음 안 다른 칸 수정',b);
  assert.deepEqual(b.re,['1,350,000','1,350,000']);
  assert.deepEqual(b.life,['40','40']);

  // ③ 두 번째 묶음 B(지하1층·옥탑) — 값이 있는 묶음에 나중에 들어오면 그 값을 받아 온다
  const c=await page.evaluate(()=>{
    bldSetGrp(0,'B');bldSet(0,'reCost','1000000');
    bldSetGrp(3,'B');
    return {b:[0,3].map(i=>BLD_STATE[i].reCost),a:[1,2].map(i=>BLD_STATE[i].reCost),
      total:BLD_RESULT.total};
  });
  console.log('③ 묶음 B',c);
  assert.deepEqual(c.b,['1,000,000','1,000,000']);
  assert.deepEqual(c.a,['1,350,000','1,350,000']);   // 다른 묶음은 안 건드린다

  // ④ 묶음 해제 — 값은 남고 그 뒤로는 따로 논다
  const d=await page.evaluate(()=>{
    bldSetGrp(3,'');bldSet(3,'reCost','900000');
    return {grp:(BLD_STATE[3]||{}).grp||'',re:[0,3].map(i=>BLD_STATE[i].reCost)};
  });
  console.log('④ 묶음 해제',d);
  assert.equal(d.grp,'');
  assert.deepEqual(d.re,['1,000,000','900000'.replace('900000','900,000')]);

  // ⑤ 저장·복원 후에도 묶음이 남는다
  const e=await page.evaluate(()=>{
    doSave();const o=JSON.parse(localStorage.getItem(FORM_STORAGE));
    clearForm();applyForm(o);refreshAfterLoad();
    return {grps:[0,1,2,3].map(i=>(BLD_STATE[i]||{}).grp||''),re:[1,2].map(i=>(BLD_STATE[i]||{}).reCost||''),
      sels:[...document.querySelectorAll('#tblBldCalc td.grpsel select')].map(s=>s.value)};
  });
  console.log('⑤ 저장·복원',e);
  assert.deepEqual(e.grps,['B','A','A','']);
  assert.deepEqual(e.re,['1,350,000','1,350,000']);
  assert.deepEqual(e.sels,['B','A','A','']);

  assert.deepEqual(errs,[],'페이지 오류: '+errs.join(' / '));
  console.log('\n✅ 건물 층 묶기 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
