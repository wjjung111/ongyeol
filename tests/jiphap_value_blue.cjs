// 집합건물(단일호수) 한글 출력 — 플레이스홀더로 채운 값: 표 밖은 파랑, 표 안은 검정(2026-10-28). 고정 문구는 원래 색. 글자모양 id 연속·itemCnt 일치
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_value_blue.cjs
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
    await page.goto(base+'/s3r86w8a.html?last=1');const scope=page.locator('#root');await scope.getByText('4. 가격산출',{exact:true}).click({timeout:60000});
    const get=async(name)=>{const btn=scope.getByRole('button',{name,exact:true});await btn.waitFor();for(let i=0;i<30&&await btn.isDisabled();i++)await page.waitForTimeout(500);
      const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),btn.click()]);const file=path.join(require('os').tmpdir(),'jiphap_value_blue_'+name+'.hwpx');await dl.saveAs(file);return unzip(fs.readFileSync(file));};
    const check=([h,x])=>{
      const HH='http://www.hancom.co.kr/hwpml/2011/head',HP='http://www.hancom.co.kr/hwpml/2011/paragraph';
      const hd=new DOMParser().parseFromString(h,'application/xml'),list=hd.getElementsByTagNameNS(HH,'charProperties')[0],prs=[...list.getElementsByTagNameNS(HH,'charPr')];
      const color=id=>{const p=prs.find(q=>q.getAttribute('id')===id);return p?p.getAttribute('textColor'):'?';};
      const sd=new DOMParser().parseFromString(x,'application/xml');
      const runs=[...sd.getElementsByTagNameNS(HP,'run')].filter(r=>r.getElementsByTagNameNS(HP,'t').length&&r.textContent.trim());
      const inTbl=n=>{for(let p=n.parentNode;p;p=p.parentNode)if(p.localName==='tbl')return true;return false;};
      const info=runs.map(r=>({t:r.textContent,tbl:inTbl(r),c:color(r.getAttribute('charPrIDRef'))}));
      return {ok:prs.length===+list.getAttribute('itemCnt')&&prs.every((p,i)=>+p.getAttribute('id')===i),
        blueInTbl:info.filter(i=>i.tbl&&i.c==='#0000FF').map(i=>i.t),blueOut:info.filter(i=>!i.tbl&&i.c==='#0000FF').map(i=>i.t),out:info.filter(i=>!i.tbl).map(i=>i.t+'@'+i.c)};
    };
    const z=await get('의견서');const r=await page.evaluate(check,[z['Contents/header.xml'].toString('utf8'),z['Contents/section0.xml'].toString('utf8')]);
    assert.ok(r.ok,'글자모양 id 연속·itemCnt 일치');
    assert.deepEqual(r.blueInTbl,[],'표 안은 파랑 없음');
    assert.ok(r.blueOut.includes('일반거래(시가참고)'),'평가목적 값 파랑 '+JSON.stringify(r.blueOut));
    assert.ok(r.blueOut.some(t=>/^\d{4}\.\d{2}\.\d{2}$/.test(t)),'기준시점 값 파랑');
    assert.ok(r.out.some(t=>t.startsWith('「감정평가에 관한 규칙」제9조에 의거 기준시점은')&&!t.endsWith('#0000FF')),'고정 문구는 원래 색');
    const zg=await get('괄감');const g=await page.evaluate(check,[zg['Contents/header.xml'].toString('utf8'),zg['Contents/section0.xml'].toString('utf8')]);
    assert.ok(g.ok,'괄감 글자모양');assert.deepEqual(g.blueInTbl,[],'괄감 표 안 파랑 없음');
    assert.deepEqual(errors,[]);
    console.log('PASS 표 밖 파랑',r.blueOut.length,'개:',r.blueOut.slice(0,8).join(' / '));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
