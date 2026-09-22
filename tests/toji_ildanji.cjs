// 묶기(일단지) 검증 — 여러 필지를 한 덩어리 면적으로 평가
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_ildanji.cjs
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
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.calcGongsi);

  // 픽스처: 신사동 565-18(745.9㎡) + 565-25(219.9㎡) = 965.8㎡
  await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    LANDS=[{소재지:'신사동',지번:'565-18',지목:'대',면적:'745.9',용도지역:'2종일주',공시지가:'19510000',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]},
           {소재지:'신사동',지번:'565-25',지목:'대',면적:'219.9',용도지역:'2종일주',공시지가:'19510000',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
    STDS=[{소재지:'신사동',지번:'500',지목:'대',면적:'300',공시지가:'20000000',용도지역:'2종일주',etcDecide:'1'}];
    TRADES=[];APPRS=[];ETC={type:'t',idx:0};GA={idx:0};
    for(const [k,v] of Object.entries({base_gijun:'2026.04.24',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,1);
    renderStds();renderLands();document.getElementById('bldBody').innerHTML='';calcGongsi();
  });
  const before=await page.evaluate(()=>({rows:document.querySelectorAll('#tblSisan tr').length,size:GONGSI_RESULT.size,total:GONGSI_RESULT.total}));
  console.log('기준(묶기 전)',before);
  assert.equal(before.rows,4);                 // 머리행 + 필지 2행 + 합계
  near(before.size,965.8);

  // ① 묶기 모드 — 묶음 면적 자동(공부면적 합계), 사정면적 칸은 한 칸(rowspan=2), 시산가액은 한 줄
  const grp=await page.evaluate(()=>{
    const sel=document.getElementById('landSajMode');sel.value='group';sel.dispatchEvent(new Event('change'));
    const cell=[...document.querySelectorAll('#landTbl td.grp-c')];
    return {area:GROUP_AREA,rowspan:cell.length===1?cell[0].rowSpan:0,
      size:GONGSI_RESULT.size,gongbu:GONGSI_RESULT.gongbuSize,total:GONGSI_RESULT.total,unit:GONGSI_RESULT.applyUnit,
      sisanRows:document.querySelectorAll('#tblSisan tr').length,
      facRows:document.querySelectorAll('#tblGaebyeol tr').length,
      sajSum:document.getElementById('landSajSum').textContent,
      wrap:document.getElementById('landSajWrap').style.display};
  });
  console.log('① 묶기 켬',grp);
  assert.equal(grp.area,'965.8');
  assert.equal(grp.rowspan,2);                 // 사정면적 칸이 두 행을 합쳐 한 칸
  assert.equal(grp.sisanRows,2);               // 머리행 + 일단지 한 줄
  assert.equal(grp.facRows,2);                 // 개별요인도 한 세트
  near(grp.size,965.8);near(grp.gongbu,965.8);
  assert.equal(grp.sajSum,'965.8');
  assert.equal(grp.total,Math.round(grp.unit*965.8*1e-6)*1e6||grp.unit*965.8);

  // ② 묶음 면적 직접 수정 → 그 면적으로 평가, 필지별 안분 합계가 정확히 일치
  const edit=await page.evaluate(()=>{
    const inp=document.querySelector('#landTbl input.grp-in');inp.value='900';inp.dispatchEvent(new Event('input'));
    const split=groupSplit();
    return {area:GROUP_AREA,size:GONGSI_RESULT.size,split:split,sum:split.reduce((a,b)=>a+b,0),
      rowSizes:GONGSI_RESULT.rows.map(r=>r.size),total:GONGSI_RESULT.total,unit:GONGSI_RESULT.applyUnit};
  });
  console.log('② 묶음 면적 900으로 수정',edit);
  near(edit.size,900);near(edit.sum,900,1e-9);
  near(edit.split[0],900*745.9/965.8,0.0001);
  assert.deepEqual(edit.rowSizes,edit.split);   // 명세표가 쓰는 필지별 면적 = 안분 면적

  // ③ 개별요인은 한 세트 — 고치면 두 필지 모두 같은 값(단가도 필지 공통)
  const fac=await page.evaluate(()=>{
    const inp=document.querySelectorAll('#tblGaebyeol tr')[1].querySelectorAll('input')[0];
    inp.value='1.10';inp.dispatchEvent(new Event('input'));
    return {gf:LANDS.map(L=>L.gf[0]),applies:GONGSI_RESULT.rows.map(r=>r.apply)};
  });
  console.log('③ 개별요인 한 세트',fac);
  assert.deepEqual(fac.gf,['1.10','1.10']);
  assert.equal(fac.applies[0],fac.applies[1]);

  // ④ 명세표 — 필지별 행 유지, 사정면적 합계 = 묶음 면적, 평가액 합계 = 시산가액
  const st=await page.evaluate(()=>{
    const rows=ArapTojiDocuments.statementRows().filter(r=>r['명세_지번']);
    return {n:rows.length,jibun:rows.map(r=>r['명세_지번']),saj:rows.map(r=>r['명세_사정면적']),
      unit:rows.map(r=>r['명세_단가']),sum:rows.reduce((a,r)=>a+r['명세_평가액'],0),total:GONGSI_RESULT.total};
  });
  console.log('④ 명세표',st);
  assert.equal(st.n,2);
  assert.deepEqual(st.jibun,['565-18','565-25']);
  near(st.saj[0]+st.saj[1],900,1e-9);
  assert.equal(st.unit[0],st.unit[1]);
  near(st.sum,st.total,1);

  // ④-2 일단지 체크 — 위치도는 본건 이름표 하나(labelGroup)로 필지 테두리를 함께 가리킨다
  const before_map=await page.evaluate(()=>mapItems().filter(it=>it.kind==='본건').map(it=>({label:it.label,g:it.labelGroup})));
  console.log('④-2 일단지 체크 전 지도 항목',before_map);
  assert.deepEqual(before_map,[{label:'본건 1',g:''},{label:'본건 2',g:''}]);
  const ildanji=await page.evaluate(()=>{
    const box=document.getElementById('ov_ildanji');
    const shown=getComputedStyle(document.getElementById('ildanjiWrap')).display;
    box.checked=true;box.dispatchEvent(new Event('change'));
    return {shown,on:ILDANJI,
      map:mapItems().filter(it=>it.kind==='본건').map(it=>({label:it.label,g:it.labelGroup,poly:it.poly})),
      row:document.querySelectorAll('#tblSisan tr')[1].cells[0].textContent,
      lab:document.querySelector('#landTbl .grp-lab').textContent};
  });
  console.log('④-2 일단지 체크',ildanji);
  assert.notEqual(ildanji.shown,'none');            // 필지 2개 이상이면 체크박스가 보인다
  assert.deepEqual(ildanji.map,[{label:'본건',g:'본건',poly:true},{label:'본건',g:'본건',poly:true}]);
  assert.equal(ildanji.row,'일단지');                // 표의 묶음 이름도 '일단지'로
  assert.equal(ildanji.lab,'일단지 묶음');

  // ⑤ 의견서 데이터 — 일단지는 한 줄(「565-18 외 1필지」, 사정면적 900㎡, 시산가액 전체)
  const op=await page.evaluate(()=>{
    const d=ArapTojiOpinion.data();
    return {n:d.parcels.length,jibun:d.parcels[0]['토지_지번'],saj:d.parcels[0]['토지_사정면적'],
      sisan:d.parcels[0]['공시_시산가액'],total:won(GONGSI_RESULT.total),pilji:d.standards[0]['필지_번호']};
  });
  console.log('⑤ 의견서',op);
  assert.equal(op.n,1);
  // 대상물건 개요 표는 필지별 두 줄(소재지·지목·공부면적) + 합친 칸(사정면적 = 묶은 면적 전체)
  const sub=await page.evaluate(()=>{
    const d=ArapTojiOpinion.data();
    return {n:d.subject.length,group:d.landGroup,
      jibun:d.subject.map(m=>m['토지_지번']),gongbu:d.subject.map(m=>m['토지_면적']),
      saj:d.subject.map(m=>m['토지_사정면적'])};
  });
  console.log('⑤-2 대상물건 개요 표',sub);
  assert.equal(sub.group,true);
  assert.equal(sub.n,2);
  assert.deepEqual(sub.jibun,['565-18','565-25']);
  assert.equal(sub.saj[0],'900');            // 합친 칸에는 묶은 면적 전체
  assert.equal(op.jibun,'565-18 외 1필지');
  assert.equal(op.sisan,op.total);
  assert.equal(op.pilji,'일단지');

  // ⑥ 저장·복원 후에도 묶기 모드와 묶음 면적이 남는다
  const round=await page.evaluate(()=>{
    doSave();const o=JSON.parse(localStorage.getItem(FORM_STORAGE));
    clearForm();applyForm(o);refreshAfterLoad();
    return {mode:SAJ_MODE.land,area:GROUP_AREA,ildanji:ILDANJI,box:document.getElementById('ov_ildanji').checked,sel:document.getElementById('landSajMode').value,
      size:GONGSI_RESULT.size,rowspan:(document.querySelector('#landTbl td.grp-c')||{}).rowSpan,
      sisanRows:document.querySelectorAll('#tblSisan tr').length};
  });
  console.log('⑥ 저장·복원',round);
  assert.equal(round.mode,'group');assert.equal(round.area,'900');assert.equal(round.sel,'group');
  assert.equal(round.ildanji,true);assert.equal(round.box,true);
  near(round.size,900);assert.equal(round.rowspan,2);assert.equal(round.sisanRows,2);

  // ⑦ 직접입력으로 되돌리면 예전 동작(필지별 행·공부면적) 그대로
  const back=await page.evaluate(()=>{
    const sel=document.getElementById('landSajMode');sel.value='direct';sel.dispatchEvent(new Event('change'));
    return {rows:document.querySelectorAll('#tblSisan tr').length,size:GONGSI_RESULT.size,
      grp:document.querySelectorAll('#landTbl td.grp-c').length,rowSizes:GONGSI_RESULT.rows.map(r=>r.size)};
  });
  console.log('⑦ 직접입력 복귀',back);
  assert.equal(back.rows,4);assert.equal(back.grp,0);
  near(back.size,965.8);assert.deepEqual(back.rowSizes,[745.9,219.9]);

  assert.deepEqual(errs,[],'페이지 오류: '+errs.join(' / '));
  console.log('\n✅ 묶기(일단지) 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
