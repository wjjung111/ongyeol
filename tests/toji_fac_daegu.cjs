// 지대별 개별요인 조건(2026-10-21) — 임야지대 = 접근·자연·행정·기타, 농경지대 = 접근·자연·획지·행정·기타
//  ① 공시지가기준법·거래사례비교법 개별요인 표가 표준지별로 나뉘고, 임야지대 표는 접근·자연·행정·기타 열만
//  ② 안 쓰는 칸(가로·획지)에 값이 남아 있어도 계에서 빠짐 · 표준지 B 표에서 입력해도 커서 유지
//  ③ 그 밖의 요인 블록(표준지 B)도 4조건, 한 벌 패널(표준지 하나·임야지대)도 가로·획지 칸 숨김
//  ④ 의견서: 공시·거래 개별요인 표가 지대마다 나뉘고 임야 표는 7열(번호·표준지·4조건·계) — 너비 합·칸 수 맞음, 그 밖의 요인 표도 4조건, 토큰 0
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_fac_daegu.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
const near=(a,b,d)=>assert.ok(Math.abs(a-b)<(d||0.0001),a+' ≒ '+b+' 아님');
const outDir=process.env.TOJI_OUT||'';
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
    const tm=f=>({reg:'경기도 화성시',use:'계획관리',from:'25.01.01',to:'26.10.01',factor:f});
    // 2번(임야) 필지 가로·획지 칸에 값이 남아 있는 상태 — 임야지대면 계에서 빠져야 함
    LANDS=[{소재지:'율암리',지번:'428-5',지목:'장',면적:'1000',용도지역:'계획관리',공시지가:'400000',비고:'-',stdIdx:0,gf:['1.03','1.03','1','1','1','1'],gaf:['1','1','1','1','1','1']},
           {소재지:'화산리',지번:'664-75',지목:'임',면적:'2000',용도지역:'계획관리',공시지가:'100000',비고:'-',stdIdx:1,gf:['0.50','1.00','0.80','0.50','1.00','1.00'],gaf:['0.50','1.00','0.90','0.50','1.00','1.00']}];
    STDS=[{소재지:'율암리',지번:'1',지목:'장',면적:'900',공시지가:'400000',용도지역:'계획관리',daegu:'공업지대'},{소재지:'화산리',지번:'2',지목:'임',면적:'3000',공시지가:'100000',용도지역:'계획관리',daegu:'임야지대'}];
    TRADES=[{loc:'율암리 10',use:'계획관리',jimok:'장',date:'2025.01.01',landA:'1000',total:'1000000000',timeMeta:tm('1.01000')},
            {loc:'화산리 20',use:'계획관리',jimok:'임',date:'2025.01.01',landA:'2000',total:'300000000',timeMeta:tm('1.02000')},{}];
    APPRS=[];ETC={type:'t',idx:0,std:0};GA={idx:0};
    for(const [k,v] of Object.entries({base_gijun:'2026.10.01',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1.01',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1.01',ga_sajeong:'1',ga_area:'1',ov_client:'테스트',g_daegu:'공업지대'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,'1.00');
    renderStds();renderLands();renderTrade();syncPick();calcGongsi();
  });
  const heads=sel=>page.evaluate(s=>{const t=document.querySelector(s);return t?[...t.rows[0].cells].map(c=>c.textContent.replace(/\s/g,'')):null;},sel);

  // ① 표가 표준지별로
  const ui=await page.evaluate(()=>({cap0:document.getElementById('tblGaebyeolCap').textContent,cap1:document.querySelector('#tblGaebyeolMore .fac-cap').textContent,
    gaCap1:document.querySelector('#tblGaFactorsMore .fac-cap').textContent}));
  const hA=await heads('#tblGaebyeol'),hB=await heads('#tblGaebyeol_1'),gB=await heads('#tblGaFactors_1');
  console.log('① 표',ui,hA,hB,gB);
  assert.equal(ui.cap0,'표준지 A — 공업지대');assert.equal(ui.cap1,'표준지 B — 임야지대');assert.equal(ui.gaCap1,'표준지 B — 임야지대');
  assert.deepEqual(hA,['일련번호','비교표준지','가로','접근','환경','획지','행정','기타','계']);
  assert.deepEqual(hB,['일련번호','비교표준지','접근','자연','행정','기타','계']);
  assert.deepEqual(gB,['일련번호','사례','접근','자연','행정','기타','계']);

  // ② 계에서 가로·획지 빠짐: 임야 = 1.00 × 0.80 × 1.00 × 1.00 = 0.800 (가로 0.5·획지 0.5 무시)
  const r=await page.evaluate(()=>({gs:GONGSI_RESULT.rows.map(x=>x.individual),ga:GEORAE_RESULT.rows.map(x=>x.individual),
    sumB:document.querySelector('#tblGaebyeol_1 td.calc-c.fac').textContent}));
  console.log('② 계',r);
  near(r.gs[0],1.061);near(r.gs[1],0.8);near(r.ga[1],0.9);assert.equal(r.sumB,'0.800');
  const typed=await page.evaluate(()=>{showTab('gongsi');const inp=document.querySelectorAll('#tblGaebyeol_1 input.fac')[1];inp.focus();inp.value='0.70';inp.dispatchEvent(new Event('input',{bubbles:true}));
    const now=document.activeElement;return {gf:LANDS[1].gf[2],focus:!!(now&&now.closest('#tblGaebyeol_1')),v:now&&now.value,ind:GONGSI_RESULT.rows[1].individual};});
  console.log('② 입력',typed);
  assert.equal(typed.gf,'0.70');assert.ok(typed.focus,'커서 유지');near(typed.ind,0.7);

  // ③ 그 밖의 요인 블록 B = 4조건, e_f1(가로)·e_f4(획지) 값은 무시
  const eb=await page.evaluate(()=>{const b=document.getElementById('etcBlk-1');
    return {head:[...b.querySelectorAll('table')[1].rows[0].cells].map(c=>c.textContent.replace(/\s/g,'')),cells:b.querySelectorAll('[data-f^="e_f"]').length};});
  console.log('③ 블록',eb);
  assert.deepEqual(eb.head,['접근조건','자연조건','행정적조건','기타조건','계']);assert.equal(eb.cells,4);
  const pc=await page.evaluate(()=>{const r={type:'t',idx:0,c:TRADES[0]};return etcPairCalc(r,1,{e_f1:'0.5',e_f2:'1.00',e_f3:'0.9',e_f4:'0.5',e_f5:'1',e_f6:'1'}).individual;});
  near(pc,0.9);

  // ④ 의견서
  const op=await page.evaluate(async()=>{
    const d=ArapTojiOpinion.data();
    const bytes=await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),d);
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const x=new TextDecoder().decode(ents.find(e=>/section0\.xml$/.test(e.name)).data);
    const doc=new DOMParser().parseFromString(x,'application/xml'),HP='http://www.hancom.co.kr/hwpml/2011/paragraph';
    const kids=(el,n)=>[...el.children].filter(c=>c.localName===n);
    const tbls=[...doc.getElementsByTagNameNS(HP,'tbl')].map(t=>{const rows=kids(t,'tr');const head=kids(rows[0],'tc').map(c=>c.textContent.replace(/\s/g,''));
      const cols=+t.getAttribute('colCnt'),W=+kids(t,'sz')[0].getAttribute('width');
      const rowOk=rows.every((tr,ri)=>{const cs=kids(tr,'tc');return cs.every(c=>+kids(c,'cellAddr')[0].getAttribute('colAddr')<cols);});
      const w0=kids(rows[0],'tc').reduce((s,c)=>s+ +kids(c,'cellSz')[0].getAttribute('width'),0);
      return {head,cols,W,w0,rowOk,text:t.textContent.replace(/\s/g,'')};});
    let b='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);
    return {fac:tbls.filter(t=>t.head.includes('접근조건')&&t.head.some(h=>/계/.test(h))).map(t=>({head:t.head,cols:t.cols,W:t.W,w0:t.w0,rowOk:t.rowOk})),
      left:(x.match(/\{\{[^}]+\}\}/g)||[]).length,b64:btoa(b)};
  });
  console.log('④ 의견서 개별요인 표',JSON.stringify(op.fac.map(t=>[t.head.join('|'),t.cols,t.W,t.w0])));
  const forest=op.fac.filter(t=>t.head.includes('자연조건'));
  const forestPer=forest.filter(t=>t.cols===7);   // 공시·거래 — 번호·표준지(사례)·4조건·계
  assert.ok(forestPer.length>=2,'공시·거래 임야 표 둘');
  forestPer.forEach(t=>{assert.ok(!t.head.includes('가로조건')&&!t.head.includes('획지조건'));assert.equal(t.w0,t.W,'머리 행 너비 합 = 표 너비');});
  assert.ok(forest.some(t=>t.cols===5),'그 밖의 요인 블록 B 표 5열(4조건+계)');
  const ind=op.fac.filter(t=>t.head.includes('가로조건'));assert.ok(ind.length>=3,'공업지대 표(공시·거래·그밖 A)는 그대로 6조건');
  op.fac.forEach(t=>assert.ok(t.rowOk));
  assert.equal(op.left,0);
  if(outDir)fs.writeFileSync(path.join(outDir,'지대별개별요인_의견서.hwpx'),Buffer.from(op.b64,'base64'));

  // 표준지 하나 · 임야지대 — 한 벌 패널에서 가로·획지 칸 숨김
  const one=await page.evaluate(()=>{STDS=[Object.assign({},STDS[1])];delete STDS[0].daegu;document.getElementById('g_daegu').value='임야지대';
    LANDS.forEach(L=>{L.stdIdx=0;delete L.etcPick;delete L.gaPick;});renderStds();renderLands();calcGongsi();
    const vis=id=>document.getElementById(id).parentNode.style.display!=='none';
    return {multi:ETC_MULTI,f1:vis('e_f1'),f4:vis('e_f4'),f3h:document.getElementById('efh3').textContent,more:document.getElementById('tblGaebyeolMore').children.length,
      cap:document.getElementById('tblGaebyeolCap').style.display,head:[...document.getElementById('tblGaebyeol').rows[0].cells].map(c=>c.textContent.replace(/\s/g,''))};});
  console.log('한 벌 패널',one);
  assert.equal(one.multi,false);assert.equal(one.f1,false);assert.equal(one.f4,false);assert.equal(one.f3h,'자연조건');
  assert.equal(one.more,0);assert.equal(one.cap,'none');assert.deepEqual(one.head,['일련번호','비교표준지','접근','자연','행정','기타','계']);

  assert.deepEqual(errs,[],'페이지 오류: '+errs.join(' / '));
  console.log('\n✅ 지대별 개별요인 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
