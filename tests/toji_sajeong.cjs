// 사정면적(지분평가) 검증 — 토지·건물 표의 사정면적/지분 칸과 평가액 반영
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_sajeong.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.calcGongsi);

  // 기본 픽스처: 토지 1필지(271.3㎡) + 건물 2층(각 100㎡)
  await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    LANDS=[{소재지:'검증동',지번:'10-1',지목:'대',면적:'271.3',용도지역:'일반상업',공시지가:'800000',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
    STDS=[{소재지:'표준동',지번:'20-1',지목:'대',면적:'150',공시지가:'1000000',용도지역:'일반상업',etcDecide:'1'}];
    TRADES=[];APPRS=[];ETC={type:'t',idx:0};GA={idx:0};
    for(const [k,v] of Object.entries({base_gijun:'2026.01.01',base_gongsi:'2026.01.01',bt_useApr:'2018.01.01',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,1);
    renderStds();renderLands();
    document.getElementById('bldBody').innerHTML='';
    [{'층별':'1층','연면적':'100'},{'층별':'2층','연면적':'100'}].forEach(r=>addBldRow(r));
    window.BLD_STATE={0:{reCost:'1500000',life:'50'},1:{reCost:'1500000',life:'50'}};
    calcGongsi();renderBldCalc();calcFinal();
  });

  const before=await page.evaluate(()=>({land:GONGSI_RESULT.total,size:GONGSI_RESULT.size,gongbu:GONGSI_RESULT.gongbuSize,bld:BLD_RESULT.total,bsize:BLD_RESULT.size}));
  console.log('기준(사정면적 없음)',before);
  assert.equal(before.size,271.3);assert.equal(before.land,271.3*1000000);

  // ① 토지: 지분입력 모드 → 지분 50% → 사정면적 자동 135.65, 평가액 절반
  const share=await page.evaluate(()=>{
    document.getElementById('landSajMode').value='share';
    document.getElementById('landSajMode').dispatchEvent(new Event('change'));
    const shareInput=[...document.querySelectorAll('#landTbl input')].find(i=>i.placeholder==='50 또는 1/2');
    shareInput.value='50';shareInput.dispatchEvent(new Event('input'));
    return {saj:LANDS[0]['사정면적'],size:GONGSI_RESULT.size,gongbu:GONGSI_RESULT.gongbuSize,total:GONGSI_RESULT.total,
            sajSum:document.getElementById('landSajSum').textContent,
            ga:GEORAE_RESULT&&GEORAE_RESULT.total,
            fnLand:document.getElementById('fn_landSize').textContent};
  });
  console.log('① 토지 지분 50%',share);
  assert.equal(share.saj,'135.65');
  assert.equal(share.size,135.65);
  assert.equal(share.gongbu,271.3);
  assert.equal(share.total,135.65*1000000);
  assert.equal(share.fnLand,'135.65');

  // ② 사정면적 자유 수정(소수점) → 그 값으로 평가
  const manual=await page.evaluate(()=>{
    const sajInput=[...document.querySelectorAll('#landTbl input')].find(i=>i.value==='135.65');
    sajInput.value='135.6';sajInput.dispatchEvent(new Event('input'));
    return {saj:LANDS[0]['사정면적'],size:GONGSI_RESULT.size,total:GONGSI_RESULT.total};
  });
  console.log('② 사정면적 직접 수정',manual);
  assert.equal(manual.size,135.6);
  assert.equal(manual.total,135.6*1000000);

  // ③ 저장·복원 후에도 모드·사정면적·지분이 남는다
  const round=await page.evaluate(()=>{
    doSave();const o=JSON.parse(localStorage.getItem(FORM_STORAGE));
    clearForm();applyForm(o);refreshAfterLoad();
    const shareShown=getComputedStyle(document.querySelectorAll('#landTbl tr')[0].cells[5]).display;
    return {mode:SAJ_MODE.land,saj:LANDS[0]['사정면적'],share:LANDS[0]['지분'],sel:document.getElementById('landSajMode').value,
            size:GONGSI_RESULT.size,total:GONGSI_RESULT.total,shareShown};
  });
  console.log('③ 저장·복원',round);
  assert.equal(round.mode,'share');assert.equal(round.saj,'135.6');assert.equal(round.share,'50');
  assert.equal(round.sel,'share');assert.equal(round.size,135.6);

  // ④ 건물: 지분입력 → 30% → 사정면적 자동 30㎡, 건물가액 30%
  const bld=await page.evaluate(()=>{
    document.getElementById('bldSajMode').value='share';
    document.getElementById('bldSajMode').dispatchEvent(new Event('change'));
    const rows=[...document.querySelectorAll('#bldBody tr')];
    rows.forEach(tr=>{const s=bldCell(tr,'지분');s.value='30';s.dispatchEvent(new Event('input'));});
    return {saj:rows.map(tr=>bldCell(tr,'사정면적').value),size:BLD_RESULT.size,gongbu:BLD_RESULT.gongbuSize,total:BLD_RESULT.total,
            fnBld:document.getElementById('fn_bldSize').textContent,
            sajSum:document.getElementById('bldSajSum').textContent};
  });
  console.log('④ 건물 지분 30%',bld);
  assert.deepEqual(bld.saj,['30','30']);
  assert.equal(bld.size,60);assert.equal(bld.gongbu,200);
  assert.equal(bld.total,Math.round(before.bld*0.3*1e6)/1e6);
  assert.equal(bld.fnBld,'60');

  // ⑤ 지분입력 칸은 직접입력 모드에서 숨는다 / 사정면적은 남는다
  const hide=await page.evaluate(()=>{
    document.getElementById('bldSajMode').value='direct';
    document.getElementById('bldSajMode').dispatchEvent(new Event('change'));
    const tr=document.querySelector('#bldBody tr');
    return {shareTd:getComputedStyle(tr.querySelector('td[data-k="bld.지분"]')).display,
            saj:bldCell(tr,'사정면적').value,size:BLD_RESULT.size};
  });
  console.log('⑤ 직접입력 전환',hide);
  assert.equal(hide.shareTd,'none');assert.equal(hide.saj,'30');assert.equal(hide.size,60);

  // ⑥ 괄감 토큰: 공부면적 / 사정면적이 갈라진다
  const doc=await page.evaluate(()=>{
    const g=gwalMap();
    return {토지공부:g['괄_토지_공부면적'],토지사정:g['괄_토지_사정면적'],건물공부:g['괄_건물_공부면적'],건물사정:g['괄_건물_사정면적']};
  });
  console.log('⑥ 괄감 토큰',doc);
  assert.equal(doc.토지공부,'271.3');assert.equal(doc.토지사정,'135.6');
  assert.equal(doc.건물공부,'200');assert.equal(doc.건물사정,'60');

  // ⑦ 엑셀 복사 문자열에 사정면적·지분 열이 들어간다
  const copy=await page.evaluate(async()=>{
    let text='';navigator.clipboard.writeText=async t=>{text=t;};
    copyLandExcel();await new Promise(r=>setTimeout(r,50));const land=text;
    text='';copyBldExcel();await new Promise(r=>setTimeout(r,50));
    return {land,bld:text};
  });
  console.log('⑦ 엑셀 복사 토지\n'+copy.land+'\n--- 건물\n'+copy.bld);
  assert.ok(copy.land.split('\n')[0].includes('사정면적(㎡)'));
  assert.ok(copy.land.split('\n')[0].includes('지분(%)'));
  assert.ok(copy.bld.split('\n')[4].includes('사정면적(㎡)'));

  // ⑧ 명세표 행: 공부면적 / 사정면적이 갈라진다
  const st=await page.evaluate(()=>window.ArapTojiDocuments.statementRows().map(r=>({기호:r['명세_기호'],공부:r['명세_공부면적'],사정:r['명세_사정면적'],액:r['명세_평가액']})));
  console.log('⑧ 명세표 행',st);
  assert.equal(st[0].공부,271.3);assert.equal(st[0].사정,135.6);
  assert.equal(st[1].공부,100);assert.equal(st[1].사정,30);

  // ⑨ 의견서 시산가액 표: 평가에 쓴 사정면적이 「공부 x 지분 = 사정」으로 적힌다(공시지가기준법·거래사례비교법 둘 다)
  const opinion=await page.evaluate(async()=>{
    // 지분을 분수(1/2)로 적어도 받아야 한다
    const inp=sel=>[...document.querySelectorAll('#landTbl input')].find(sel);
    const gongbu=inp(i=>i.value===String(LANDS[0]['면적']));
    gongbu.value='223.7';gongbu.dispatchEvent(new Event('input',{bubbles:true}));
    const shareInput=inp(i=>i.placeholder==='50 또는 1/2');
    shareInput.value='1/2';shareInput.dispatchEvent(new Event('input',{bubbles:true}));
    const saj=LANDS[0]['사정면적'];
    const maps=ArapTojiOpinion.data();
    const bytes=await ArapTojiOpinion.build(await fetchTplB64('템플릿/토건 의견서(산출근거) 템플릿.hwpx'),maps);
    const entries=await ArapCheonggu.parseZip(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const xml=new TextDecoder().decode(entries.find(e=>e.name==='Contents/section0.xml').data);
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw Error('XML 오류');
    const cells=[...doc.getElementsByTagNameNS('*','tc')].map(c=>c.textContent.replace(/\s+/g,' ').trim());
    // 표 머리(사정면적/공부면적)와 층별 면적도 같이 본다
    const heads=[...doc.getElementsByTagNameNS('*','tbl')].map(t=>[...t.getElementsByTagNameNS('*','tc')].slice(0,9).map(c=>c.textContent.replace(/\s+/g,'')).join('|'));
    return {saj,area:maps.parcels[0]['토지_사정면적'],gongbu:maps.parcels[0]['토지_면적'],
            floor:{면적:maps.floors[0]['층1_면적'],공부:maps.floors[0]['층1_공부면적']},
            heads:heads.filter(h=>h.includes('면적')),
            cells:cells.filter(t=>t.includes('223.7')||t.includes('111.85')),left:(xml.match(/\{\{[^}]+\}\}/g)||[])};
  });
  console.log('⑨ 의견서 면적 칸',opinion);
  assert.equal(opinion.saj,'111.85','분수 지분(1/2)도 사정면적으로 계산된다');
  assert.equal(opinion.area,'223.7 x 1/2 = 111.85');
  assert.equal(opinion.gongbu,'223.7','물건 표는 공부면적 그대로');
  assert.equal(opinion.cells.filter(t=>t==='223.7 x 1/2 = 111.85').length,2,'공시지가기준법·거래사례비교법 시산가액 표 두 곳');
  assert.ok(opinion.cells.includes('223.7'),'물건 표의 공부면적은 그대로');
  assert.deepEqual(opinion.left,[],'남은 토큰 없음');
  // 건물: 재조달원가 표는 공부(연)면적 100, 건물가액 산출 표는 사정면적 30
  assert.equal(opinion.floor.공부,'100');
  assert.equal(opinion.floor.면적,'30');
  const head=t=>opinion.heads.filter(h=>h.includes(t)).length;
  assert.ok(opinion.heads.some(h=>h.includes('사정면적')),'시산가액·건물가액·최종 표 머리는 사정면적');
  assert.ok(opinion.heads.some(h=>h.includes('공부면적')),'재조달원가 표 머리는 공부면적');
  assert.equal(opinion.heads.filter(h=>h.includes('사정면적')).length,4,'사정면적 머리 4곳(공시·거래·건물가액·최종)');
  assert.equal(opinion.heads.filter(h=>h.includes('공부면적')).length,1,'공부면적 머리 1곳(재조달원가)');

  if(errs.length){console.log('페이지 오류',errs);throw new Error('page errors');}
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
