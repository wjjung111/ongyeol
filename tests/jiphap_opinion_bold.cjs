// 집합건물(단일호수) 의견서 hwpx — 선정 사례 행 굵게, 선정사유 「기호 ㉢을」 굵게+밑줄, 글자모양 id 연속·itemCnt 일치
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_opinion_bold.cjs
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
    const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');});
    await page.goto(base+'/s3r86w8a.html');const scope=page.locator('#root');await scope.getByText('4. 가격산출',{exact:true}).click({timeout:60000});
    const btn=scope.getByRole('button',{name:'표지/괄감/의견서'});await btn.waitFor();for(let i=0;i<30&&await btn.isDisabled();i++)await page.waitForTimeout(500);
    const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),btn.click()]);
    const file=path.join(require('os').tmpdir(),'jiphap_opinion_bold.hwpx');await dl.saveAs(file);
    const z=unzip(fs.readFileSync(file));
    const r=await page.evaluate(async([h,x])=>{
      const hd=new DOMParser().parseFromString(h,'application/xml'),HH='http://www.hancom.co.kr/hwpml/2011/head';
      const list=hd.getElementsByTagNameNS(HH,'charProperties')[0],prs=[...list.getElementsByTagNameNS(HH,'charPr')];
      const info=id=>{const p=prs.find(q=>q.getAttribute('id')===id);return p?{bold:!!p.getElementsByTagNameNS(HH,'bold').length,ul:(p.getElementsByTagNameNS(HH,'underline')[0]||{getAttribute:()=>''}).getAttribute('type'),color:p.getAttribute('textColor')}:null;};
      const sd=new DOMParser().parseFromString(x,'application/xml'),HP='http://www.hancom.co.kr/hwpml/2011/paragraph';
      const rows=[...sd.getElementsByTagNameNS(HP,'tr')].map(tr=>({text:tr.textContent,ids:[...tr.getElementsByTagNameNS(HP,'run')].filter(r=>r.getElementsByTagNameNS(HP,'t').length).map(r=>r.getAttribute('charPrIDRef'))}));
      const caseRows=rows.filter(r=>/^[㉠-㉭]/.test(r.text)&&/호/.test(r.text));
      const why=[...sd.getElementsByTagNameNS(HP,'p')].find(p=>p.textContent.includes('비교사례로 선정하였음')&&!p.getElementsByTagNameNS(HP,'tbl').length);
      const whyRuns=why?[...why.getElementsByTagNameNS(HP,'run')].map(r=>({t:r.textContent,f:info(r.getAttribute('charPrIDRef'))})):[];
      return {cnt:prs.length,itemCnt:+list.getAttribute('itemCnt'),ids:prs.map(p=>+p.getAttribute('id')),caseRows:caseRows.map(r=>({c:r.text.slice(0,1),bold:r.ids.map(info).every(f=>f&&f.bold),anyBold:r.ids.map(info).some(f=>f&&f.bold)})),whyRuns,tw:x.includes('TW:')};
    },[z['Contents/header.xml'].toString('utf8'),z['Contents/section1.xml'].toString('utf8')]);
    assert.equal(r.cnt,r.itemCnt,'itemCnt 일치');assert.deepEqual(r.ids,r.ids.map((_,i)=>i),'글자모양 id 연속');assert.equal(r.tw,false);
    const bold=r.caseRows.filter(x=>x.bold),plain=r.caseRows.filter(x=>!x.anyBold);
    assert.equal(bold.length,1,'굵은 사례 행 하나 '+JSON.stringify(r.caseRows));assert.equal(plain.length,r.caseRows.length-1,'나머지 행은 굵지 않음');
    const em=r.whyRuns.find(x=>/^기호 [㉠-㉭][을를]$/.test(x.t));
    assert(em,'선정사유 강조 런 '+JSON.stringify(r.whyRuns));assert.equal(em.t.slice(3,4),bold[0].c,'강조 기호 = 굵은 행 기호');
    assert(em.f.bold&&em.f.ul==='BOTTOM'&&em.f.color==='#000000','굵게+밑줄+검정');
    r.whyRuns.filter(x=>x!==em).forEach(x=>assert(!x.f.bold&&x.f.ul!=='BOTTOM','나머지 문장은 보통'));
    assert.deepEqual(errors,[]);
    console.log('PASS 선정',bold[0].c,'/',em.t);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
