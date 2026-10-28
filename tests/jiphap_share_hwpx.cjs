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
      // 그 밖의 사항 문구: 처음엔 지분·사정면적 따라가는 자동 문구 → 고치면 그 글, ↺ 자동 문구로 복귀
      const ta=scope.getByLabel('지분평가 그 밖의 사항 문구');
      assert.match(await ta.inputValue(),/^본건은 귀 의뢰인의 요청에 의거하여 귀 의뢰지분\(1\/4, 사정면적 [\d.]+㎡\)만을 평가하였으며/,'자동 문구');
      await ta.fill('임시');await scope.getByRole('button',{name:'↺ 자동 문구'}).click();
      assert.match(await ta.inputValue(),/귀 의뢰지분\(1\/4/,'자동 문구 복귀');
      await ta.fill('지분 위치 특정 불가 & 전체 기준 평가');
    }
    await scope.getByText('4. 가격산출',{exact:true}).click();
    // 2026-10-28부터 표지·괄감·의견서가 따로 — 의견서(x)·괄감(x0)을 각각 받는다
    const get=async(name,fname)=>{const btn=scope.getByRole('button',{name,exact:true});await btn.waitFor();for(let i=0;i<30&&await btn.isDisabled();i++)await page.waitForTimeout(500);
      const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),btn.click()]);const file=path.join(process.env.OUT||require('os').tmpdir(),fname);await dl.saveAs(file);return unzip(fs.readFileSync(file));};
    const tag=(share?'주거_단일호수_지분_출력예시.hwpx':'주거_단일호수_출력예시.hwpx').replace('.hwpx','');
    const z=await get('의견서',tag+'_의견서.hwpx'),zg=await get('괄감',tag+'_괄감.hwpx'),zp=await get('표지',tag+'_표지.hwpx');
    assert.ok(!z['Contents/section1.xml']&&!zg['Contents/section1.xml']&&!zp['Contents/section1.xml'],'파일마다 구역 하나');
    assert.ok(T(zp['Contents/section0.xml'].toString('utf8')).includes('Appraisal Report')&&!zp['Contents/section0.xml'].toString('utf8').includes('chapter'),'표지만');
    const x=z['Contents/section0.xml'].toString('utf8'),x0=zg['Contents/section0.xml'].toString('utf8');
    const ok=await page.evaluate(([a,b])=>[a,b].every(s=>!new DOMParser().parseFromString(s,'application/xml').getElementsByTagName('parsererror').length),[x,x0]);
    assert.ok(ok,'XML 정상');assert.deepEqual([...new Set((x+x0).match(/\{\{[^}]+\}\}/g)||[])],[],'남은 토큰 없음');
    { // 「7. 단가의 결정」 시점수정 칸: 단 설정 조각·옛 줄배치 없이 가운데 정렬되게
      const k=x.indexOf('7. 전유면적당 단가의 결정');const tb=x.slice(k,x.indexOf('</hp:tbl>',k));
      assert.ok(!/<hp:colPr/.test(tb),'단가 결정 표에 단 설정 조각 없음');
      const v=tb.match(/<hp:p\b[^>]*>(?:(?!<\/hp:p>)[\s\S])*?1\.\d{5}<\/hp:t><\/hp:run>((?:(?!<\/hp:p>)[\s\S])*?)<\/hp:p>/);assert.ok(v,'시점수정 값 문단');assert.ok(!/linesegarray/.test(v[1]),'시점수정 칸 줄배치 캐시 제거');}
    const t=T(x);
    assert.ok(!/\|[^|]*\d+\/\d+\/\d+호\|/.test(t.slice(0,t.indexOf('감정평가액의 결정'))),'거래사례 동/층/호에 「호」 안 붙음');   // 결정표는 사용자 양식대로 「506/7/702호」
    // 개별요인 의견: ■ 네 줄(각각 문단)
    const ops=t.split('|').filter(s=>s.startsWith('■ '));
    assert.deepEqual(ops.map(s=>s.split(':')[0]),['■ 단지외부요인','■ 단지내부요인','■ 호별요인','■ 기타요인'],'■ 네 줄 '+JSON.stringify(ops));
    if(share){
      assert.ok(!t.includes('귀 제시 지분(1/4)만을 감정평가하였으며'),'4. 감정평가방법 라. 문단 없음');
      assert.ok(!t.includes('합리성 검토를 생략하였음.|라.|'),'4. 다. 뒤 라. 없음');
      { const k=t.indexOf('업무진행 시 참고 바람');assert.ok(k>0&&t.slice(k).startsWith('업무진행 시 참고 바람|마.| 지분 위치 특정 불가 &amp; 전체 기준 평가|'),'그 밖의 사항 마. 문구 '+t.slice(k,k+80)); }
      assert.equal((t.match(/ × 1\/4\|/g)||[]).length,4,'개요 면적 네 칸 × 1/4');
      { const rows=[...t.matchAll(/\|([\d.,]+) × 1\/4\|= ([\d.]+)(?=\|)/g)];   // 개요 면적 칸 둘째 줄 「= 계산값」(소수 둘째 자리 반올림)
        assert.equal(rows.length,4,'개요 면적 네 칸 = 계산값 '+JSON.stringify(rows.map(r=>r[0])));
        for(const r of rows)assert.equal(r[2],(Math.round(+r[1].replace(/,/g,'')/4*100+1e-7)/100).toFixed(2),'계산값 '+r[0]); }
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
      assert.ok(!t.includes('|마.|'),'지분 아니면 그 밖의 사항 마. 없음');
    }
    assert.deepEqual(errors,[]);await ctx.close();console.log(share?'지분 OK':'일반 OK');}
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
