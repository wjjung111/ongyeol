// 저장공간 가득 참 대비(arap_storage.js) — 임시 칸 → 다른 건 이전 버전(오래된 것부터) 순으로 비우고 다시 저장, 건·메모는 안 지움,
// 끝내 못 쓰면 빨간 띠 + 파일로 받기. 집건·토건·입주권 세 앱이 맨 앞에서 로드하는지도 본다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/storage_quota.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
for(const f of ['s3r86w8a.html','토지건물.html','입주권.html']){const s=fs.readFileSync(path.join(root,f),'utf8');
  assert.equal(s.indexOf('<script',s.indexOf('<head>')),s.indexOf('<script src="arap_storage.js"'),f+' — arap_storage.js를 첫 스크립트로');}
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(n==='/blank.html'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><body>빈 화면</body>');}
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const page=await (await browser.newContext({acceptDownloads:true})).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/blank.html');
    // 꽉 채우기: 시점수정 임시 2M자, 기한 지난 임시(켤 때 지워져야), 이전 버전 2개 건(오래된 것 t=1·2 / 3·4), 건 하나, 나머지는 채움
    await page.evaluate(()=>{localStorage.clear();const X=n=>'x'.repeat(n);
      localStorage.setItem('arm-jb-rates-v1','{"t":'+Date.now()+',"v":"'+X(1500000)+'"}');
      localStorage.setItem('arm-jb-prep-v2','{"t":1,"tbl":"'+X(10000)+'"}');
      localStorage.setItem('tojigeonmul-bak:A',JSON.stringify([{t:2,data:X(400000)},{t:1,data:X(400000)}]));
      localStorage.setItem('appraisal-bak:B',JSON.stringify([{t:4,data:X(400000)},{t:3,data:X(400000)}]));
      localStorage.setItem('tojigeonmul-case:OLD',X(500000));localStorage.setItem('tojigeonmul-memo:OLD',X(300000));
      let i=0;for(;;){try{localStorage.setItem('fill'+i,X(100000));i++;}catch(e){break;}}
      for(let n=50000;n>=1000;n=Math.floor(n/2)){try{localStorage.setItem('fill'+(i++),X(n));}catch(e){}}});
    await page.addScriptTag({url:base+'/arap_storage.js'});
    const r=await page.evaluate(()=>{const X=n=>'y'.repeat(n),has=k=>localStorage.getItem(k)!=null,out={};
      out.prepGone=!has('arm-jb-prep-v2');   // 기한 지난 임시 칸은 켤 때 지움
      // 1) 임시 칸만 비우면 들어가는 크기
      localStorage.setItem('tojigeonmul-case:NEW',X(1000000));out.s1={rates:has('arm-jb-rates-v1'),bakA:JSON.parse(localStorage.getItem('tojigeonmul-bak:A')).length,ok:has('tojigeonmul-case:NEW')};
      // 2) 이전 버전을 버려야 들어가는 크기 — 가장 오래된(t=1) 것부터
      localStorage.setItem('tojigeonmul-case:NEW2',X(900000));
      const a=JSON.parse(localStorage.getItem('tojigeonmul-bak:A')||'[]'),b=JSON.parse(localStorage.getItem('appraisal-bak:B')||'[]');
      out.s2={ok:localStorage.getItem('tojigeonmul-case:NEW2').length,aTs:a.map(x=>x.t),bTs:b.map(x=>x.t)};
      out.keep={oldCase:has('tojigeonmul-case:OLD'),oldMemo:has('tojigeonmul-memo:OLD')};
      // 3) 끝내 안 들어가면 던지고 빨간 띠
      try{localStorage.setItem('tojigeonmul-case:NEW',X(9000000));out.s3='no-throw';}catch(e){out.s3=e.name;}
      out.bar=(document.getElementById('arap-storage-bar')||{}).innerText||'';out.failed=ArapStorage.failed();
      out.keep2={oldCase:has('tojigeonmul-case:OLD'),oldMemo:has('tojigeonmul-memo:OLD'),newCase:localStorage.getItem('tojigeonmul-case:NEW').length};
      // 중요하지 않은 칸(열 너비 등)은 띠를 안 띄움
      try{localStorage.setItem('arap-colw-x',X(9000000));}catch(e){}out.failed2=ArapStorage.failed();
      return out;});
    console.log(JSON.stringify(r));
    assert(r.prepGone,'기한 지난 임시 칸 정리');
    assert.deepEqual(r.s1,{rates:false,bakA:2,ok:true},'1단계: 임시 칸만 비우고 저장(이전 버전은 그대로)');
    assert.equal(r.s2.ok,900000);assert(!r.s2.aTs.includes(1),'가장 오래된 이전 버전부터 버림');
    assert.deepEqual(r.keep,{oldCase:true,oldMemo:true},'다른 건·메모는 안 지움');
    assert.equal(r.s3,'QuotaExceededError');assert(/저장공간이 가득/.test(r.bar)&&/파일로 받기/.test(r.bar),'빨간 띠');
    assert.deepEqual(r.failed,['tojigeonmul-case:NEW']);assert.deepEqual(r.failed2,['tojigeonmul-case:NEW']);
    assert.deepEqual(r.keep2,{oldCase:true,oldMemo:true,newCase:1000000},'실패해도 이전 저장 내용은 그대로');
    const dl=page.waitForEvent('download');await page.click('#arap-storage-bar button');const d=await dl;
    assert.equal(fs.statSync(await d.path()).size,9000000,'못 쓴 내용 그대로 파일로');   // (헤드리스는 한글 파일명을 download로 보고해 크기로 확인)
    // 다시 저장되면 띠가 사라짐
    const gone=await page.evaluate(()=>{localStorage.setItem('tojigeonmul-case:NEW','{}');return !document.getElementById('arap-storage-bar')&&ArapStorage.failed().length===0;});
    assert(gone,'저장되면 띠 없어짐');
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
