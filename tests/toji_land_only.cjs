// 「토지만」 평가(토지건물.html?mode=land) — 화면(건물 숨김·탭 이름)·건물가액 0·저장 복원·서류 5종(토지 전용 의견서·괄감 건물 줄 없음·요항표 Ⅲ 없음·명세표 토지 행만)
// 의견서는 1필지·3필지·3필지 일단지 모두: 남은 토큰 0, 표 칸 정합, Ⅳ 결정표(여러 필지면 토지 기호n + 합계, 일단지·1필지면 한 줄).
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_land_only.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.OPINION_TEST_OUTPUT||path.join(root,'..','opinion-test'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
async function check(page,bytesArr){return page.evaluate(async bytes=>{
  const es=await ArapCheonggu.parseZip(Uint8Array.from(bytes).buffer),HP='http://www.hancom.co.kr/hwpml/2011/paragraph',ch=(el,n)=>Array.from(el.children).filter(x=>x.localName===n);
  const xml=new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data),doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror'))throw Error('XML');
  const bad=[],tables=[];
  for(const t of doc.getElementsByTagNameNS(HP,'tbl')){const rows=ch(t,'tr'),cnt=+t.getAttribute('rowCnt'),cols=+t.getAttribute('colCnt'),occ=new Set();
    if(cnt!==rows.length)bad.push('rowCnt');
    rows.forEach((r,i)=>ch(r,'tc').forEach(c=>{const a=ch(c,'cellAddr')[0],s=ch(c,'cellSpan')[0];const rr=+a.getAttribute('rowAddr'),cc=+a.getAttribute('colAddr');if(rr!==i)bad.push('rowAddr');
      for(let y=rr;y<rr+ +s.getAttribute('rowSpan');y++)for(let z=cc;z<cc+ +s.getAttribute('colSpan');z++){const k=y+','+z;if(occ.has(k))bad.push('overlap');occ.add(k);}}));
    if(occ.size!==cnt*cols)bad.push('missing '+rows[0].textContent.slice(0,15));
    tables.push(rows.map(r=>ch(r,'tc').map(c=>c.textContent)));}
  return {left:xml.match(/\{\{[^}]+\}\}/g)||[],bad,tables,text:doc.documentElement.textContent};},Array.from(bytesArr));}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html?mode=land',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiOpinion&&window.ArapTojiDocuments);
    // ① 화면
    assert.equal(await page.evaluate(()=>LAND_ONLY),true,'?mode=land → 토지만');
    assert.equal(await page.locator('#ov_evalKind').inputValue(),'land');
    assert(await page.locator('#tabbtn-bld').isHidden(),'건물평가 탭 숨김');
    assert.equal(await page.locator('#tabbtn-final').textContent(),'3. 토지 평가액 결정');
    assert.equal(await page.locator('#tabbtn-cheonggu').textContent(),'7. 청구서 다운로드');
    assert(await page.locator('#sd_bldAmt').isHidden());assert(await page.locator('#btnFetchBld').isHidden(),'본건 건물 카드 숨김');
    assert.match(await page.locator('#mbTitle').textContent(),/EXACT 토지$/);
    await page.evaluate(()=>showTab('yohang'));assert(await page.locator('.y-bld').isHidden(),'요항표 Ⅲ 숨김');
    await page.evaluate(()=>{showTab('gyeoljeong');stepTab(1);});assert.equal(await page.evaluate(()=>CUR_TAB),'final','다음 → 건물평가 건너뜀');
    await page.evaluate(()=>stepTab(-1));assert.equal(await page.evaluate(()=>CUR_TAB),'gyeoljeong','이전 → 건물평가 건너뜀');
    const fill=async(mode,n)=>page.evaluate(({mode,n})=>{
      const set=(k,v)=>document.getElementById(k).value=String(v);
      LANDS=Array.from({length:n},(_,i)=>({소재지:'검증동',지번:(10+i)+'',지목:'답',면적:String(100+i*50),용도지역:'자연녹지',이용상황:'전',공시지가:'80000',도로교통:'세로(가)',형상:'부정형',지세:'평지',stdIdx:0,gf:[1,1,1,i?0.95:1,1,1],gaf:[1,1,1,1.05,1,1],gop:'필지'+(i+1)+' 표준지 비교',gaop:'필지'+(i+1)+' 사례 비교'}));
      STDS=[{소재지:'표준동',지번:'20-1',지목:'답',면적:'150',공시지가:'100000',용도지역:'자연녹지',etcDecide:'1.2'}];
      TRADES=[{loc:'거래동 1',use:'자연녹지',jimok:'답',landA:'300',total:'90000000',date:'2025.03.01',landUnit:'300000'},{},{}];
      APPRS=[{no:'a',loc:'평가동 1',use:'자연녹지',jimok:'답',cond:'전',unit:'310000',base:'2025.02.01',purp:'담보'}];
      ETC={type:'t',idx:0};GA={idx:0};
      SAJ_MODE.land=mode==='ildanji'?'group':'direct';ILDANJI=mode==='ildanji';
      // 건물 표에 값이 남아 있어도(평가대상 전환) 토지만이면 건물가액 0
      document.getElementById('bldBody').innerHTML='';addBldRow({'구분':'주','층별':'1층','구조':'철근콘크리트','용도':'점포','연면적':'100'});window.BLD_STATE={0:{reCost:'1500000',life:'50'}};
      renderStds();renderLands();
      for(const [k,v] of Object.entries({ov_client:'토지검증',ov_caseNo:'',base_gijun:'2026.01.01',base_gongsi:'2026.01.01',base_josa:'2026.01.02',bt_useApr:'2018.01.01',jb_factor:'1.02',eTime:'1.02',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1.03',ga_area:'1',ga_sajeong:'1'}))set(k,v);
      calcGongsi();renderBldCalc();calcFinal();
      return {land:LAND_FINAL,bld:BLD_RESULT.total,total:document.getElementById('fn_total').textContent,parcels:GONGSI_RESULT.rows.map(r=>r.total)};},{mode,n});
    // ② 의견서 3가지
    for(const [mode,n] of [['single',1],['multi',3],['ildanji',3]]){
      const v=await fill(mode,n);
      assert.equal(v.bld,0,'토지만 건물가액 0');
      assert.equal(v.total.replace(/[^\d]/g,''),String(v.land),'감정평가액 = 토지');
      const bytes=await page.evaluate(async()=>Array.from(await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),ArapTojiOpinion.data())));
      fs.writeFileSync(path.join(out,'토지만_의견서_'+mode+'.hwpx'),Buffer.from(bytes));
      const r=await check(page,bytes);
      assert.deepEqual(r.left,[],mode+' 남은 토큰');assert.deepEqual(r.bad,[],mode+' 표 구조');
      assert(!/건물면적|사용승인일|재조달원가\(원|건물금액/.test(r.text),mode+' 거래사례 표 건물 칸 없음');
      assert(r.text.includes('원가법'),'원가법 정의 문단 유지');
      assert(r.text.includes('본건 토지에 대하여')&&r.text.includes('현황 토지의 면적'),'오타 수정');
      assert(!r.text.includes('토지 및 건물의 특성'),'결정의견 토지의 특성');
      const iv=r.tables.find(t=>t[0][0]==='구분'&&t[0].join('').includes('감정평가액(원)'));
      assert(iv,'Ⅳ 결정표');
      const fmt=x=>x.toLocaleString('ko-KR');
      if(mode==='multi'){
        assert.equal(iv.length,1+3+1,'머리+필지3+합계');
        v.parcels.forEach((amt,i)=>{assert.equal(iv[1+i][0],'토지 기호'+(i+1));assert.equal(iv[1+i][3],fmt(amt));});
        assert.equal(iv[4][0],'합계');assert.equal(iv[4][1],'450');assert.equal(iv[4][3],fmt(v.land));
        assert.equal((r.text.match(/필지\d 표준지 비교/g)||[]).length,3);
      }else{
        assert.equal(iv.length,3,mode+' 머리+토지+합계');assert.equal(iv[1][0],'토지');assert.equal(iv[1][3],fmt(v.land));
        assert.equal(iv[2][1],mode==='single'?'100':'450','합계 사정면적');
      }
    }
    // ③ 괄호감정표 — 건물 줄 없음, 평가내역 세로 합침 4줄, 일반건축물대장 없음
    const gbytes=await page.evaluate(async()=>Array.from(await ArapCheonggu.buildTokenHwpx(await gwalTplB64(),gwalMap(),{})));
    fs.writeFileSync(path.join(out,'토지만_괄호감정표.hwpx'),Buffer.from(gbytes));
    const g=await check(page,gbytes);
    assert.deepEqual(g.bad,[],'괄감 표 구조');
    const gt=g.tables.find(t=>t.some(r=>r[0]==='평가내역'));
    assert(!gt.some(r=>r.includes('건물')),'괄감 건물 줄 없음');assert.equal(gt.length,11);
    assert(!g.text.includes('일반건축물대장')&&g.text.includes('토지대장, 귀 제시자료'),'목록표시근거');
    // ④ 요항표 — Ⅲ 건물의 개황 없음
    const ybytes=await page.evaluate(async()=>Array.from(await ArapTojiDocuments.buildYohang()));
    fs.writeFileSync(path.join(out,'토지만_요항표.hwpx'),Buffer.from(ybytes));
    const y=await check(page,ybytes);
    assert(!y.text.includes('건물의 개황')&&!y.text.includes('요항_건물'),'요항표 건물 절 없음');assert(y.text.includes('토지의 개황'));
    // ⑤ 명세표 — 토지 행만
    const rows=await page.evaluate(()=>ArapTojiDocuments.statementRows());
    assert.equal(rows.length,3);assert(rows.every(r=>!r.header));
    // ⑥ 저장·복원 + 평가대상 전환
    await page.evaluate(()=>{document.getElementById('ov_caseNo').value='LAND-TEST';doSave();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ArapTojiOpinion);
    assert.equal(await page.evaluate(()=>LAND_ONLY),true,'저장 건은 토지만으로 복원');
    await page.selectOption('#ov_evalKind','tb');
    assert.equal(await page.evaluate(()=>LAND_ONLY),false);assert(await page.locator('#tabbtn-bld').isVisible(),'토건 전환 → 건물 탭');
    assert.equal(await page.locator('#tabbtn-final').textContent(),'4. 토지건물 평가액 결정');
    assert(await page.evaluate(()=>BLD_RESULT.total>0),'토건 전환 → 남아 있던 건물 입력으로 건물가액 계산');
    assert.equal(await page.evaluate(()=>opinionTplPath()),'템플릿/토건 의견서(산출근거) 템플릿.hwpx');
    // ⑦ 저장된 토건 건을 연 채로 ?mode=land → 새 평가서(토지만)
    await page.evaluate(()=>doSave());
    await page.goto(base+'/토지건물.html?mode=land',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ArapTojiOpinion);
    assert.equal(await page.evaluate(()=>LAND_ONLY),true);assert.equal(await page.locator('#ov_caseNo').inputValue(),'','새 평가서');
    assert(await page.evaluate(()=>getLandList().some(c=>c.id==='LAND-TEST')),'전 건은 목록에 남음');
    assert.deepEqual(errors,[]);
    console.log('PASS',out);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
