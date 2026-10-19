// 목록표시근거 칸 — 접수개요 입력값이 한글 문서 칸에 들어가는지 (템플릿은 고정 글자라 런타임에 바꿔 넣음)
//  ① 집합건물 단일: 감정평가표(표지/괄감/의견서 묶음 section0) ② 입주권: 2. 괄호감정표
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/list_basis_cell.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),zlib=require('zlib'),os=require('os');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
function unzip(buf){const files={};let p=0;
  while(p+30<=buf.length&&buf.readUInt32LE(p)===0x04034b50){const method=buf.readUInt16LE(p+8),csz=buf.readUInt32LE(p+18),nl=buf.readUInt16LE(p+26),el=buf.readUInt16LE(p+28);
    const name=buf.slice(p+30,p+30+nl).toString('utf8');const data=buf.slice(p+30+nl+el,p+30+nl+el+csz);
    files[name]=method===8?zlib.inflateRawSync(data):data;p=p+30+nl+el+csz;}
  return files;}
// '목록표시근거' 머리 칸 다음 칸의 문단별 글자
function cellLines(xml){const i=xml.indexOf('>목록표시근거<');assert(i>=0,'목록표시근거 칸');const s=xml.indexOf('<hp:tc ',i),e=xml.indexOf('</hp:tc>',s);
  return (xml.slice(s,e).match(/<hp:p [\s\S]*?<\/hp:p>/g)||[]).map(p=>(p.match(/<hp:t>([^<]*)<\/hp:t>/g)||[]).map(t=>t.replace(/<\/?hp:t>/g,'')).join(''));}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'listbasis-'));
  const open=async(url,init)=>{const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await page.addInitScript(init);await page.goto(base+url,{waitUntil:'domcontentloaded'});return {ctx,page,errors};};
  const save=async(page,click,name)=>{const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),click()]);const f=path.join(tmp,name);await dl.saveAs(f);return unzip(fs.readFileSync(f));};
  try{
    // ① 집합건물 단일
    for(const [val,want] of [['귀 제시목록 등',['귀 제시목록 등']],
                             ['등기사항전부증명서(집합건물), 집합건축물대장, 귀 제시목록 등',['등기사항전부증명서(집합건물),','집합건축물대장, 귀 제시목록 등']]]){
      const {ctx,page,errors}=await open('/s3r86w8a.html?last=1',()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');});
      const scope=page.locator('#root');
      await scope.getByText('1. 접수개요',{exact:true}).click({timeout:60000});
      await scope.locator('div:has(> span:text-is("목록표시근거")) input').first().fill(val);
      await scope.getByText('4. 가격산출',{exact:true}).click();
      const btn=scope.getByRole('button',{name:'표지/괄감/의견서'});await btn.waitFor();for(let i=0;i<30&&await btn.isDisabled();i++)await page.waitForTimeout(500);
      const z=await save(page,()=>btn.click(),'jip.hwpx');
      const xml=z['Contents/section0.xml'].toString('utf8');
      assert.deepEqual(cellLines(xml),want,'집건 감정평가표 칸');
      assert(!xml.includes('{{'),'미치환 토큰 없음');
      assert.deepEqual(errors,[]);await ctx.close();console.log('집건',JSON.stringify(want));
    }
    // ② 입주권 — 새 기본값 / 직접 고친 값
    {
      const {ctx,page,errors}=await open('/입주권.html',()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
      await page.waitForSelector('text=② 접수개요',{timeout:60000});await page.click('text=② 접수개요');
      const inp=page.locator('div:has(> span:text-is("목록표시근거")) input').first();
      await inp.fill('공급계약서 및 귀 제시목록 등');
      await page.click('text=④ 가격산출');
      let z=await save(page,()=>page.getByRole('button',{name:'2. 괄호감정표'}).click(),'ipj1.hwpx');
      assert.deepEqual(cellLines(z['Contents/section0.xml'].toString('utf8')),['공급계약서 및 귀 제시목록 등'],'입주권 괄감 칸');
      await page.click('text=② 접수개요');await inp.fill('조합원 공급계약서, 관리처분계획서, 귀 제시목록 등');await page.click('text=④ 가격산출');
      z=await save(page,()=>page.getByRole('button',{name:'2. 괄호감정표'}).click(),'ipj2.hwpx');
      assert.deepEqual(cellLines(z['Contents/section0.xml'].toString('utf8')),['조합원 공급계약서,','관리처분계획서, 귀 제시목록 등'],'입주권 두 줄');
      assert.deepEqual(errors,[]);await ctx.close();console.log('입주권 OK');
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
