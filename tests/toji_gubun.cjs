// 토지 평가구분(구분평가·일부 평가외·전체 평가외) 검증 — 사용자 샘플 2건(2026-10-19)
//  ① 구산동 1530-3 949㎡ = 663 + 286(하천 저촉 부분, 행정적 조건 0.85) — 명세표 같은 기호 두 줄·괄호선, 의견서 번호 합침
//  ② 양주 회정동 123 1,935㎡ = 1,694 + 235(도로저촉 구분평가) + 6(타인점유 평가외), 124-5 236㎡ 전체 평가외
//     — 괄감 사정 1,929 / 242 감정평가 외
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_gubun.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
const near=(a,b,d)=>assert.ok(Math.abs(a-b)<(d||0.0001),a+' ≒ '+b+' 아님');
const outDir=process.env.TOJI_OUT||'';   // 지정하면 만든 서류를 저장(한글·엑셀에서 열어 보기용)
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  page.on('dialog',d=>d.accept());
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html?mode=land',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.calcGongsi&&window.ArapTojiDocuments&&window.ArapTojiOpinion);

  // 공통 픽스처 — 표준지 1개, 그 밖의 요인 2.49(샘플), 시점 1.00151
  const setup=async lands=>page.evaluate(lands=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    LANDS=lands;
    STDS=[{소재지:'구산동',지번:'1587',지목:'전',면적:'1974',공시지가:'138600',용도지역:'농림지역',etcDecide:'2.49'}];
    TRADES=[];APPRS=[];ETC={type:'t',idx:0};GA={idx:0};ETC_GUBUN_AUTO=[];
    for(const [k,v] of Object.entries({base_gijun:'2023.08.11',base_gongsi:'2023.01.01',jb_factor:'1.00151',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ov_client:'테스트'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,1);
    renderStds();renderLands();document.getElementById('bldBody').innerHTML='';calcGongsi();
  },lands);
  const L=(jb,area,extra)=>Object.assign({소재지:'구산동',지번:jb,지목:'전',면적:String(area),용도지역:'농림지역',공시지가:'143600',비고:'-',stdIdx:0,gf:['1.00','1.00','1.03','1.00','1.00','0.90'],gaf:['1','1','1','1','1','1']},extra||{});

  // ── ① 구산동 1530-3 ──
  await setup([L('1530-3',949)]);
  const s1=await page.evaluate(()=>{
    const sel=document.querySelector('#landTbl select[onchange^="setGubun"]');
    const opts=[...sel.options].map(o=>o.value);
    sel.value='gubun';sel.dispatchEvent(new Event('change'));
    const sub=document.querySelector('#landTbl tr.land-sub');
    const area=sub.querySelector('input');area.value='286';area.dispatchEvent(new Event('input'));
    const note=sub.querySelectorAll('input')[1];note.value='하천 저촉 부분';note.dispatchEvent(new Event('input'));
    return {opts,n:LANDS.length,sub:LANDS[1].sub,out:LANDS[1].out,parentSaj:LANDS[0]['사정면적'],
      no:[...document.querySelectorAll('#landTbl tr')].slice(1).map(tr=>tr.cells[0].textContent),
      gf:LANDS[1].gf.slice(),sajSum:document.getElementById('landSajSum').textContent,
      facRows:document.querySelectorAll('#tblGaebyeol tr').length};
  });
  console.log('① 구분평가 줄 추가',s1);
  assert.deepEqual(s1.opts,['normal','gubun','outPart','outAll']);
  assert.equal(s1.n,2);assert.equal(s1.sub,true);assert.equal(s1.out,false);
  assert.equal(s1.parentSaj,'663');                 // 공부 949 − 나눈 줄 286
  assert.deepEqual(s1.no,['1','1-1']);
  assert.deepEqual(s1.gf,['1.00','1.00','1.03','1.00','1.00','0.90']);   // 원 필지 개별요인 복사
  assert.equal(s1.sajSum,'949');
  assert.equal(s1.facRows,5);                       // 머리 + (요인+의견)×2

  // 나눈 줄만 행정적 조건 0.85 → 단가가 따로(샘플: 320,000 / 272,000)
  const c1=await page.evaluate(()=>{
    const rows=document.querySelectorAll('#tblGaebyeol tr');
    const inp=rows[3].querySelectorAll('input.fac')[4];inp.value='0.85';inp.dispatchEvent(new Event('input'));
    const g=GONGSI_RESULT;return {apply:g.rows.map(r=>r.apply),ind:g.rows.map(r=>r.individual),size:g.size,gongbu:g.gongbuSize,total:g.total,out:g.outSize,
      sisan:[...document.querySelectorAll('#tblSisan tr')].map(tr=>tr.cells[0].textContent)};
  });
  console.log('① 단가',c1);
  near(c1.ind[0],0.927,0.0005);near(c1.ind[1],0.788,0.0005);
  assert.equal(c1.apply[0],320000);assert.equal(c1.apply[1],272000);   // 샘플 결정단가와 같음
  near(c1.size,949);near(c1.gongbu,949);assert.equal(c1.out,0);
  assert.equal(c1.total,212160000+77792000);       // 289,952,000 (샘플 감정평가액)
  assert.deepEqual(c1.sisan,['일련번호','1','1-1','합계']);

  // 그 밖의 사항 자동 문구
  const e1=await page.evaluate(()=>ETC_ITEMS.filter(t=>/구분평가하였음/.test(t)));
  console.log('① 그 밖의 사항',e1);
  assert.deepEqual(e1,['본건 토지의 일부(약 286㎡)는 하천 저촉 부분인바 평가목적 등을 고려하여 구분평가하였음.']);

  // 명세표 행·실제 xlsx
  const m1=await page.evaluate(async()=>{
    const rows=ArapTojiDocuments.statementRows();
    const bytes=await ArapTojiDocuments.buildStatement(rows);
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const dec=new TextDecoder();
    const sh=dec.decode(ents.find(e=>/sheet1\.xml$/.test(e.name)).data),st=dec.decode(ents.find(e=>e.name==='xl/styles.xml').data);
    let b='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);
    return {rows:rows.map(r=>({no:r['명세_기호'],loc:r['명세_소재지'],gb:r['명세_공부면적'],saj:r['명세_사정면적'],unit:r['명세_단가'],amt:r['명세_평가액'],note:r['명세_비고'],br:r.br})),
      fmts:(st.match(/formatCode="&quot;[┌│└]&quot;\* [^"]*"/g)||[]),hasLine:sh.includes('<t>│</t>'),b64:btoa(b),
      jFormulas:(sh.match(/<f>\+I\d+\*H\d+<\/f>/g)||[]).length};
  });
  console.log('① 명세표',m1.rows,m1.fmts,'│ 줄',m1.hasLine,'금액 수식',m1.jFormulas);
  assert.equal(m1.rows.length,2);
  assert.deepEqual(m1.rows.map(r=>r.no),['1','']);
  assert.equal(m1.rows[1].loc,undefined);              // 소재지는 원 필지 줄에서 흘러내림
  assert.equal(m1.rows[1].gb,null);                    // 공부면적은 원 필지에 한 번만
  assert.deepEqual(m1.rows.map(r=>r.saj),[663,286]);
  assert.deepEqual(m1.rows.map(r=>r.unit),[320000,272000]);
  assert.deepEqual(m1.rows.map(r=>r.br),['top','end']);
  assert.equal(m1.rows[1].note,'하천 저촉 부분');
  assert.equal(m1.fmts.length,3);assert.ok(m1.hasLine);assert.equal(m1.jFormulas,2);
  if(outDir)fs.writeFileSync(path.join(outDir,'구산동_명세표.xlsx'),Buffer.from(m1.b64,'base64'));

  // 괄감(토지만) — 구분평가만 있으면 사정은 한 줄(949), 단가 '-'(샘플)
  const g1=await page.evaluate(()=>{const m=gwalMap();return {gb:m['괄_토지_공부면적'],saj:m['괄_토지_사정면적'],unit:m['괄_토지_단가'],amt:m['괄_토지_금액'],b2:m['괄_건물_사정면적'],b2amt:m['괄_건물_금액']};});
  console.log('① 괄감',g1);
  assert.deepEqual(g1,{gb:'949',saj:'949',unit:'-',amt:'289,952,000',b2:'-',b2amt:'-'});

  // 의견서 — 개별요인 표 번호 「1(하천 저촉)」, 단가·시산가액 표 번호 칸 합침, 비고 칸 사유
  const o1=await page.evaluate(async()=>{
    const d=ArapTojiOpinion.data();
    const bytes=await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),d);
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const x=new TextDecoder().decode(ents.find(e=>/section0\.xml$/.test(e.name)).data);
    const plain=x.replace(/<[^>]+>/g,'');
    let b='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);
    return {n:d.parcels.length,no:d.parcels.map(p=>[p['필지_번호'],p['공시개별_번호'],p['토지_면적'],p['토지_사정면적']]),ga:d.parcelsGa.map(p=>p['필지_번호']),
      runs:d.parcelRuns,subject:d.subject.map(s=>[s['토지_번호'],s['토지_사정면적'],s['토지_비고']]),pilji:d.standards[0]['필지_번호'],
      left:(x.match(/\{\{[^}]+\}\}/g)||[]).length,hasLabel:plain.includes('1(하천 저촉)'),hasNote:plain.includes('하천 저촉 부분'),
      rowSpan2:(x.match(/rowSpan="2"/g)||[]).length,b64:btoa(b),etc:plain.includes('구분평가하였음')};
  });
  console.log('① 의견서',o1.no,o1.ga,o1.runs,o1.subject,'남은 토큰',o1.left);
  assert.equal(o1.n,2);
  assert.deepEqual(o1.no,[['1','1','949','663'],['','1(하천 저촉)','','286']]);
  assert.deepEqual(o1.ga,['1','1(하천 저촉)']);
  assert.deepEqual(o1.runs,[[0,2]]);
  assert.deepEqual(o1.subject,[['1','949','일부 구분평가(286㎡)']]);
  assert.equal(o1.pilji,'1');
  assert.equal(o1.left,0);assert.ok(o1.hasLabel);assert.ok(o1.hasNote);assert.ok(o1.etc);
  if(outDir)fs.writeFileSync(path.join(outDir,'구산동_의견서.hwpx'),Buffer.from(o1.b64,'base64'));

  // 묶기는 같이 못 쓴다
  const gr=await page.evaluate(()=>{const s=document.getElementById('landSajMode');s.value='group';s.dispatchEvent(new Event('change'));return SAJ_MODE.land;});
  assert.equal(gr,'direct');

  // 저장·복원
  const r1=await page.evaluate(()=>{doSave();const o=JSON.parse(localStorage.getItem(FORM_STORAGE));clearForm();applyForm(o);refreshAfterLoad();
    return {n:LANDS.length,sub:LANDS[1].sub,saj:LANDS.map(l=>l['사정면적']),total:GONGSI_RESULT.total,auto:ETC_GUBUN_AUTO.length};});
  console.log('① 저장·복원',r1);
  assert.deepEqual(r1,{n:2,sub:true,saj:['663','286'],total:289952000,auto:1});

  // 나눈 줄 지우면 원 필지 사정면적 비움·문구 빠짐
  const d1=await page.evaluate(()=>{delLand(1);return {n:LANDS.length,saj:LANDS[0]['사정면적'],size:GONGSI_RESULT.size,etc:ETC_ITEMS.some(t=>/구분평가하였음/.test(t))};});
  console.log('① 나눈 줄 삭제',d1);
  assert.deepEqual(d1,{n:1,saj:'',size:949,etc:false});

  // ── ② 양주 회정동 — 구분평가·일부 평가외·전체 평가외 섞임 ──
  await setup([L('123',1935,{소재지:'회정동'}),L('124-5',236,{소재지:'회정동'})]);
  const s2=await page.evaluate(()=>{
    setGubun(0,'gubun');LANDS[1]['사정면적']='235';LANDS[1]['비고']='도로저촉부분';landPartChanged(1);
    LANDS[1].gf[4]='0.80';
    addLandPart(0,true);LANDS[2]['사정면적']='6';LANDS[2]['비고']='타인점유부분';landPartChanged(2);
    setGubun(3,'outAll');LANDS[3]['비고']='담보가치희박';landChanged();
    const g=GONGSI_RESULT;
    return {n:LANDS.length,no:LANDS.map((l,i)=>landNo(i)),saj:LANDS[0]['사정면적'],size:g.size,out:g.outSize,gongbu:g.gongbuSize,evalG:g.evalGongbu,
      total:g.total,apply:g.rows.map(r=>r.apply),parcels:landParcelCount(),addr:document.getElementById('sd_addr').textContent,
      sisan:[...document.querySelectorAll('#tblSisan tr')].map(tr=>tr.cells[0].textContent),
      fac:[...document.querySelectorAll('#tblGaebyeol tr')].filter(tr=>tr.cells.length>2).map(tr=>tr.cells[0].textContent)};
  });
  console.log('② 양주',s2);
  assert.deepEqual(s2.no,['1','1-1','1-2','2']);
  assert.equal(s2.saj,'1694');                    // 1,935 − 235 − 6
  near(s2.size,1929);near(s2.out,242);near(s2.gongbu,2171);near(s2.evalG,1935);
  assert.equal(s2.parcels,2);
  assert.deepEqual(s2.sisan,['일련번호','1','1-1','1-2','2','합계']);
  assert.deepEqual(s2.fac,['일련번호','1','1-1']);  // 평가외 줄은 개별요인 표에 없다
  assert.equal(s2.apply[2],0);assert.equal(s2.apply[3],0);
  assert.equal(s2.total,s2.apply[0]*1694+s2.apply[1]*235);

  const m2=await page.evaluate(async()=>{
    const rows=ArapTojiDocuments.statementRows();
    const bytes=await ArapTojiDocuments.buildStatement(rows);
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const sh=new TextDecoder().decode(ents.find(e=>/sheet1\.xml$/.test(e.name)).data);
    let b='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);
    return {rows:rows.map(r=>[r['명세_기호'],r['명세_사정면적'],r['명세_단가'],r['명세_평가액'],r['명세_비고'],r.br,r.out]),
      outText:(sh.match(/<t>감정평가 외<\/t>/g)||[]).length,b64:btoa(b)};
  });
  console.log('② 명세표',m2.rows,'감정평가 외',m2.outText);
  assert.deepEqual(m2.rows.map(r=>r[0]),['1','','','2']);
  assert.deepEqual(m2.rows.map(r=>r[5]),['top','mid','end',null]);
  assert.deepEqual(m2.rows.map(r=>r[2]).slice(2),['-','-']);
  assert.equal(m2.rows[3][4],'담보가치희박');
  assert.equal(m2.outText,2);
  if(outDir)fs.writeFileSync(path.join(outDir,'회정동_명세표.xlsx'),Buffer.from(m2.b64,'base64'));

  // 괄감(토지만) — 사정 1,929 / 둘째 줄(양식 빈 건물 줄) 242 감정평가 외 (샘플)
  const g2=await page.evaluate(async()=>{const m=gwalMap();
    const bytes=await ArapCheonggu.buildTokenHwpx(await gwalTplB64(),m,{});
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const x=new TextDecoder().decode(ents.find(e=>/section0\.xml$/.test(e.name)).data).replace(/<[^>]+>/g,'|');
    let b='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);
    return {gb:m['괄_토지_공부면적'],saj:m['괄_토지_사정면적'],unit:m['괄_토지_단가'],b2:m['괄_건물_사정면적'],b2amt:m['괄_건물_금액'],has:x.includes('감정평가 외'),b64:btoa(b)};});
  console.log('② 괄감',g2.gb,g2.saj,g2.unit,g2.b2,g2.b2amt);
  assert.deepEqual([g2.gb,g2.saj,g2.unit,g2.b2,g2.b2amt],['2,171','1,929','-','242','감정평가 외']);
  assert.ok(g2.has);
  if(outDir)fs.writeFileSync(path.join(outDir,'회정동_괄감.hwpx'),Buffer.from(g2.b64,'base64'));

  // 의견서 — 평가외 줄은 산출근거 표에서 빠지고 평가대상 토지 표 비고에
  const o2=await page.evaluate(async()=>{const d=ArapTojiOpinion.data();
    const bytes=await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),d);
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const x=new TextDecoder().decode(ents.find(e=>/section0\.xml$/.test(e.name)).data);
    let b='';const u=new Uint8Array(bytes.buffer||bytes);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);
    return {parcels:d.parcels.map(p=>p['공시개별_번호']),runs:d.parcelRuns,subject:d.subject.map(s=>[s['토지_번호'],s['토지_사정면적'],s['토지_비고']]),
      gongbu:d.global['토지_면적'],saj:d.global['토지_사정면적'],left:(x.match(/\{\{[^}]+\}\}/g)||[]).length,b64:btoa(b),
      etc:ETC_ITEMS.filter(t=>/하였음\.$/.test(t)&&/본건 토지 기호/.test(t))};});
  console.log('② 의견서',o2.parcels,o2.runs,o2.subject,o2.gongbu,o2.saj,o2.etc);
  assert.deepEqual(o2.parcels,['1','1(도로저촉)']);
  assert.deepEqual(o2.runs,[[0,2]]);
  assert.deepEqual(o2.subject,[['1','1,929','일부 구분평가(235㎡), 일부 감정평가 외(6㎡)'],['2','236','감정평가 외(담보가치희박)']]);
  assert.equal(o2.gongbu,'1,935');assert.equal(o2.saj,'1,929');assert.equal(o2.left,0);
  assert.deepEqual(o2.etc,[
    '본건 토지 기호1의 일부(약 235㎡)는 도로저촉부분인바 평가목적 등을 고려하여 구분평가하였음.',
    '본건 토지 기호1의 일부(약 6㎡)는 타인점유부분인바 평가목적 등을 고려하여 감정평가 외 하였음.',
    '본건 토지 기호2는 담보가치희박인바 평가목적 등을 고려하여 감정평가 외 하였음.']);
  if(outDir)fs.writeFileSync(path.join(outDir,'회정동_의견서.hwpx'),Buffer.from(o2.b64,'base64'));

  // 토지건물 모드 괄감 — 토지 줄 아래에 감정평가 외 줄을 끼운다(건물 줄은 그대로)
  const g3=await page.evaluate(async()=>{LAND_ONLY=false;const m=gwalMap();
    const bytes=await ArapCheonggu.buildTokenHwpx(await gwalTplB64(),m,{});
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const x=new TextDecoder().decode(ents.find(e=>/section0\.xml$/.test(e.name)).data);
    const trs=(x.match(/<hp:tr>.*?<\/hp:tr>/gs)||[]).map(t=>t.replace(/<[^>]+>/g,'|').replace(/\|+/g,'|'));
    const i=trs.findIndex(t=>t.includes('|토지|2,171|'));LAND_ONLY=true;
    return {land:trs[i],out:trs[i+1],bld:trs[i+2],left:(x.match(/\{\{[^}]+\}\}/g)||[]).length};});
  console.log('② 토지건물 괄감',g3);
  assert.ok(/\|242\|-\|감정평가 외\|/.test(g3.out));assert.ok(/^\|건물\|/.test(g3.bld));assert.equal(g3.left,0);

  // 위치도·요항표 — 나눈 줄은 필지로 안 센다
  const mp=await page.evaluate(()=>({map:mapItems().filter(it=>it.kind==='본건').map(it=>it.label),yh:yohangLands().length,label:caseObjLabel?1:0}));
  console.log('② 위치도·요항표',mp);
  assert.deepEqual(mp.map,['본건 1','본건 2']);assert.equal(mp.yh,2);

  // 「일반」으로 되돌리면 나눈 줄을 지운다
  const back=await page.evaluate(()=>{setGubun(0,'normal');setGubun(1,'normal');return {n:LANDS.length,saj:LANDS.map(l=>l['사정면적']||''),size:GONGSI_RESULT.size,out:GONGSI_RESULT.outSize,etc:ETC_GUBUN_AUTO.length};});
  console.log('② 일반 복귀',back);
  assert.deepEqual(back,{n:2,saj:['',''],size:2171,out:0,etc:0});

  assert.deepEqual(errs,[],'페이지 오류: '+errs.join(' / '));
  console.log('\n✅ 토지 평가구분(구분평가·평가외) 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
