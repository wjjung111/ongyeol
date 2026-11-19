// 토지평가 세 단계(2-1·2-2·2-3)가 맨 윗줄 탭에 늘 보임 + 2-1 공시지가기준법 한 화면 배치(2026-11-03) — 7개 카드가 내부 탭 없이 모두 보이고
// 2차(같은 날): 왼쪽 열 = 비교표준지→시점수정→개별요인비교→그 밖의 요인→시산가액, 오른쪽 열 = 거래사례→평가사례, 좁은 화면은 1열
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_gongsi_layout.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
const CARDS=[['gsStdCard','비교표준지'],['gsJbCard','시점수정'],['gsFacCard','개별요인비교'],['gsEtcCard','그 밖의 요인'],['pinLand','시산가액'],
             ['gsTradeCard','거래사례'],['gsApprCard','평가사례']];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({viewport:{width:1400,height:900}}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('console: '+m.text());});   // 지도 등 바깥 주소는 테스트에서 막아 둠
    page.on('dialog',d=>d.accept());page.setDefaultTimeout(60000);
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await ctx.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');});
    await page.goto(base+'/'+encodeURI('토지건물.html'),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.showTab&&window.calcGongsi);
    // 첫 화면(1. 대상물건 개요)에서 2-1·2-2·2-3 탭 버튼이 바로 보임 — 「2. 토지평가」 묶음 버튼 없이
    for(const id of ['gongsi','gyeoljeong'])assert(await page.locator('#tabbtn-'+id).isVisible(),'첫 화면 탭 버튼 보임 '+id);
    assert.equal(await page.locator('#tabbtn-land').count(),0,'묶음 버튼 없음');
    const order=await page.$$eval('.tabs button',bs=>bs.map(b=>b.id.replace('tabbtn-','')));
    assert.deepEqual(order.slice(0,4),['daesang','gongsi','gyeoljeong','bld'],'탭 순서: '+order.join(','));
    assert.equal(await page.locator('#tabbtn-georae').count(),0,'거래사례비교법 탭 따로 없음');
    await page.click('#tabbtn-gyeoljeong');assert(await page.locator('#tab-gyeoljeong').isVisible(),'2-2 토지평가액 결정 탭 열림');
    for(const id of ['gongsi','gyeoljeong'])assert(await page.locator('#tabbtn-'+id).isVisible(),'다른 탭에서도 보임 '+id);
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
    const sameCol=(ids,label)=>{ids.forEach(id=>assert.ok(Math.abs(x(id)-x(ids[0]))<=1,label+' 같은 열: '+ids.map(i=>i+'@'+x(i)).join(', ')));
      for(let k=1;k<ids.length;k++)assert.ok(y(ids[k])>y(ids[k-1]),label+' 위→아래 순서 '+ids[k]);};
    sameCol(['gsStdCard','gsJbCard','gsFacCard','gsEtcCard','pinLand'],'왼쪽(계산 흐름)');
    sameCol(['gsTradeCard','gsApprCard'],'오른쪽(사례)');
    assert.ok(x('gsTradeCard')>x('gsStdCard')+200,'사례는 오른쪽 열');
    assert.ok(Math.abs(y('gsTradeCard')-y('gsStdCard'))<=1,'두 열 위쪽 맞춤');
    assert.ok(Math.abs(boxes.gsFacCard.width-boxes.gsJbCard.width)<=1,'개별요인 = 시점수정 같은 너비');
    // 좌우 너비 조절 손잡이(⋮) — 끌면 왼쪽 열 너비가 바뀌고 저장(옛 2단 저장키 tab-gongsi:lr 그대로)
    {const h=page.locator('#gongsi_layout>.split-h');assert(await h.isVisible(),'⋮ 손잡이 보임');
      const w0=(await page.locator('#gsMain').boundingBox()).width,hb=await h.boundingBox();
      await page.mouse.move(hb.x+hb.width/2,hb.y+20);await page.mouse.down();await page.mouse.move(hb.x-200,hb.y+20,{steps:5});await page.mouse.up();
      const w1=(await page.locator('#gsMain').boundingBox()).width;
      assert.ok(w1<w0-150,'끌어서 왼쪽 열 좁힘 '+w0+'→'+w1);
      assert.ok(await page.evaluate(()=>!!localStorage.getItem('tojigeonmul-split:tab-gongsi:lr')),'너비 저장');
      await h.dblclick();assert.ok(Math.abs((await page.locator('#gsMain').boundingBox()).width-w0)<=2,'더블클릭 → 기본 너비');
      for(const [id] of CARDS)boxes[id]=await page.locator('#'+id).boundingBox();}
    // 거래사례비교법(옛 2-2)은 같은 화면 맨 아래 — 채택·개별요인·시산가액 모두 보이고 사례 열들보다 아래
    for(const id of ['georae_sec','resGeorae','tblTradePick','ga_unit','ga_mode'])assert(await page.locator('#'+id).isVisible(),'#'+id+' 보임(2-1 화면)');
    {const g=await page.locator('#georae_sec').boundingBox();assert.ok(g.y>boxes.pinLand.y&&g.y>boxes.gsApprCard.y,'거래사례비교법은 맨 아래');}
    // 옛 showTab('georae') 호출 → 2-1 화면으로
    await page.evaluate(()=>showTab('georae'));assert(await page.locator('#tab-gongsi').isVisible()&&await page.locator('#georae_sec').isVisible(),'옛 georae → 2-1');
    console.log('1400px', CARDS.map(([id])=>id+'('+x(id)+','+y(id)+')').join(' '));

    // 거래사례 추가·그 밖의 요인 적용사례 선택이 바로 화면에서 됨(탭 전환 없이)
    const pick=await page.evaluate(()=>{TRADES=[{loc:'가동 1-1',unit:'1,000,000',date:'2025.01.01'}];renderTrade();syncPick();
      const s=document.getElementById('etcPick');return [...s.options].map(o=>o.value);});
    assert.ok(pick.includes('t0'),'적용사례 목록에 거래 #1: '+pick.join(','));

    // 2-2 토지평가액 결정: 방법별 적용단가 칸 · 3. 건물평가: 국세청 기준시가 박스 = 재조달원가 박스와 같은 열·너비
    {const u=await page.evaluate(()=>{GONGSI_RESULT={total:6073318000,rows:[{apply:15300000}]};GEORAE_RESULT={total:6304224000,rows:[{apply:15880000}]};calcGyeoljeong();
        return ['gj_au','gj_bu','gj_udiff','gj_fu'].map(id=>document.getElementById(id).textContent);});
      assert.deepEqual(u,['15,300,000','15,880,000','3.7%','15,300,000'],'적용단가 칸 '+u);
      await page.evaluate(()=>showTab('bld'));
      const a=await page.locator('#tblBldCalc').locator('xpath=ancestor::div[contains(@class,"card")][1]').boundingBox(),g=await page.locator('#gjsCard').boundingBox();
      assert.ok(Math.abs(a.x-g.x)<=1&&Math.abs(a.width-g.width)<=1&&g.y>a.y,'기준시가 박스 = 재조달원가 박스 너비 '+JSON.stringify([a,g]));
      await page.evaluate(()=>showTab('gongsi'));}
    // 모든 화면(.tab)은 서로 형제 — 한 화면이 다른 화면 안으로 들어가 숨는 사고 방지(2026-11-03 위치도가 2-1 안에 들어가 안 보였음)
    {const par=await page.$$eval('.tab',ts=>[...new Set(ts.map(t=>t.parentElement.id||t.parentElement.className))]);assert.equal(par.length,1,'탭 부모 하나: '+par);
      await page.evaluate(()=>showTab('jido'));assert(await page.locator('#mapBox').isVisible(),'위치도 지도 칸 보임');
      // 4. 평가액 결정·청구서: 검산 패널 없음, 청구서 칸이 같은 화면에, 옛 showTab('cheonggu') → final
      await page.evaluate(()=>showTab('cheonggu'));assert(await page.locator('#tab-final').isVisible(),'옛 청구서 탭 → 4번');
      for(const id of ['cheonggu_sec','cg_table','btnCheonggu','fn_total'])assert(await page.locator('#'+id).isVisible(),'#'+id+' 보임(4번)');
      assert.equal(await page.locator('#tblCheck').count(),0,'검산 패널 없음');
      await page.evaluate(()=>showTab('gongsi'));}
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
