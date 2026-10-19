// 토지건물 본건 필지 순서 바꾸기(일련번호 ⠿ 끌기) 검증 — 나눈 줄 동반 이동, 사례별 기억(gaMem)·요항표 기호1 따라감, 실제 드래그
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_land_move.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const ctx=await browser.newContext({viewport:{width:1600,height:1000}});const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.accept());
  await ctx.route('**/*',r=>{const u=r.request().url();
    if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.moveLand&&window.renderLands);
  await page.evaluate(()=>{
    LANDS=[{소재지:'화산리',지번:'664-73',면적:'380',지목:'도로'},{sub:true,out:true,사정면적:'50',비고:'도로'},
           {소재지:'화산리',지번:'664-75',면적:'960',지목:'임야',yh:{jise:'완경사',shape:'부정형',use:'자연림',roadCnt:'1',road1dir:'북측',road1w:'4'}},
           {소재지:'화산리',지번:'664-4',면적:'9607',지목:'공장용지',yh:{jise:'평지',shape:'사다리형',use:'공업용'}}];
    STDS=[{}];TRADES=[{loc:'x',gaMem:{gaf:[[1],[2],[3],[4]],gaApply:['a','b','c','d'],gaop:['o1','o2','o3','o4']}},{},{}];
    const set=(k,v)=>document.getElementById(k).value=v;set('y_jise','평지');set('y_shape','사다리형');set('y_use','도로등');set('y_roadCnt','2');set('y_road1dir','남측');
    renderStds();renderLands();renderTrade();renderYohangLands();calcGongsi();
  });
  const order=()=>page.evaluate(()=>LANDS.map(L=>L.sub?'↳'+L.비고:L.지번));
  // ① 1번(나눈 줄 포함)을 맨 아래로
  await page.evaluate(()=>moveLand(0,3));
  assert.deepEqual(await order(),['664-75','664-4','664-73','↳도로']);
  const r1=await page.evaluate(()=>({y:['jise','use','roadCnt','road1dir'].map(k=>document.getElementById('y_'+k).value),
    yh2:LANDS[1].yh&&LANDS[1].yh.use,yh3:LANDS[2].yh&&LANDS[2].yh.use,firstYh:LANDS[0].yh,
    gaApply:TRADES[0].gaMem.gaApply,no:[...document.querySelectorAll('#landTbl tr')].slice(1).map(tr=>tr.cells[0].innerText.replace('⠿','').trim())}));
  console.log('①',JSON.stringify(r1));
  assert.deepEqual(r1.y,['완경사','자연림','1','북측'],'새 기호1 요항표 = 664-75 값');
  assert.equal(r1.yh2,'공업용');assert.equal(r1.yh3,'도로등','옛 기호1 값은 664-73을 따라감');assert.equal(r1.firstYh,undefined);
  assert.deepEqual(r1.gaApply,['c','d','a','b']);
  assert.deepEqual(r1.no,['1','2','3','3-1']);
  // ② 나눈 줄 위에 놓아도 그 원 필지 자리로 — 3번(664-73)을 맨 위로
  await page.evaluate(()=>moveLand(3,0));
  assert.deepEqual(await order(),['664-73','↳도로','664-75','664-4']);
  assert.equal(await page.evaluate(()=>document.getElementById('y_use').value),'도로등');
  // ③ 실제 드래그: 3번(664-4) ⠿ → 1번 줄
  await page.evaluate(()=>showTab('daesang'));
  const grips=page.locator('#landTbl td.land-grip');
  assert.equal(await grips.count(),3);
  await grips.nth(2).dragTo(page.locator('#landTbl tr').nth(1));
  assert.deepEqual(await order(),['664-4','664-73','↳도로','664-75']);
  // ④ 되돌리기(Ctrl+Z)로 원래 순서
  await page.evaluate(()=>{histFlush();histUndo();});
  assert.deepEqual(await order(),['664-73','↳도로','664-75','664-4']);
  // ⑤ 필지 하나면 손잡이 없음
  await page.evaluate(()=>{LANDS=[{지번:'1'}];renderLands();});
  assert.equal(await page.locator('#landTbl td.land-grip').count(),0);
  assert.deepEqual(errs,[]);
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
