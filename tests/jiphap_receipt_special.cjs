// 집건 접수 캡처 자동 인식 — 「특용 (기준 - 하한)」 → 특별용역비 방식 드롭다운 자동(2026-11-20 사용자 「특용비 자동인식 못함」)
//  - ArapFee.specialMode 문자열 정리(괄호·띄어쓰기·요율·여러 줄표)
//  - 단일: AI가 feeSpecialMode로 줌 / 여러 호수: AI가 feeSpecial 칸에 방식 글자를 넣어도 읽음 → 둘 다 '기준-하한' + 차액 303,000
//  - 금액만 있으면 직접입력 + 그 금액
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_receipt_special.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// 1) 순수 함수
{const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'arap_fee.js'),'utf8'),ctx);const f=ctx.window.ArapFee.specialMode;
 for(const [i,o] of [['특용 (기준 - 하한)','기준-하한'],['기준-하한','기준-하한'],['상한–하한요율','상한-하한'],['특용비 상한 ~ 기준','상한-기준'],['상한하한','상한-하한'],['기준 − 하한 수수료','기준-하한'],['500000',''],['',''],[null,''],['하한','']])
   assert.equal(f(i),o,JSON.stringify(i));}
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
const FEE=['1  예상평가액  1,775,270,360','2  하한 수수료  1,512,680  10억원 ~ 50억원','3  기준 수수료  1,815,216  10억원 ~ 50억원','4  상한 수수료  2,128,260  10억원 ~ 50억원'].join('\n');
const BASE={caseNo:'ON261117-1632',client:'이영수',baseDate:'26.6.17',purpose:'상속',submitTo:'세무서및국세청',deskPrice:536000000,feeDownPayment:500000,feeBasis:'하한',evalCategory:null};
const CASES=[
  {mode:'single',res:{...BASE,feeSpecial:null,feeSpecialMode:'기준 - 하한'},want:['기준-하한','303,000']},
  {mode:'multi',res:{...BASE,feeSpecial:'(기준 - 하한)',units:[{dong:'103',floor:'4',ho:'403',area:'74.97'}]},want:['기준-하한','303,000']},
  {mode:'single',res:{...BASE,feeSpecial:'150000',feeSpecialMode:null},want:['직접입력','150,000']},
];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const {mode,res,want} of CASES){
      const ctx=await browser.newContext({viewport:{width:1700,height:1000}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();
        if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
        if(u.startsWith('https://api.anthropic.com/'))return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({content:[{type:'text',text:JSON.stringify(res)}]})});
        if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);sessionStorage.setItem('arap-jiphap-mode',mode);localStorage.setItem('v2:appraisal-api-key','sk-test');},{mode});
      await page.goto(base+'/s3r86w8a.html');
      const sel=mode==='single'?'#root':'#root-multi',sc=page.locator(sel);
      await sc.locator('.up-box').waitFor();
      await page.evaluate(()=>{const dt=new DataTransfer();const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));dt.items.add(new File([png],'image.png',{type:'image/png'}));document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
      await sc.getByRole('button',{name:/자동 인식/}).click();
      await page.waitForFunction(s=>[...document.querySelectorAll(s+' input')].some(i=>i.value==='세무서및국세청'),sel);
      await sc.getByText('3. 위치도 · 청구서',{exact:true}).click();
      await sc.locator('textarea[placeholder*="계산서1"]').first().fill(FEE);
      await page.waitForTimeout(300);
      const modeSel=sc.locator('select[title*="상한-기준"]');
      const got=[await modeSel.inputValue(),await sc.locator('tr',{hasText:'특별용역비'}).last().locator('input').first().inputValue()];
      console.log(mode,JSON.stringify(res.feeSpecialMode??res.feeSpecial),'→',got);
      assert.deepEqual(got,want,mode);
      assert.deepEqual(errors,[]);await ctx.close();
    }
    console.log('✅ 모두 통과');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error('❌',e);process.exit(1);});
