// 💾 파일 백업 — 백업 폴더(구글 드라이브 폴더 등) 지정 → 버튼/자동으로 그 폴더에 `온결백업_YYYYMMDD.json`.
// (테스트 폴더 이름은 영문, 폴더 기억은 가짜 보관함 — 이 리눅스 헤드리스 크롬은 OPFS 한글 이름에서 쓰기 실패, IndexedDB에서 OPFS 손잡이를 꺼내면 브라우저가 죽음)
// 폴더 고르기 창 대신 브라우저 내부 폴더(OPFS)를 돌려줘서 실제 파일 쓰기·IndexedDB 기억·새로고침 후 자동 백업까지 본다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/filebak_dir.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(n==='/blank.html'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><body><div id="m"></div><script src="/arap_filebak.js"></script><script>ArapFileBak.autoMs=300;ArapFileBak.mount(document.getElementById("m"));</script></body>');}
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext();
    await ctx.addInitScript(()=>{const dir=async()=>{const r=await navigator.storage.getDirectory();return await r.getDirectoryHandle('armbak',{create:true});};
      window.showDirectoryPicker=dir;
      // 폴더 기억: 실제 앱은 IndexedDB. 여기선 「기억함」 표시만 localStorage에 두고 꺼낼 때 같은 폴더를 다시 연다
      window.ArapFileBakStore={get:async()=>localStorage.getItem('t-dir')?await dir():undefined,put:async()=>{localStorage.setItem('t-dir','1');},del:async()=>{localStorage.removeItem('t-dir');}};});
    const page=await ctx.newPage(),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
    await page.goto(base+'/blank.html');
    await page.evaluate(()=>{localStorage.clear();localStorage.setItem('appraisal-case-list',JSON.stringify([{id:'A1',updated:'2026-11-01T00:00:00Z'}]));localStorage.setItem('case:A1','{"v":1}');localStorage.setItem('arap-gh-token','ghp_secret');});
    const files=()=>page.evaluate(async()=>{const r=await navigator.storage.getDirectory();const d=await r.getDirectoryHandle('armbak',{create:true});const out={};
      for await(const [n,h] of d.entries()){out[n]=await (await h.getFile()).text();}return out;});
    assert.equal(await page.textContent('.arap-filebak-down'),'백업 파일 내려받기');
    // 폴더 고르기 → 바로 첫 백업 파일
    await page.click('.arap-filebak-pick');await page.waitForFunction(()=>/armbak/.test(document.querySelector('.arap-filebak-st').textContent));
    const today=await page.evaluate(()=>ArapFileBak.dayName());assert.match(today,/^ongyeol_backup_\d{8}\.json$/);
    let f=await files();assert.deepEqual(Object.keys(f),[today]);
    let snap=JSON.parse(f[today]);assert.equal(snap.data['case:A1'],'{"v":1}');assert.equal(snap.data['arap-gh-token'],undefined,'토큰은 안 담음');
    assert.match(dialogs[0],/「armbak」로 정했고/);
    assert.equal(await page.textContent('.arap-filebak-down'),'지금 백업');
    assert.match(await page.textContent('.arap-filebak-st'),/📁 armbak · 저장하면 자동 백업 · 마지막 파일 백업 .*\(오늘\)/);
    // 저장건이 바뀌면 자동으로 덮어씀(하루 파일 하나)
    await page.evaluate(()=>localStorage.setItem('case:A1','{"v":2}'));await page.waitForTimeout(900);
    f=await files();assert.equal(Object.keys(f).length,1);assert.equal(JSON.parse(f[today]).data['case:A1'],'{"v":2}');
    // 관계없는 칸이 바뀌면 안 씀
    await page.evaluate(()=>localStorage.setItem('arap-colw-x','1'));
    // 새로고침해도 폴더 기억(IndexedDB) → 자동 백업 계속
    await page.reload();await page.waitForFunction(()=>/armbak/.test(document.querySelector('.arap-filebak-st').textContent));
    await page.evaluate(()=>localStorage.setItem('case:A1','{"v":3}'));await page.waitForTimeout(900);
    f=await files();assert.equal(JSON.parse(f[today]).data['case:A1'],'{"v":3}');
    // 「지금 백업」 버튼
    await page.evaluate(()=>localStorage.setItem('arap-colw-y','2'));
    await page.evaluate(()=>{localStorage.setItem('case:A1','{"v":4}');});await page.click('.arap-filebak-down');await page.waitForTimeout(300);
    f=await files();assert.equal(JSON.parse(f[today]).data['case:A1'],'{"v":4}');
    // 건이 하나도 없으면 자동 백업이 빈 파일로 덮지 않음
    await page.evaluate(()=>{localStorage.removeItem('case:A1');localStorage.setItem('appraisal-case-list','[]');});await page.waitForTimeout(900);
    f=await files();assert.equal(JSON.parse(f[today]).data['case:A1'],'{"v":4}');
    // 폴더 해제 → 내려받기 방식으로 돌아감, 폴더 파일은 그대로
    await page.click('.arap-filebak-forget');await page.waitForTimeout(300);
    assert.equal(await page.textContent('.arap-filebak-down'),'백업 파일 내려받기');
    await page.reload();await page.waitForTimeout(300);assert.equal(await page.textContent('.arap-filebak-down'),'백업 파일 내려받기');
    f=await files();assert.equal(Object.keys(f).length,1);
    assert.deepEqual(errors,[]);
    console.log('filebak_dir OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
