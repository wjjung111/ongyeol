// 의견서 거래사례 표 굵은 글씨(2026-11-19) — 토지단가 행만 굵게, 거래사례#1(이어지는 표의 #4) 열은 다른 열과 같은 보통 글씨
//  토건·토지 양식 둘 다, 사례 5건(3+2 두 표)·비고 행 포함
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_trade_bold.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),outDir=process.env.TOJI_OUT||'';
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    for(const [mode,tpl] of [['','토건'],['?mode=land','토지']]){
      const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
      page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.accept());
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.goto(base+'/토지건물.html'+mode,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.ArapTojiOpinion&&window.calcGongsi);
      const res=await page.evaluate(async(tpl)=>{
        const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
        LANDS=[{소재지:'철산동',지번:'1',지목:'대',면적:'100',용도지역:'2종일주',공시지가:'3000000',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
        STDS=[{소재지:'철산동',지번:'2',지목:'대',면적:'150',공시지가:'3000000',용도지역:'2종일주'}];
        TRADES=Array.from({length:5},(_,i)=>({loc:'철산동 '+(90+i),use:'2종일주',jimok:'대',landA:'180',bldA:'250',total:'900000000',date:'2026.01.01',
          useApr:'1985.01.01',strct:'벽돌구조',reCost:'900000',life:'45',note:i===0?'관찰감가':''}));
        APPRS=[];ETC={type:'t',idx:0};GA={idx:0};
        for(const [k,v] of Object.entries({base_gijun:'2026.10.01',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1',ga_sajeong:'1',ga_area:'1',ov_client:'테스트'}))set(k,v);
        renderStds();renderLands();if(window.renderTrade)renderTrade();calcGongsi();
        const bytes=await ArapTojiOpinion.build(await fetchTplB64(opinionTplPath()),ArapTojiOpinion.data());
        const es=await ArapCheonggu.parseZip(bytes.buffer),HP='http://www.hancom.co.kr/hwpml/2011/paragraph',HH='http://www.hancom.co.kr/hwpml/2011/head';
        const doc=new DOMParser().parseFromString(new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data),'application/xml');
        const head=new DOMParser().parseFromString(new TextDecoder().decode(es.find(e=>e.name==='Contents/header.xml').data),'application/xml');
        const bold=new Set(Array.from(head.getElementsByTagNameNS(HH,'charPr')).filter(p=>p.getElementsByTagNameNS(HH,'bold').length).map(p=>p.getAttribute('id')));
        const ch=(el,n)=>Array.from(el.children).filter(x=>x.localName===n);
        const tbls=Array.from(doc.getElementsByTagNameNS(HP,'tbl')).filter(t=>!t.getElementsByTagNameNS(HP,'tbl').length&&ch(ch(t,'tr')[0],'tc').some(c=>/^거래사례#\d/.test(c.textContent.trim()))&&ch(t,'tr').some(r=>ch(r,'tc')[0].textContent.trim()==='사용승인일'));
        return {tpl:opinionTplPath(),bytes:Array.from(bytes),tables:tbls.map(t=>ch(t,'tr').map(r=>({label:ch(r,'tc')[0].textContent.trim(),
          cells:ch(r,'tc').slice(1).map(c=>Array.from(c.getElementsByTagNameNS(HP,'run')).filter(x=>x.getElementsByTagNameNS(HP,'t').length).map(x=>bold.has(x.getAttribute('charPrIDRef'))))})))};
      },tpl);
      assert.ok(res.tpl.includes(tpl),res.tpl);
      if(outDir)fs.writeFileSync(path.join(outDir,'trade_bold_'+tpl+'.hwpx'),Buffer.from(res.bytes));
      assert.ok(res.tables.length>=2&&res.tables.some(t=>t[1].cells.length===2),tpl+' 거래사례 표가 3+2로 나뉨: '+res.tables.length);
      res.tables.forEach((rows,ti)=>rows.slice(1).forEach(r=>r.cells.forEach((runs,ci)=>{
        const want=r.label.startsWith('토지단가');
        assert.ok(runs.length&&runs.every(b=>b===want),tpl+' 표'+(ti+1)+' '+r.label+' 열'+(ci+1)+' 굵게='+runs+' (기대 '+want+')');
      })));
      assert.ok(res.tables[0].some(r=>r.label.replace(/\s/g,'')==='비고'),tpl+' 비고 행');
      assert.deepEqual(errs,[]);
      console.log('✓',tpl,'— 토지단가 행만 굵게');
      await ctx.close();
    }
    console.log('toji_trade_bold OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
