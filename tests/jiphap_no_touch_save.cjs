// 집건: 열기만 한 건은 저장 시각이 안 바뀜(단일·여러 호수 두 앱이 한 페이지에 함께 떠도) — 고치면 저장
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_no_touch_save.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const mk=async init=>{const ctx=await browser.newContext({viewport:{width:1300,height:900}});
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
  await ctx.addInitScript(i=>{if(sessionStorage.getItem('i'))return;sessionStorage.setItem('i','1');localStorage.setItem('arap-user-name','wdw');Object.entries(i||{}).forEach(([k,v])=>localStorage.setItem(k,v));},init);
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('dialog',d=>d.accept());return {ctx,p};};
try{
  // ── 집건: 한 번 열어 단일·여러 호수 각각 마지막 건이 저장된 상태를 만든 뒤, 다시 열기만 하면 시각이 그대로인지
  {const {ctx,p}=await mk({'arap-jiphap-mode':'single'});
    await p.goto(base+'/s3r86w8a.html');await p.locator('#root').getByText('2. 대상물건개요',{exact:true}).waitFor({timeout:60000});
    await p.waitForTimeout(7000);   // 첫 로드 자동저장(여러 호수 5초 디바운스 포함)이 끝나게
    const snap=()=>p.evaluate(()=>{const o={};for(const k of ['appraisal-case-list','v2:appraisal-case-list']){try{o[k]=JSON.parse(localStorage.getItem(k)||'[]').map(x=>x.id+'@'+x.updated);}catch(e){}}return JSON.stringify(o);});
    const s1=await snap();
    await p.reload();await p.locator('#root').getByText('2. 대상물건개요',{exact:true}).waitFor({timeout:60000});await p.waitForTimeout(7000);
    const s2=await snap();assert.equal(s2,s1,'다시 열기만 하면 저장 시각 그대로');
    // 실제로 고치면 저장됨
    const before=await p.evaluate(()=>localStorage.getItem('case:SAMPLE-압구정현대'));
    await p.locator('#root').getByText('1. 접수개요',{exact:true}).click();
    await p.locator('#root input[placeholder="HI260305-2601"]').locator('xpath=ancestor::div[2]').locator('input').nth(1).fill('테스트의뢰인');
    await p.waitForTimeout(1500);
    const after=await p.evaluate(()=>localStorage.getItem('case:SAMPLE-압구정현대'));
    assert.notEqual(after,before,'고치면 저장');
    assert.deepEqual(p.errs,[]);await ctx.close();console.log('집건 OK');}
  console.log('PASS');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
