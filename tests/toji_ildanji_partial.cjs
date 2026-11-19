// 묶음에 넣을 필지 고르기 — 246-2(따로) · 247-1+247-3(일단지, 용도지역별 일반상업 60.1 / 3종일주 41.2) · 247-2(따로)
// 사용자 샘플 명세표(2026-10-29 광희동2가) 기준. PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_ildanji_partial.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
const near=(a,b,d)=>assert.ok(Math.abs(a-b)<(d||0.0001),a+' ≒ '+b+' 아님');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|JSONP|시군구 조회/.test(m.text()))errs.push('console: '+m.text());});
  page.on('dialog',d=>d.accept());
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.calcGongsi&&window.ArapTojiDocuments&&window.ArapTojiOpinion);
  const outDir=process.env.OUT_DIR||'';

  await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    const loc='서울특별시 중구 광희동2가';
    LANDS=[{소재지:loc,지번:'246-2',지목:'대',면적:'67.2',용도지역:'일반상업지역',stdIdx:0},
           {소재지:loc,지번:'247-1',지목:'대',면적:'45.2',용도지역:'일반상업지역, 제3종일반주거지역',stdIdx:0},
           {소재지:loc,지번:'247-3',지목:'대',면적:'56.1',용도지역:'일반상업지역, 제3종일반주거지역',stdIdx:0},
           {소재지:loc,지번:'247-2',지목:'대',면적:'4.3',용도지역:'제3종일반주거지역',stdIdx:1}];
    STDS=[{소재지:'광희동2가',지번:'100',공시지가:'30000000',용도지역:'일반상업지역',etcDecide:'1'},
          {소재지:'광희동2가',지번:'200',공시지가:'20000000',용도지역:'제3종일반주거지역',etcDecide:'1'}];
    TRADES=[{loc:'광희동2가 300',total:'3000000000',landA:'100',landUnit:'30000000',date:'2026.01.01',
      etcMemBy:{0:{f:{eTime:'1',eArea:'1.000',e_f1:'1.00',e_f2:'1.00',e_f3:'1.00',e_f4:'1.00',e_f5:'1.00',e_f6:'1.00'},dec:'1'},1:{f:{eTime:'1',eArea:'1.000',e_f1:'1.00',e_f2:'1.00',e_f3:'1.00',e_f4:'1.00',e_f5:'1.00',e_f6:'1.00'},dec:'1'}}}];
    APPRS=[];ETC={type:'t',idx:0};GA={idx:0};
    for(const [k,v] of Object.entries({base_gijun:'2026.08.31',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1',ga_sajeong:'1',ga_area:'1'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,1);
    ILDANJI=true;renderStds();renderLands();document.getElementById('bldBody').innerHTML='';calcGongsi();
    const sel=document.getElementById('landSajMode');sel.value='group';sel.dispatchEvent(new Event('change'));
  });
  // ① 1번·4번 필지 묶음 체크 끄기 → 묶은 면적 = 247-1+247-3 = 101.3
  const a=await page.evaluate(()=>{
    const cks=[...document.querySelectorAll('#landTbl td.grp-ck input')];
    cks[0].checked=false;cks[0].dispatchEvent(new Event('change'));
    [...document.querySelectorAll('#landTbl td.grp-ck input')][3].checked=false;[...document.querySelectorAll('#landTbl td.grp-ck input')][3].dispatchEvent(new Event('change'));
    setLandStd(3,0,1);   // 묶음에 있는 동안엔 대표 필지 표준지(A)를 따랐으므로, 뺀 뒤 표준지 B로
    return {grp:grpIdx(),area:GROUP_AREA,rowspan:document.querySelector('#landTbl td.grp-c').rowSpan,
      sisan:[...document.querySelectorAll('#tblSisan tr')].slice(1).map(tr=>tr.cells[0].textContent),
      sizes:GONGSI_RESULT.rows.map(r=>[r.key,r.size]),total:GONGSI_RESULT.total,unitDoc:landUnitDoc()};
  });
  console.log('①',a);
  assert.deepEqual(a.grp,[1,2]);assert.equal(a.area,'101.3');assert.equal(a.rowspan,2);
  assert.deepEqual(a.sisan,['1','일단지','4','합계']);
  assert.equal(a.total,30000000*67.2+30000000*101.3+20000000*4.3);assert.equal(a.unitDoc,'-');

  // ② 용도지역별 나누기 — 일반상업 60.1 / 3종일주 41.2(표준지 B)
  const b=await page.evaluate(()=>{
    addZones();GZONES[0].name='일반상업지역';GZONES[1].name='제3종일반주거지역';GZONES[0].area='60.1';GZONES[1].stdIdx=1;renderLands();calcGongsi();
    return {keys:evalKeys(),sisan:[...document.querySelectorAll('#tblSisan tr')].slice(1).map(tr=>tr.cells[0].textContent),
      fac:[...document.querySelectorAll('#tblGaebyeol tr, #tblGaebyeolMore tr')].filter(tr=>tr.cells.length>3).map(tr=>tr.cells[0].textContent),
      rows:GONGSI_RESULT.rows.map(r=>[r.key,r.size,r.apply]),total:GONGSI_RESULT.total,size:GONGSI_RESULT.size,
      ga:GEORAE_RESULT.rows.map(r=>[r.key,r.size])};
  });
  console.log('②',b);
  assert.deepEqual(b.keys,[0,'z0','z1',3]);
  assert.deepEqual(b.sisan,['1','일단지일반상업지역','일단지제3종일반주거지역','4','합계']);
  assert.deepEqual(b.rows,[[0,67.2,30000000],['z0',60.1,30000000],['z1',41.2,20000000],[3,4.3,20000000]]);
  assert.equal(b.total,30000000*(67.2+60.1)+20000000*(41.2+4.3));near(b.size,172.8);
  assert.deepEqual(b.ga.map(x=>x[0]),[0,'z0','z1',3]);

  // ③ 명세표 — 샘플 순서: 1 246-2 / 2·3 일단지(꺾쇠) / 4 247-2
  const m=await page.evaluate(async()=>{
    const rows=ArapTojiDocuments.statementRows().filter(r=>!r.header&&(r['명세_지번']||r.hbr));
    const bytes=await ArapTojiDocuments.buildStatement(ArapTojiDocuments.statementRows());
    let s='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);
    return {rows:rows.map(r=>[r['명세_기호'],r['명세_지번'],r['명세_공부면적'],r['명세_사정면적'],r['명세_단가'],r['명세_비고'],r.gbr||'',r.hbr||'']),b64:btoa(s)};
  });
  console.log('③ 명세표',m.rows);
  assert.deepEqual(m.rows,[
    ['1','246-2',67.2,67.2,30000000,'','',''],
    ['2','247-1',45.2,60.1,30000000,'일단지\n일반상업지역','top','top'],
    ['3','247-3',56.1,41.2,20000000,'일단지\n제3종\n일반주거지역','end','end'],
    ['4','247-2',4.3,4.3,20000000,'','','']]);
  if(outDir)fs.writeFileSync(path.join(outDir,'광희동4필지_명세표.xlsx'),Buffer.from(m.b64,'base64'));

  // ④ 의견서 — 산출근거 4줄(1 / 일반상업 / 3종일주 / 4), 평가대상 토지 표 필지 4줄, 남은 토큰 0
  const o=await page.evaluate(async()=>{
    const d=ArapTojiOpinion.data();
    const bytes=await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),d);
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const x=new TextDecoder().decode(ents.find(e=>/section0\.xml$/.test(e.name)).data);
    let s='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);
    return {p:d.parcels.map(p=>[p['공시개별_번호'],p['토지_지번'],p['토지_사정면적'],p['공시_시산가액']]),zr:d.zoneRuns,gr:d.groupRun,
      subj:d.subject.map(s=>[s['토지_지번'],s['토지_사정면적']]),std:d.standards.map(s=>s['필지_번호']),left:(x.match(/\{\{[^}]+\}\}/g)||[]).length,b64:btoa(s)};
  });
  console.log('④ 의견서',o.p,o.zr,o.gr,o.subj,o.std,'남은 토큰',o.left);
  assert.deepEqual(o.p.map(r=>r[0]),['1','일반상업','3종일주','4']);
  assert.equal(o.p[1][1],'247-1 외 1필지');assert.deepEqual(o.zr,[1,2]);assert.deepEqual(o.gr,[1,2]);
  assert.deepEqual(o.subj.map(r=>r[0]),['246-2','247-1','247-3','247-2']);assert.equal(o.subj[1][1],'101.3');
  assert.deepEqual(o.std,['1, 일반상업','3종일주, 4']);assert.equal(o.left,0);
  if(outDir)fs.writeFileSync(path.join(outDir,'광희동4필지_의견서.hwpx'),Buffer.from(o.b64,'base64'));

  // ⑤ 저장·복원 — 묶음 체크 유지
  const r=await page.evaluate(()=>{const o=JSON.parse(JSON.stringify(collect()));applyForm(o);refreshAfterLoad();
    return {grp:grpIdx(),total:GONGSI_RESULT.total,cks:[...document.querySelectorAll('#landTbl td.grp-ck input')].map(c=>c.checked)};});
  console.log('⑤',r);assert.deepEqual(r.grp,[1,2]);assert.equal(r.total,b.total);assert.deepEqual(r.cks,[false,true,true,false]);
  assert.equal(errs.length,0,errs.join('\n'));
  console.log('✅ 일부 필지만 묶기 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
