// 입주권 의견서 시점수정 표 「산출내역」 지역 경로(2026-10-29) — 템플릿에 고정돼 있던 「서울 > 강남지역 > 동남권 >」을 빼고 사례별 실제 지수 경로.
// ① 샘플(② 시점수정 지역 = 서초구) → 「서울 > 강남지역 > 동남권 > 서초구」(종전과 같은 결과)
// ② 시점수정 지역을 비우고 사례 시점수정을 전북 > 전주시 > 완산구 지수로 계산·적용 → 「전북 > 전주시 > 완산구」, 서울 경로 없음, 미치환 토큰 없음
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),zlib=require('zlib'),os=require('os');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'ipj-sjpath-'));
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
function unzip(buf){const files={};let p=0;
  while(p+30<=buf.length&&buf.readUInt32LE(p)===0x04034b50){const method=buf.readUInt16LE(p+8),csz=buf.readUInt32LE(p+18),nl=buf.readUInt16LE(p+26),el=buf.readUInt16LE(p+28);
    const name=buf.slice(p+30,p+30+nl).toString('utf8');const data=buf.slice(p+30+nl+el,p+30+nl+el+csz);files[name]=method===8?zlib.inflateRawSync(data):data;p=p+30+nl+el+csz;}
  return files;}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1500,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await page.goto(base+'/'+encodeURI('입주권.html'),{waitUntil:'domcontentloaded'});await page.waitForSelector('text=② 접수개요',{timeout:60000});
    const opinion=async name=>{await page.click('text=④ 가격산출');
      const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.click('button:text-is("3. 의견서")')]);
      const f=path.join(out,name);await d.saveAs(f);return unzip(fs.readFileSync(f))['Contents/section0.xml'].toString('utf8');};
    // 산출내역 문단(「× 100」 든 문단)에서 첫 줄바꿈 앞 글자 — 값 칸은 글자색 때문에 런이 나뉘어 있어 태그를 걷어 내고 읽음
    const cellsOf=x=>[...x.matchAll(/<hp:p [^>]*>((?:(?!<\/hp:p>).)*?× 100(?:(?!<\/hp:p>).)*)<\/hp:p>/gs)].map(m=>m[1].split('<hp:lineBreak/>')[0].replace(/<[^>]+>/g,''));
    // ① 샘플
    let x=await opinion('a.hwpx');
    assert.deepEqual([...new Set(cellsOf(x))],['서울 &gt; 강남지역 &gt; 동남권 &gt; 서초구'],'샘플 산출내역');
    assert.doesNotMatch(x,/\{\{[^}]+\}\}/,'미치환 토큰');
    // ② 시점수정 지역 비우고 사례 시점수정을 전주 완산구 지수로
    await page.click('text=① 대상물건개요');await page.locator('div:has(> span:text-is("시점수정 지역")) input').first().fill('');
    await page.click('text=④ 가격산출');
    const tds=page.locator('td[title="클릭해서 시점수정치 입력"]:visible');const n=await tds.count();assert.ok(n>0);
    for(let i=0;i<n;i++){await tds.nth(i).click();await page.waitForSelector('text=시점수정치 계산');
      await page.getByLabel('시점수정 지역 검색').fill('완산');await page.locator('tr[data-key="완산구"]').click();   // 지역 = 표 목록
      await page.locator('button:text-is("시점수정치 계산")').click();
      await page.locator('button:text-is("적용")').click();await page.waitForSelector('text=시점수정치 계산',{state:'detached'});}
    x=await opinion('b.hwpx');
    assert.deepEqual([...new Set(cellsOf(x))],['전북 &gt; 전주시 &gt; 완산구'],'전주 산출내역');
    assert.doesNotMatch(x,/강남지역 &gt; 동남권/);assert.doesNotMatch(x,/\{\{[^}]+\}\}/,'미치환 토큰');
    assert.deepEqual(errors,[]);console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
