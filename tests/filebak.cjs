// 💾 파일 백업(arap_filebak.js) — 저장건 전체를 파일 하나로 내려받기 / 불러오기. 집건(단일·여러 호수)·토건·입주권에 줄이 뜨는지,
// 토큰·API 키는 안 담기는지, 불러오기가 새 건은 들여오고 목록은 합치고 다른 건은 물어본 대로 하는지.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/filebak.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(n==='/blank.html'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><body><div id="m"></div></body>');}
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({acceptDownloads:true});
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>{const u=r.request().url();
      if(/unpkg|cdnjs|jsdelivr|cdn\./.test(u))return r.continue().catch(()=>r.abort());return r.abort();});
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/blank.html');
    await page.evaluate(()=>{localStorage.clear();
      localStorage.setItem('appraisal-case-list',JSON.stringify([{id:'A1',updated:'2026-11-01T00:00:00Z',label:'A1 가'},{id:'A2',updated:'2026-11-02T00:00:00Z',label:'A2 나'}]));
      localStorage.setItem('case:A1','{"v":"a1"}');localStorage.setItem('case:A2','{"v":"a2"}');
      localStorage.setItem('appraisal-memo:A1','메모1');
      localStorage.setItem('tojigeonmul-list',JSON.stringify([{id:'T1',updated:'2026-11-03T00:00:00Z'}]));localStorage.setItem('tojigeonmul-case:T1','{"t":1}');
      localStorage.setItem('ipj:case-list',JSON.stringify([{id:'P1',updated:'2026-11-04T00:00:00Z'}]));localStorage.setItem('ipj:case:P1','{"p":1}');
      localStorage.setItem('arap-gh-token','ghp_secret');localStorage.setItem('v2:appraisal-api-key','sk-secret');localStorage.setItem('arap-access-ok','1');
      localStorage.setItem('arm-jb-rates-v1','cache');localStorage.setItem('appraisal-tpl-docx-v7','tpl');});
    await page.addScriptTag({url:base+'/arap_filebak.js'});
    await page.evaluate(()=>ArapFileBak.mount(document.getElementById('m')));
    assert.match(await page.textContent('.arap-filebak-st'),/아직 파일 백업을 받은 적이 없어요/);
    // 내려받기
    const [dl]=await Promise.all([page.waitForEvent('download'),page.click('.arap-filebak-down')]);
    assert.match(await page.evaluate(()=>ArapFileBak.fileName()),/^ongyeol_backup_\d{8}_\d{4}\.json$/);   // 리눅스 헤드리스는 한글 파일명을 'download'로 바꿔 보고해 함수 값으로 확인
    const file=path.join(require('os').tmpdir(),'filebak_test_'+Date.now()+'.json');await dl.saveAs(file);
    const snap=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(snap.app,'ongyeol-backup');assert.equal(snap.cases,4);
    assert.deepEqual(Object.keys(snap.data).sort(),['appraisal-case-list','appraisal-memo:A1','case:A1','case:A2','ipj:case-list','ipj:case:P1','tojigeonmul-case:T1','tojigeonmul-list'].sort(),'토큰·키·임시·템플릿은 빠짐');
    assert.match(await page.textContent('.arap-filebak-st'),/마지막 파일 백업 .*\(오늘\)/);
    // 7일 지나면 빨간 안내
    await page.evaluate(()=>{localStorage.setItem('arap-filebak-last',String(Date.now()-9*86400000));});
    await page.reload();await page.addScriptTag({url:base+'/arap_filebak.js'});await page.evaluate(()=>ArapFileBak.mount(document.getElementById('m')));
    assert.match(await page.textContent('.arap-filebak-st'),/9일 전.*다시 받아 두세요/);
    // 기록 삭제 흉내 → 불러오기(전부 새 건): 확인 1번 → 전부 돌아옴, 토큰은 안 생김
    await page.evaluate(()=>localStorage.clear());
    let dialogs=[];page.on('dialog',d=>{dialogs.push(d.type()+':'+d.message());d.accept();});
    await Promise.all([page.waitForNavigation(),page.setInputFiles('.arap-filebak-file',file)]);
    let st=await page.evaluate(()=>({a1:localStorage.getItem('case:A1'),memo:localStorage.getItem('appraisal-memo:A1'),t1:localStorage.getItem('tojigeonmul-case:T1'),p1:localStorage.getItem('ipj:case:P1'),
      list:JSON.parse(localStorage.getItem('appraisal-case-list')).map(x=>x.id),tok:localStorage.getItem('arap-gh-token')}));
    assert.deepEqual(st,{a1:'{"v":"a1"}',memo:'메모1',t1:'{"t":1}',p1:'{"p":1}',list:['A2','A1'],tok:null});
    assert.match(dialogs[0],/새로 들어올 건: 4건/);
    // 섞인 상태: A1은 지금 것이 다름, A3는 지금만 있음, A2는 없음 → [취소]=지금 것 유지: A2만 들어오고 A1·A3 그대로, 목록은 합쳐짐
    await page.addScriptTag({url:base+'/arap_filebak.js'});await page.evaluate(()=>ArapFileBak.mount(document.getElementById('m')));
    await page.evaluate(()=>{localStorage.removeItem('case:A2');localStorage.setItem('case:A1','{"v":"LOCAL"}');localStorage.setItem('case:A3','{"v":"a3"}');
      localStorage.setItem('appraisal-case-list',JSON.stringify([{id:'A3',updated:'2026-11-09T00:00:00Z'},{id:'A1',updated:'2026-11-08T00:00:00Z',label:'로컬'}]));});
    page.removeAllListeners('dialog');dialogs=[];
    page.on('dialog',d=>{dialogs.push(d.message());if(d.type()==='confirm')d.dismiss();else d.accept();});
    await Promise.all([page.waitForNavigation(),page.setInputFiles('.arap-filebak-file',file)]);
    st=await page.evaluate(()=>({a1:localStorage.getItem('case:A1'),a2:localStorage.getItem('case:A2'),a3:localStorage.getItem('case:A3'),list:JSON.parse(localStorage.getItem('appraisal-case-list'))}));
    assert.equal(st.a1,'{"v":"LOCAL"}');assert.equal(st.a2,'{"v":"a2"}');assert.equal(st.a3,'{"v":"a3"}');
    assert.deepEqual(st.list.map(x=>x.id),['A3','A1','A2']);assert.equal(st.list[1].label,'로컬');
    assert.match(dialogs[0],/새로 들어올 건: 1건[\s\S]*내용이 다른 건: 1건/);
    // [확인]=파일 내용으로 바꾸기: A1이 파일 내용으로, A3는 그대로
    await page.addScriptTag({url:base+'/arap_filebak.js'});await page.evaluate(()=>ArapFileBak.mount(document.getElementById('m')));
    page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());
    await Promise.all([page.waitForNavigation(),page.setInputFiles('.arap-filebak-file',file)]);
    st=await page.evaluate(()=>({a1:localStorage.getItem('case:A1'),a3:localStorage.getItem('case:A3'),list:JSON.parse(localStorage.getItem('appraisal-case-list'))}));
    assert.equal(st.a1,'{"v":"a1"}');assert.equal(st.a3,'{"v":"a3"}');assert.equal(st.list.find(x=>x.id==='A1').label,'A1 가');
    // 엉뚱한 파일은 거절
    const bad=file.replace('.json','_bad.json');fs.writeFileSync(bad,'{"hello":1}');
    await page.addScriptTag({url:base+'/arap_filebak.js'});await page.evaluate(()=>ArapFileBak.mount(document.getElementById('m')));
    page.removeAllListeners('dialog');dialogs=[];page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
    await page.setInputFiles('.arap-filebak-file',bad);await page.waitForTimeout(300);
    assert.match(dialogs[0],/온결 백업 파일이 아닙니다/);
    fs.unlinkSync(file);fs.unlinkSync(bad);
    assert.deepEqual(errors,[]);
    // 실제 화면에 줄이 뜨는지 — 집건(단일·여러 호수)·토건·입주권
    const ctx2=await browser.newContext(),pg=await ctx2.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());pg.setDefaultTimeout(60000);
    await ctx2.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await ctx2.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');});
    const vis=()=>pg.$$eval('.arap-filebak-down',a=>a.filter(x=>x.offsetParent!==null).length);
    const seen={};
    for(const mode of ['single','multi']){
      await pg.goto(base+'/blank.html');await pg.evaluate(m=>(localStorage.setItem('arap-jiphap-mode',m),sessionStorage.setItem('arap-jiphap-mode',m)),mode);
      await pg.goto(base+'/s3r86w8a.html');
      const scope=pg.locator(mode==='single'?'#root':'#root-multi');
      await scope.getByText('저장된 건',{exact:false}).first().waitFor();await pg.waitForTimeout(800);
      if(!(await vis()))await scope.getByText('저장된 건',{exact:false}).first().click();
      await pg.waitForTimeout(500);seen['집건-'+mode]=await vis();
    }
    await pg.goto(base+'/'+encodeURI('토지건물.html'));await pg.waitForSelector('#syncBar .arap-filebak-down');seen['토건']=await vis();
    await pg.goto(base+'/'+encodeURI('입주권.html'));
    await pg.getByText('저장된 건',{exact:false}).first().waitFor();await pg.waitForTimeout(800);
    if(!(await vis()))await pg.getByText('저장된 건',{exact:false}).first().click();
    await pg.waitForTimeout(500);seen['입주권']=await vis();
    console.log('화면별 「백업 파일 내려받기」 버튼 수',JSON.stringify(seen));
    for(const k of ['집건-single','집건-multi','토건','입주권'])assert.equal(seen[k],1,k);
    assert.deepEqual(errs,[]);
    console.log('filebak OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
