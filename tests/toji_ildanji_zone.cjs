// 묶음(일단지) 용도지역별 나누기 검증 — 247-1(45.2)+247-3(56.1) = 101.3㎡ → 일반상업 60.1 / 3종일주 41.2
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_ildanji_zone.cjs
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
  const ctx=await browser.newContext({acceptDownloads:true});const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|JSONP|시군구 조회/.test(m.text()))errs.push('console: '+m.text());});
  page.on('dialog',d=>d.accept());
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.calcGongsi&&window.ArapTojiDocuments&&window.ArapTojiOpinion);
  const outDir=process.env.OUT_DIR||'';

  // 픽스처: 표준지 A(일반상업 30,000,000) · B(3종일주 20,000,000), 거래사례 하나
  await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    LANDS=[{소재지:'서울특별시 중구 광희동2가',지번:'247-1',지목:'대',면적:'45.2',용도지역:'일반상업지역, 제3종일반주거지역',공시지가:'8547000',stdIdx:0},
           {소재지:'서울특별시 중구 광희동2가',지번:'247-3',지목:'대',면적:'56.1',용도지역:'일반상업지역, 제3종일반주거지역',공시지가:'8548000',stdIdx:0}];
    STDS=[{소재지:'광희동2가',지번:'100',지목:'대',면적:'300',공시지가:'30000000',용도지역:'일반상업지역',etcDecide:'1'},
          {소재지:'광희동2가',지번:'200',지목:'대',면적:'200',공시지가:'20000000',용도지역:'제3종일반주거지역',etcDecide:'1'}];
    TRADES=[{loc:'광희동2가 300',total:'3000000000',landA:'100',landUnit:'30000000',date:'2026.01.01'}];APPRS=[];ETC={type:'t',idx:0};GA={idx:0};
    for(const [k,v] of Object.entries({base_gijun:'2026.08.31',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1',ga_sajeong:'1',ga_area:'1'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,1);
    ILDANJI=true;
    renderStds();renderLands();document.getElementById('bldBody').innerHTML='';calcGongsi();
    const sel=document.getElementById('landSajMode');sel.value='group';sel.dispatchEvent(new Event('change'));
  });
  // ① 용도지역별 나누기 버튼 → 용도지역 칸에서 이름 두 개, 첫 줄 면적 입력 → 둘째 줄 자동
  const z=await page.evaluate(()=>{
    const btn=[...document.querySelectorAll('#landTbl td.zone-c button')].find(b=>/용도지역별 나누기/.test(b.textContent));btn.click();
    const a=document.querySelector('#landTbl input.zone-ar[data-k="0"]');a.value='60.1';a.dispatchEvent(new Event('input'));
    return {names:GZONES.map(Z=>Z.name),ph:document.querySelector('#landTbl input.zone-ar[data-k="1"]').placeholder,hint:document.getElementById('zoneSumHint').textContent,
      sisan:document.querySelectorAll('#tblSisan tr').length,fac:document.querySelectorAll('#tblGaebyeol tr').length,
      size:GONGSI_RESULT.size,gongbu:GONGSI_RESULT.gongbuSize,rows:GONGSI_RESULT.rows.length};
  });
  console.log('①',z);
  assert.deepEqual(z.names,['일반상업지역','제3종일반주거지역']);
  assert.match(z.ph,/41\.2/);assert.match(z.hint,/= 묶은 면적/);
  assert.equal(z.sisan,4);   // 머리 + 구역 2 + 합계
  assert.equal(z.fac,5);     // 머리 + (요인+의견)×2 — 개별요인 2줄
  near(z.size,101.3);near(z.gongbu,101.3);assert.equal(z.rows,2);

  // ② 둘째 구역을 표준지 B로, 개별요인 0.9 → 구역별 단가
  const c=await page.evaluate(()=>{
    GZONES[1].stdIdx=1;GZONES[1].gf=['1.00','1.00','1.00','1.00','0.90','1.00'];calcGongsi();
    // 표준지가 둘이면 그 밖의 요인이 표준지별 블록 — 표준지 B 블록 결정 보정치 1.00
    const blocks=ETC_BLOCKS.map(b=>b.rows.join(','));
    TRADES[0].etcMemBy[1]={f:Object.assign({},ETC_DEF_F,{eTime:'1'}),dec:'1'};calcGongsi();
    const r=GONGSI_RESULT.rows;
    return {blocks:blocks,multi:ETC_MULTI,u0:r[0].apply,u1:r[1].apply,s0:r[0].size,s1:r[1].size,total:GONGSI_RESULT.total,
      first:[...document.querySelectorAll('#tblSisan tr')].slice(1,3).map(tr=>tr.cells[0].textContent),
      ga:GEORAE_RESULT.rows.length,gaTotal:GEORAE_RESULT.total,unitDoc:landUnitDoc()};
  });
  console.log('②',c);
  assert.ok(c.multi);assert.deepEqual(c.blocks,['z0','z1']);
  assert.equal(c.u0,30000000);assert.equal(c.u1,18000000);near(c.s0,60.1);near(c.s1,41.2);
  assert.equal(c.total,30000000*60.1+18000000*41.2);
  assert.deepEqual(c.first,['일단지일반상업지역','일단지제3종일반주거지역']);
  assert.equal(c.ga,2);assert.equal(c.unitDoc,'-');

  // ③ 저장·복원
  const sv=await page.evaluate(()=>{const o=JSON.parse(JSON.stringify(collect()));GZONES=[];applyForm(o);refreshAfterLoad();
    return {n:GZONES.length,names:GZONES.map(Z=>Z.name),total:GONGSI_RESULT.total,zoneRows:document.querySelectorAll('#landTbl .zone-r input.zone-nm').length};});
  console.log('③',sv);
  assert.equal(sv.n,2);assert.equal(sv.zoneRows,2);assert.equal(sv.total,c.total);

  // ④ 명세표 — 필지 줄(2) + 구역 줄(2)을 나란히: 공부 45.2</56.1>, 사정 <60.1/>41.2, 비고 「일단지 / 일반상업지역」
  const m=await page.evaluate(async()=>{
    const rows=ArapTojiDocuments.statementRows().filter(r=>!r.header&&r['명세_지번']!=null&&r['명세_지번']!==''||r.hbr);
    const bytes=await ArapTojiDocuments.buildStatement(ArapTojiDocuments.statementRows());
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const dec=new TextDecoder();
    const sh=dec.decode(ents.find(e=>/sheet1\.xml$/.test(e.name)).data),st=dec.decode(ents.find(e=>e.name==='xl/styles.xml').data);
    let b='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);
    window._use=rows.map(r=>r['명세_지역구조']);
    return {use:window._use,rows:rows.map(r=>[r['명세_기호'],r['명세_지번'],r['명세_공부면적'],r['명세_사정면적'],r['명세_단가'],r['명세_평가액'],r['명세_비고'],r.gbr,r.hbr]),
      fmts:(st.match(/formatCode="[^"]*&quot;(&lt;|&gt;)&quot;[^"]*"/g)||[]).length,lines:(sh.match(/<t>│<\/t>/g)||[]).length,b64:btoa(b)};
  });
  console.log('④ 명세표',m.rows,'서식',m.fmts,'세로선',m.lines);
  assert.deepEqual(m.rows,[
    ['2'.replace('2','1'),'247-1',45.2,60.1,30000000,30000000*60.1,'일단지\n일반상업지역','top','top'],
    ['2','247-3',56.1,41.2,18000000,18000000*41.2,'일단지\n제3종\n일반주거지역','end','end']]);
  assert.deepEqual(m.use,['일반상업지역\n제3종\n일반주거지역','일반상업지역\n제3종\n일반주거지역']);
  assert.equal(m.fmts,4);   // 공부 < > · 사정 < >assert.ok(m.lines>=6);
  if(outDir)fs.writeFileSync(path.join(outDir,'광희동_명세표.xlsx'),Buffer.from(m.b64,'base64'));

  // ⑤ 의견서 — 산출근거 표는 구역 2줄(번호 일반상업·3종일주), 평가대상 토지 표는 필지 2줄
  const o=await page.evaluate(async()=>{
    const d=ArapTojiOpinion.data();
    const bytes=await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),d);
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const x=new TextDecoder().decode(ents.find(e=>/section0\.xml$/.test(e.name)).data);
    const plain=x.replace(/<[^>]+>/g,'');
    let b='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);
    return {parcels:d.parcels.map(p=>[p['공시개별_번호'],p['토지_용도지역'],p['토지_사정면적'],p['공시_적용단가'],p['공시_시산가액']]),
      subject:d.subject.map(s=>[s['토지_지번'],s['토지_면적']]),std:d.standards.map(s=>s['필지_번호']),unit:d.global['공시_적용단가'],
      left:(x.match(/\{\{[^}]+\}\}/g)||[]).length,has:['일반상업','3종일주','2,544,600,000'].map(t=>plain.includes(t)),b64:btoa(b)};
  });
  console.log('⑤ 의견서',o.parcels,o.subject,o.std,o.unit,'남은 토큰',o.left,o.has);
  assert.deepEqual(o.parcels,[['일반상업','일반상업지역','60.1','30,000,000','1,803,000,000'],['3종일주','제3종일반주거지역','41.2','18,000,000','741,600,000']]);
  assert.deepEqual(o.subject,[['247-1','45.2'],['247-3','56.1']]);
  assert.deepEqual(o.std,['일반상업','3종일주']);assert.equal(o.unit,'-');
  assert.equal(o.left,0);assert.ok(o.has.every(Boolean));
  if(outDir)fs.writeFileSync(path.join(outDir,'광희동_의견서.hwpx'),Buffer.from(o.b64,'base64'));

  // ⑥ 괄감 — 단가 '-', 사정 101.3
  const g=await page.evaluate(()=>{const m=gwalMap();return [m['괄_토지_공부면적'],m['괄_토지_사정면적'],m['괄_토지_단가'],m['괄_토지_금액']];});
  console.log('⑥ 괄감',g);assert.deepEqual(g,['101.3','101.3','-','2,544,600,000']);

  // ⑥-2 묶음 지분 1/2 — 구역 평가면적 = 구역 면적 × 1/2, 그 밖의 사항 지분 문구, 명세표 사정면적도 지분 면적
  const sh=await page.evaluate(()=>{
    const inp=document.querySelector('#landTbl input.grp-sh');inp.value='1/2';inp.dispatchEvent(new Event('input'));
    const st=ArapTojiDocuments.statementRows().filter(r=>r.hbr);
    return {sizes:GONGSI_RESULT.rows.map(r=>r.size),total:GONGSI_RESULT.total,size:GONGSI_RESULT.size,ga:GEORAE_RESULT.rows.map(r=>r.size),
      ev:[...document.querySelectorAll('#landTbl .zone-ev')].map(e=>e.textContent),sum:document.getElementById('landSajSum').textContent,
      etc:ETC_ITEMS.some(t=>/지분\(1\/2\)만의 평가/.test(t)),st:st.map(r=>r['명세_사정면적']),gwal:gwalMap()['괄_토지_사정면적'],
      saved:JSON.parse(JSON.stringify(collect())).GROUP_SHARE};
  });
  console.log('⑥-2 지분',sh);
  assert.deepEqual(sh.sizes,[30.05,20.6]);assert.deepEqual(sh.ga,[30.05,20.6]);near(sh.size,50.65);
  assert.equal(sh.total,c.total/2);assert.deepEqual(sh.ev,['→ 30.05','→ 20.6']);assert.match(sh.sum,/지분 1\/2 → 평가 50\.65/);
  assert.ok(sh.etc);assert.deepEqual(sh.st,[30.05,20.6]);assert.equal(sh.gwal,'50.65');assert.equal(sh.saved,'1/2');
  await page.evaluate(()=>{const inp=document.querySelector('#landTbl input.grp-sh');inp.value='';inp.dispatchEvent(new Event('input'));});

  // ⑦ 구역 하나 지우기 → 묶음 한 줄로 복귀
  const back=await page.evaluate(()=>{delZone(1);return {n:GZONES.length,rows:GONGSI_RESULT.rows.length,sisan:document.querySelectorAll('#tblSisan tr').length};});
  console.log('⑦',back);assert.equal(back.n,0);assert.equal(back.sisan,2);
  assert.equal(errs.length,0,errs.join('\n'));
  console.log('통과');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
