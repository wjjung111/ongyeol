// 집합건물 단일호수 비주거용 한글 감정평가서 — 비주거용 템플릿(자본수익률 표·상업용 개별요인) 사용, 자본수익률 산식 줄별 문단, 남은 토큰 없음
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_nr_hwpx.cjs  (OUT=경로 주면 받은 파일을 거기에 저장)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
// 작은 zip 읽기(중앙 디렉터리 → 저장/deflate 항목) — 앱의 parseZip은 바깥에서 부를 수 없어서
function unzip(buf){const out={},zlib=require('zlib');let e=buf.length-22;while(buf.readUInt32LE(e)!==0x06054b50)e--;
  let p=buf.readUInt32LE(e+16);const n=buf.readUInt16LE(e+10);
  for(let i=0;i<n;i++){const m=buf.readUInt16LE(p+10),cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),off=buf.readUInt32LE(p+42);
    const name=buf.slice(p+46,p+46+nl).toString();const lnl=buf.readUInt16LE(off+26),lel=buf.readUInt16LE(off+28);const data=buf.slice(off+30+lnl+lel,off+30+lnl+lel+cs);
    out[name]=m===8?zlib.inflateRawSync(data):data;p+=46+nl+el+cl;}
  return out;}
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1300,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');localStorage.setItem('arap-nrcap-kind','집합상가');localStorage.setItem('arap-nrcap-region','서울');});
    await page.goto(base+'/s3r86w8a.html');const scope=page.locator('#root');
    await scope.getByText('2. 대상물건개요',{exact:true}).click({timeout:60000});
    await scope.locator('button',{hasText:/^비주거용$/}).first().click();
    if(process.env.SHARE){await scope.locator('select').filter({has:page.locator('option[value="share"]')}).first().selectOption('share');
      await scope.locator('input[placeholder="분자"]').fill('1');await scope.locator('input[placeholder="분모"]').fill('4');}
    await scope.getByText('3. 사례 등 입력',{exact:true}).click();
    // 선정 사례 행의 시점수정치 칸 → 자본수익률 계산 → 적용
    const idx=await scope.locator('tr').evaluateAll(trs=>trs.findIndex(tr=>{const c=tr.querySelectorAll(':scope > td')[2];const b=c&&c.querySelector('input[type=checkbox]');return !!(b&&b.checked&&/^#\d/.test((tr.querySelectorAll(':scope > td')[3]||{}).textContent||''));}));
    assert.ok(idx>=0,'선정 사례 행');
    await scope.locator('tr').nth(idx).locator('td[style*="cursor: pointer"]').first().click();
    const modal=scope.locator('div[style*="max-width: 540px"]').filter({hasText:'시점수정치 — 사례'});await modal.waitFor();
    await modal.locator('button',{hasText:/^계산$/}).click();
    assert.match(await modal.locator('textarea').inputValue(),/^집합상가\n지역 : 서울/,'자본수익률 산식이 칸에');
    await modal.locator('button',{hasText:/^적용$/}).click();
    await scope.getByText('4. 가격산출',{exact:true}).click();
    const btn=scope.getByRole('button',{name:'표지/괄감/의견서'});await btn.waitFor();for(let i=0;i<30&&await btn.isDisabled();i++)await page.waitForTimeout(500);
    const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),btn.click()]);
    const file=process.env.OUT||path.join(require('os').tmpdir(),'jiphap_nr.hwpx');await dl.saveAs(file);
    const z=unzip(fs.readFileSync(file));const x=z['Contents/section1.xml'].toString('utf8'),x0=z['Contents/section0.xml'].toString('utf8');
    const ok=await page.evaluate(([a,b])=>[a,b].every(s=>!new DOMParser().parseFromString(s,'application/xml').getElementsByTagName('parsererror').length),[x,x0]);
    assert.ok(ok,'XML 정상');
    assert.deepEqual([...new Set((x+x0).match(/\{\{[^}]+\}\}/g)||[])],[],'남은 토큰 없음');
    const t=(x.match(/<hp:t>[^<]*<\/hp:t>/g)||[]).map(s=>s.slice(6,-7)).join('|');
    assert.ok(t.includes('가. 자본수익률(|집합 상가|)'),'시점수정 제목');
    assert.ok(t.includes('[출처: 한국부동산원 임대동향조사]'));assert.ok(!t.includes('매매가격지수'),'매매가격지수 문구 없음');
    assert.ok(t.includes('개별요인 비교항목(상업용)')&&t.includes('공실률 및 입점업체 구성')&&!t.includes('시공사의 브랜드'),'상업용 항목');
    assert.match(t,/\|\d{4}\.\dQ\(\d+일\) : -?\d+\.\d\d\|/,'분기 내역 줄');
    assert.match(t,/\|\(1[+-]0\.\d{5}×\d+\/\d+\)/,'산식 첫 줄');
    assert.match(t,/\|\d+\.\d{3}%\|\(\|1\.\d{5}\|\)/,'상승률·시점수정치');
    assert.ok(/\d{4}\.\d\d\.\d\d ~ \d{4}\.\d\d\.\d\d/.test(t),'기간');
    assert.ok(!/charPrIDRef="5[3-7]"/.test(x),'파란 글자 없음');
    { // 「7. 단가의 결정」 시점수정 칸: 단 설정 조각·옛 줄배치 없이 가운데 정렬되게
      const k=x.indexOf('7. 전유면적당 단가의 결정');const tb=x.slice(k,x.indexOf('</hp:tbl>',k));
      assert.ok(!/<hp:colPr/.test(tb),'단가 결정 표에 단 설정 조각 없음');
      const v=tb.match(/<hp:p\b[^>]*>(?:(?!<\/hp:p>)[\s\S])*?1\.\d{5}<\/hp:t><\/hp:run>((?:(?!<\/hp:p>)[\s\S])*?)<\/hp:p>/);assert.ok(v,'시점수정 값 문단');assert.ok(!/linesegarray/.test(v[1]),'시점수정 칸 줄배치 캐시 제거');}
    assert.equal(t.split('|').filter(v=>v.startsWith('■ ')).length,4,'개별요인 ■ 네 줄');
    if(process.env.SHARE)assert.ok(t.includes('귀 제시 지분(1/4)만을')&&/□ 산식 : /.test(t),'지분 양식');
    assert.deepEqual(errors,[]);
    console.log(t.slice(t.indexOf('가. 자본수익률'),t.indexOf('나. 시점수정치의 결정')));
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
