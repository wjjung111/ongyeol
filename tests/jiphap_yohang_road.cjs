// 집합건물 요항표 4. 접면도로 상황 — 주거용 고정 문장 / 비주거용은 2. 대상물건개요에서 방향·노폭 입력(나머지 글자 연한 회색)
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
    await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');});
    await page.goto(base+'/s3r86w8a.html?last=1');const scope=page.locator('#root');
    const road=async()=>{await scope.getByText('4. 가격산출',{exact:true}).click();
      const btn=scope.getByRole('button',{name:'요항표',exact:true});await btn.waitFor();for(let i=0;i<30&&await btn.isDisabled();i++)await page.waitForTimeout(500);
      const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),btn.click()]);
      const f=path.join(require('os').tmpdir(),'yohang_road.hwpx');await dl.saveAs(f);const z=unzip(fs.readFileSync(f));
      const x=Object.keys(z).filter(n=>/section\d+\.xml$/.test(n)).map(n=>z[n].toString('utf8')).join('');
      assert.deepEqual([...new Set(x.match(/\{\{[^}]+\}\}/g)||[])],[]);return x;};
    await scope.getByText('2. 대상물건개요',{exact:true}).click({timeout:60000});
    const card=scope.getByText('접면도로 상황 (요항표)',{exact:true}).locator('xpath=..');
    assert.ok((await card.innerText()).includes('아파트단지 내 포장도로가 개설되어'),'주거용 화면 문장');
    assert.ok((await road()).includes('아파트단지 내 포장도로가 개설되어 있으며, 이를 통해 외곽 공도와 연계됨.'),'주거용 요항표');
    await scope.getByText('2. 대상물건개요',{exact:true}).click();
    await scope.locator('button',{hasText:/^비주거용$/}).first().click();
    await scope.locator('input[aria-label="접면도로 방향"]').fill('북측');await scope.locator('input[aria-label="접면도로 노폭"]').fill('40');
    const gray=await scope.locator('span',{hasText:'으로 노폭 약'}).evaluate(e=>getComputedStyle(e).color);assert.equal(gray,'rgb(156, 163, 175)','연한 회색');
    if(process.env.SHOT)await card.screenshot({path:process.env.SHOT});
    const xr=await road();console.log((xr.match(/<hp:t>[^<]*접함[^<]*<\/hp:t>/g)||[]).join(' / '));assert.ok(xr.includes('본건 북측으로 노폭 약 40m 내외의 포장도로에 접함.'),'비주거용 요항표');
    // 두 면 이상 접함 — 둘째 칸이 생기고 「…, 동측으로 노폭 약 8m 내외의 포장도로에 각각 접함.」
    await scope.getByText('2. 대상물건개요',{exact:true}).click();await scope.locator('select[aria-label="접면도로 수"]').selectOption('2');
    await scope.locator('input[aria-label="접면도로 방향 2"]').fill('동측');await scope.locator('input[aria-label="접면도로 노폭 2"]').fill('8');
    assert.ok((await card.innerText()).includes('각각 접함'),'화면 각각');
    if(process.env.SHOT)await card.screenshot({path:process.env.SHOT.replace(/\.png$/,'_2.png')});
    const x2=await road();assert.ok(x2.includes('본건 북측으로 노폭 약 40m, 동측으로 노폭 약 8m 내외의 포장도로에 각각 접함.'),'두 면 요항표');
    await scope.getByText('2. 대상물건개요',{exact:true}).click();
    // 새로고침 뒤에도 입력 유지(건 저장)
    await page.waitForTimeout(1500);await page.reload();await scope.getByText('2. 대상물건개요',{exact:true}).click({timeout:60000});
    assert.equal(await scope.locator('input[aria-label="접면도로 방향"]').inputValue(),'북측','저장 유지');assert.equal(await scope.locator('input[aria-label="접면도로 방향 2"]').inputValue(),'동측','둘째 저장 유지');
    assert.deepEqual(errors,[]);console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
