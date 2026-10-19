// 본건 토지 표 한글 입력 검증 — 글자 칸에 한 글자 칠 때마다 표를 다시 그려 한글 조합이 끊기던 문제(사용자 제보 2026-10-19:
// 나눈 줄 사유에 「선하지」를 치면 「ㅅㅓㄴㅎㅏㅈㅣ」로 써짐). 실제 입력기처럼 조합(ㅅ→서→선) 후 확정을 CDP로 흉내 낸다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_ime.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.setGubun);
  await page.evaluate(()=>{LANDS=[{소재지:'율암리',지번:'428-5',지목:'',면적:'4568',비고:'-',stdIdx:0}];renderLands();calcGongsi();
    setGubun(0,'gubun');LANDS[1]['사정면적']='211';landPartChanged(1);});
  const cdp=await ctx.newCDPSession(page);
  // 음절마다 조합 단계(ㅅ→서→선)를 보낸 뒤 확정 — 표를 다시 그리면 조합 중인 칸이 바뀌어 낱자가 남는다
  const type=async(sel,syll)=>{await page.click(sel);
    for(const s of syll){for(const step of s.steps)await cdp.send('Input.imeSetComposition',{text:step,selectionStart:step.length,selectionEnd:step.length});
      await cdp.send('Input.insertText',{text:s.done});}};
  await type('#landTbl tr.land-sub td[colspan="7"] input',[{steps:['ㅅ','서','선'],done:'선'},{steps:['ㅎ','하'],done:'하'},{steps:['ㅈ','지'],done:'지'}]);
  await type('#landTbl tr:nth-child(2) td:nth-child(4) input',[{steps:['ㄷ','대'],done:'대'}]);   // 기존 글자 칸(지목)도 같은 문제였다
  const r=await page.evaluate(()=>({sub:LANDS[1]['비고'],jimok:LANDS[0]['지목'],etc:ETC_ITEMS.some(t=>t.indexOf('선하지인바')>=0)}));
  console.log('한글 입력',r);
  assert.equal(r.sub,'선하지');
  assert.equal(r.jimok,'대');
  assert.ok(r.etc);   // 그 밖의 사항 자동 문구도 사유를 따라간다
  assert.deepEqual(errs,[],'페이지 오류: '+errs.join(' / '));
  console.log('\n✅ 본건 토지 표 한글 입력 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
