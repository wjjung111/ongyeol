// 토지평가 세 단계(2-1·2-2·2-3)가 맨 윗줄 탭에 늘 보임 + 2-1 공시지가기준법 한 화면 배치(2026-11-03) — 7개 카드가 내부 탭 없이 모두 보이고
// 1행 비교표준지|시점수정|개별요인비교 · 2행 거래사례|평가사례 · 3행 그 밖의 요인|시산가액, 좁은 화면은 1열
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_gongsi_layout.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
const CARDS=[['gsStdCard','비교표준지'],['gsJbCard','시점수정'],['gsFacCard','개별요인비교'],
             ['gsTradeCard','거래사례'],['gsApprCard','평가사례'],['gsEtcCard','그 밖의 요인'],['pinLand','시산가액']];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({viewport:{width:1400,height:900}}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
    page.on('dialog',d=>d.accept());page.setDefaultTimeout(60000);
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await ctx.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');});
    await page.goto(base+'/'+encodeURI('토지건물.html'),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.showTab&&window.calcGongsi);
    // 첫 화면(1. 대상물건 개요)에서 2-1·2-2·2-3 탭 버튼이 바로 보임 — 「2. 토지평가」 묶음 버튼 없이
    for(const id of ['gongsi','georae','gyeoljeong'])assert(await page.locator('#tabbtn-'+id).isVisible(),'첫 화면 탭 버튼 보임 '+id);
    assert.equal(await page.locator('#tabbtn-land').count(),0,'묶음 버튼 없음');
    const order=await page.$$eval('.tabs button',bs=>bs.map(b=>b.id.replace('tabbtn-','')));
    assert.deepEqual(order.slice(0,5),['daesang','gongsi','georae','gyeoljeong','bld'],'탭 순서: '+order.join(','));
    await page.click('#tabbtn-georae');assert(await page.locator('#tab-georae').isVisible(),'2-2 탭 열림');
    for(const id of ['gongsi','georae','gyeoljeong'])assert(await page.locator('#tabbtn-'+id).isVisible(),'다른 탭에서도 보임 '+id);
    await page.click('#tabbtn-gongsi');
    assert.equal(await page.locator('#tabbtn-gongsi.active').count(),1,'2-1 버튼 활성');
    assert.equal(await page.locator('#tab-gongsi .subtabs').count(),0,'내부 탭 단추 없음');

    const boxes={};
    for(const [id,name] of CARDS){
      const loc=page.locator('#'+id);
      assert(await loc.isVisible(),name+' 카드 보임');
      boxes[id]=await loc.boundingBox();
    }
    // 핵심 칸들도 숨김 없이 보임
    for(const id of ['stdTbl','jb_rate','g_daegu','tblTrade','tblAppr','etcPick','eDecide','tblSisan'])
      assert(await page.locator('#'+id).isVisible(),'#'+id+' 보임');
    const y=id=>Math.round(boxes[id].y),x=id=>Math.round(boxes[id].x);
    const sameRow=(ids,label)=>{ids.forEach(id=>assert.ok(Math.abs(y(id)-y(ids[0]))<=1,label+' 같은 줄: '+ids.map(i=>i+'@'+y(i)).join(', ')));
      for(let k=1;k<ids.length;k++)assert.ok(x(ids[k])>x(ids[k-1]),label+' 왼→오 순서');};
    sameRow(['gsStdCard','gsJbCard','gsFacCard'],'1행');
    sameRow(['gsTradeCard','gsApprCard'],'2행');
    sameRow(['gsEtcCard','pinLand'],'3행');
    assert.ok(y('gsTradeCard')>y('gsStdCard')&&y('gsEtcCard')>y('gsTradeCard'),'행 순서 1→2→3');
    console.log('1400px', CARDS.map(([id])=>id+'('+x(id)+','+y(id)+')').join(' '));

    // 거래사례 추가·그 밖의 요인 적용사례 선택이 바로 화면에서 됨(탭 전환 없이)
    const pick=await page.evaluate(()=>{TRADES=[{loc:'가동 1-1',unit:'1,000,000',date:'2025.01.01'}];renderTrade();syncPick();
      const s=document.getElementById('etcPick');return [...s.options].map(o=>o.value);});
    assert.ok(pick.includes('t0'),'적용사례 목록에 거래 #1: '+pick.join(','));

    // 좁은 화면 → 1열(카드가 모두 같은 x, 위→아래)
    await page.setViewportSize({width:900,height:900});await page.waitForTimeout(200);
    const nb=[];for(const [id] of CARDS)nb.push(await page.locator('#'+id).boundingBox());
    nb.forEach((b,k)=>{assert.ok(Math.abs(b.x-nb[0].x)<=1,'좁은 화면 1열 x');if(k)assert.ok(b.y>nb[k-1].y,'좁은 화면 위→아래');});
    const hscroll=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    assert.equal(hscroll,false,'좁은 화면 가로 스크롤 없음');
    console.log('900px 1열 OK');

    assert.deepEqual(errors,[]);await ctx.close();
    console.log('✅ 모두 통과');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error('❌',e);process.exit(1);});
