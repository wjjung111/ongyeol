// 집건 단일 청구서 — 면적 옵션이 「지분평가」일 때만 수수료 배수(1.1·1.5) 드롭다운이 뜨고 평가수수료에 곱해지는지
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_fee_mul.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
const num=s=>Number(String(s).replace(/[^\d]/g,''));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)||u.includes('cdn')||u.includes('unpkg')?r.continue():r.abort();});
    await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');});
    await page.goto(base+'/s3r86w8a.html?last=1');
    const scope=page.locator('#root');
    // 샘플은 지분평가 아님 → 할증 칸 없음
    await scope.getByText('4. 가격산출',{exact:true}).click({timeout:60000});
    const right=scope.locator('.k4-right');
    assert(!(await right.innerText()).includes('지분평가 할증'),'지분평가 아니면 할증 칸 없음');
    const feeRow=async()=>num((await right.innerText()).match(/평가수수료[^\d]*([\d,]{5,})/)[1]);
    const base0=await feeRow();
    // 지분평가로 바꾸기(② 대상물건개요의 면적 옵션) 대신 저장 데이터 조작은 위험하니 UI 선택
    await scope.getByText('2. 대상물건개요',{exact:false}).first().click();
    const sel=scope.locator('select:has(option[value="share"])').first();
    await sel.selectOption('share');
    await scope.locator('input[placeholder="분자"]').fill('1');
    await scope.locator('input[placeholder="분모"]').fill('2');
    await scope.getByText('4. 가격산출',{exact:true}).click();
    const mul=right.locator('select:has(option:text("×1.5배"))');
    await mul.waitFor();
    const sh=await feeRow();   // 지분 감정평가액 기준 수수료(배수 1)
    await mul.selectOption('1.5');await page.waitForTimeout(300);
    const m15=await feeRow();
    const fee1=sh;assert(m15>fee1,'1.5배 > 1배: '+fee1+' → '+m15);
    assert(Math.abs(m15-fee1*1.5)<=1000,'1.5배(천원 절사): '+fee1+' → '+m15);
    await mul.selectOption('1.1');await page.waitForTimeout(300);
    assert(Math.abs(await feeRow()-fee1*1.1)<=1000,'1.1배');
    console.log('base',base0,'지분 1배',fee1,'1.1배',await feeRow(),'1.5배',m15);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
