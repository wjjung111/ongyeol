// 집건 요약 띠 「지금 결과」(결정단가·감정평가액·탁상 대비) — 스크롤해서 화면 위로 사라지면 위쪽에 떠서 계속 보임(2026-11-20 사용자)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_result_float.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:1700,height:900}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);sessionStorage.setItem('arap-jiphap-mode',mode);},{mode});
      await page.goto(base+'/s3r86w8a.html');
      const sc=page.locator(mode==='single'?'#root':'#root-multi');
      if(mode==='multi'){
        // 여러 호수엔 샘플이 없어 단일 샘플 저장본을 여러 호수 저장소에 한 호짜리로 옮겨 연다
        await page.evaluate(()=>{const raw=localStorage.getItem('case:SAMPLE-압구정현대');const d=JSON.parse(raw);d.ov={...d.ov,caseNo:'FLOAT-TEST',units:[{dong:d.ov.dong,floor:d.ov.floor,ho:d.ov.ho,area:d.ov.area}]};
          localStorage.setItem('v2:case:FLOAT-TEST',JSON.stringify(d));const L=JSON.parse(localStorage.getItem('v2:appraisal-case-list')||'[]');L.unshift({id:'FLOAT-TEST',label:'FLOAT-TEST 현대아파트',updated:new Date().toISOString()});localStorage.setItem('v2:appraisal-case-list',JSON.stringify(L));});
        await page.reload();
      }
      await sc.locator('.jr-item').filter({hasText:mode==='single'?'SAMPLE-압구정현대':'FLOAT-TEST'}).click();
      await sc.locator('.js-nm',{hasText:'현대아파트'}).waitFor();
      await sc.getByText('2. 사례 · 가격산출',{exact:true}).click();
      await sc.locator('.js-row .js-grp.res').waitFor();
      assert.equal(await sc.locator('.js-float').count(),0,mode+': 맨 위에서는 떠 있는 상자 없음');
      // 본문 맨 아래로(단일 = 가운데 칸 안쪽 스크롤, 여러 호수 = 페이지 스크롤 — 둘 다 내림)
      await page.evaluate(()=>{for(const el of document.querySelectorAll('div')){if(el.scrollHeight>el.clientHeight+50&&/(auto|scroll)/.test(getComputedStyle(el).overflowY))el.scrollTop=el.scrollHeight;}window.scrollTo(0,document.body.scrollHeight);});
      const fl=sc.locator('.js-float');await fl.waitFor({state:'visible'});
      const t=await fl.innerText();console.log(mode,JSON.stringify(t.replace(/\s+/g,' ')));
      assert.match(t,/감정평가액/);if(mode==='single')assert.match(t,/결정단가/);
      const box=await fl.boundingBox(),mb=await page.locator('#mode-bar').boundingBox();
      assert.ok(box.y>=mb.y+mb.height-1&&box.y<mb.y+mb.height+20,mode+': 위쪽(상단 바 바로 아래) '+JSON.stringify(box));
      await page.screenshot({path:path.join(process.env.SHOT_DIR||require('os').tmpdir(),'result_float_'+mode+'.png')});
      // 다시 위로 올리면 사라짐
      await page.evaluate(()=>{for(const el of document.querySelectorAll('div'))el.scrollTop=0;window.scrollTo(0,0);});
      await fl.waitFor({state:'detached'});
      assert.deepEqual(errors,[]);await ctx.close();console.log('PASS',mode);
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error('❌',e);process.exit(1);});
