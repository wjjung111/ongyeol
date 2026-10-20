// 토지건물 조회 — 임야(산) 지번에 「산」이 붙는지 (토지특성 mnnmSlno에는 산이 없고 PNU 11번째 자리 2 = 산)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_san_jibun.cjs
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
  const ctx=await browser.newContext({viewport:{width:1500,height:900}});const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.accept());
  // 질의에 「산」이 있으면 PNU 11번째 자리 2(산), 아니면 1
  const pnuOf=q=>'4159034022'+(/산\s*\d/.test(q)?'2':'1')+(/산/.test(q)?'00340002':'06640073');
  await ctx.route('**/*',r=>{const u=r.request().url(),J=b=>r.fulfill({body:JSON.stringify(b),contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'}});
    if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.includes('api.vworld.kr/req/search')){const q=new URL(u).searchParams.get('query')||'';
      return J({response:{status:'OK',result:{items:[{id:pnuOf(q),title:q,address:{parcel:'경기도 화성시 우정읍 '+q}}]}}});}
    if(u.includes('getLandCharacteristics')){const p=new URL(u).searchParams.get('pnu');const san=p.charAt(10)==='2';
      return J({landCharacteristicss:{field:[{stdrYear:'2026',pnu:p,mnnmSlno:san?'34-2':'664-73',ldCodeNm:'경기도 화성시 우정읍 화산리',lndcgrCodeNm:san?'임야':'도로',lndpclAr:'1000',pblntfPclnd:'50000'}]}});}
    if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.extract&&window.renderStds);
  await page.evaluate(()=>showTab('land'));
  await page.fill('#stdQuery','화산리 산34-2');await page.click('#btnStd');
  await page.waitForFunction(()=>/조회 완료/.test(document.getElementById('stdStatus').textContent),{timeout:10000});
  await page.evaluate(()=>showTab('daesang'));
  await page.fill('#landQuery','화산리 664-73');await page.click('#btnLand');
  await page.waitForFunction(()=>/조회 완료/.test(document.getElementById('landStatus').textContent),{timeout:10000});
  const r=await page.evaluate(()=>({std:STDS[0]['지번'],land:LANDS[0]['지번'],twice:sanJibun('4159034022200340002','산34-2')}));
  console.log(r);
  assert.equal(r.std,'산34-2','표준지 임야 지번에 산');
  assert.equal(r.land,'664-73','일반 지번은 그대로');
  assert.equal(r.twice,'산34-2','이미 산이 있으면 또 붙이지 않음');
  assert.deepEqual(errs,[]);
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
