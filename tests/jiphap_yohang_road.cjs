// 집합건물 요항표 4. 접면도로 상황 — 주거용 고정 문장 / 비주거용은 1. 접수 · 대상물건에서 방향·노폭 입력(나머지 글자 연한 회색)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_yohang_road.cjs  (SHOT=png 경로)
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
    await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');(localStorage.setItem('arap-jiphap-mode','single'),sessionStorage.setItem('arap-jiphap-mode','single'));});
    await page.goto(base+'/s3r86w8a.html?last=1');const scope=page.locator('#root');
    const road=async()=>{await scope.getByText('3. 위치도 · 청구서',{exact:true}).click();
      const btn=scope.getByRole('button',{name:'요항표',exact:true});await btn.waitFor();for(let i=0;i<30&&await btn.isDisabled();i++)await page.waitForTimeout(500);
      const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),btn.click()]);
      const f=path.join(require('os').tmpdir(),'yohang_road.hwpx');await dl.saveAs(f);const z=unzip(fs.readFileSync(f));
      const x=Object.keys(z).filter(n=>/section\d+\.xml$/.test(n)).map(n=>z[n].toString('utf8')).join('');
      assert.deepEqual([...new Set(x.match(/\{\{[^}]+\}\}/g)||[])],[]);return x;};
    await scope.getByText('1. 접수 · 대상물건',{exact:true}).click({timeout:60000});
    const card=scope.getByText('접면도로 상황 (요항표)',{exact:true}).locator('xpath=..');
    assert.ok((await card.innerText()).includes('아파트단지 내 포장도로가 개설되어'),'주거용 화면 문장');
    assert.ok((await road()).includes('아파트단지 내 포장도로가 개설되어 있으며, 이를 통해 외곽 공도와 연계됨.'),'주거용 요항표');
    // 주거용이라도 종류가 다세대주택이면 아파트 단지 문장 대신 방향·노폭 입력(2026-11-16)
    await scope.getByText('1. 접수 · 대상물건',{exact:true}).click();
    const kindInp=scope.locator('xpath=.//span[normalize-space()="종류"]/following-sibling::input').first();const kind0=await kindInp.inputValue();
    await kindInp.fill('다세대주택');
    await scope.locator('input[aria-label="접면도로 방향"]').fill('남측');await scope.locator('input[aria-label="접면도로 노폭"]').fill('6');
    assert.ok(!(await card.innerText()).includes('아파트단지'),'다세대 화면엔 아파트 문장 없음');
    const xd=await road();assert.ok(xd.includes('본건 남측으로 노폭 약 6m 내외의 포장도로에 접함.'),'다세대 요항표');assert.ok(!xd.includes('아파트단지'),'다세대 요항표에 아파트 문장 없음');
    assert.ok(xd.includes('본건 주위는 다세대주택, 단독주택 및 근린생활시설 등이 혼재하는 주거지대로서'),'다세대 부근상황');
    await scope.getByText('1. 접수 · 대상물건',{exact:true}).click();await kindInp.fill(kind0);
    assert.ok((await card.innerText()).includes('아파트단지 내 포장도로가 개설되어'),'종류 되돌리면 아파트 문장');
    await scope.locator('button',{hasText:/^비주거용$/}).first().click();
    await scope.locator('input[aria-label="접면도로 방향"]').fill('북측');await scope.locator('input[aria-label="접면도로 노폭"]').fill('40');
    const gray=await scope.locator('span',{hasText:'으로 노폭 약'}).evaluate(e=>getComputedStyle(e).color);assert.equal(gray,'rgb(156, 163, 175)','연한 회색');
    if(process.env.SHOT)await card.screenshot({path:process.env.SHOT});
    const xr=await road();console.log((xr.match(/<hp:t>[^<]*접함[^<]*<\/hp:t>/g)||[]).join(' / '));assert.ok(xr.includes('본건 북측으로 노폭 약 40m 내외의 포장도로에 접함.'),'비주거용 요항표');
    // 두 면 이상 접함 — 둘째 칸이 생기고 「…, 동측으로 노폭 약 8m 내외의 포장도로에 각각 접함.」
    await scope.getByText('1. 접수 · 대상물건',{exact:true}).click();await scope.locator('select[aria-label="접면도로 수"]').selectOption('2');
    await scope.locator('input[aria-label="접면도로 방향 2"]').fill('동측');await scope.locator('input[aria-label="접면도로 노폭 2"]').fill('8');
    assert.ok((await scope.locator('textarea[aria-label="접면도로 문장"]').inputValue()).includes('각각 접함'),'화면 각각');
    if(process.env.SHOT)await card.screenshot({path:process.env.SHOT.replace(/\.png$/,'_2.png')});
    const x2=await road();assert.ok(x2.includes('본건 북측으로 노폭 약 40m, 동측으로 노폭 약 8m 내외의 포장도로에 각각 접함.'),'두 면 요항표');
    await scope.getByText('1. 접수 · 대상물건',{exact:true}).click();
    // 새로고침 뒤에도 입력 유지(건 저장)
    await page.waitForTimeout(1500);await page.reload();await scope.getByText('1. 접수 · 대상물건',{exact:true}).click({timeout:60000});
    assert.equal(await scope.locator('input[aria-label="접면도로 방향"]').inputValue(),'북측','저장 유지');assert.equal(await scope.locator('input[aria-label="접면도로 방향 2"]').inputValue(),'동측','둘째 저장 유지');
    // 2026-11-19 아파트도 직접 입력 · 도로명(광대로인 신반포로) · 주차장 · 문장 직접 고치기
    await scope.locator('button',{hasText:/^주거용$/}).first().click();
    assert.ok((await card.innerText()).includes('아파트단지 내 포장도로가 개설되어'),'주거용 되돌리면 고정 문장');
    await scope.locator('select[aria-label="접면도로 문장 방식"]').selectOption('input');
    await scope.locator('select[aria-label="접면도로 수"]').selectOption('4');
    const row=async(i,dir,kind,a,b)=>{const lb=i?' '+(i+1):'';await scope.locator(`select[aria-label="접면도로 종류${lb}"]`).selectOption(kind);
      await scope.locator(`input[aria-label="접면도로 방향${lb}"]`).fill(dir);
      if(kind==='name'){await scope.locator(`input[aria-label="접면도로 등급${lb}"]`).fill(a);await scope.locator(`input[aria-label="접면도로 도로명${lb}"]`).fill(b);}
      else await scope.locator(`input[aria-label="접면도로 노폭${lb}"]`).fill(a);};
    await row(0,'북서측','name','광대로','신반포로');await row(1,'북동측','name','광대로','잠원로');await row(2,'남서측','','8');await row(3,'남동측','','6');
    await scope.locator('select[aria-label="주차장 문구"]').selectOption('apt');
    const want='본건은 북서측 및 북동측으로 각각 광대로인 신반포로 및 잠원로와 접하며, 남서측 및 남동측으로 각각 노폭 약 8m 및 6m의 포장도로와 접하고, 동단지 내 주차장 구비되어 있음.';
    const ta=scope.locator('textarea[aria-label="접면도로 문장"]');assert.equal(await ta.inputValue(),want,'화면 문장(도로명+노폭+주차장)');
    if(process.env.SHOT)await card.screenshot({path:process.env.SHOT.replace(/\.png$/,'_apt.png')});
    const x3=await road();assert.ok(x3.includes(want),'요항표 도로명+주차장');assert.ok(!x3.includes('아파트단지 내 포장도로'),'고정 문장 없음');
    await scope.getByText('1. 접수 · 대상물건',{exact:true}).click();
    await ta.fill(want.replace('8m 및 6m','8미터 및 6미터'));
    assert.ok((await card.innerText()).includes('자동 문장으로'),'직접 고침 표시');
    const x4=await road();assert.ok(x4.includes('노폭 약 8미터 및 6미터의 포장도로'),'직접 고친 문장 그대로');
    await scope.getByText('1. 접수 · 대상물건',{exact:true}).click();await card.getByRole('button',{name:'↺ 자동 문장으로'}).click();
    assert.equal(await ta.inputValue(),want,'자동 문장 복귀');
    assert.deepEqual(errors,[]);console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
