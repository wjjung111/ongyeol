// 집건 접수 캡처 자동 인식 — 평가목적·제출처·탁상가격(가평가) 채움 검증(2026-11-15)
//  - 단일 호수: 「가평가 9억 희망」 → 탁상가격 900,000,000 · 평가목적 담보 · 제출처 삼성전자, 주황 「자동」 표시
//  - 여러 호수: 평가목적·제출처 채움, 호가 하나면 그 호 탁상가격에 9억
//  - 위치도 지적선 체크 기본 해제(집건 단일·여러 호수)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_receipt_fields.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
const RESULT={caseNo:'ON261111-2002',client:'이미화',baseDate:'2026.11.11',purpose:'담보',submitTo:'삼성전자',deskPrice:900000000,feeDownPayment:300000,feeBasis:'하한',evalCategory:null};
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
      await page.waitForFunction(s=>[...document.querySelectorAll(s+' input')].some(i=>i.value==='삼성전자'),sel);
      const vals=await page.evaluate(s=>[...document.querySelectorAll(s+' input')].map(i=>i.value),sel);
      assert.ok(vals.includes('담보'),mode+': 평가목적 담보');
      assert.ok(vals.includes('삼성전자'),mode+': 제출처 삼성전자');
      assert.ok(vals.includes('900,000,000'),mode+': 탁상가격 9억 '+JSON.stringify(vals.filter(v=>/\d{3},\d{3}/.test(v))));
      const html=await sc.innerHTML();
      if(mode==='single')for(const l of ['평가목적','제출처','탁상가격'])assert.match(html,new RegExp(l+'<span[^>]*>자동'),mode+': '+l+' 자동 표시');
      // 위치도 지적선 기본 해제
      const cad=await page.evaluate(m=>{const e=document.getElementById('mapCadastre'+(m==='single'?'':'M'));return e?e.checked:null;},mode);
      if(cad!==null)assert.equal(cad,false,mode+': 지적선 기본 해제');
      if(mode==='single'){
        // 의견서(비주거 템플릿 — 전역에 노출된 것) 6-라: 담보 목적이면 「일반거래나 소송 등」, 일반거래면 원문 그대로
        const txt=await page.evaluate(async()=>{const out={};for(const p of ['담보','일반거래(시가참고)']){const map={'평가목적':p};
          const bytes=await buildEvalHwpxV2(map,V2NROPIN_TPL_B64,{ids:V2_IDS_NR});const u8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes.buffer||bytes);
          const s=new TextDecoder().decode(u8).replace(/<[^>]+>/g,'');const k=s.indexOf('라. 본건은');out[p]=k<0?'':s.slice(k,k+80);}return out;}).catch(e=>({err:String(e)}));
        assert.ok(!txt.err,txt.err);
        assert.match(txt['담보'],/담보 목적의 감정평가로서, 일반거래나 소송 등 다른 목적/,'담보: '+txt['담보']);
        assert.match(txt['일반거래(시가참고)'],/일반거래\(시가참고\) 목적의 감정평가로서, 담보나 소송 등 다른 목적/,'일반거래: '+txt['일반거래(시가참고)']);
        // 화면 「의견서 문구」 박스의 라. 도 같은 문장
        assert.match(await sc.innerText(),/담보 목적의 감정평가로서, 일반거래나 소송 등/,'화면 라. 문구');
      }
      assert.deepEqual(errors,[]);await ctx.close();console.log('PASS',mode,'(지적선 칸',cad===null?'미표시':'해제',')');
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
