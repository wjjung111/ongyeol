// 토지건물 거래사례 — kais 붙여넣기 칸 하나 + 붙여넣으면 건축물대장(주구조)·토지특성(도로교통) 자동 조회, 붙여넣은 값과 다르면 표시 (2026-11-24)
// 브이월드·건축물대장은 가짜 응답. PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_trade_bld_lookup.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
// 지번별 가짜 필지
const P={
  '1015-6':{pnu:'1154510200110150006',land:{lndpclAr:'22.83',lndcgrCodeNm:'대',prposArea1Nm:'제2종일반주거지역',roadSideCodeNm:'세로한면(가)'},
    title:[{mainAtchGbCdNm:'주건축물',strctCdNm:'철근콘크리트구조',etcStrct:'',totArea:'35.76',useAprDay:'20120302',mainPurpsCdNm:'제2종근린생활시설'},
           {mainAtchGbCdNm:'부속건축물',strctCdNm:'경량철골구조',totArea:'80',useAprDay:'20150101'}]},
  '195-14':{pnu:'1154510200101950014',land:{lndpclAr:'22.39',lndcgrCodeNm:'대',prposArea1Nm:'제3종일반주거지역',roadSideCodeNm:'소로한면'},
    title:[{mainAtchGbCdNm:'주건축물',strctCdNm:'철근콘크리트구조',etcStrct:'철근콘크리트조',totArea:'42.00',useAprDay:'20171114',mainPurpsCdNm:'다가구주택'}]},
  '300-1':{pnu:'1154510200103000001',land:{lndpclAr:'150',lndcgrCodeNm:'대',prposArea1Nm:'제2종일반주거지역',roadSideCodeNm:'중로한면'},
    title:[{mainAtchGbCdNm:'주건축물',strctCdNm:'벽돌구조',totArea:'120.5',useAprDay:'19950510'}]},
};
const byPnu={};Object.keys(P).forEach(j=>byPnu[P[j].pnu]=j);
const queries=[];
const wrap=items=>({response:{header:{resultCode:'00'},body:{items:items.length?{item:items}:'',totalCount:items.length}}});
const H=['상세물건번호','시군구','소재지','지번','상세물건구분','지목','용도지역','기타주소','거래시점','전체면적','전용면적','물건금액','단가','사용승인일자'];
const row=a=>a.join('\t');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({viewport:{width:1500,height:1000}});const page=await ctx.newPage();const errs=[];
    page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>{errs.push('dialog: '+d.message());d.accept();});
    await ctx.route('**/*',r=>{const u=new URL(r.request().url()),cb=u.searchParams.get('callback');
      const J=b=>r.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:cb?'text/javascript':'application/json',body:cb?cb+'('+JSON.stringify(b)+')':JSON.stringify(b)});
      if(u.href.includes('arap_access.js')||u.href.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
      if(u.href.startsWith(base))return r.continue();
      if(u.href.includes('api.vworld.kr/req/search')){const q=u.searchParams.get('query')||'';queries.push(q);
        const m=/(\d+(?:-\d+)?)\s*$/.exec(q),jb=m&&m[1];
        // 「999-9」는 검색이 엉뚱한 필지(300-1)를 집는 경우
        const hit=jb==='999-9'?'300-1':jb;
        if(!P[hit])return J({response:{status:'NOT_FOUND'}});
        const addr=q.replace(/\S+$/,hit);
        return J({response:{status:'OK',result:{items:[{id:P[hit].pnu,title:addr,address:{parcel:addr}}]}}});}
      if(u.href.includes('getLandCharacteristics')){const jb=byPnu[u.searchParams.get('pnu')];
        return J({landCharacteristicss:{field:[Object.assign({stdrYear:'2026',ldCodeNm:'서울특별시 금천구 독산동',mnnmSlno:jb,pnu:P[jb].pnu},P[jb].land)]}});}
      if(u.pathname.includes('/bld')){const jb=byPnu[u.searchParams.get('pnu')];return J(wrap(jb?P[jb].title:[]));}
      return r.abort();});
    await ctx.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.renderTrade&&window.tradeLookup);
    await page.evaluate(()=>{
      LANDS=[{소재지:'서울특별시 금천구 독산동',지번:'100',fullAddr:'서울특별시 금천구 독산동 100',지목:'대',면적:'200',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
      TRADES=[{},{},{}];renderLands();renderTrade();showTab('land');});
    // ① 붙여넣기 칸은 열마다 하나
    const kp=await page.evaluate(()=>({n:document.querySelectorAll('#tblTrade .kp').length,rows:[...document.querySelectorAll('#tblTrade th.rowh')].map(t=>t.textContent).filter(t=>/kais/.test(t))}));
    assert.equal(kp.n,3,'열마다 한 칸');assert.deepEqual(kp.rows,['kais'],'kais 행 하나');
    const paste=(i,text)=>page.evaluate(([i,text])=>{const ta=document.querySelector('#tblTrade .kp[data-i="'+i+'"]');ta.focus();
      const dt=new DataTransfer();dt.setData('text/plain',text);ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));},[i,text]);
    const done=()=>page.waitForFunction(()=>/남은 칸: 재조달원가/.test(document.getElementById('pTradeMsg').textContent),null,{timeout:15000});
    // ② 토지·건물 행을 한꺼번에(2건) — 구분 열 있음
    await paste(0,[row(H),
      row(['1','서울특별시 금천구','독산동','1015-6','토지','대','제2종일반주거지역','','2026-04-25','22.83','','282000000','','']),
      row(['1','서울특별시 금천구','독산동','1015-6','건물','','','','2026-04-25','35.76','35.76','282000000','','2012-03-02']),
      row(['2','서울특별시 금천구','독산동','195-14','토지','대','제3종일반주거지역','','2026-03-10','22.39','','410000000','','']),
      row(['2','서울특별시 금천구','독산동','195-14','건물','','','','2026-03-10','42.59','42.59','410000000','','2017-11-14'])].join('\n'));
    await done();
    const a=await page.evaluate(()=>TRADES.slice(0,2).map(c=>({loc:c.loc,landA:c.landA,bldA:c.bldA,appr:c.appr,struct:c.struct,road:c.road,use:c.use,jimok:c.jimok})));
    console.log('② 붙여넣기 + 조회',a);
    assert.equal(a[0].struct,'철근콘크리트구조','주구조 = 부속 뺀 주건축물');
    assert.equal(a[0].road,'세로(가)','도로교통 자동');
    assert.equal(a[1].struct,'철근콘크리트구조(철근콘크리트조)');
    assert.equal(a[1].road,'소로한면');
    assert.ok(queries.some(q=>q==='서울특별시 금천구 독산동 1015-6'),'KAIS 시군구로 조회: '+queries.join(' | '));
    // ③ 다른 값 표시 — #2 건물면적(KAIS 42.59 / 대장 42)
    const d=await page.evaluate(()=>({cells:[...document.querySelectorAll('#tblTrade td.chk-d')].map(td=>td.querySelector('input').value),
      notes:[...document.querySelectorAll('#tblTrade .chk-n')].map(n=>n.textContent),ok:[...document.querySelectorAll('#tblTrade .chk-ok')].length,
      warn:[...document.querySelectorAll('#tblTrade .chk-e')].map(n=>n.textContent),msg:document.getElementById('pTradeMsg').textContent}));
    console.log('③ 대조',d);
    assert.deepEqual(d.cells,['42.59']);assert.deepEqual(d.notes,['대장 42㎡ ↵']);
    assert.equal(d.ok,1);assert.deepEqual(d.warn,['⚠ 대장과 다른 칸 1개']);
    assert.ok(/#2 건물면적/.test(d.msg),'메시지에 다른 칸');
    // ④ 직접 고치면 표시가 바로 사라짐 → 다시 다르게 → 「대장 …」 누르면 대장값
    const inp=page.locator('#tblTrade td.chk-d input');
    await inp.fill('42');
    assert.equal(await page.locator('#tblTrade td.chk-d').count(),0,'같아지면 표시 없음');
    await page.locator('#tblTrade input[oninput*="tradeIn(1,\'bldA\'"]').fill('42.59');
    assert.equal(await page.locator('#tblTrade td.chk-d').count(),1);
    await page.click('#tblTrade .chk-n');
    assert.equal(await page.evaluate(()=>TRADES[1].bldA),'42');
    assert.equal(await page.locator('#tblTrade td.chk-d').count(),0);
    // ⑤ 같은 칸에 토지 → 건물 차례로(구분 열 없이) = 한 사례, 토지만 붙였을 땐 커서 그대로
    const H2=H.filter(h=>h!=='상세물건구분'),r2=a=>row(a.filter((_,k)=>k!==4));
    await paste(2,[row(H2),r2(['3','서울특별시 금천구','독산동','300-1','x','대','제2종일반주거지역','','2026-01-05','150','','900000000','',''])].join('\n'));
    await done();
    assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.getAttribute('data-i')),'2','토지만 → 같은 칸');
    let c3=await page.evaluate(()=>({landA:TRADES[2].landA,bldA:TRADES[2].bldA||'',struct:TRADES[2].struct||'',road:TRADES[2].road,n:TRADES.length}));
    assert.deepEqual(c3,{landA:'150',bldA:'',struct:'',road:'중로한면',n:3},'토지만 — 주구조 안 채움');
    await paste(2,[row(H2),r2(['3','서울특별시 금천구','독산동','300-1','x','','','','2026-01-05','120.5','120.5','900000000','','1995-05-10'])].join('\n'));
    await done();
    c3=await page.evaluate(()=>({landA:TRADES[2].landA,bldA:TRADES[2].bldA,struct:TRADES[2].struct,appr:TRADES[2].appr,n:TRADES.length}));
    console.log('⑤ 차례로',c3);
    assert.deepEqual(c3,{landA:'150',bldA:'120.5',struct:'벽돌구조',appr:'1995.05.10',n:3});
    // ⑥ 저장·복원에 대조 결과 유지, 소재지 바꾸면 대조 결과 버림
    const rt=await page.evaluate(()=>{const o=JSON.parse(JSON.stringify(collect()));applyForm(o);renderTrade();
      return {chk:!!TRADES[1]._chk,ok:document.querySelectorAll('#tblTrade .chk-ok').length};});
    assert.deepEqual(rt,{chk:true,ok:3});
    await page.locator('#tblTrade .loc-w input').nth(1).fill('독산동 195-15');
    assert.equal(await page.evaluate(()=>!!TRADES[1]._chk),false);
    // ⑦ 검색이 다른 지번을 집으면 대장을 붙이지 않고 실패 표시
    await page.evaluate(()=>{TRADES.push({loc:'독산동 999-9',bldA:'50'});renderTrade();});
    await page.evaluate(()=>tradeLookup([3]));
    const bad=await page.evaluate(()=>({struct:TRADES[3].struct||'',err:TRADES[3]._chk&&TRADES[3]._chk.err,note:document.querySelectorAll('#tblTrade .chk-e').length}));
    console.log('⑦ 지번 불일치',bad);
    assert.equal(bad.struct,'');assert.ok(/지번이 다르게/.test(bad.err));
    await page.screenshot({path:process.env.SHOT||'/tmp/toji_trade_bld_lookup.png',clip:await page.locator('#gsTradeCard').boundingBox()});
    assert.deepEqual(errs,[]);
    console.log('✅ 거래사례 대장·토지특성 조회·대조 검증 통과');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
