// 토지평가액 결정 — 공시지가기준법·거래사례비교법 가중평균(2026-11-23).
// 끄면 종전(공시지가기준법 시산가액), 켜면 결정단가 = 반올림(공시 단가×a% + 거래 단가×(100−a)%) → 토지가액·괄감·명세표·의견서 문장이 따라가고 저장·복원.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_land_weight.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
async function fixture(page){return page.evaluate(()=>{
  const set=(k,v)=>document.getElementById(k).value=String(v);
  LANDS=[{소재지:'검증동',지번:'10-1',지목:'대',면적:'100',용도지역:'일반상업',공시지가:'800000',도로교통:'광대한면',형상:'정방형',지세:'평지',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,0.95,1.05,1]}];
  STDS=[{소재지:'표준동',지번:'20-1',지목:'대',면적:'150',공시지가:'1000000',용도지역:'일반상업',etcDecide:'2'}];
  TRADES=[0,1,2].map(i=>({loc:'거래동 '+(30+i)+'-1',use:'일반상업',jimok:'대',landA:'100',bldA:'0',total:'200000000',date:'2025.01.01',landUnit:'2000000'}));
  APPRS=[{no:'a',loc:'평가동 40-1',use:'일반상업',jimok:'대',cond:'상업용',unit:'2100000',base:'2025.02.01',purp:'시가참고'}];
  ETC={type:'t',idx:0};GA={idx:0};
  renderStds();renderLands();
  for(const [k,v] of Object.entries({ov_client:'가중평균 검증',base_gijun:'2026.01.01',base_gongsi:'2026.01.01',base_josa:'2026.01.02',bt_useApr:'2018.01.01',bt_strct:'철근콘크리트',bt_purps:'근린생활시설',bt_flrs:'지상 2층',jb_factor:'1.02',jb_region:'검증시 검증구',jb_use:'상업',eTime:'1.02',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1.03',ga_area:'1',ga_sajeong:'1'}))set(k,v);
  for(let i=1;i<=6;i++)set('e_f'+i,1);
  if(document.getElementById('op_location')){set('op_location','검증초등학교 북측');set('op_costSource','검증용 단가표, 2026년');set('op_costRows','검증분류\t점포\t철근콘크리트\t3\t1,500,000\t50\t(45~55)');}
  document.getElementById('bldBody').innerHTML='';addBldRow({'동':'가','구분':'주','층구분':'지상','층별':'1층','구조':'철근콘크리트','용도':'점포','연면적':'200'});
  window.BLD_STATE={0:{reCost:'1500000',life:'50'}};
  calcGongsi();renderBldCalc();calcFinal();
  return {gs:GONGSI_RESULT.rows[0].apply,ga:GEORAE_RESULT.rows[0].apply,land:LAND_FINAL,bld:BLD_RESULT.total};
});}
async function opinionText(page){return page.evaluate(async()=>{
  const bytes=await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),ArapTojiOpinion.data());
  const entries=await ArapCheonggu.parseZip(bytes.buffer||Uint8Array.from(bytes).buffer);
  return entries.filter(e=>/^Contents\/section\d+\.xml$/.test(e.name)).map(e=>{const x=new TextDecoder().decode(e.data);
    if(/\{\{[^}]+\}\}/.test(x))throw Error('토큰 남음');
    return new DOMParser().parseFromString(x,'application/xml').documentElement.textContent;}).join('\n');});}
const won=n=>Math.round(n).toLocaleString('ko-KR');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiOpinion&&window.ArapTojiDocuments);
    const f=await fixture(page);
    assert.equal(f.land,f.gs*100,'끔 = 공시지가기준법 시산가액');
    assert.notEqual(f.gs,f.ga,'두 방법 단가가 달라야 검증이 됨');
    const off=await opinionText(page);
    assert(off.includes('공시지가기준법에 의한 시산가액을 토지감정평가액으로 결정하였음.'),'끔 = 종전 문장');

    // 켜고 공시 20% → 거래 80% 자동
    await page.evaluate(()=>showTab('gyeoljeong'));
    await page.locator('#gj_wtOn').check();
    assert(await page.locator('#gj_wtA').isVisible());
    await page.locator('#gj_wtA').fill('20');
    assert.equal(await page.locator('#gj_wtB').inputValue(),'80');
    const exp=await page.evaluate(([a,b])=>applyAuto((a*20+b*80)/100),[f.gs,f.ga]);
    let r=await page.evaluate(()=>({land:LAND_FINAL,unit:LAND_DECIDED.applyUnit,doc:landUnitDoc(),gw:gwalMap(),side:document.getElementById('sd_landAmt').textContent,fin:document.getElementById('gj_final').textContent}));
    assert.equal(r.unit,exp,'결정단가 = 가중평균 반올림');
    assert.equal(r.land,exp*100,'토지가액 = 결정단가 × 면적');
    assert.equal(r.doc,won(exp));assert.equal(r.gw['괄_토지_단가'],won(exp));assert.equal(r.gw['괄_토지_금액'],won(exp*100));
    assert.equal(r.side,won(exp*100));assert.equal(r.fin,won(exp*100)+' 원');
    assert.equal(r.gw['감정평가액'],won(exp*100+f.bld),'감정평가액 = 결정 토지 + 건물');
    // 거래 쪽 칸에 넣어도 공시 쪽이 따라감
    await page.locator('#gj_wtB').fill('70');
    assert.equal(await page.locator('#gj_wtA').inputValue(),'30');
    const exp30=await page.evaluate(([a,b])=>applyAuto((a*30+b*70)/100),[f.gs,f.ga]);
    assert.equal(await page.evaluate(()=>LAND_FINAL),exp30*100);
    await page.locator('#gj_wtA').fill('20');
    // 명세표 토지 줄
    const st=await page.evaluate(()=>ArapTojiDocuments.statementRows().find(x=>x['명세_지번']==='10-1'));
    assert.equal(st['명세_단가'],exp);assert.equal(st['명세_평가액'],exp*100);
    // 의견서 문장
    const on=await opinionText(page);
    assert(on.includes('「감정평가에 관한 규칙」 제12조 제3항에 의거 주된 방법인 공시지가기준법에 의한 시산가액과 거래사례비교법에 의한 시산가액을 조정하되, 각각 20%와 80%의 가중치를 부여하여 가중평균한 가액을 토지감정평가액으로 결정하였음.'),'켬 = 감칙 12조③ 결정 문장');
    assert(on.includes('합리성이 충분히 인정된다고 보기 어려움.'),'켬 = 합리성 검토 문장');
    assert(!on.includes('공시지가기준법에 의한 시산가액의 합리성이 인정됨.'));
    assert(!on.includes('공시지가기준법에 의한 시산가액을 토지감정평가액으로 결정하였음.'));
    // 화면 문구 칸 — 자동 문구가 보이고, 고치면 의견서에 고친 대로
    assert((await page.locator('#gj_wtT2').inputValue()).includes('각각 20%와 80%'));
    // 모양(2026-11-23): 제목 줄은 글상자 위 한 줄, 글상자는 카드 폭 전체·스크롤 없이 글 길이만큼, 되돌리기 버튼은 고쳤을 때만
    const lay=await page.evaluate(()=>[1,2].map(n=>{const t=document.getElementById('gj_wtT'+n),hd=t.previousElementSibling,b=hd.querySelector('b'),box=document.getElementById('gj_wtTxt');
      const tr=t.getBoundingClientRect(),hr=hd.getBoundingClientRect(),br=b.getBoundingClientRect(),xr=box.getBoundingClientRect();
      return {above:hr.bottom<=tr.top+1,titleOneLine:br.height<24,fullW:tr.width>=xr.width-2,noScroll:t.scrollHeight<=t.clientHeight+2,btn:getComputedStyle(document.getElementById('gj_wtT'+n+'r')).display};}));
    lay.forEach((l,i)=>{assert(l.above&&l.titleOneLine&&l.fullW&&l.noScroll,'문단 칸 모양 '+(i+1)+' '+JSON.stringify(l));assert.equal(l.btn,'none','안 고쳤으면 되돌리기 버튼 숨김');});
    if(process.env.SHOT)await page.locator('#gjCard').screenshot({path:process.env.SHOT});
    await page.locator('#gj_wtT2').fill('직접 쓴 결정 문구 검증.');
    assert.equal(await page.locator('#gj_wtT2h').textContent(),'직접 고친 문구');
    const own=await opinionText(page);
    assert(own.includes('직접 쓴 결정 문구 검증.')&&!own.includes('가중평균한 가액을 토지감정평가액으로'),'고친 문구가 의견서에');
    await page.locator('#gj_wtTxt button').nth(1).click();
    assert((await page.locator('#gj_wtT2').inputValue()).includes('각각 20%와 80%'),'자동 문구로 되돌림');
    assert(on.includes(won(exp*100)));
    // 결정단가 직접 고치기
    await page.evaluate(()=>gjWtUnit('0','2,000,000'));
    assert.equal(await page.evaluate(()=>LAND_FINAL),200000000,'직접 고친 결정단가');
    await page.evaluate(()=>gjWtUnit('0',''));
    assert.equal(await page.evaluate(()=>LAND_FINAL),exp*100,'비우면 자동');
    // 저장·복원
    await page.evaluate(()=>doSave());
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiOpinion);
    await page.evaluate(()=>{calcGongsi();renderBldCalc();calcFinal();});
    r=await page.evaluate(()=>({on:LAND_WT.on,a:LAND_WT.a,land:LAND_FINAL,box:document.getElementById('gj_wtOn').checked}));
    assert.deepEqual(r,{on:true,a:'20',land:exp*100,box:true},'저장·복원');
    // 끄면 종전
    await page.evaluate(()=>showTab('gyeoljeong'));
    await page.locator('#gj_wtOn').uncheck();
    assert.equal(await page.evaluate(()=>LAND_FINAL),f.gs*100,'끄면 공시지가기준법');
    assert.equal(await page.evaluate(()=>window.LAND_DECIDED),null);
    // 새 평가서 = 끔
    await page.locator('#gj_wtOn').check();
    await page.evaluate(()=>clearForm());
    assert.equal(await page.evaluate(()=>LAND_WT.on),false,'새 평가서는 끔');
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
