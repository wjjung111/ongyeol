// Isolated browser regression for editable precedent pricing and saved calculation basis.
// PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=msedge node tests/jiphap_prec_pricing.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try{
 for(const mode of ['single','multi']){
 const ctx=await browser.newContext();const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});page.on('dialog',d=>{console.log('DIALOG',d.message());d.accept()});page.setDefaultTimeout(15000);console.log('START',mode);
 await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
 await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);const prefix=mode==='multi'?'v2:':'';if(localStorage.getItem(prefix+'case:TEST-PREC'))return;
 const row={id:'test-1',selected:'a',location:'테스트동',jibun:'1',exclusiveArea:'',appraiseAmount:'',unitPrice:'',buildingName:'검증',baseDate:'2026.01.01',purpose:'일반거래',isShown:true};
 localStorage.setItem(prefix+'appraisal-case-list',JSON.stringify([{id:'TEST-PREC',label:'입력 검증'}]));localStorage.setItem(prefix+'case:TEST-PREC',JSON.stringify({ov:{caseNo:'TEST-PREC',jibun:'서울특별시 강남구 테스트동 1',units:[],area:'100',baseDate:'2026.09.17',writeDate:'2026.09.17'},precs:[row,{...row,id:'test-2',selected:'b',exclusiveArea:50,appraiseAmount:300000000,unitPrice:6000000}],cases:[],propType:'주거용'}));},{mode});
 await page.goto(base+'/s3r86w8a.html');console.log('LOADED');const scope=page.locator(mode==='single'?'#root':'#root-multi');await scope.getByText('③ 사례 등 입력',{exact:true}).click({timeout:60000});
 const area=scope.getByRole('textbox',{name:'평가사례 전유면적(㎡)',exact:true}).first();const amount=scope.getByRole('textbox',{name:'평가사례 사례가격(천원)',exact:true}).first();const unit=scope.getByRole('textbox',{name:'평가사례 단가(원/㎡)',exact:true}).first();
 const value=async el=>Number((await el.inputValue()).replace(/,/g,''));const set=async(el,v)=>{await el.fill(v);await el.blur();};
 await set(area,'100');await set(amount,'500000');assert.equal(await value(unit),5000000);
 await set(amount,'600000');assert.equal(await value(unit),6000000);
 await set(area,'80');assert.equal(await value(unit),7500000);assert.equal(await value(amount),600000);
 await set(unit,'8000000');assert.equal(await value(amount),640000);
 await set(area,'90');assert.equal(await value(amount),720000);assert.equal(await value(unit),8000000);
 const key=(mode==='multi'?'v2:':'')+'case:TEST-PREC';await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).precs[0].appraiseAmount===720000000,key,{timeout:10000});
 await page.reload();await scope.getByText('③ 사례 등 입력',{exact:true}).click();await set(area,'100');assert.equal(await value(amount),800000);assert.equal(await value(unit),8000000);
 await area.fill('');await area.pressSequentially('84.95');assert.equal(await area.inputValue(),'84.95');await area.blur();await set(unit,'1234567');assert.equal(await value(amount),104876.467);
 await set(amount,'123456.789');assert.equal(await value(unit),Math.round(123456789/84.95));
 await set(area,'0');assert.equal(await unit.inputValue(),'');assert.equal(await value(amount),123456.789);
 await set(area,'');assert.equal(await unit.inputValue(),'');await set(amount,'');await set(unit,'2000000');assert.equal(await amount.inputValue(),'');await set(area,'50');assert.equal(await value(amount),100000);
 assert.equal(await value(scope.getByRole('textbox',{name:'평가사례 사례가격(천원)',exact:true}).nth(1)),300000);
 assert.equal(await value(scope.getByRole('textbox',{name:'평가사례 단가(원/㎡)',exact:true}).nth(1)),6000000);
 await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).precs[0].appraiseAmount===100000000,key,{timeout:10000});const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).precs[0],key);assert.equal(saved.unitPrice,2000000);assert.equal(saved.exclusiveArea,50);assert.equal(saved.priceBasis,'unit');
 assert.deepEqual(errors,[]);console.log(mode+': PASS price/area/unit edits, both input orders, decimals, zero/blank, reload/basis persistence, independent rows, no page errors');await ctx.close();
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
