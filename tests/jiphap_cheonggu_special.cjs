// 집합건물(단일호수 앱) 청구서 — 특별용역비 방식 드롭다운(상한-하한 / 기준-하한 / 상한-기준 / 직접입력) 자동 차액.
// PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=msedge node tests/jiphap_cheonggu_special.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const FEE=['1  예상평가액  1,775,270,360',
           '2  하한 수수료  1,512,680  10억원 ~ 50억원',
           '3  기준 수수료  1,815,216  10억원 ~ 50억원',
           '4  상한 수수료  2,128,260  10억원 ~ 50억원'].join('\n');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try{
 for(const mode of ['single']){   // 청구서 카드는 단일호수 앱(#root)에만 있다
 const ctx=await browser.newContext();const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});page.on('dialog',d=>d.accept());page.setDefaultTimeout(15000);console.log('START',mode);
 await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
 await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);},{mode});
 await page.goto(base+'/s3r86w8a.html');
 const scope=page.locator(mode==='single'?'#root':'#root-multi');
 await scope.getByText('④ 가격산출',{exact:true}).click({timeout:60000});
 const card=scope;
 const ta=card.locator('textarea[placeholder^="여기에 계산서1"]').first();await ta.fill(FEE);
 const sel=card.locator('select[title*="상한-기준"]');
 const opts=await sel.locator('option').allTextContents();console.log('options',opts);
 assert.deepEqual(opts,['상한-하한','기준-하한','상한-기준','직접입력']);
 const special=card.locator('input[placeholder="계산서 붙여넣으면 자동"], input[placeholder="0"]').first();
 const pick=async v=>{await sel.selectOption(v);await page.waitForTimeout(150);return (await card.locator('input[placeholder="계산서 붙여넣으면 자동"]').first().inputValue());};
 const r={};
 r['상한-하한']=await pick('상한-하한');r['기준-하한']=await pick('기준-하한');r['상한-기준']=await pick('상한-기준');
 console.log(mode,r);
 assert.equal(r['상한-하한'],'615,580');   // 2,128,260 - 1,512,680
 assert.equal(r['기준-하한'],'302,536');   // 1,815,216 - 1,512,680
 assert.equal(r['상한-기준'],'313,044');   // 2,128,260 - 1,815,216
 // 채워진 값은 직접 고칠 수 있다
 const inp=card.locator('input[placeholder="계산서 붙여넣으면 자동"]').first();await inp.fill('313,000');assert.equal(await inp.inputValue(),'313,000');
 assert.equal(errors.length,0);
 await ctx.close();
 }
 console.log('✅ 모두 통과');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error('❌',e);process.exit(1);});
