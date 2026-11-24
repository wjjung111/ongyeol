// 토지건물 위치도 → 「광역위치도 확정」「상세위치도 확정」 캡처 → 6. 위치도 한글(소재지 전체 주소, 그림 칸 꽉 차게, 표 위 빈 줄 5줄로 통일) (2026-11-24)
// 화면 공유(getDisplayMedia)는 가짜 스트림: 빨간 틀 자리만 빨강, 나머지 파랑으로 칠한 캔버스 → 잘린 그림이 전부 빨강이어야 정확히 자른 것.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_mapshot.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),zlib=require('zlib');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
// 아주 작은 zip 읽기(stored/deflate)
function unzip(buf){const out={};let o=0;while(buf.readUInt32LE(o)===0x04034b50){const m=buf.readUInt16LE(o+8),cs=buf.readUInt32LE(o+18),nl=buf.readUInt16LE(o+26),el=buf.readUInt16LE(o+28);
  const name=buf.slice(o+30,o+30+nl).toString(),d=buf.slice(o+30+nl+el,o+30+nl+el+cs);out[name]=m===8?zlib.inflateRawSync(d):d;o+=30+nl+el+cs;}return out;}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});const page=await ctx.newPage();const errs=[];
    page.on('pageerror',e=>{if(!/\bL is not defined|kakao|leaflet|ArapMap\b/i.test(e.message))errs.push(e.message);});
    page.on('dialog',d=>{errs.push('dialog: '+d.message());d.dismiss();});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
      if(u.startsWith(base))return r.continue();return r.abort();});
    await ctx.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}
      // 가짜 화면 공유: 부를 때마다 지금 빨간 틀 자리를 빨강으로 칠한 화면(뷰포트 크기 × 1.25배)
      window.__shareCalls=0;
      navigator.mediaDevices.getDisplayMedia=async function(o){window.__shareCalls++;window.__lastOpt=o;
        const k=1.25,c=document.createElement('canvas');c.width=Math.round(innerWidth*k);c.height=Math.round(innerHeight*k);
        const x=c.getContext('2d'),paint=()=>{const r=document.getElementById('mapFrame').getBoundingClientRect();
          x.fillStyle='#0000ff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#ff0000';x.fillRect(r.left*k,r.top*k,r.width*k,r.height*k);};
        paint();const s=c.captureStream(10);const iv=setInterval(paint,50);s.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(iv));
        const t=s.getVideoTracks()[0],stop=t.stop.bind(t);t.stop=()=>{clearInterval(iv);stop();};return s;};
    });
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapMapShot&&window.mapShot&&window.renderLands);
    await page.evaluate(()=>{
      LANDS=[{소재지:'서울특별시 금천구 독산동',지번:'1023-9',fullAddr:'서울특별시 금천구 독산동 1023-9',지목:'대',면적:'200',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
      renderLands();document.getElementById('ov_client').value='홍길동';try{showTab('jido');}catch(e){}
      document.getElementById('tab-jido').classList.add('on');mapFrameFit();renderMapShotState();});
    // ① 버튼 위치(말풍선 패널 오른쪽) · 틀 비율
    const lay=await page.evaluate(()=>{const b=document.getElementById('btnShotWide').getBoundingClientRect(),p=document.getElementById('mapLabPanel').getBoundingClientRect(),f=document.getElementById('mapFrame').getBoundingClientRect();
      return {right:b.left>=p.right-1,sameRow:b.top<p.bottom,ratio:f.height/f.width,fh:f.height,ih:innerHeight,btns:[...document.querySelectorAll('.mshot .msbtns .btn')].map(x=>x.textContent)};});
    console.log('① 배치',lay);
    assert.ok(lay.right&&lay.sameRow,'버튼은 말풍선 패널 오른쪽');
    assert.deepEqual(lay.btns,['📸 광역위치도 확정','📸 상세위치도 확정']);
    assert.ok(Math.abs(lay.ratio-56000/50228)<0.01,'틀 비율 = 한글 그림 칸');assert.ok(lay.fh<=lay.ih-40);
    await page.screenshot({path:process.env.SHOT||'/tmp/toji_mapshot.png'});
    // ② 광역 확정 → 아직 다운로드 없음, 그림은 전부 빨강(틀만 정확히 잘림)
    let dl=0;page.on('download',()=>dl++);
    await page.evaluate(()=>{const A=window.ArapCheonggu,o=A.triggerDownload;window.__names=[];A.triggerDownload=(b,n)=>{window.__names.push(n);return o(b,n);};});
    await page.click('#btnShotWide');
    await page.waitForFunction(()=>MAPSHOT.wide,null,{timeout:15000});
    const w=await page.evaluate(async()=>{const s=MAPSHOT.wide,im=new Image();im.src=s.dataUrl;await im.decode();
      const c=document.createElement('canvas');c.width=s.w;c.height=s.h;const x=c.getContext('2d');x.drawImage(im,0,0);
      const px=(a,b)=>Array.from(x.getImageData(a,b,1,1).data).slice(0,3);
      return {w:s.w,h:s.h,corners:[px(1,1),px(s.w-2,1),px(1,s.h-2),px(s.w-2,s.h-2),px(s.w>>1,s.h>>1)],msg:document.getElementById('mapShotMsg').textContent,opt:window.__lastOpt};});
    console.log('② 광역',{w:w.w,h:w.h,corners:w.corners,msg:w.msg});
    w.corners.forEach(c=>assert.ok(c[0]>200&&c[2]<60,'틀 밖(파랑)이 섞이지 않음 '+c));
    assert.ok(Math.abs(w.h/w.w-56000/50228)<0.02);assert.equal(w.opt.preferCurrentTab,true);
    assert.equal(dl,0,'하나만 찍으면 아직 안 받음');assert.ok(/상세위치도 확정/.test(w.msg));
    // ③ 상세 확정 → 자동 다운로드
    const [d]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.click('#btnShotDetail')]);
    assert.deepEqual(await page.evaluate(()=>window.__names),['6. 위치도_홍길동.hwpx']);
    const z=unzip(fs.readFileSync(await d.path()));
    const names=Object.keys(z);console.log('③ 파일',names);
    assert.equal(names[0],'mimetype');assert.ok(z['BinData/image1.png']&&z['BinData/image2.png']);
    assert.equal(z['BinData/image1.png'].slice(1,4).toString(),'PNG');
    const hpf=z['Contents/content.hpf'].toString();assert.ok(/id="image1" href="BinData\/image1.png" media-type="image\/png"/.test(hpf)&&/id="image2"/.test(hpf));
    const lines=x=>{const tb=x.lastIndexOf('<hp:p ',x.lastIndexOf('<hp:tbl',x.indexOf('rowCnt="2"')));let h=x.slice(0,tb),n=0,m;
      const re=/<hp:p id="0" paraPrIDRef="\d+" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="\d+"\/>(?:<hp:linesegarray>(?:(?!<\/hp:p>)[\s\S])*?<\/hp:linesegarray>)?<\/hp:p>$/;
      while((m=re.exec(h))){n++;h=h.slice(0,m.index);}return n;};
    for(const [i,img,title] of [[0,'image1','광역위치도'],[1,'image2','상세위치도']]){
      const x=z['Contents/section'+i+'.xml'].toString();
      const t=x.match(/<hp:t>[^<]*<\/hp:t>/g).map(s=>s.replace(/<[^>]+>/g,''));
      assert.deepEqual(t,['chapter','5',title,'소재지','서울특별시 금천구 독산동 1023-9']);
      assert.ok(x.includes('binaryItemIDRef="'+img+'"'),'그림 '+img);
      assert.ok(/<hp:curSz width="50228" height="56000"\/>/.test(x),'그림 칸 폭에 꽉 차게');
      assert.ok(/<hp:cellSz width="50510" height="56282"\/>/.test(x),'그림 행 높이');
      assert.equal(lines(x),4,'표 위 빈 문단 4개(첫 줄 포함 5줄)');
      // XML 모양 검사
      const ok=await page.evaluate(s=>!new DOMParser().parseFromString(s,'application/xml').querySelector('parsererror'),x);assert.ok(ok,'XML '+i);
    }
    // ④ 다시 찍기 · 「한글 받기」 · 전체 받기 목록에 6. 위치도
    const st=await page.evaluate(()=>document.getElementById('mapShotState').textContent);
    assert.ok(/✓ 광역/.test(st)&&/✓ 상세/.test(st)&&/한글 받기/.test(st),st);
    // 다른 건(접수번호 바뀜)이면 그림을 비움
    const cleared=await page.evaluate(()=>{document.getElementById('ov_caseNo').value='X-1';renderMapShotState();return !MAPSHOT.wide&&/아직/.test(document.getElementById('mapShotState').textContent);});
    assert.ok(cleared,'다른 건이면 비움');
    // 공유 취소
    await page.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=async()=>{const e=new Error('x');e.name='NotAllowedError';throw e;};});
    await page.click('#btnShotWide');
    await page.waitForFunction(()=>/취소/.test(document.getElementById('mapShotMsg').textContent));
    assert.deepEqual(errs,[]);
    console.log('✅ 위치도 한글 캡처 검증 통과');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
