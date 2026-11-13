// 공부서류 업로드 칸에 캡처 이미지 Ctrl+V 붙여넣기 검증(2026-11-13) — 집건 단일·여러 호수 + 토지건물
//  - 업로드 칸이 보일 때 화면(입력칸 밖)에 이미지를 붙여넣으면 파일 목록에 「붙여넣은캡처_….png」로 추가
//  - 다른 입력칸(예: 접수번호 칸)에 커서가 있을 때 붙여넣으면 가로채지 않음 / 업로드 칸이 안 보이는 탭에서도 무시
//  - 글자만 붙여넣으면 무시
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/upload_paste.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
// 페이지 안에서 진짜 paste 이벤트를 만든다(클립보드에 이미지 파일 1개 또는 글자)
const paste=(page,sel,kind)=>page.evaluate(({sel,kind})=>{
  const dt=new DataTransfer();
  if(kind==='image'){const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));dt.items.add(new File([png],'image.png',{type:'image/png'}));}
  else dt.setData('text/plain','접수 번호: ON261111-3202');
  const t=sel?document.querySelector(sel):document.body;if(sel)t.focus();
  const ev=new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true});t.dispatchEvent(ev);return ev.defaultPrevented;
},{sel,kind});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:1700,height:1000}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);},{mode});
      await page.goto(base+'/s3r86w8a.html');
      const sc=page.locator(mode==='single'?'#root':'#root-multi');
      const box=sc.locator('.up-box');await box.waitFor();
      const chips=()=>box.locator('span',{hasText:'📎'}).allInnerTexts();
      assert.equal((await chips()).length,0);
      // 1) 화면에 이미지 붙여넣기 → 추가
      assert.equal(await paste(page,null,'image'),true,mode+': 이미지 붙여넣기를 받아야 함');
      await page.waitForTimeout(100);
      let c=await chips();assert.equal(c.length,1,mode+': 파일 1개');assert.match(c[0],/붙여넣은캡처_\d{6}\.png/);
      assert.match(await box.innerText(),/붙여넣은 이미지 1개를 추가했습니다/);
      // 2) 글자만 붙여넣기 → 무시
      assert.equal(await paste(page,null,'text'),false,mode+': 글자는 무시');
      // 3) 다른 입력칸(접수번호)에 커서 → 가로채지 않음
      const caseNo=(mode==='single'?'#root':'#root-multi')+' input[placeholder="HI260305-2601"]';
      assert.equal(await paste(page,caseNo,'image'),false,mode+': 입력칸 몫은 가로채지 않음');
      // 4) 다른 탭(업로드 칸 안 보임) → 무시
      await sc.locator('.js-tab').nth(1).click();
      assert.equal(await paste(page,null,'image'),false,mode+': 다른 탭에서는 무시');
      await sc.locator('.js-tab').nth(0).click();
      // 5) 두 번째 이미지 → 이름이 겹치지 않음
      await paste(page,null,'image');await page.waitForTimeout(100);
      c=await chips();assert.equal(c.length,2);assert.notEqual(c[0],c[1],'파일 이름이 겹치지 않음');
      assert.deepEqual(errors,[]);await ctx.close();console.log('PASS 집건',mode);
    }
    // 토지건물
    {
      const ctx=await browser.newContext({viewport:{width:1600,height:1000}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await ctx.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');});
      await page.goto(base+'/'+encodeURI('토지건물.html'),{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.ArapTojiUpload);
      const visible=await page.locator('#upCard').isVisible();
      if(!visible){console.log('토지건물: 업로드 칸이 첫 화면에 안 보임 — 붙여넣기 무시 확인만');assert.equal(await paste(page,null,'image'),false);}
      else{
        assert.equal(await paste(page,null,'image'),true,'토건: 이미지 붙여넣기');
        assert.equal(await page.locator('#up_list span.del').count(),1);
        assert.match(await page.textContent('#up_list'),/붙여넣은캡처_\d{6}\.png/);
        assert.match(await page.textContent('#up_dropHint'),/붙여넣은 이미지 1개/);
        await page.evaluate(()=>{const i=[...document.querySelectorAll('input[type=text],input:not([type]),textarea')].find(e=>e.offsetParent&&!document.getElementById('upCard').contains(e));i.id=i.id||'__outsideInput';window.__outId=i.id;});
        const outId=await page.evaluate(()=>window.__outId);
        assert.equal(await paste(page,'#'+outId,'image'),false,'토건: 업로드 칸 밖 입력칸 몫은 가로채지 않음');
      }
      assert.deepEqual(errors,[]);await ctx.close();console.log('PASS 토지건물');
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
