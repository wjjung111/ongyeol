// 집건 접수 캡처 평가목적 — 증여·양도·상속·특관자매매 등이면 평가목적 칸 「일반거래(시가참고)」, 상속·증여면 평가구분도 (2026-11-19)
//  단일·여러 호수 화면 값 + 단일 괄감(평가목적 칸)·의견서(「…증여재산에 대한 일반거래(시가참고) 목적의 감정평가임」)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_receipt_purpose.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
const RESULT={caseNo:'ON261116-211401',client:'김순옥',baseDate:'26.11.11',purpose:'증여',submitTo:'세무서, 국세청',deskPrice:130000000,evalCategory:null};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:1700,height:1000}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
      const res=mode==='single'?RESULT:{...RESULT,units:[{dong:'',floor:'4',ho:'402',area:'59.9'}]};
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
      await page.waitForFunction(s=>[...document.querySelectorAll(s+' input')].some(i=>i.value==='세무서, 국세청'),sel);
      const vals=await page.evaluate(s=>[...document.querySelectorAll(s+' input')].map(i=>i.value),sel);
      assert.ok(vals.includes('일반거래(시가참고)'),mode+': 평가목적 일반거래(시가참고) '+JSON.stringify(vals.slice(0,12)));
      assert.ok(vals.includes('증여'),mode+': 평가구분 증여');
      if(mode==='single'){
        // 실제 엔진으로 괄감·주거 의견서·비주거 의견서를 뽑아 파일로 저장(OUT_DIR) + 글자 확인
        const pv=vals.find(v=>v==='일반거래(시가참고)');
        const got=await page.evaluate(async(pv)=>{const map={'평가목적':window.arapPurposeDoc('일반시가(시가참고)','증여')   /* 2026-11-20 옛 저장값도 서류엔 일반거래 */,'평가구분':'증여','의뢰인':'김순옥'};const out={};
          for(const [k,tpl,ids] of [['gwal',V2GWAL_TPL_B64,V2_IDS_SPLIT],['opin',V2OPIN_TPL_B64,V2_IDS_OPIN],['nr',V2NROPIN_TPL_B64,V2_IDS_NR]]){
            const bytes=await buildEvalHwpxV2({...map},tpl,{ids});const u8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes.buffer||bytes);
            out[k]=btoa(Array.from(u8,c=>String.fromCharCode(c)).join(''));}return out;},pv).catch(e=>({err:String(e)}));
        assert.ok(!got.err,got.err);
        const os=require('os'),cp=require('child_process'),dir=process.env.OUT_DIR||os.tmpdir();
        for(const k of ['gwal','opin','nr']){const f=path.join(dir,'purpose_'+k+'.hwpx');fs.writeFileSync(f,Buffer.from(got[k],'base64'));
          const t=cp.execFileSync('unzip',['-p',f,'Contents/section0.xml'],{maxBuffer:1<<28}).toString('utf8').replace(/<[^>]+>/g,'');
          if(k==='gwal')assert.match(t,/평가목적\s*일반거래\(시가참고\)/,'괄감 평가목적 '+t.slice(t.indexOf('평가목적'),t.indexOf('평가목적')+30));
          else{const i=t.indexOf('상속세 및 증여세법');assert.match(t.slice(i,i+80),/증여\s*재산에 대한 일반거래\(시가참고\) 목적의 감정평가임/,k+' 의견서: '+t.slice(i,i+80));}}
        // 평가구분 빈칸 → 「상속세 및 증여세법」에 의한 일반거래(시가참고) 목적 (2026-11-20)
        const bk=await page.evaluate(async()=>{const out={};
          for(const [k,tpl,ids] of [['opin',V2OPIN_TPL_B64,V2_IDS_OPIN],['nr',V2NROPIN_TPL_B64,V2_IDS_NR]]){
            const bytes=await buildEvalHwpxV2({'평가목적':window.arapPurposeDoc('일반거래(시가참고)',''),'평가구분':'','의뢰인':'김옥희'},tpl,{ids});const u8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes.buffer||bytes);
            out[k]=btoa(Array.from(u8,c=>String.fromCharCode(c)).join(''));}return out;}).catch(e=>({err:String(e)}));
        assert.ok(!bk.err,bk.err);
        for(const k of ['opin','nr']){const f=path.join(dir,'purpose_blank_'+k+'.hwpx');fs.writeFileSync(f,Buffer.from(bk[k],'base64'));
          const t=cp.execFileSync('unzip',['-p',f,'Contents/section0.xml'],{maxBuffer:1<<28}).toString('utf8').replace(/<[^>]+>/g,'');
          assert.match(t,/으로서,\s*「상속세 및 증여세법」에 의한 일반거래\(시가참고\) 목적의 감정평가임/,k+' 빈칸 의견서');}
      }
      assert.deepEqual(errors,[]);await ctx.close();console.log('PASS',mode);
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
