// 표준지별 지대(2026-10-21) — 계획관리 공장지대 안의 임야 필지는 임야지대 비교항목으로
//  ① 표준지 둘 → 「지대」 자리에 표준지마다 고르는 칸, 기본은 전체 지대
//  ② A 공업지대 / B 임야지대 → 의견서 「개별요인 비교항목」 제목+항목 표가 지대마다 반복, 남은 토큰 0
//  ③ 둘 다 같은 지대면 종전과 같이 한 번 · 저장·복원
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_daegu_std.cjs
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
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  page.on('dialog',d=>d.accept());
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html?mode=land',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.calcGongsi&&window.ArapTojiOpinion);
  await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    LANDS=[{소재지:'율암리',지번:'428-5',지목:'장',면적:'1000',용도지역:'계획관리',공시지가:'400000',비고:'-',stdIdx:0,gf:['1','1','1','1','1','1']},
           {소재지:'화산리',지번:'664-75',지목:'임',면적:'2000',용도지역:'계획관리',공시지가:'100000',비고:'-',stdIdx:1,gf:['1','1','1','1','1','1']}];
    STDS=[{소재지:'율암리',지번:'1',지목:'장',면적:'900',공시지가:'400000',용도지역:'계획관리'},{소재지:'화산리',지번:'2',지목:'임',면적:'3000',공시지가:'100000',용도지역:'계획관리'}];
    const tm=f=>({reg:'경기도 화성시',use:'계획관리',from:'25.01.01',to:'26.10.01',factor:f});
    TRADES=[{loc:'율암리 10',use:'계획관리',jimok:'장',date:'2025.01.01',landA:'1000',total:'1000000000',timeMeta:tm('1.01000')},{}];
    APPRS=[];ETC={type:'t',idx:0,std:0};GA={idx:0};
    for(const [k,v] of Object.entries({base_gijun:'2026.10.01',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1.01',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1.01',ga_sajeong:'1',ga_area:'1',ov_client:'테스트',g_daegu:'공업지대'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,'1.00');
    renderStds();renderLands();renderTrade();syncPick();calcGongsi();
  });
  const opinion=()=>page.evaluate(async()=>{const d=ArapTojiOpinion.data();
    const bytes=await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),d);
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const x=new TextDecoder().decode(ents.find(e=>/section0\.xml$/.test(e.name)).data);
    const plain=x.replace(/<[^>]+>/g,'');
    return {blocks:d.daeguBlocks,heads:(plain.match(/개별요인 비교항목\([^)]*\).*?(?=조건항목)/g)||[]).map(h=>h.trim()),left:(x.match(/\{\{[^}]+\}\}/g)||[]).length,
      forest:plain.includes('임도'),items:(x.match(/조건/g)||[]).length,b:x};});

  // ① 화면
  const ui=await page.evaluate(()=>({g:document.getElementById('g_daegu').style.display,sels:[...document.querySelectorAll('#daeguStd select')].map(s=>s.value)}));
  console.log('① 화면',ui);assert.equal(ui.g,'none');assert.deepEqual(ui.sels,['공업지대','공업지대']);

  // ③ 같은 지대 → 한 번
  const same=await opinion();console.log('③ 같은 지대',same.heads,same.left);
  assert.equal(same.blocks,null);assert.equal(same.heads.length,1);assert.ok(same.heads[0].startsWith('개별요인 비교항목(공업지대)'));assert.equal(same.left,0);

  // ② B = 임야지대
  await page.evaluate(()=>{const s=document.querySelectorAll('#daeguStd select')[1];s.value='임야지대';s.dispatchEvent(new Event('change'));});
  const two=await opinion();console.log('② 두 지대',two.blocks,two.heads);
  assert.deepEqual(two.blocks.map(b=>b.daegu),['공업지대','임야지대']);
  assert.equal(two.heads.length,2);
  assert.ok(two.heads[0].includes('개별요인 비교항목(공업지대) — 표준지 A (기호 1)'));
  assert.ok(two.heads[1].includes('개별요인 비교항목(임야지대) — 표준지 B (기호 2)'));
  assert.ok(two.items>same.items,'항목 표가 늘어남');
  assert.equal(two.left,0);

  // 저장·복원
  const rt=await page.evaluate(()=>{STDS=JSON.parse(JSON.stringify(STDS));renderStds();   // 저장 = STDS 통째(o.STDS) → 지대도 함께
    return [...document.querySelectorAll('#daeguStd select')].map(s=>s.value);});
  assert.deepEqual(rt,['공업지대','임야지대']);

  // 표준지 하나면 종전 칸
  const one=await page.evaluate(()=>{STDS=[STDS[0]];LANDS.forEach(L=>L.stdIdx=0);renderStds();renderLands();calcGongsi();
    return {g:document.getElementById('g_daegu').style.display,box:document.getElementById('daeguStd').style.display,blocks:ArapTojiOpinion.data().daeguBlocks};});
  assert.notEqual(one.g,'none');assert.equal(one.box,'none');assert.equal(one.blocks,null);

  assert.deepEqual(errs,[],'페이지 오류: '+errs.join(' / '));
  console.log('\n✅ 표준지별 지대 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
