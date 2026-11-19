// 토지건물 — 거래사례·평가사례 「의견서 표시」 끄기(2026-11-03): 끈 사례는 의견서·위치도에서 빠지고 번호는 남은 것끼리 다시 매긴다.
// 산정에 선정된 사례는 끌 수 없다. 실제 의견서 hwpx를 만들어 본문까지 확인.
// node tests/toji_op_hide.cjs   (PLAYWRIGHT_MODULE·PLAYWRIGHT_CHANNEL 선택)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[],alerts=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/Failed to load resource|JSONP|시군구 조회|지가변동률/.test(t))errs.push('console: '+t);});   // 시점수정 조회(외부망 차단)는 무시
  page.on('dialog',d=>{alerts.push(d.message());d.accept();});
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.calcGongsi&&window.ArapTojiOpinion);

  await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    LANDS=[{소재지:'신사동',지번:'565-18',지목:'대',면적:'745.9',용도지역:'2종일주',공시지가:'19510000',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
    STDS=[{소재지:'신사동',지번:'500',지목:'대',면적:'300',공시지가:'20000000',용도지역:'2종일주'}];
    TRADES=[{loc:'신사동 500-1',total:'1,000,000,000',landA:'100',date:'2025-01-02'},
            {loc:'신사동 500-2',total:'2,000,000,000',landA:'100',date:'2025-02-02'},
            {loc:'신사동 500-3',total:'3,000,000,000',landA:'100',date:'2025-03-02'}];
    APPRS=[{no:'a',loc:'신사동 554-1',jimok:'대',use:'2종일주',unit:'36,400,000',base:'2025-02-07',purp:'시가참고'},
           {no:'b',loc:'신사동 586-9',jimok:'대',use:'3종일주',unit:'34,705,000',base:'2023-04-25',purp:'시가참고'},
           {no:'c',loc:'신사동 576-1',jimok:'대',use:'2종일주',unit:'33,300,000',base:'2024-09-25',purp:'시가참고'}];
    ETC={type:'a',idx:2};GA={idx:2};   // 그 밖의 요인 = 평가사례 c, 거래사례비교법 = 거래사례 #3
    for(const [k,v] of Object.entries({base_gijun:'2026.04.24',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,1);
    renderStds();renderLands();document.getElementById('bldBody').innerHTML='';renderTrade();renderAppr();syncPick();calcGongsi();
  });

  // ① 화면: 거래사례 표 「의견서 표시」 행 + 평가사례 표 「의견서 표시」 열, 선정된 사례는 잠김
  const ui=await page.evaluate(()=>{
    const tr=[...document.querySelectorAll('#tblTrade tr')].find(r=>r.cells[0].textContent.includes('의견서'));
    return {tradeCks:tr?[...tr.querySelectorAll('input.op-ck')].map(c=>({on:c.checked,lock:c.disabled})):null,
      apprCks:[...document.querySelectorAll('#tblAppr input.op-ck')].map(c=>({on:c.checked,lock:c.disabled})),
      apprHead:document.querySelector('#tblAppr tr').textContent.includes('의견서')};
  });
  console.log('① 화면',ui);
  assert.ok(ui.tradeCks&&ui.tradeCks.length===3,'거래사례 의견서 표시 행');
  assert.deepEqual(ui.tradeCks.map(c=>c.on),[true,true,true],'기본은 모두 표시');
  assert.deepEqual(ui.tradeCks.map(c=>c.lock),[false,false,true],'선정된 거래사례 #3은 잠김');
  assert.ok(ui.apprHead,'평가사례 표 머리 「의견서 표시」');
  assert.deepEqual(ui.apprCks.map(c=>c.lock),[false,false,true],'선정된 평가사례 c는 잠김');

  // ② 거래사례 #1, 평가사례 a를 끈다(실제 체크박스 클릭)
  await page.evaluate(()=>showTab('gongsi'));
  await page.locator('#tblTrade input.op-ck').nth(0).uncheck();
  await page.locator('#tblAppr input.op-ck').nth(0).uncheck();
  const d=await page.evaluate(()=>{
    const m=ArapTojiOpinion.data();
    return {hideT:!!TRADES[0]._hide,hideA:!!APPRS[0]._hide,hasDataT:tradeHasData(TRADES[0]),
      trades:m.trades.map(t=>({no:t.no,loc:t.data.loc})),apprs:m.appraisals.map(a=>a['평사1_기호']+' '+a['평사1_소재지']+' '+a['평사1_지번']),
      gaPick:m.global['거래_채택기호'],etcPick:m.global['그밖_채택사례'],etcCode:m.global['그밖_사례기호'],
      dim:document.querySelectorAll('#tblTrade .op-off').length,dimRow:document.querySelector('#tblAppr tr.op-off')!=null,
      saved:JSON.stringify(collect().TRADES).includes('"_hide":true'),
      map:mapItems().filter(i=>i.kind!=='본건'&&i.kind!=='비교표준지').map(i=>i.label)};
  });
  console.log('② 끈 뒤',d);
  assert.ok(d.hideT&&d.hideA,'끈 표시가 사례에 저장');
  assert.equal(d.hasDataT,true,'사례 내용은 그대로');
  assert.ok(d.saved,'건 저장(collect)에 들어감');
  assert.deepEqual(d.trades,[{no:2-1,loc:'신사동 500-2'},{no:2,loc:'신사동 500-3'}],'의견서 거래사례 = 남은 2건, #1·#2로 다시 매김');
  assert.deepEqual(d.apprs,['a 신사동 586-9','b 신사동 576-1'],'의견서 평가사례 = 남은 2건, 기호 a·b');
  assert.equal(d.gaPick,'거래사례#2','채택 문장도 의견서 번호');
  assert.equal(d.etcPick,'평가사례 b');
  assert.equal(d.etcCode,'b');
  assert.ok(d.dim>=10,'끈 거래사례 열 흐리게');
  assert.ok(d.dimRow,'끈 평가사례 행 흐리게');
  assert.deepEqual(d.map,['거래 #1','거래 #2','평가 a','평가 b'],'위치도에서도 빠지고 번호는 의견서와 같게');

  // ③ 실제 의견서 hwpx
  const doc=await page.evaluate(async()=>{
    const bytes=await ArapTojiOpinion.build(await fetchTplB64('템플릿/토건 의견서(산출근거) 템플릿.hwpx'),ArapTojiOpinion.data());
    const entries=await ArapCheonggu.parseZip(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const xml=new TextDecoder().decode(entries.find(e=>e.name==='Contents/section0.xml').data);
    const dd=new DOMParser().parseFromString(xml,'application/xml');
    if(dd.querySelector('parsererror'))throw Error('XML 오류');
    const body=[...dd.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('');
    return {heads:(body.match(/거래사례#\d/g)||[]),has1:body.includes('500-1'),has2:body.includes('500-2'),hasA:body.includes('554-1'),hasB:body.includes('586-9'),
      left:(xml.match(/\{\{[^}]+\}\}/g)||[])};
  });
  console.log('③ 의견서',doc);
  assert.ok(!doc.has1,'끈 거래사례 소재지가 의견서에 없음');
  assert.ok(doc.has2,'남은 거래사례는 있음');
  assert.ok(!doc.hasA,'끈 평가사례 소재지가 의견서에 없음');
  assert.ok(doc.hasB,'남은 평가사례는 있음');
  assert.ok(!doc.heads.includes('거래사례#3'),'거래사례#3 번호 없음(2건으로 다시 매김)');
  assert.ok(doc.heads.includes('거래사례#1')&&doc.heads.includes('거래사례#2'));
  assert.deepEqual(doc.left,[],'남은 토큰 없음');

  // ④ 선정된 사례는 끌 수 없다 / 끈 사례를 선정하면 다시 표시
  const lock=await page.evaluate(()=>{
    togOpShow('t',2,false);   // 잠긴 칸을 우회해 불러도 안 꺼진다
    const r1=!TRADES[2]._hide&&ArapTojiOpinion.data().trades.length;
    pickGa(0);                // 끈 거래사례 #1을 거래사례비교법에 선정
    renderTrade();
    const m=ArapTojiOpinion.data();
    return {r1,afterPick:m.trades.map(t=>t.no+' '+t.data.loc),hide0:!!TRADES[0]._hide,gaPick:m.global['거래_채택기호']};
  });
  console.log('④ 선정 사례',lock,alerts);
  assert.equal(lock.r1,2,'선정 사례 끄기는 거절');
  assert.ok(alerts.length===1&&alerts[0].includes('선정'),'거절 안내');
  assert.deepEqual(lock.afterPick,['1 신사동 500-1','2 신사동 500-2','3 신사동 500-3'],'선정하면 의견서에 다시 나감');
  assert.equal(lock.hide0,false,'선정되면 끈 표시가 풀림');
  assert.equal(lock.gaPick,'거래사례#1');

  // ⑤ 다시 켜기 + 아무것도 안 끄면 종전과 똑같은 번호
  const back=await page.evaluate(()=>{togOpShow('a',0,true);const m=ArapTojiOpinion.data();return m.appraisals.map(a=>a['평사1_기호']);});
  assert.deepEqual(back,['a','b','c'],'다시 켜면 원래 기호');

  assert.deepEqual(errs,[],'페이지 오류: '+errs.join(' / '));
  console.log('\n✅ 의견서 표시 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
