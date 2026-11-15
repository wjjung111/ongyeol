// 토지건물 「1. 대상물건 개요」 배치 (2026-11-15, 집건 1번 탭과 같게)
// 왼쪽 = 감정평가 개요 세로 한 줄(맨 위 평가유형 버튼 3개 한 줄) / 오른쪽 = 공부서류 업로드 → 본건 토지 → 본건 건물 → 그 밖의 사항
// 좁은 화면(1280px 미만)은 위아래. PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_tab1_layout.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    for(const w of [1600,1100]){
      const ctx=await browser.newContext({viewport:{width:w,height:900}});
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await ctx.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');});
      const pg=await ctx.newPage(),errors=[];pg.on('pageerror',e=>errors.push(e.message));
      await pg.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});await pg.waitForSelector('#ov_caseNo');
      const r=await pg.evaluate(()=>{const b=id=>document.getElementById(id).getBoundingClientRect();
        const ek=document.querySelector('.evalkind-bar'),card=document.getElementById('ov_caseNo').closest('.card');
        return {ekInCard:card.contains(ek),ek:[...ek.querySelectorAll('.btn')].map(x=>Math.round(x.getBoundingClientRect().top)),
          ov:b('ov_caseNo'),cardW:card.getBoundingClientRect().width,up:b('upCard'),land:b('landQuery'),bld:b('btnFetchBld'),etc:b('etcItemsCard'),
          upNotLeft:!document.querySelector('.ov-col').contains(document.getElementById('upCard')),
          hs:document.documentElement.scrollWidth<=innerWidth};});
      assert.ok(r.ekInCard,'평가유형이 감정평가 개요 카드 안');assert.ok(r.upNotLeft,'업로드는 오른쪽 열');
      assert.equal(new Set(r.ek).size,1,'평가유형 버튼 3개 한 줄 '+r.ek);
      assert.ok(r.up.top<r.land.top&&r.land.top<r.bld.top&&r.bld.top<r.etc.top,'업로드→토지→건물→그 밖의 사항 순');
      if(w>=1280){assert.ok(r.cardW<=345,'왼쪽 340px '+r.cardW);assert.ok(r.up.left>r.ov.right,'업로드는 개요 오른쪽');assert.ok(r.etc.left>r.ov.right,'그 밖의 사항도 오른쪽 열');}
      else assert.ok(r.up.top>r.ov.top,'좁으면 위아래');
      assert.ok(r.hs,'가로 스크롤 없음');assert.deepEqual(errors,[]);
      // 평가유형 버튼 동작 그대로
      await pg.click('#ek_land');assert.equal(await pg.isVisible('#btnFetchBld'),false,'토지만 → 건물 카드 숨김');
      await pg.click('#ek_tb');assert.equal(await pg.isVisible('#btnFetchBld'),true);
      await ctx.close();
    }
    console.log('toji_tab1_layout OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
