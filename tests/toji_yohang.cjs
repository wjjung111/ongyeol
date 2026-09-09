// 요항표 탭 검증 — 입력칸 자동채움·직접입력·토지이용계획 복붙 정리·저장 후 복원·hwpx 생성(검정 글자, 미치환 토큰 0)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_yohang.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.YOHANG_TEST_OUTPUT||path.join(root,'..','yohang-test'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
const RAW=`「국토의 계획 및 이용에 관한 법률」에 따른 지역ㆍ지구등
제1종일반주거지역, 소로한면(접함)
다른 법령 등에 따른 지역ㆍ지구등
가축사육제한구역<가축분뇨의 관리 및 이용에 관한 법률>, 상대보호구역<교육환경 보호에 관한 법률>
「토지이용규제 기본법 시행령」 제9조 제4항 각 호에 해당되는 사항
<추가기재>
건축법 제2조제1항제11호나목에 따른 도로에 접함`;
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiDocuments);
    // 대상물건 값 입력 → 요항표 탭에서 자동채움 확인
    await page.evaluate(()=>{
      LANDS=[{소재지:'여수동',지번:'457',지목:'대',면적:'271.3',용도지역:'1종일주',이용상황:'주상용',도로교통:'소로한면',형상:'세장형',지세:'평지'}];
      renderLands();
      document.getElementById('bt_strct').value='철근콘크리트구조';
      document.getElementById('bt_flrs').value='4/0';
      document.getElementById('bt_purps').value='제2종근린생활시설 및 다가구주택';
      document.getElementById('op_location').value='성남여수초등학교 북서측';
      document.getElementById('ov_client').value='검증 의뢰인';
      showTab('yohang');
    });
    const auto=await page.evaluate(()=>Object.fromEntries(Y_IDS.map(id=>[id,document.getElementById(id).value])));
    assert.equal(auto.y_dong,'여수동');assert.equal(auto.y_jise,'평탄');assert.equal(auto.y_shape,'세장형');
    assert.equal(auto.y_struct,'철근콘크리트구조 지상 4층');assert.equal(auto.y_near,'성남여수초등학교 북서측');
    // 나머지 칸 직접 입력 + 토이계 붙여넣기
    await page.evaluate(raw=>{
      const set=(id,v)=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
      set('y_traffic','성남여수동행정복지센터 버스정류장');set('y_use','주상용 건부지');
      set('y_road1dir','북측');set('y_road1w','6');set('y_road2dir','동측');set('y_road2w','4');
      set('y_wall','몰탈위 페인팅 마감');set('y_window','샷시');
      const ta=document.querySelector('#toiceBox textarea');ta.value=raw;ta.dispatchEvent(new Event('input',{bubbles:true}));
    },RAW);
    const preview=await page.textContent('#toicePreview');
    console.log('--- 정리된 토이계 ---\n'+preview+'\n---');
    assert(!/국토의 계획 및 이용에 관한 법률/.test(preview));
    assert(/제1종일반주거지역/.test(preview)&&/가축사육제한구역/.test(preview));
    assert(/\n<추가기재>/.test(preview));
    // 저장 후 새로고침해도 남는지
    await page.evaluate(()=>doSave());
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiDocuments);
    const kept=await page.evaluate(()=>{showTab('yohang');return {t:document.getElementById('y_traffic').value,toice:(document.querySelector('#toiceBox textarea')||{}).value||''};});
    assert.equal(kept.t,'성남여수동행정복지센터 버스정류장');assert(/제1종일반주거지역/.test(kept.toice));
    // 다운로드
    const dl=page.waitForEvent('download');await page.locator('#btnYohang2').click();
    const file=path.join(out,'요항표.hwpx');await (await dl).saveAs(file);
    const res=await page.evaluate(async bytes=>{
      const entries=await ArapCheonggu.parseZip(Uint8Array.from(bytes).buffer);
      const dec=new TextDecoder();let text='',redRuns=0,left=[];
      for(const e of entries.filter(e=>/^Contents\/section\d+\.xml$/.test(e.name))){
        const xml=dec.decode(e.data);
        (xml.match(/\{\{[^}]+\}\}/g)||[]).forEach(t=>left.push(t));
        redRuns+=(xml.match(/charPrIDRef="43"/g)||[]).length;
        const doc=new DOMParser().parseFromString(xml,'application/xml');
        if(doc.querySelector('parsererror'))throw Error('XML 오류');
        text+=doc.documentElement.textContent;
      }
      return {text,redRuns,left:[...new Set(left)]};
    },Array.from(fs.readFileSync(file)));
    console.log('남은 토큰',res.left,'| 빨강런',res.redRuns);
    for(const m of ['여수동','성남여수초등학교 북서측','성남여수동행정복지센터 버스정류장','평탄','세장형','주상용 건부지','북측','동측','철근콘크리트구조 지상 4층','몰탈위 페인팅 마감','샷시','제1종일반주거지역','가축사육제한구역','<추가기재>'])
      assert(res.text.includes(m),'문서에 없음: '+m);
    assert.equal(res.left.length,0,'미치환 토큰 '+res.left);
    assert.equal(res.redRuns,0,'빨강 글자 남음');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({status:'PASS',auto},null,1));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
