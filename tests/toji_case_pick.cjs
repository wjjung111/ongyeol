// 필지별 사례 검증(2026-10-21) — 공장용지·임야처럼 필지마다 그 밖의 요인 사례·거래사례비교법 사례를 따로 쓴다
//  ① 그 밖의 요인: 1번 필지(표준지 A) = 거래사례 #1, 2번 필지(표준지 B) = 거래사례 #2 → 보정치가 필지별로, 패널을 바꿔도 유지
//  ② 거래사례비교법: 1번 = #1, 2번 = #2 → 사례단가·시점수정이 필지별로
//  ③ 사례 순서를 바꿔도 필지가 고른 사례를 따라감 · 저장·복원
//  ④ 의견서: 그 밖의 요인 산정 표 쌍마다 반복·결정 표 두 줄, 거래사례 시점수정 표 두 줄, 남은 토큰 0
//  ⑤ 따로 안 고르면 종전과 같음(의견서 반복 없음)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_case_pick.cjs
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

  // 픽스처: 1번 공장용지(표준지 A 400,000) · 2번 임야(표준지 B 100,000), 거래사례 #1 공장 100만원/㎡ · #2 임야 15만원/㎡
  await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    const tm=f=>({reg:'경기도 화성시',use:'계획관리',from:'25.01.01',to:'26.10.01',factor:f});
    LANDS=[{소재지:'율암리',지번:'428-5',지목:'장',면적:'1000',용도지역:'계획관리',공시지가:'400000',비고:'-',stdIdx:0,gf:['1','1','1','1','1','1'],gaf:['1','1','1','1','1','1']},
           {소재지:'화산리',지번:'664-75',지목:'임',면적:'2000',용도지역:'계획관리',공시지가:'100000',비고:'-',stdIdx:1,gf:['1','1','1','1','1','1'],gaf:['1','1','1','1','1','1']}];
    STDS=[{소재지:'율암리',지번:'1',지목:'장',면적:'900',공시지가:'400000',용도지역:'계획관리'},{소재지:'화산리',지번:'2',지목:'임',면적:'3000',공시지가:'100000',용도지역:'계획관리'}];
    TRADES=[{loc:'율암리 10',use:'계획관리',jimok:'장',date:'2025.01.01',landA:'1000',total:'1000000000',timeMeta:tm('1.01000')},
            {loc:'화산리 20',use:'계획관리',jimok:'임',date:'2025.01.01',landA:'2000',total:'300000000',timeMeta:tm('1.02000')},{}];
    APPRS=[];ETC={type:'t',idx:0,std:0};GA={idx:0};
    for(const [k,v] of Object.entries({base_gijun:'2026.10.01',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1.01',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1.01',ga_sajeong:'1',ga_area:'1',ov_client:'테스트'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,'1.00');
    renderStds();renderLands();renderTrade();syncPick();calcGongsi();
  });
  const base0=await page.evaluate(()=>({etc:GONGSI_RESULT.rows.map(r=>r.etc),pairs:document.getElementById('etcPairs').style.display,own:anyOwnCase(),
    blocks:ArapTojiOpinion.data().etcBlocks}));
  console.log('⑤ 따로 안 고름',base0);
  near(base0.etc[0],2.52);assert.equal(base0.etc[1],0);   // 종전: 표준지 A만 결정치, B는 안 정함(0)
  assert.equal(base0.pairs,'none');assert.equal(base0.own,false);assert.equal(base0.blocks,null);

  // ① 2번 필지만 그 밖의 요인 사례 #2 → 아직 입력 안 함 → ✎로 패널에 띄워 입력
  const e1=await page.evaluate(()=>{
    const sel=document.querySelectorAll('#tblSisan tr')[2].querySelector('select');sel.value='t1';sel.dispatchEvent(new Event('change'));
    const before={etc:GONGSI_RESULT.rows[1].etc,warn:document.getElementById('etcPairs').textContent};
    editEtcPair(1);   // 패널 = 거래사례 #2 ↔ 표준지 B
    const panel={pick:ETC.idx,std:etcStdIdx()};
    document.getElementById('eTime').value='1.02';document.getElementById('e_f3').value='0.90';calcGongsi();
    const mid={etc:GONGSI_RESULT.rows.map(r=>r.etc)};
    pickEtc('t',0);   // 패널을 #1로 되돌려도 2번 필지 값은 #2 기억으로
    const after={etc:GONGSI_RESULT.rows.map(r=>r.etc),list:document.getElementById('etcPairs').textContent};
    return {before,panel,mid,after};
  });
  console.log('① 그 밖의 요인 필지별',JSON.stringify(e1));
  near(e1.before.etc,1.53);assert.ok(e1.before.warn.includes('아직 입력 안 함'));   // 입력 전 = 사례 시점수정만 반영한 기본값(150,000×1.02/100,000) + 경고
  assert.deepEqual(e1.panel,{pick:1,std:1});
  // #2 ↔ B: 150,000×1.02×0.9 = 137,700 / 100,000 → 1.37
  near(e1.mid.etc[0],2.52);near(e1.mid.etc[1],1.37);   // 패널을 2번 쌍으로 바꿔도 1번 필지는 고정된 #1 ↔ A 그대로
  near(e1.after.etc[1],1.37);near(e1.after.etc[0],2.52);   // 1번은 #1 ↔ A 그대로(1,010,000/400,000 = 2.525 → 2.52)
  assert.ok(e1.after.list.includes('거래사례 #2 ↔ 표준지 B'));

  // ② 거래사례비교법: 2번 필지 = #2 (시점수정 1.02 — 거래사례 표에 계산해 둔 값)
  const g1=await page.evaluate(()=>{
    const sel=document.querySelectorAll('#tblGaFactors tr')[3].querySelector('select');sel.value='1';sel.dispatchEvent(new Event('change'));
    const r=GEORAE_RESULT.rows;return {src:r.map(x=>x.source),time:r.map(x=>x.time),cases:r.map(x=>x.caseIdx),apply:r.map(x=>x.apply)};
  });
  console.log('② 거래사례비교법 필지별',g1);
  assert.deepEqual(g1.cases,[0,1]);assert.deepEqual(g1.src,[1000000,150000]);
  near(g1.time[0],1.01);near(g1.time[1],1.02);
  // 2번 사례 시점수정 칸을 고치면 2번 필지만 바뀐다
  const g2=await page.evaluate(()=>{const inp=document.querySelectorAll('#tblGaSisan tr')[2].querySelectorAll('input')[1];inp.value='1.03';inp.dispatchEvent(new Event('input'));
    return {time:GEORAE_RESULT.rows.map(x=>x.time),hidden:document.getElementById('ga_time').value,mem:TRADES[1].gaMem.f.ga_time};});
  console.log('② 2번 사례 시점수정만 수정',g2);
  near(g2.time[0],1.01);near(g2.time[1],1.03);assert.equal(g2.hidden,'1.01');assert.equal(g2.mem,'1.03');

  // ③ 사례 순서를 바꿔도 필지가 고른 사례를 따라간다 · 저장·복원
  const mv=await page.evaluate(()=>{moveTrade(1,0);
    return {ga:GEORAE_RESULT.rows.map(x=>x.caseIdx),src:GEORAE_RESULT.rows.map(x=>x.source),etc:GONGSI_RESULT.rows.map(r=>r.etc),etcKey:GONGSI_RESULT.rows.map(r=>r.etcKey)};});
  console.log('③ 사례 순서 바꿈',mv);
  assert.deepEqual(mv.src,[1000000,150000]);assert.deepEqual(mv.ga,[1,0]);
  near(mv.etc[0],2.52);near(mv.etc[1],1.37);assert.deepEqual(mv.etcKey,['t1','t0']);
  const rt=await page.evaluate(()=>{doSave();const o=JSON.parse(localStorage.getItem(FORM_STORAGE));clearForm();applyForm(o);refreshAfterLoad();
    return {etc:GONGSI_RESULT.rows.map(r=>r.etc),src:GEORAE_RESULT.rows.map(x=>x.source),time:GEORAE_RESULT.rows.map(x=>x.time)};});
  console.log('③ 저장·복원',rt);
  near(rt.etc[0],2.52);near(rt.etc[1],1.37);assert.deepEqual(rt.src,[1000000,150000]);near(rt.time[1],1.03);

  // ④ 의견서
  const op=await page.evaluate(async()=>{
    const d=ArapTojiOpinion.data();
    const bytes=await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),d);
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const x=new TextDecoder().decode(ents.find(e=>/section0\.xml$/.test(e.name)).data);
    const plain=x.replace(/<[^>]+>/g,'|');
    let b='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);
    return {blocks:(d.etcBlocks||[]).map(x=>x.head),rows:d.etcRows,ga:d.gaTimes&&d.gaTimes.map(t=>[t['거래_채택기호'],t['거래_시점']]),
      chosen:d.global['그밖_채택사례'],gaChosen:d.global['거래_채택기호'],gaCol:d.parcelsGa.map(p=>p['거래_채택기호']),
      left:(x.match(/\{\{[^}]+\}\}/g)||[]).length,hasA:plain.includes('■ 거래사례 #2 ↔ 표준지 A'),hasB:plain.includes('■ 거래사례 #1 ↔ 표준지 B'),
      blk2:(plain.split('■ 거래사례 #1 ↔ 표준지 B')[1]||'').replace(/\|+/g,'|').slice(0,500),b64:btoa(b)};
  });
  console.log('④ 의견서',JSON.stringify({blocks:op.blocks,rows:op.rows,ga:op.ga,chosen:op.chosen,gaChosen:op.gaChosen,gaCol:op.gaCol,left:op.left}));
  assert.deepEqual(op.blocks,['■ 거래사례 #2 ↔ 표준지 A (기호 1)','■ 거래사례 #1 ↔ 표준지 B (기호 2)']);
  assert.deepEqual(op.rows.map(r=>[r['표준지_기호'],r['그밖_사례기호'],r['그밖_결정보정치'],r['필지_번호']]),[['A','#2','2.52','1'],['B','#1','1.37','2']]);
  assert.deepEqual(op.ga,[['거래사례#2','1.01000'],['거래사례#1','1.03000']]);
  assert.equal(op.chosen,'거래사례 #2, 거래사례 #1');assert.equal(op.gaChosen,'거래사례#2, 거래사례#1');
  assert.deepEqual(op.gaCol,['거래사례#2','거래사례#1']);
  assert.equal(op.left,0);assert.ok(op.hasA);assert.ok(op.hasB);
  // 둘째 반복 표는 그 쌍 값(사례 150,000 · 표준지 100,000 · 1.37)
  assert.ok(/\|150,000\|/.test(op.blk2)&&/\|100,000\|/.test(op.blk2)&&/\|1\.37\|/.test(op.blk2),op.blk2);
  if(outDir)fs.writeFileSync(path.join(outDir,'필지별사례_의견서.hwpx'),Buffer.from(op.b64,'base64'));

  // 「선정」으로 되돌리면 종전 방식
  const back=await page.evaluate(()=>{LANDS.forEach(L=>{delete L.etcPick;delete L.gaPick;});calcGongsi();
    return {own:anyOwnCase(),pairs:document.getElementById('etcPairs').style.display,blocks:ArapTojiOpinion.data().etcBlocks,ga:GEORAE_RESULT.rows.map(x=>x.caseIdx)};});
  console.log('선정으로 복귀',back);
  assert.equal(back.own,false);assert.equal(back.pairs,'none');assert.equal(back.blocks,null);assert.deepEqual(back.ga,[1,1]);

  // ⑥ 표준지별 사례 — 사례 표 「선정」 칸에서 표준지 A·B를 고르면 그 표준지 필지 전부에(사용자 화면 방식)
  const ps=await page.evaluate(async()=>{
    APPRS=[{no:'a',loc:'화산리 30',unit:'800000',base:'2025.06.01',timeMeta:{reg:'경기도 화성시',use:'계획관리',from:'25.06.01',to:'26.10.01',factor:'1.00000'}},
           {no:'g',loc:'쌍송리 1',unit:'130000',base:'2025.06.01',timeMeta:{reg:'경기도 화성시',use:'계획관리',from:'25.06.01',to:'26.10.01',factor:'1.00000'}},{}];
    renderAppr();renderTrade();
    const radios=document.querySelectorAll('#tblAppr input[name="pickAppr"]').length,sels=document.querySelectorAll('#tblAppr select.std-pick').length;
    setStdCase('etc','a',0,'0');setStdCase('etc','a',1,'1');
    setStdCase('ga','t',1,'0');setStdCase('ga','t',0,'1');
    await new Promise(r=>setTimeout(r,200));calcGongsi();   // 시점수정 자동 채움(비동기) 끝난 뒤
    return {radios,sels,etcKey:GONGSI_RESULT.rows.map(r=>r.etcKey),etc:GONGSI_RESULT.rows.map(r=>r.etc),ga:GEORAE_RESULT.rows.map(r=>r.caseIdx),
      bar:document.getElementById('etcPairs').innerText,blocks:(ArapTojiOpinion.data().etcBlocks||[]).length};
  });
  console.log('⑥ 표준지별 사례',JSON.stringify(ps));
  assert.equal(ps.radios,0);assert.equal(ps.sels,3);
  assert.deepEqual(ps.etcKey,['a0','a1']);near(ps.etc[0],2);near(ps.etc[1],1.3);   // 800,000/400,000 · 130,000/100,000
  assert.deepEqual(ps.ga,[1,0]);
  assert.ok(ps.bar.includes('평가사례 a ↔ 표준지 A')&&ps.bar.includes('평가사례 g ↔ 표준지 B'));assert.equal(ps.blocks,2);

  assert.deepEqual(errs,[],'페이지 오류: '+errs.join(' / '));
  console.log('\n✅ 필지별 사례 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
