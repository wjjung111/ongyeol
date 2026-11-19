// 괄감 = 박찬희 양식(2026-11-10) — 미리 서명해 둔 종이에 맞도록 서식(header.xml)·표 높이를 바꾸지 않는지
//  ① 토건 괄감 4가지(토지건물·토지만·건물만·토지 감정평가 외 줄): header.xml이 템플릿 그대로, 평가내역 표 높이 = 템플릿 높이, 칸 정합
//  ② 템플릿 3종(집건·토건·임대료)에 계산식 필드·옛 사건 값이 없는지
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/gwal_park_form.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
const TPLS=['템플릿/토건 괄호감정표 템플릿.hwpx','템플릿/exact v2.0 괄감 템플릿(단일호수 공통).hwpx','템플릿/임대료 괄호감정표 템플릿.hwpx'];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html?last=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiDocuments&&window.ArapCheonggu);
    // ② 템플릿 자체
    for(const t of TPLS){
      const r=await page.evaluate(async p=>{const b=new Uint8Array(await (await fetch(encodeURI(p))).arrayBuffer());
        const es=await ArapCheonggu.parseZip(b.buffer);return new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data);},t);
      assert(!r.includes('fieldBegin'),t+' 계산식 필드 없음');
      for(const bad of ['이광욱','이호송','244,297,510'])assert(!r.includes(bad),t+' 옛 값 '+bad);
    }
    // ① 토건 4가지
    const modes=[['토지건물',{}],['토지만',{land:true}],['건물만',{bld:true}],['감정평가 외',{out:123.4}]];
    for(const [name,m] of modes){
      const r=await page.evaluate(async m=>{
        const L=LAND_ONLY,B=BLD_ONLY,gs=window.GONGSI_RESULT=window.GONGSI_RESULT||{},o=gs.outSize;
        LAND_ONLY=!!m.land;BLD_ONLY=!!m.bld;gs.outSize=m.out||0;
        try{
          const tpl=await fetchTplB64('템플릿/토건 괄호감정표 템플릿.hwpx');
          const bytes=await ArapCheonggu.buildTokenHwpx(await gwalTplB64(),gwalMap(),{});
          const es=await ArapCheonggu.parseZip(new Uint8Array(bytes.buffer||bytes).buffer);
          const te=await ArapCheonggu.parseZip(Uint8Array.from(atob(tpl),c=>c.charCodeAt(0)).buffer);
          const dec=e=>new TextDecoder().decode(e.data),get=(a,n)=>a.find(e=>e.name===n);
          const sec=dec(get(es,'Contents/section0.xml')),tsec=dec(get(te,'Contents/section0.xml'));
          const H=s=>{const a=s.indexOf('<hp:tbl id="1148540928"');return s.slice(a,s.indexOf('>',s.indexOf('<hp:sz',a))).match(/<hp:sz [^>]*height="(\d+)"/)[1];};
          const doc=new DOMParser().parseFromString(sec,'application/xml'),HP='http://www.hancom.co.kr/hwpml/2011/paragraph',ch=(el,n)=>Array.from(el.children).filter(x=>x.localName===n),bad=[];
          for(const t of doc.getElementsByTagNameNS(HP,'tbl')){const rows=ch(t,'tr'),cnt=+t.getAttribute('rowCnt'),cols=+t.getAttribute('colCnt'),occ=new Set();
            if(cnt!==rows.length)bad.push('rowCnt');
            rows.forEach((row,i)=>ch(row,'tc').forEach(c=>{const a=ch(c,'cellAddr')[0],s=ch(c,'cellSpan')[0];const rr=+a.getAttribute('rowAddr'),cc=+a.getAttribute('colAddr');if(rr!==i)bad.push('rowAddr');
              for(let y=rr;y<rr+ +s.getAttribute('rowSpan');y++)for(let z=cc;z<cc+ +s.getAttribute('colSpan');z++){const k=y+','+z;if(occ.has(k))bad.push('overlap');occ.add(k);}}));
            if(occ.size!==cnt*cols)bad.push('missing');}
          return {header:dec(get(es,'Contents/header.xml'))===dec(get(te,'Contents/header.xml')),h:H(sec),th:H(tsec),bad,left:sec.match(/\{\{[^}]+\}\}/g)||[]};
        }finally{LAND_ONLY=L;BLD_ONLY=B;gs.outSize=o;}
      },m);
      assert(r.header,name+' header.xml 그대로');
      assert.equal(r.h,r.th,name+' 평가내역 표 높이 그대로(심사자 서명 위치)');
      assert.deepEqual(r.bad,[],name+' 표 칸 정합');
      assert.deepEqual(r.left,[],name+' 남은 토큰');
    }
    assert.deepEqual(errors,[],'페이지 오류');
    console.log('gwal_park_form OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
