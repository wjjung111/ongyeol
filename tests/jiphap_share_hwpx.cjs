// 집합건물 단일호수 한글 감정평가서 — 지분평가 양식(라. 문단·개요 × 1/4·결정표 지분 열·□ 산식, 샘플 방식 계산) + 개별요인 의견 ■ 네 줄
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_share_hwpx.cjs  (OUT=폴더 주면 받은 파일 저장)
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
  const T=x=>(x.match(/<hp:t>[^<]*<\/hp:t>/g)||[]).map(s=>s.slice(6,-7)).join('|');
  try{
    for(const share of [true,false]){
    const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1300,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');});
    await page.goto(base+'/s3r86w8a.html?last=1');const scope=page.locator('#root');
    await scope.getByText('2. 대상물건개요',{exact:true}).click({timeout:60000});
    if(share){
      await scope.locator('select').filter({has:page.locator('option[value="share"]')}).first().selectOption('share');
      await scope.locator('input[placeholder="분자"]').fill('1');await scope.locator('input[placeholder="분모"]').fill('4');
    }
    await scope.getByText('4. 가격산출',{exact:true}).click();
    const btn=scope.getByRole('button',{name:'표지/괄감/의견서'});await btn.waitFor();for(let i=0;i<30&&await btn.isDisabled();i++)await page.waitForTimeout(500);
    const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),btn.click()]);
    const file=path.join(process.env.OUT||require('os').tmpdir(),share?'주거_단일호수_지분_출력예시.hwpx':'주거_단일호수_출력예시.hwpx');await dl.saveAs(file);
    const z=unzip(fs.readFileSync(file));const x=z['Contents/section1.xml'].toString('utf8'),x0=z['Contents/section0.xml'].toString('utf8');
    const ok=await page.evaluate(([a,b])=>[a,b].every(s=>!new DOMParser().parseFromString(s,'application/xml').getElementsByTagName('parsererror').length),[x,x0]);
    assert.ok(ok,'XML 정상');assert.deepEqual([...new Set((x+x0).match(/\{\{[^}]+\}\}/g)||[])],[],'남은 토큰 없음');
    { // 「7. 단가의 결정」 시점수정 칸: 단 설정 조각·옛 줄배치 없이 가운데 정렬되게
      const k=x.indexOf('7. 전유면적당 단가의 결정');const tb=x.slice(k,x.indexOf('</hp:tbl>',k));
      assert.ok(!/<hp:colPr/.test(tb),'단가 결정 표에 단 설정 조각 없음');
      const v=tb.match(/<hp:p\b[^>]*>(?:(?!<\/hp:p>)[\s\S])*?1\.\d{5}<\/hp:t><\/hp:run>((?:(?!<\/hp:p>)[\s\S])*?)<\/hp:p>/);assert.ok(v,'시점수정 값 문단');assert.ok(!/linesegarray/.test(v[1]),'시점수정 칸 줄배치 캐시 제거');}
    const t=T(x);
    // 개별요인 의견: ■ 네 줄(각각 문단)
    const ops=t.split('|').filter(s=>s.startsWith('■ '));
    assert.deepEqual(ops.map(s=>s.split(':')[0]),['■ 단지외부요인','■ 단지내부요인','■ 호별요인','■ 기타요인'],'■ 네 줄 '+JSON.stringify(ops));
    if(share){
      assert.ok(t.includes('귀 제시 지분(1/4)만을 감정평가하였으며'),'라. 문단');
      assert.ok(t.includes('|라.|'),'라. 머리');
      assert.equal((t.match(/ × 1\/4\|/g)||[]).length,4,'개요 면적 네 칸 × 1/4');
      assert.ok(t.includes('귀 제시|지분 비율')&&t.includes('귀 제시 지분|감정평가액(원)')&&t.includes('|25%|'),'결정표 지분 열');
      const m=t.match(/□ 산식 : ([\d,]+) × ([\d.]+) ≒ ([\d,]+) × 25% ≒ ([\d,]+)/);assert.ok(m,'산식 문단');
      const n=s=>+s.replace(/,/g,'');
      const full=n(m[3]),fin=n(m[4]);
      assert.ok(Math.abs(n(m[1])*+m[2]-full)<full*0.01,'전체 금액');
      assert.ok(Math.abs(full*0.25-fin)<=fin*0.01+1000000,'지분 금액');
      assert.ok(T(x0).includes(m[4]),'감정평가표 금액 = 지분 금액');
      assert.ok(t.includes('|'+m[2]+'|'),'결정표 전유면적(공부)');
    }else{
      assert.ok(!t.includes('귀 제시 지분')&&!t.includes('□ 산식'),'지분 아니면 그대로');
    }
    assert.deepEqual(errors,[]);await ctx.close();console.log(share?'지분 OK':'일반 OK');}
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
