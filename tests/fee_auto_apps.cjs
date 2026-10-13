// 감정평가수수료 자동 계산 — 집합건물(단일·여러호수)·입주권 청구서: 계산서를 안 붙여도 감정평가액으로 평가수수료가 채워지는지
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/fee_auto_apps.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
global.window={};require(path.join(root,'arap_fee.js'));const F=window.ArapFee;
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
const num=s=>Number(String(s).replace(/[^\d]/g,''));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    // ① 집합건물 — 대표 샘플(압구정, 계산서가 들어 있음) → 「자동 계산과 같음」, 계산서를 비우면 자동 계산으로 같은 평가수수료
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);},{mode});
      await page.goto(base+'/s3r86w8a.html');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      await scope.getByText('4. 가격산출',{exact:true}).click({timeout:60000});
      const right=scope.locator('.k4-right');
      const ta=scope.locator('textarea[placeholder*="계산서1"]').first();
      const feeRow=async()=>{const t=await right.innerText();const m=t.match(/평가수수료[^\d]*([\d,]{5,})/);return m?num(m[1]):null;};
      if(mode==='single'){
        assert((await ta.inputValue()).includes('하한 수수료'),'샘플에 계산서 있음');
        const rt=await right.innerText();assert(rt.includes('자동 계산과 같음'),'샘플 계산서 = 자동 계산: '+rt.slice(0,700));
      }
      const pasted=await feeRow();
      await ta.fill('');await page.waitForTimeout(300);
      const t=await right.innerText();
      if(mode==='multi'){   // 여러호수 샘플은 사례가 없어 합계 미완료 — 합계가 정해지기 전에는 기다림 안내(화면 합계 행과 같은 계산)
        assert(t.includes('감정평가액이 정해지면'),'multi 대기 안내');assert.equal(await feeRow(),null);
        assert.deepEqual(errors,[]);await ctx.close();console.log('multi 대기 안내 OK');continue;}
      assert(t.includes('평가수수료 자동 계산'),mode+' 상태 '+t.slice(0,300));
      const m=t.match(/예상평가액\s*([\d,]+)원/);assert(m,mode+' 예상평가액 표시: '+t.slice(0,400));
      const amt=num(m[1]),a=F.calc(amt);
      assert(t.includes(a.하한수수료.toLocaleString('ko-KR'))&&t.includes(a.기준수수료.toLocaleString('ko-KR')),mode+' 하한·기준 표시');
      const auto=await feeRow();
      assert.equal(auto,Math.floor(a.하한수수료/1000)*1000,mode+' 평가수수료 = 하한 천원 미만 절사');
      if(mode==='single')assert.equal(auto,pasted,'샘플: 붙여넣은 계산서와 자동 계산의 평가수수료 같음');
      console.log(mode,'예상평가액',amt,'평가수수료',auto);
      assert.deepEqual(errors,[]);
      await ctx.close();
    }
    // ② 입주권 — 샘플(방배)에서 계산서 없이 평가수수료 칸이 자동 계산값(하한)으로
    {
      const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
      await page.goto(base+'/입주권.html',{waitUntil:'domcontentloaded'});
      await page.waitForSelector('text=④ 가격산출',{timeout:60000});
      await page.click('text=④ 가격산출');
      const auto=page.locator('text=자동 계산: 예상평가액').first();await auto.waitFor();
      const t=await auto.innerText();const amt=num(t.match(/예상평가액\s*([\d,]+)원/)[1]),a=F.calc(amt);
      assert(t.includes(a.하한수수료.toLocaleString('ko-KR')),'입주권 하한 표시 '+t);
      const fv=await page.evaluate(()=>{const td=[...document.querySelectorAll('td')].find(x=>x.textContent.trim().startsWith('평가수수료'));const inp=td&&td.parentElement.querySelector('input');return inp?inp.value:null;});
      assert.equal(num(fv),a.하한수수료,'입주권 평가수수료 칸 = 하한(칸에는 원 단위, 청구서 계산에서 천원 미만 절사)');
      console.log('입주권 예상평가액',amt,'평가수수료 칸',fv);
      assert.deepEqual(errors,[]);
      await ctx.close();
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
