// 집합건물 ③ 거래사례 표 — 「거래시점」 머리글 오름·내림 정렬이 같은 해 안에서도 날짜 순서대로(단일·여러호수)
// 전에는 parseFloat("2025.11.03")=2025.11 로 잘려 같은 달·같은 해 사례 순서가 엉켰다(2026-10-19)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_case_sort_date.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const TSV=['소재지\t지번\t기타주소\t거래시점\t전용면적\t물건금액\t단가\t사용승인일자',
  '잠실동\t35-2\t트리지움 상가동 158호\t2025.11.03\t40.05\t1,250,000,000\t31,210,986\t2007-08-24',
  '잠실동\t35-2\t트리지움 상가동 154호\t2025.04.16\t30.78\t900,000,000\t29,239,766\t2007-08-24',
  '잠실동\t22-6\t리센츠 상가동 A27호\t2025.03.24\t12.76\t330,000,000\t25,862,068\t2008-07-31',
  '잠실동\t194\t잠실아이파크 A108호\t2025.04.23\t18.72\t440,000,000\t23,504,273\t2013-12-27',
  '잠실동\t22-6\t리센츠 상가동 A54호\t2025.12.27\t24.70\t580,000,000\t23,481,781\t2008-07-31',
  '잠실동\t44-3\t레이크팰리스 상가A동 103호\t2025.04.28\t44.52\t1,040,000,000\t23,360,287\t2006-12-28'].join('\n');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);},{mode});
      await page.goto(base+'/s3r86w8a.html');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      await scope.getByText('3. 사례 등 입력',{exact:true}).click({timeout:60000});
      await scope.locator('textarea[placeholder^="카이스에서 복사"]').first().evaluate((ta,t)=>{const dt=new DataTransfer();dt.setData('text/plain',t);ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));},TSV);
      const table=scope.locator('table',{has:page.locator('th',{hasText:'거래시점'})}).first();
      await table.locator('tbody tr').nth(5).waitFor();
      // 거래시점 열 순번을 머리글에서 찾아 그 칸 값만 읽는다
      const dates=()=>table.evaluate(t=>{const ths=[...t.querySelectorAll('thead th')];const c=ths.findIndex(h=>h.textContent.includes('거래시점'));
        return [...t.querySelectorAll('tbody tr')].map(tr=>{const td=tr.children[c];if(!td)return '';const inp=td.querySelector('input');return (inp?inp.value:td.textContent).trim();}).filter(v=>/\d/.test(v));});
      const num=v=>{const m=v.match(/(\d{2,4})\D+(\d{1,2})\D+(\d{1,2})/);return m?(+m[1]<100?2000+ +m[1]:+m[1])*10000+ +m[2]*100+ +m[3]:NaN;};
      const th=table.locator('thead th',{hasText:'거래시점'});
      await th.click();let d=await dates();const n1=d.map(num);
      assert.ok(n1.length>=6&&n1.every((v,i)=>i===0||n1[i-1]<=v),mode+' 오름차순: '+d.join(' '));
      assert.ok((await th.innerText()).includes('▲'));
      await th.click();d=await dates();const n2=d.map(num);
      assert.ok(n2.every((v,i)=>i===0||n2[i-1]>=v),mode+' 내림차순: '+d.join(' '));
      assert.ok((await th.innerText()).includes('▼'));
      console.log(mode,d.join(' '));
      assert.deepEqual(errors,[]);
      await ctx.close();
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
