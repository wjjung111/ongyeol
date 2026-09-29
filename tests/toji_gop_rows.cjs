// 개별요인비교(본건/표준지) — 필지마다 요인 행 아래 「비교의견」 행. 화면·저장 복원·의견서 표(필지별 2줄 묶음) 확인.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_gop_rows.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.OPINION_TEST_OUTPUT||path.join(root,'..','opinion-test'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiOpinion);
    // 옛 저장건처럼 공통 의견만 있는 상태 — 필지 4개
    await page.evaluate(()=>{
      document.getElementById('g_opinion').value='예전 공통 의견';
      LANDS=[0,1,2,3].map(i=>({소재지:'검증동',지번:(10+i)+'-1',지목:'답',면적:'100',용도지역:'자연녹지',공시지가:'80000',stdIdx:0,gf:[i?0.92:1,1,1,i===2?0.97:1,1,1]}));
      STDS=[{소재지:'표준동',지번:'20-1',지목:'답',면적:'150',공시지가:'100000',용도지역:'자연녹지',etcDecide:'1'}];
      document.getElementById('base_gijun').value='2026.01.01';
      renderStds();renderLands();showTab('gongsi');calcGongsi();});
    const inputs=page.locator('#tblGaebyeol input[aria-label$="비교의견"]');
    assert.equal(await inputs.count(),4,'필지 4개 → 의견 칸 4개');
    assert.equal(await page.locator('#tblGaebyeol tr').count(),9,'머리 1 + (요인+의견) 4');
    assert.equal(await inputs.nth(2).inputValue(),'예전 공통 의견','옛 공통 의견을 보여 줌');
    for(let i=0;i<4;i++){await inputs.nth(i).fill('필지'+(i+1)+' 의견: 표준지 대비 '+(i?'열세':'대등'));}
    assert.deepEqual(await page.evaluate(()=>LANDS.map(L=>L.gop)),['필지1 의견: 표준지 대비 대등','필지2 의견: 표준지 대비 열세','필지3 의견: 표준지 대비 열세','필지4 의견: 표준지 대비 열세']);
    // 요인 칸을 고쳐 표를 다시 그려도 의견 유지
    await page.locator('#tblGaebyeol input.fac').nth(0).fill('1.02');
    assert.equal(await inputs.nth(0).inputValue(),'필지1 의견: 표준지 대비 대등');
    // 저장·복원
    await page.evaluate(()=>doSave());
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ArapTojiOpinion);
    await page.evaluate(()=>showTab('gongsi'));
    assert.equal(await inputs.count(),4);assert.equal(await inputs.nth(3).inputValue(),'필지4 의견: 표준지 대비 열세','복원');
    // 의견서 — 실제 다운로드
    await page.evaluate(()=>showTab('doc'));
    const dl=page.waitForEvent('download');await page.locator('#btnOpinion').click();const d=await dl;
    const file=path.join(out,'gop_rows.hwpx');await d.saveAs(file);
    const res=await page.evaluate(async bytes=>{
      const es=await ArapCheonggu.parseZip(Uint8Array.from(bytes).buffer),HP='http://www.hancom.co.kr/hwpml/2011/paragraph';
      const xml=es.filter(e=>/^Contents\/section\d+\.xml$/.test(e.name)).map(e=>new TextDecoder().decode(e.data));
      if(xml.some(x=>/\{\{[^}]+\}\}/.test(x)))throw Error('남은 토큰');
      const ch=(el,n)=>Array.from(el.children).filter(x=>x.localName===n);
      let found=null;
      for(const x of xml){const doc=new DOMParser().parseFromString(x,'application/xml');
        for(const t of doc.getElementsByTagNameNS(HP,'tbl')){const rows=ch(t,'tr');if(!rows.length)continue;
          const head=rows[0].textContent;if(!(head.includes('비교표준지')&&head.includes('가로조건')&&head.includes('계')&&!head.includes('사례')))continue;
          const cnt=Number(t.getAttribute('rowCnt')),cols=Number(t.getAttribute('colCnt')),occ=new Set();
          rows.forEach((r,i)=>ch(r,'tc').forEach(c=>{const a=ch(c,'cellAddr')[0],s=ch(c,'cellSpan')[0];const rr=+a.getAttribute('rowAddr'),cc=+a.getAttribute('colAddr'),rs=+s.getAttribute('rowSpan'),cs=+s.getAttribute('colSpan');
            if(rr!==i)throw Error('rowAddr');for(let y=rr;y<rr+rs;y++)for(let z=cc;z<cc+cs;z++){const k=y+','+z;if(occ.has(k))throw Error('겹침');occ.add(k);}}));
          if(occ.size!==cnt*cols)throw Error('빈칸 '+occ.size+'/'+cnt*cols);
          found={cnt,rows:rows.length,texts:rows.map(r=>r.textContent),spans:rows.map(r=>ch(r,'tc').map(c=>ch(c,'cellSpan')[0].getAttribute('rowSpan')+'x'+ch(c,'cellSpan')[0].getAttribute('colSpan')))};}}
      return found;},Array.from(fs.readFileSync(file)));
    assert(res,'개별요인 표를 찾음');
    assert.equal(res.cnt,9);assert.equal(res.rows,9);
    for(let i=0;i<4;i++){
      assert(res.texts[1+2*i].startsWith(String(i+1)),'번호 '+(i+1));
      assert.equal(res.spans[1+2*i][0],'2x1','번호 칸 두 줄 병합');
      assert.equal(res.texts[2+2*i],'필지'+(i+1)+' 의견: 표준지 대비 '+(i?'열세':'대등'),'의견 행 '+(i+1));
      assert.deepEqual(res.spans[2+2*i],['1x8']);
    }
    assert(res.texts[1].includes('1.02'),'고친 요인값 반영');
    // 묶기(일단지)면 의견 한 줄
    await page.evaluate(()=>{SAJ_MODE.land='group';showTab('gongsi');calcGongsi();});
    assert.equal(await inputs.count(),1,'묶기 → 의견 1개');
    assert.equal(await inputs.nth(0).inputValue(),'필지1 의견: 표준지 대비 대등','묶기 = 첫 필지 의견');
    assert.deepEqual(errors,[]);
    console.log('PASS',file);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
