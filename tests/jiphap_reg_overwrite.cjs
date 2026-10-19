// 집합건물 단일호수 — 다른 건을 복사해 쓴 뒤 새 등기를 자동 인식하면 물건 칸이 새 등기 값으로 통째로 바뀌는지
//   (등기에 없는 대지권·연면적·사용승인일 등 옛 건 값이 남지 않음, 접수 칸은 그대로) — AI 응답은 흉내
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_reg_overwrite.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const REG={jibun:"서울특별시 강남구 신사동 616-2",road:"서울특별시 강남구 압구정로 224",dong:null,floor:"1",ho:"105",area:"46.01",structure:"철근콘크리트조 스라브즙",owner:"김학덕",mainUse:"점포 사무실 음식점 및 다방",mainUseJeonyu:"점포"};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({viewport:{width:1300,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
      if(u.startsWith('https://api.anthropic.com'))return r.fulfill({json:{content:[{type:'text',text:JSON.stringify(REG)}]}});
      return u.startsWith(base)?r.continue():r.abort();});
    await page.addInitScript(k=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');localStorage.setItem(k,'sk-test');},'v2:appraisal-api-key');
    await page.goto(base+'/s3r86w8a.html?last=1');const scope=page.locator('#root');
    await scope.getByText('2. 대상물건개요',{exact:true}).click({timeout:60000});
    const form=scope.locator('xpath=//div[normalize-space(text())="대상물건 정보"]/.. | //div[normalize-space(text())="건물 개요 (의견서용)"]/..');
    const getF=async l=>form.locator(`xpath=.//span[normalize-space(text())="${l}"]/following-sibling::input[1]`).first().inputValue();
    // 샘플(압구정 현대)이 복사해 온 옛 건 역할
    assert.notEqual(await getF('대지권비율 분자'),'','옛 건 대지권 있음');
    await scope.locator('input[type=file]').first().setInputFiles({name:'105호 등기.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
    await scope.locator('button',{hasText:'자동 인식'}).click();
    await scope.locator('text=인식 완료').waitFor({timeout:15000});
    assert.equal(await getF('지번주소'),REG.jibun);assert.equal(await getF('전유면적(㎡)'),'46.01');assert.equal(await getF('소유자'),'김학덕');
    for(const l of ['대지권비율 분자','대지권비율 분모','공용면적(㎡)','건물명'])assert.equal(await getF(l),'',l+' 옛 값 지움');
    const apr=await form.locator('xpath=.//span[normalize-space(text())="사용승인일"]/..//input').first().inputValue();assert.equal(apr,'','사용승인일 옛 값 지움');
    for(const l of ['연면적(㎡)','대지면적(㎡)','단지규모(동/세대·호)'])assert.equal(await getF(l),'',l+' 옛 값 지움');
    assert.deepEqual(errors,[]);console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
