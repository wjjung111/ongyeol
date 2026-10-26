// 집건 단일 청구서 수수료 할증 — 사유(소급·선하지·임야·도로 ×1.5), 지분평가(×1.1·×1.5, 전체 평가액 기준 수수료 상한), 겹치면 큰 배수 하나
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_fee_mul.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
const num=s=>Number(String(s).replace(/[^\d]/g,''));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)||u.includes('cdn')||u.includes('unpkg')?r.continue():r.abort();});
    await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');});
    await page.goto(base+'/s3r86w8a.html?last=1');
    global.window={};require(path.join(root,'arap_fee.js'));const F=window.ArapFee;
    const scope=page.locator('#root');
    await scope.getByText('4. 가격산출',{exact:true}).click({timeout:60000});
    const right=scope.locator('.k4-right');
    await scope.locator('textarea[placeholder*="계산서1"]').first().fill('');   // 샘플의 붙여넣은 계산서를 비워 자동 계산으로
    await page.waitForTimeout(300);
    const txt=()=>right.innerText();
    const feeRow=async()=>num((await txt()).match(/평가수수료[\s\S]*?([\d,]{6,})\s*\n/)[1]);
    const amtNow=async()=>num((await txt()).match(/예상평가액\s*([\d,]+)원/)[1]);
    const rd=n=>Math.floor(n/1000)*1000;
    // ① 지분평가 아님 → 지분 할증 칸 없음, 사유 드롭다운은 있음
    assert(!(await txt()).includes('지분평가 할증'),'지분평가 아니면 지분 할증 칸 없음');
    const amt0=await amtNow(),fee0=await feeRow();
    assert.equal(fee0,rd(F.calc(amt0).하한수수료),'할증 없음 = 하한 절사');
    const reason=right.locator('select:has(option[value="소급"])');
    for(const r of ['소급','선하지','임야','도로']){
      await reason.selectOption(r);await page.waitForTimeout(200);
      assert.equal(await feeRow(),rd(F.calc(amt0).하한수수료*1.5),r+' ×1.5');
      assert((await txt()).includes('할증: '),r+' 산식 표시');
    }
    // 특별용역비 상한-하한 자동값도 배수
    const spSel=right.locator('select:has(option[value="상한-하한"])');
    await spSel.selectOption('상한-하한');await page.waitForTimeout(300);
    const a0=F.calc(amt0);
    const spVal=num(await right.locator('tr:has-text("특별용역비") input').inputValue());
    assert.equal(spVal,Math.round((a0.상한수수료-a0.하한수수료)*1.5/1000)*1000,'특별용역비 차액 × 1.5');
    await spSel.selectOption('직접입력');
    // 기준요율에도 배수
    const basis=right.locator('select:has(option[value="기준"])').first();
    await basis.selectOption('기준');await page.waitForTimeout(200);
    assert.equal(await feeRow(),rd(a0.기준수수료*1.5),'기준요율 ×1.5');
    await basis.selectOption('하한');
    await reason.selectOption('');await page.waitForTimeout(200);
    assert.equal(await feeRow(),fee0,'사유 해제 → 원래대로');
    // ② 지분평가 1/2
    await scope.getByText('2. 대상물건개요',{exact:false}).first().click();
    await scope.locator('select:has(option[value="share"])').first().selectOption('share');
    await scope.locator('input[placeholder="분자"]').fill('1');
    await scope.locator('input[placeholder="분모"]').fill('2');
    await scope.getByText('4. 가격산출',{exact:true}).click();
    const mul=right.locator('select:has(option[value="1.5"])');await mul.waitFor();
    const amtS=await amtNow();assert(amtS<amt0*0.6,'지분 감정평가액 ≈ 1/2: '+amt0+' → '+amtS);
    const feeS=await feeRow();assert.equal(feeS,rd(F.calc(amtS).하한수수료),'지분 1배');
    await mul.selectOption('1.1');await page.waitForTimeout(200);
    const capFull=F.calc(amt0).하한수수료;   // 전체 평가액(지분 전) 기준 수수료 — 상한
    assert.equal(await feeRow(),rd(Math.min(F.calc(amtS).하한수수료*1.1,capFull)),'지분 1.1배');
    await mul.selectOption('1.5');await page.waitForTimeout(200);
    const want15=rd(Math.min(F.calc(amtS).하한수수료*1.5,capFull));
    assert.equal(await feeRow(),want15,'지분 1.5배(전체 평가액 기준 수수료 상한)');
    if(F.calc(amtS).하한수수료*1.5>capFull)assert((await txt()).includes('제5조④'),'상한 적용 문구');
    // 지분 1.1 + 소급 1.5 → 큰 배수 하나(1.5, 소급이므로 지분 상한 미적용)
    await mul.selectOption('1.1');await reason.selectOption('소급');await page.waitForTimeout(200);
    assert.equal(await feeRow(),rd(F.calc(amtS).하한수수료*1.5),'겹치면 큰 배수 하나(소급 1.5)');
    // 청구서 hwpx에도 할증된 평가수수료가 들어가는지(저장 방식 zip이라 XML 글자를 바로 찾는다)
    {
      const want=rd(F.calc(amtS).하한수수료*1.5).toLocaleString('ko-KR');
      const [dl]=await Promise.all([page.waitForEvent('download'),right.getByText('📄 청구서 hwpx 다운로드').click()]);
      const buf=fs.readFileSync(await dl.path());
      const zlib=require('zlib');let xml='';   // 엔트리별로 풀어 본문 XML 모으기(무압축/압축 모두)
      for(let o=0;o+30<buf.length;){if(buf.readUInt32LE(o)!==0x04034b50)break;const m=buf.readUInt16LE(o+8),cs=buf.readUInt32LE(o+18),nl=buf.readUInt16LE(o+26),el=buf.readUInt16LE(o+28);const d=buf.subarray(o+30+nl+el,o+30+nl+el+cs);xml+=(m===8?zlib.inflateRawSync(d):d).toString('utf8');o+=30+nl+el+cs;}
      assert(xml.includes('>'+want+'<'),'청구서 hwpx 평가수수료 '+want);
      console.log('hwpx 평가수수료',want);
    }
    console.log('전체',amt0,fee0,'지분',amtS,feeS,'지분1.5',want15,'상한',capFull);
    // ③ 엔진 직접: 할증 최저 375,000원(제4조③) — 소액 건
    {
      const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
      const a=html.indexOf('function feeMulOf'),b=html.indexOf('function buildGeonmyeong');
      const src=html.slice(a,b).replace(/function parseFeeStatement[\s\S]*?\n}\n/,'');
      const fmt=n=>Number(n).toLocaleString('ko-KR');
      const E=new Function('window','fmt',src+';return{feeAdjOf,computeCheonggu};')(window,fmt);
      const small=F.calc(30000000);   // 3천만원
      // 표 최저 250,000 × 1.5 = 375,000이라 1.5배는 저절로 맞고, 지분 1.1배(275,000)에서 최저가 걸린다
      const c=E.computeCheonggu(small,'0','0','하한',null,null,null,null,E.feeAdjOf({areaOption:'share',feeMul:'1.1'}));
      assert(small.하한수수료*1.1<375000,'소액 전제');
      assert.equal(c.평가수수료,375000,'할증 최저 375,000원');assert(c.할증메모.includes('제4조③'));
      const n=E.computeCheonggu(small,'0','0','하한',null,null,null,null,E.feeAdjOf({}));
      assert.equal(n.평가수수료,Math.floor(small.하한수수료/1000)*1000,'할증 없으면 최저 규칙 없음');
      const bad=E.feeAdjOf({feeSurReason:'엉뚱한값',areaOption:'none',feeMul:'1.5'});
      assert.equal(bad.mul,1,'목록 밖 사유·지분 아님 → 1배');
    }
    // ④ 여러 호수 화면에도 사유 드롭다운
    {
      const ctx2=await browser.newContext(),pg=await ctx2.newPage();pg.on('pageerror',e=>errors.push(e.message));pg.on('dialog',d=>d.accept());
      await ctx2.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)||u.includes('cdn')||u.includes('unpkg')?r.continue():r.abort();});
      await pg.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','multi');});
      await pg.goto(base+'/s3r86w8a.html?last=1');
      const sc=pg.locator('#root-multi');
      await sc.getByText('4. 가격산출',{exact:true}).click({timeout:60000});
      const rs=sc.locator('.k4-right select:has(option[value="소급"])');
      await rs.selectOption('도로');assert.equal(await rs.inputValue(),'도로','여러 호수 사유 선택');
      assert(!(await sc.locator('.k4-right').innerText()).includes('지분평가 할증'),'여러 호수엔 지분 칸 없음');
      await ctx2.close();
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
