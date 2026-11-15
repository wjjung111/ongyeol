// 집건 「📦 일괄 받기」 (2026-11-15) + 평가목적 자산재평가면 의견서 목적 문장이 외부감사법(arap_purpose_law.js) — 단일: 표지·괄감·의견서·요항표·명세표 5개 / 여러 호수(주거용): 감정평가서+명세표 2개
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_dl_all.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL,env:{...process.env,LANG:'C.UTF-8'}});
  try{
    for(const [mode,want] of [['single',['1. 표지','2. 감정평가표(괄감)','3. 의견서(산출근거)','5. 요항표','4. 명세표']],['multi',['1. 감정평가서','4. 명세표']]]){
      const ctx=await browser.newContext({viewport:{width:1800,height:1000},acceptDownloads:true}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);page.on('dialog',d=>d.accept());
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(({mode})=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');
        localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);sessionStorage.setItem('arap-jiphap-mode',mode);const pre=mode==='multi'?'v2:':'';
        localStorage.setItem(pre+'appraisal-case-list',JSON.stringify([{id:'T',label:'t'}]));
        localStorage.setItem(pre+'case:T',JSON.stringify({ov:{caseNo:'T',jibun:'서울특별시 강남구 압구정동 456',buildingName:'현대',dong:'77',floor:'9',ho:'904',area:'144.2',
          units:[{id:1,dong:'77',floor:'9',ho:'904',area:'144.2'},{id:2,dong:'77',floor:'10',ho:'1004',area:'144.2'}],baseDate:'2026.11.03',writeDate:'2026.11.03',client:'테스트',purpose:'자산재평가',floorDetail:'1층 100㎡'},
          cases:[],precs:[],propType:'주거용'}));
      },{mode});
      await page.goto(base+'/s3r86w8a.html?last=1');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      await scope.getByText('3. 위치도 · 청구서',{exact:true}).click();
      const btn=scope.getByRole('button',{name:'📦 일괄 받기'});
      await btn.waitFor();await page.waitForFunction(b=>!b.disabled,await btn.elementHandle(),{timeout:20000});
      const names=[],files={};page.on('download',async d=>{const n=d.suggestedFilename();names.push(n);files[n]=await d.path();});
      await btn.click();
      for(let t=0;t<100&&names.length<want.length;t++)await page.waitForTimeout(200);
      await page.waitForTimeout(800);
      assert.deepEqual(names.map(n=>n.replace(/_.*$/,'')),want,mode+' '+names.join(' | '));
      assert.ok(await btn.isEnabled(),'다 받은 뒤 버튼 다시 켜짐');
      // 평가목적 자산재평가 → 의견서 「1. 감정평가의 목적」이 외부감사법 문구 (2026-11-15)
      const op=names.find(n=>/^(3\. 의견서|1\. 감정평가서)/.test(n));
      for(let t=0;t<50&&!files[op];t++)await page.waitForTimeout(100);
      const x=require('child_process').execFileSync('unzip',['-p',files[op],'Contents/section*.xml'],{maxBuffer:1<<28}).toString().replace(/<[^>]+>/g,'');
      assert.match(x,/「주식회사 등의 외부감사에 관한 법률」상 유형자산에 대한 자산재평가 목적의 감정평가임/,mode+' 목적 문장');
      assert.ok(!x.includes('「상속세 및 증여세법」상'),mode+' 상증세법 문구 없음');
      assert.deepEqual(errors,[]);await ctx.close();console.log(mode,'OK',names.join(' | '));
    }
    console.log('jiphap_dl_all OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
