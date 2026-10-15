// 입주권 「💾 저장」 — 집건과 같은 규칙(arap_casebak.js, pre "ipj:")
//  ① 새 평가서는 접수번호를 쳐도 저장 안 함 → 💾 저장 누르면 그때부터 저장
//  ② 저장된 건의 번호 칸만 고치면 원래 번호로 계속 저장, 「💾 번호 바꿔 저장」 = 이름 바꾸기(옛 번호 건 없어짐)
//  ③ 이미 있는 번호로 💾 저장 → 거절(덮어쓰지 않음)  ④ 다른 내용을 덮어쓰면 「↺ 이전 버전」에 보관 → 되돌리기
// node tests/ipj_save_button.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[],dialogs=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});page.setDefaultTimeout(20000);
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(url)?r.continue():r.abort();});
  await page.addInitScript(()=>{try{if(!sessionStorage.getItem('seeded')){localStorage.clear();localStorage.setItem('arap-user-name','wdw');sessionStorage.setItem('seeded','1');}}catch(e){}});
  const ls=k=>page.evaluate(k=>localStorage.getItem(k),k);
  const caseOf=async id=>JSON.parse(await ls('ipj:case:'+id)||'null');
  const fld=label=>page.locator(`div:has(> span:text-is("${label}")) input`).first();
  try{
    await page.goto(url+'/입주권.html',{waitUntil:'domcontentloaded'});await page.waitForSelector('text=④ 가격산출',{timeout:60000});
    // ① 새 평가서 — 번호를 쳐도 저장 안 함
    await page.getByRole('button',{name:'+ 새 평가서'}).click();
    assert(await page.locator('.unsaved-msg').isVisible(),'저장 안 됨 안내');
    await page.click('text=② 접수개요');
    await fld('접수번호').fill('ON1');await fld('의뢰인').fill('홍길동');
    await page.waitForTimeout(1200);
    assert.equal(await ls('ipj:case:ON1'),null,'💾 전엔 저장 안 함');
    await page.getByRole('button',{name:'💾 저장 (ON1)'}).click();
    await page.waitForTimeout(600);
    assert.equal((await caseOf('ON1')).ov.client,'홍길동','💾 뒤 저장');
    assert(JSON.parse(await ls('ipj:case-list')).some(c=>c.id==='ON1'),'목록(ipj:case-list)에 올라감');
    console.log('① OK');
    // ② 번호 칸만 고치면 원래 번호로 계속 저장
    await fld('접수번호').fill('ON12');await fld('의뢰인').fill('김철수');
    await page.waitForTimeout(1200);
    assert.equal(await ls('ipj:case:ON12'),null,'고친 번호로 새 건 안 생김');
    const c1=await caseOf('ON1');assert.equal(c1.ov.client,'김철수','원래 번호로 계속 저장');assert.equal(c1.ov.caseNo,'ON1','저장된 caseNo는 확정 번호');
    assert(await page.getByText('접수번호 변경 대기: ON1 → ON12').isVisible(),'변경 대기 안내');
    await page.getByRole('button',{name:'💾 번호 바꿔 저장'}).click();
    await page.waitForTimeout(600);
    assert.equal(await ls('ipj:case:ON1'),null,'옛 번호 건 없어짐');
    assert.equal((await caseOf('ON12')).ov.client,'김철수','새 번호로 옮김');
    const L=JSON.parse(await ls('ipj:case-list')).map(c=>c.id);assert(L.includes('ON12')&&!L.includes('ON1'),'목록 이름 바꿈');
    console.log('② OK');
    // ③ 이미 있는 번호 거절
    await page.getByRole('button',{name:'+ 새 평가서'}).click();
    await page.click('text=② 접수개요');
    await fld('접수번호').fill('ON12');await fld('의뢰인').fill('덮어쓰면안됨');
    dialogs.length=0;await page.getByRole('button',{name:'💾 저장 (ON12)'}).click();await page.waitForTimeout(600);
    assert(dialogs.some(m=>m.includes('이미 있습니다')),'거절 안내');
    assert.equal((await caseOf('ON12')).ov.client,'김철수','덮어쓰지 않음');
    console.log('③ OK');
    // ④ 이전 버전 — ON12를 열고, 다른 창이 쓴 것처럼 저장소를 바꾼 뒤 이 화면에서 고치면 직전 내용이 보관됨
    await page.getByRole('button',{name:/📂 저장된 건/}).click();
    await page.locator('tr:has-text("ON12") >> text=열기').click();
    await page.evaluate(()=>{const k='ipj:case:ON12',o=JSON.parse(localStorage.getItem(k));o.ov.client='다른창';o.ov.owner='다른창 소유자';o.ov.projName='다른 사업';localStorage.setItem(k,JSON.stringify(o));});
    await page.click('text=② 접수개요');await fld('의뢰인').fill('이 화면');
    await page.waitForTimeout(800);
    assert.equal((await caseOf('ON12')).ov.client,'이 화면');
    const ring=JSON.parse(await ls('ipj:appraisal-bak:ON12')||'[]');
    assert(ring.length>=1&&JSON.parse(ring[0].raw).ov.client==='다른창','덮어쓰기 직전 내용 보관');
    await page.getByRole('button',{name:/📂 저장된 건/}).click();
    await page.locator('.bak-btn').first().click();
    await page.locator('.bak-restore').first().click();await page.waitForTimeout(800);
    assert.equal(await fld('의뢰인').inputValue(),'다른창','되돌리기 → 화면에도');
    assert.equal((await caseOf('ON12')).ov.client,'다른창','되돌리기 → 저장소');
    console.log('④ OK');
    // 새로 열어도 마지막 건 복원
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('text=④ 가격산출',{timeout:60000});
    await page.waitForTimeout(800);
    assert.equal(await page.locator('.unsaved-msg').count(),0,'새로고침 뒤 마지막 건(ON12) 복원 — 저장 안 됨 안내 없음');
    assert.equal((await caseOf('ON12')).ov.client,'다른창','열기만 해도 내용 그대로');
    assert.deepEqual(errors,[]);console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
