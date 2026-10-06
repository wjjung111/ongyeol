// 「건물만」 평가(토지건물.html?mode=bld) — 화면(토지평가 숨김·탭 이름·이전/다음)·토지가액 0·저장 복원·건물 전용 의견서
// 의견서: 남은 토큰 0, 표 칸 정합, 토지 절 없음, Ⅲ 건물가액·Ⅳ 결정표(건물+합계), 건물 표 소재지 = 동 + 지번 + [도로명주소] + 도로명.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_bld_only.cjs
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
    // 칸마다 문단 글자를 '|'로 이어 둔다(소재지 칸 줄 확인용)
    tables.push(rows.map(r=>ch(r,'tc').map(c=>Array.from(c.getElementsByTagNameNS(HP,'p')).map(p=>p.textContent).join('|'))));}
  const top=ch(doc.documentElement,'p').map(p=>p.textContent);
  return {left:xml.match(/\{\{[^}]+\}\}/g)||[],bad,tables,top,text:doc.documentElement.textContent};},Array.from(bytesArr));}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html?mode=bld',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiOpinion&&window.ArapTojiDocuments);
    // ① 화면
    assert.equal(await page.evaluate(()=>BLD_ONLY),true,'?mode=bld → 건물만');
    assert.equal(await page.evaluate(()=>LAND_ONLY),false);
    assert.equal(await page.locator('#ov_evalKind').inputValue(),'bld');
    assert(await page.locator('#tabbtn-land').isHidden(),'토지평가 탭 숨김');
    assert(await page.locator('#tabbtn-bld').isVisible(),'건물평가 탭 보임');
    assert.equal(await page.locator('#tabbtn-bld').textContent(),'2. 건물평가');
    assert.equal(await page.locator('#tabbtn-final').textContent(),'3. 건물 평가액 결정');
    assert.equal(await page.locator('#tabbtn-cheonggu').textContent(),'7. 청구서 다운로드');
    assert(await page.locator('#sd_landAmt').isHidden()&&await page.locator('#sd_landUnit').isHidden(),'사이드바 토지 숨김');
    assert(await page.locator('#sd_bldAmt').isVisible());
    assert(await page.locator('#btnFetchBld').isVisible(),'본건 건물 카드 보임');
    assert.match(await page.locator('#mbTitle').textContent(),/EXACT 건물$/);
    await page.evaluate(()=>{showTab('daesang');stepTab(1);});assert.equal(await page.evaluate(()=>CUR_TAB),'bld','다음 → 토지평가 건너뜀');
    await page.evaluate(()=>stepTab(-1));assert.equal(await page.evaluate(()=>CUR_TAB),'daesang','이전 → 토지평가 건너뜀');
    await page.evaluate(()=>{showTab('bld');stepTab(1);});assert.equal(await page.evaluate(()=>CUR_TAB),'final');
    assert.equal(await page.evaluate(()=>opinionTplPath()),'템플릿/건물 의견서(산출근거) 템플릿.hwpx');
    // ② 값 — 토지 입력이 남아 있어도(평가대상 전환) 건물만이면 토지가액 0
    const fill=async(road,floors)=>page.evaluate(({road,floors})=>{
      const set=(k,v)=>document.getElementById(k).value=String(v);
      LANDS=[{소재지:'서울특별시 강남구 검증동',지번:'12-3',지목:'대',면적:'200',용도지역:'제2종일반주거',이용상황:'단독',공시지가:'5000000',도로교통:'세로(가)',형상:'세장형',지세:'평지',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
      STDS=[{소재지:'표준동',지번:'1',지목:'대',면적:'200',공시지가:'5000000',용도지역:'제2종일반주거',etcDecide:'1.2'}];
      TRADES=[];APPRS=[];
      renderStds();renderLands();
      document.getElementById('bldBody').innerHTML='';const st={};
      for(let i=0;i<floors;i++){addBldRow({'구분':'주','층별':(i+1)+'층','구조':'철근콘크리트구조','용도':i?'주택':'제2종근린생활시설','연면적':String(100+i*10)});st[i]={reCost:'1200000',life:'50'};}
      window.BLD_STATE=st;
      for(const [k,v] of Object.entries({ov_client:'건물검증',ov_caseNo:'',base_gijun:'2026.10.01',base_gongsi:'2026.01.01',base_josa:'2026.10.02',bt_useApr:'2015.05.12',bt_strct:'철근콘크리트구조',bt_flrs:'지상'+floors+'층',bt_purps:'제2종근린생활시설',bt_roadAddr:road,ov_purpose:'일반거래(시가참고)'}))set(k,v);
      LANDS[0].roadAddr='';
      calcGongsi();renderBldCalc();calcFinal();
      return {land:LAND_FINAL,bld:BLD_RESULT.total,size:BLD_RESULT.size,total:document.getElementById('fn_total').textContent,gongsi:(GONGSI_RESULT||{}).total||0};},{road,floors});
    const fmt=x=>x.toLocaleString('ko-KR');
    for(const [mode,road,floors] of [['road','서울특별시 강남구 검증로 45',2],['noroad','',1]]){
      const v=await fill(road,floors);
      assert(v.gongsi>0,'토지 계산 자체는 돌아도');assert.equal(v.land,0,'건물만 토지가액 0');assert(v.bld>0,'건물가액');
      assert.equal(v.total.replace(/[^\d]/g,''),String(v.bld),'감정평가액 = 건물');
      assert.equal(await page.evaluate(()=>cheongguAddr()),'서울특별시 강남구 검증동 12-3 건물','청구서 건명 … 건물');
      const bytes=await page.evaluate(async()=>Array.from(await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),ArapTojiOpinion.data())));
      fs.writeFileSync(path.join(out,'건물만_의견서_'+mode+'.hwpx'),Buffer.from(bytes));
      const r=await check(page,bytes);
      assert.deepEqual(r.left,[],mode+' 남은 토큰');assert.deepEqual(r.bad,[],mode+' 표 구조');
      // 토지 관련 절·문단 없음
      ['토지가액 산출근거','공시지가기준법에 의한 시산가액','평가대상 토지','비교표준지','본건 토지는','"공시지가기준법','토지 및 건물'].forEach(w=>assert(!r.text.includes(w),mode+' 없어야 함: '+w));
      assert(r.text.includes('부동산(건물)으로서'),'목적 문장');
      assert(r.top.some(t=>t.startsWith('Ⅲ. 건물가액 산출근거'))&&r.top.some(t=>t.startsWith('Ⅳ. 감정평가액의 결정')),'절 번호 Ⅲ·Ⅳ');
      assert(r.top.some(t=>t.startsWith('② 대상물건과'))&&r.top.some(t=>t.startsWith('③ 대상물건이')),'방법 목록 번호');
      assert(r.top.some(t=>t.startsWith('나.')&&t.includes('본건 건물은')&&t.includes('원가법을 적용')),'나. 원가법');
      assert(r.top.some(t=>t.startsWith('다.')&&t.includes('합리성을 검토하여야 하나, 본건 건물은')),'다. 합리성 검토 생략');
      assert(r.text.includes('본건 건물에 대하여 공부(등기사항전부증명서와 일반건축물대장 등)와 현황 건물의 면적·구조'),'그 밖의 사항 물적 동일성(건물)');
      assert(r.text.includes('건물의 특성을 종합적으로 고려하여 원가법에 의한 시산가액을 감정평가액으로 결정'),'결정의견');
      assert(r.text.includes('해당사항 없음'),'감정평가조건 그대로');
      // 건물 표 — 소재지 칸: 동 | 지번 | [도로명주소] | 도로명
      const bt=r.tables.find(t=>t[0].join('').replace(/\|/g,'').includes('구조 및 층수'));
      assert(bt,'건물 표');
      const loc=bt[1][1].split('|');
      if(road)assert.deepEqual(loc,['서울특별시 강남구 검증동','12-3','[도로명주소]',road],'소재지 칸 + 도로명');
      else assert.deepEqual(loc,['서울특별시 강남구 검증동','12-3'],'도로명 없으면 두 줄');
      // Ⅳ 결정표 — 건물 + 합계
      const iv=r.tables.find(t=>t[0][0]==='구분'&&t[0].join('').replace(/\|/g,'').includes('감정평가액(원)'));
      assert.equal(iv.length,3,'머리+건물+합계');assert.equal(iv[1][0],'건물');assert.equal(iv[1][3],fmt(v.bld));
      assert.equal(iv[2][0],'합계');assert.equal(iv[2][3],fmt(v.bld));
      // 건물가액 산출 표 층 수
      const calc=r.tables.find(t=>{const h=t[0].join('').replace(/\|/g,'');return h.includes('잔가율')&&h.includes('금액(원)');});
      const body=calc.slice(1).filter(x=>!/합계/.test(x.join('')));assert.equal(body.length,floors,'층별 행 '+JSON.stringify(calc));
      assert(calc[calc.length-1].includes(fmt(v.bld)),'건물가액 산출 표 합계');
    }
    // ③ 평가대상 전환 — 그 밖의 사항 물적 동일성 문구·결정의견 기본 문구가 따라 바뀐다
    assert.equal(await page.evaluate(()=>ETC_ITEMS[1]),await page.evaluate(()=>ETC_ITEM_BLD));
    assert.equal(await page.locator('#fn_opinion').inputValue(),await page.evaluate(()=>FN_OPINION_BLD));
    // ④ 저장·복원
    await page.evaluate(()=>{document.getElementById('ov_caseNo').value='BLD-TEST';doSave();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ArapTojiOpinion);
    assert.equal(await page.evaluate(()=>BLD_ONLY),true,'저장 건은 건물만으로 복원');
    assert.equal(await page.evaluate(()=>LAND_FINAL),0);
    await page.selectOption('#ov_evalKind','tb');
    assert.equal(await page.evaluate(()=>BLD_ONLY),false);assert(await page.locator('#tabbtn-land').isVisible(),'토건 전환 → 토지평가 탭');
    assert.equal(await page.locator('#tabbtn-final').textContent(),'4. 토지건물 평가액 결정');
    assert(await page.evaluate(()=>LAND_FINAL>0),'토건 전환 → 남아 있던 토지 입력으로 토지가액 계산');
    assert.equal(await page.evaluate(()=>ETC_ITEMS[1]),await page.evaluate(()=>ETC_ITEMS_DEFAULT[1]),'물적 동일성 기본 문구 복귀');
    assert.equal(await page.locator('#fn_opinion').inputValue(),await page.evaluate(()=>FN_OPINION_TB));
    await page.selectOption('#ov_evalKind','land');
    assert.equal(await page.evaluate(()=>LAND_ONLY&&!BLD_ONLY),true,'토지만 전환');
    await page.selectOption('#ov_evalKind','bld');
    assert.equal(await page.evaluate(()=>BLD_ONLY&&!LAND_ONLY),true,'건물만 전환');
    assert(await page.locator('#tabbtn-bld').isVisible(),'토지만→건물만 전환 시 건물 탭 다시 보임');
    assert.deepEqual(errors,[]);
    console.log('PASS',out);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
