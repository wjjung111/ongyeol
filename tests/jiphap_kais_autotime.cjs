// 집합건물 ③ 거래사례 카이스 붙여넣기 — 건물명에서 호·층 떼기(「이스트리버빌 203호」 → 이스트리버빌),
// 붙여넣는 순간 시점수정치 자동(주거 매매가격지수, 카이스 시군구로 지역) + 칸 아래 근거 「자동 · 연립다세대 · 서울 동남권 · 26.07~26.10」 (2026-11-24, 단일·여러호수)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_kais_autotime.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const H='상세물건번호\t시군구\t소재지\t지번\t상세물건구분\t지목\t용도지역\t기타주소\t거래시점\t전체면적\t전용면적\t물건금액\t단가\t사용승인일자';
const TSV=[H,
  '1\t서울특별시 강동구\t 성내동\t501-6\t건물\t대\t제2종일반주거지역\t이스트리버빌 203호\t2026-08-21\t47.02\t47.02\t520,000,000\t11,059,123\t2023-12-20',
  '2\t서울특별시 강동구\t 성내동\t221-1\t건물\t대\t제2종일반주거지역\t에버빌 4층 401호\t2026-05-06\t42.32\t42.32\t490,000,000\t11,578,449\t2015-08-04'].join('\n');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:1500,height:950}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-sjidx-kind','연립다세대');(localStorage.setItem('arap-jiphap-mode',mode),sessionStorage.setItem('arap-jiphap-mode',mode));},{mode});
      await page.goto(base+'/s3r86w8a.html');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      // 개요 기준시점
      const bd=scope.locator('input[placeholder^="20260310"]').first();
      await bd.waitFor({timeout:60000});await bd.fill('20261125');await bd.press('Tab');
      await scope.getByText('2. 사례 · 가격산출',{exact:true}).click();
      await scope.locator('textarea[placeholder^="카이스에서 복사"]').first().evaluate((ta,t)=>{const dt=new DataTransfer();dt.setData('text/plain',t);ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));},TSV);
      const table=scope.locator('table',{has:page.locator('th',{hasText:'거래시점'})}).first();
      await table.locator('tbody tr').nth(1).waitFor();
      const rows=await table.evaluate(t=>{const ths=[...t.querySelectorAll('thead th')].map(h=>h.textContent.trim());
        const col=n=>ths.findIndex(h=>h.startsWith(n));
        return [...t.querySelectorAll('tbody tr')].map(tr=>{const cell=n=>{const td=tr.children[col(n)];if(!td)return '';const i=td.querySelector('input');return i?i.value:td.textContent.trim();};
          const ta=tr.children[col('시점수정치')];
          return {name:cell('건물명'),dfh:cell('동/층/호'),ta:cell('시점수정치'),basis:(ta&&ta.querySelector('[aria-label$="시점수정 근거"]')||{}).textContent||'',
            tip:(ta&&ta.querySelector('[aria-label$="시점수정 근거"]')||{title:''}).title};});});
      console.log(mode,rows.map(r=>({...r,tip:r.tip.split('\n').slice(0,3).join(' / ')})));
      const byName=Object.fromEntries(rows.map(r=>[r.name,r]));
      assert.ok(byName['이스트리버빌']&&byName['에버빌'],'건물명에서 호·층 뗌: '+rows.map(r=>r.name).join(','));
      assert.equal(byName['이스트리버빌'].dfh,'/2/203','동/층/호는 그대로');
      for(const r of rows){
        assert.ok(/^1\.\d{5}$/.test(r.ta),'시점수정치 자동: '+r.ta);
        assert.ok(/^자동 · 연립다세대 · 서울 동남권 · \d\d\.\d\d~26\.10$/.test(r.basis),'근거 표시: '+r.basis);
        assert.ok(/지역 : 서울 동남권/.test(r.tip),'마우스 올리면 산식 전체');
      }
      assert.ok(byName['이스트리버빌'].basis.includes('26.07~26.10'),'거래 2026.08 → 전월 07');
      assert.deepEqual(errors,[]);
      if(mode==='single')await page.screenshot({path:process.env.SHOT||'/tmp/jiphap_kais_autotime.png',clip:await table.boundingBox()});
      await ctx.close();
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
