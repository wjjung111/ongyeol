// 집합건물 앱 오른쪽 메모장 — 이미지 붙여넣기가 새로고침 뒤에도 남는지(단일·여러호수)
//  - 큰 화면 캡처(PNG ~2MB)를 붙여넣으면 줄여서(JPEG, 긴 변 1600px) 저장 → 저장 공간을 거의 안 먹고 새로고침해도 남는다
//  - 브라우저 저장 공간이 가득 차 저장에 실패하면 조용히 넘어가지 않고 빨간 안내 + 경고창, 공간을 비우고 [다시 저장]하면 저장됨
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_memo_image.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  try{
    for(const mode of ['single','multi']){
      const pre=mode==='multi'?'v2:':'';
      const ctx=await browser.newContext({viewport:{width:1700,height:900}}),page=await ctx.newPage(),errors=[],dialogs=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(({mode,pre})=>{if(localStorage.getItem('arap-user-name'))return;
        localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);
        localStorage.setItem(pre+'appraisal-case-list',JSON.stringify([{id:'T',label:'t'}]));
        localStorage.setItem(pre+'case:T',JSON.stringify({ov:{caseNo:'T',jibun:'서울 중구 87'},cases:[],precs:[],propType:'주거용'}));},{mode,pre});
      await page.goto(base+'/s3r86w8a.html');
      const ta=page.locator('textarea[placeholder*="Enter / 이미지"]:visible').first();await ta.waitFor();
      const paste=()=>ta.evaluate(async el=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const x=c.getContext('2d');const d=x.createImageData(1600,900);for(let i=0;i<d.data.length;i+=4){const v=(Math.random()*40+100)|0;d.data[i]=v;d.data[i+1]=v+20;d.data[i+2]=v+5;d.data[i+3]=255;}x.putImageData(d,0,0);
        const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'a.png',{type:'image/png'}));el.focus();el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));return blob.size;});
      const memoLen=()=>page.evaluate(k=>{const v=localStorage.getItem(k);return v?v.length:0;},pre+'appraisal-memo:T');

      // 1) 큰 캡처 붙여넣기 → 줄여서 저장, 새로고침 뒤에도 남음
      const orig=await paste();assert.ok(orig>1500000,'테스트 이미지는 큰 PNG여야 함 '+orig);
      await page.waitForFunction(k=>!!localStorage.getItem(k),pre+'appraisal-memo:T');
      const len=await memoLen();assert.ok(len<orig*0.6,`줄여서 저장돼야 함: 원본 ${orig}B → 저장 ${len}자`);
      await page.reload();const ta2=page.locator('textarea[placeholder*="Enter / 이미지"]:visible').first();await ta2.waitFor();await page.waitForTimeout(500);
      assert.equal(await page.locator('img[src^="data:image/jpeg"]:visible').count(),1,'새로고침 뒤 이미지 메모가 남아야 함');
      assert.deepEqual(dialogs,[]);

      // 2) 저장 공간 가득 → 조용히 사라지지 않고 안내
      await page.evaluate(()=>{try{let i=0;const chunk='x'.repeat(100000);while(true){localStorage.setItem('zz_fill_'+i,chunk);i++;}}catch(e){}try{let j=0;while(true){localStorage.setItem('zz_fillb_'+j,'x'.repeat(500));j++;}}catch(e){}});
      await page.locator('textarea[placeholder*="Enter / 이미지"]:visible').first().evaluate(()=>{});
      await paste();
      await page.waitForFunction(()=>true);
      await page.locator('text=저장 공간이 가득').first().waitFor();
      assert.equal(dialogs.length,1,'저장 실패 경고창');assert.ok(/저장 공간이 가득/.test(dialogs[0]));

      // 3) 공간을 비우고 [다시 저장] → 저장됨, 안내 사라짐
      await page.evaluate(()=>{Object.keys(localStorage).filter(k=>k.startsWith('zz_fill')).forEach(k=>localStorage.removeItem(k));});
      await page.getByRole('button',{name:'다시 저장'}).click();
      await page.waitForTimeout(300);
      assert.equal(await page.locator('text=저장 공간이 가득').count(),0);
      await page.reload();await page.locator('textarea[placeholder*="Enter / 이미지"]:visible').first().waitFor();await page.waitForTimeout(500);
      assert.equal(await page.locator('img[src^="data:image/jpeg"]:visible').count(),2,'다시 저장한 뒤 새로고침해도 이미지 2장');

      assert.deepEqual(errors,[]);
      console.log(mode+': PASS 큰 캡처 줄여 저장·새로고침 유지, 저장 공간 가득 시 안내+경고, 다시 저장');
      await ctx.close();
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
