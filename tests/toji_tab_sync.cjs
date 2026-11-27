// 두 창 실시간 동기화(2026-11-27) — 위치도 창 + 작업 창. 「불러오기/덮어쓰기」 안내줄 없이 서로 따라간다
//  ① A에서 고치면 B가 바로 따라감(안내줄 없음, B의 탭은 그대로)
//  ② 거의 동시에: A는 거래사례, B는 의뢰인 → 저장할 때 합쳐져 두 창 모두 둘 다 가짐
//  ③ 같은 내용이면 서로 되받아 쓰지 않음(판이 계속 바뀌지 않음)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});const ctx=await browser.newContext();const errs=[];
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  const open=async(q)=>{const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(base+'/토지건물.html'+(q||''),{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.syncRemote&&window.renderTrade);return p;};
  const A=await open();
  await A.evaluate(()=>{document.getElementById('ov_caseNo').value='SYNC-1';document.getElementById('ov_client').value='처음';
    TRADES=[{loc:'율암동 1',total:'100'},{},{}];renderTrade();commitCaseNo();});
  const B=await open('?last=1');
  await B.evaluate(()=>showTab('jido'));
  const bState=()=>B.evaluate(()=>({id:currentId,loc:(TRADES[0]||{}).loc,client:document.getElementById('ov_client').value,bar:!document.getElementById('conflictBar').hidden,tab:CUR_TAB}));
  assert.deepEqual(await bState(),{id:'SYNC-1',loc:'율암동 1',client:'처음',bar:false,tab:'jido'});
  // ① A 수정 → B 따라감
  await A.evaluate(()=>{TRADES[0].loc='율암동 1103-1';renderTrade();saveForm();});await sleep(900);
  const s1=await bState();console.log('①',s1);assert.deepEqual(s1,{id:'SYNC-1',loc:'율암동 1103-1',client:'처음',bar:false,tab:'jido'});
  // ② 동시에: A 거래사례 저장, B는 의뢰인 고치는 중(자동저장 대기) → B 저장 때 합침
  await B.evaluate(()=>{document.getElementById('ov_client').value='홍길동';saveForm();});   // 0.4초 대기 중
  await A.evaluate(()=>{TRADES[1]={loc:'상매동 515-4',total:'200'};renderTrade();doSave();});
  await sleep(1200);
  const s2b=await B.evaluate(()=>({t:TRADES.map(c=>c.loc||''),client:document.getElementById('ov_client').value,bar:!document.getElementById('conflictBar').hidden}));
  const s2a=await A.evaluate(()=>({t:TRADES.map(c=>c.loc||''),client:document.getElementById('ov_client').value,bar:!document.getElementById('conflictBar').hidden}));
  console.log('② B',s2b,'A',s2a);
  assert.deepEqual(s2b.t.slice(0,2),['율암동 1103-1','상매동 515-4']);assert.equal(s2b.client,'홍길동');assert.equal(s2b.bar,false);
  assert.deepEqual(s2a.t.slice(0,2),['율암동 1103-1','상매동 515-4']);assert.equal(s2a.client,'홍길동');assert.equal(s2a.bar,false);
  // ③ 조용해지면 판이 더 바뀌지 않음
  const r1=await A.evaluate(()=>JSON.parse(localStorage.getItem(landCaseKey('SYNC-1')))._rev);await sleep(1500);
  const r2=await A.evaluate(()=>JSON.parse(localStorage.getItem(landCaseKey('SYNC-1')))._rev);assert.equal(r1,r2,'서로 되받아 쓰지 않음');
  // 저장된 건에도 합친 내용
  const st=await A.evaluate(()=>{const o=JSON.parse(localStorage.getItem(landCaseKey('SYNC-1')));return {c:o.ov.ov_client,t:o.TRADES.map(c=>c.loc||'')};});
  assert.equal(st.c,'홍길동');assert.equal(st.t[1],'상매동 515-4');
  assert.deepEqual(errs,[]);console.log('✅ toji_tab_sync 통과');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
