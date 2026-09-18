// 요항표 탭 검증 — 입력칸 자동채움·직접입력·토지이용계획 복붙 정리·저장 후 복원·hwpx 생성(채운 값은 빨강 유지, 미치환 토큰 0)
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
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
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
      sd(); // 실제 토지 조회·계산 후 사이드바 갱신은 hideExamples도 호출한다.
    });
    const auto=await page.evaluate(()=>Object.fromEntries(Y_IDS.map(id=>[id,document.getElementById(id).value])));
    assert.equal(auto.y_dong,'여수동');assert.equal(auto.y_jise,'평탄한');assert.equal(auto.y_shape,'세장형');
    assert.equal(auto.y_struct,'철근콘크리트구조 지상 4층');assert.equal(auto.y_near,'성남여수초등학교 북서측');
    assert.equal(auto.y_use,'제2종근린생활시설 및 다가구주택','건물 주용도 자동 입력');
    await page.evaluate(()=>{
      document.getElementById('bt_purps').value='제1종근린생활시설';
      document.getElementById('y_use').value=LANDS[0]['이용상황'];
      fillYohangFromData();
    });
    assert.equal(await page.locator('#y_use').inputValue(),'제1종근린생활시설','종전 토지 자동값 교체');
    await page.locator('#y_use').fill('현황상 사무실');
    await page.evaluate(()=>fillYohangFromData());
    assert.equal(await page.locator('#y_use').inputValue(),'현황상 사무실','직접 입력 보존');
    await page.locator('#y_use').fill('');
    await page.evaluate(()=>fillYohangFromData());
    assert.equal(await page.locator('#y_use').inputValue(),'제1종근린생활시설');
    // 기본 문구는 실제 값이 아니라 placeholder이며, 빈칸 출력은 원본 양식을 보존한다.
    const defaultSurroundings='본건 주위는 아파트단지 및 근린생활시설 등이 혼재하는 지대로서, 제반 입지여건 무난한 편임.';
    assert.equal(await page.locator('#y_surroundings').inputValue(),'');
    assert.equal(await page.locator('#y_locationEtc').getAttribute('placeholder'),'해당사항 없음.');
    assert.equal(await page.locator('#y_locationEtc_hint').count(),0);
    assert.equal(await page.locator('#y_surroundings').getAttribute('placeholder'),defaultSurroundings.slice(0,-1));
    await page.locator('#y_surroundings').focus();
    assert(await page.locator('#y_surroundings').evaluate(el=>el.matches(':placeholder-shown')),'포커스 상태에서도 기본 문장 표시');
    assert.equal(await page.locator('#y_surroundings').evaluate(el=>getComputedStyle(el,'::placeholder').color),'rgb(160, 167, 178)');
    assert.equal(await page.locator('#landQuery').getAttribute('placeholder'),'','다른 화면의 예시 숨김 동작은 유지');
    assert.deepEqual(await page.locator('.y-location:not(.y-land):not(.y-bld) h4').allTextContents(),['1. 지리적 위치','2. 부근상황','3. 교통상황','4. 기타사항']);
    // Ⅲ. 건물의 개황도 문장형 — 양식 문구 그대로("건물로서 / 등 / 창호 등임. / 로 이용 중임.")
    assert.deepEqual(await page.locator('.y-bld h4').allTextContents(),['1. 건물의 구조','2. 이용상태']);
    assert.deepEqual((await page.locator('.y-bld p').allTextContents()).map(t=>t.replace(/\s+/g,' ').trim()),[' 건물로서','- 외벽 : 등','- 창호 : 창호 등임.','공부상 로 이용 중임.'].map(t=>t.trim()));
    assert.deepEqual(await page.evaluate(()=>['y_struct','y_wall','y_window','y_usestate'].map(id=>document.getElementById(id).closest('.y-bld')?document.getElementById(id).className:'')),['y-inline y-struct','y-inline y-wall','y-inline y-window','y-inline y-usestate']);
    async function outputParagraphs(){return page.evaluate(async()=>{
      const bytes=await ArapTojiDocuments.buildYohang();
      const entries=await ArapCheonggu.parseZip(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
      const d=new DOMParser().parseFromString(new TextDecoder().decode(entries.find(e=>e.name==='Contents/section0.xml').data),'application/xml');
      if(d.querySelector('parsererror'))throw Error('XML 오류');
      return Array.from(d.documentElement.children).filter(p=>p.localName==='p').map(p=>p.textContent);
    });}
    const landPlaceholders=await page.evaluate(()=>['y_jise','y_shape','y_road1dir','y_road1w','y_road2dir','y_road2w'].map(id=>document.getElementById(id).placeholder));
    assert.deepEqual(landPlaceholders,['등고평탄한','정방형','남서측','0','북측','0']);
    assert.deepEqual(await page.locator('.y-land h4').allTextContents(),['1. 지세 및 형상','2. 이용상황','3. 접면도로 상황']);
    const defaults=await outputParagraphs();
    assert(defaults.some(t=>t.includes('대비 평탄한 세장형의 토지임.')),'기존 자동채움 지세와 문장 출력 일치');
    assert(defaults.includes(defaultSurroundings));
    assert(defaults.some(t=>t.includes('제1종근린생활시설로 이용중임.')),'건물 주용도의 요항표 출력');
    const emptyEtcCount=defaults.filter(t=>t==='해당사항 없음.').length;
    await page.locator('#y_surroundings').fill('   ');
    await page.locator('#y_locationEtc').fill('  ');
    assert.deepEqual(await outputParagraphs(),defaults,'공백만 입력하면 양식 문구 유지');
    const surroundings='주위는 단독주택 및 상가가 혼재함.\n<현장 확인> & {{사용자_메모}}';
    const locationEtc='진입 시 사전 연락 필요.\n추가 확인사항 있음.';
    await page.locator('#y_surroundings').fill(surroundings);
    await page.locator('#y_locationEtc').fill(locationEtc);
    const custom=await outputParagraphs();
    for(const line of [...surroundings.split('\n'),...locationEtc.split('\n')])assert(custom.includes(line),'입력 줄 보존: '+line);
    assert(!custom.includes(defaultSurroundings));
    assert.equal(custom.filter(t=>t==='해당사항 없음.').length,emptyEtcCount-1,'다른 절의 기타사항은 보존');
    await page.setViewportSize({width:1800,height:1800});
    await page.locator('#y_surroundings').fill('');
    await page.locator('#y_locationEtc').fill('');
    await page.locator('#y_locationEtc').blur();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.locator('#tab-yohang > .cols5050 > .card').first().screenshot({path:path.join(out,'입지조건-화면.png')});
    await page.locator('#y_surroundings').fill(surroundings);
    await page.locator('#y_locationEtc').fill(locationEtc);
    // 나머지 칸 직접 입력 + 토이계 붙여넣기
    await page.evaluate(raw=>{
      const set=(id,v)=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
      set('y_traffic','성남여수동행정복지센터 버스정류장');set('y_use','주상용 건부지');
      set('y_jise','등고평탄한');set('y_shape','정방형');
      set('y_road1dir','남서측');set('y_road1w','0');set('y_road2dir','북측');set('y_road2w','0');
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
    await page.evaluate(()=>sd());
    assert.equal(await page.locator('#y_surroundings').getAttribute('placeholder'),defaultSurroundings.slice(0,-1),'저장 후 재진입해도 안내 유지');
    assert.equal(await page.locator('#y_locationEtc').getAttribute('placeholder'),'해당사항 없음.');
    assert.deepEqual(await page.evaluate(()=>['y_jise','y_shape','y_road1dir','y_road1w','y_road2dir','y_road2w'].map(id=>document.getElementById(id).placeholder)),landPlaceholders);
    assert.equal(await page.locator('#y_surroundings').inputValue(),surroundings);
    assert.equal(await page.locator('#y_locationEtc').inputValue(),locationEtc);
    // 새 필드가 없는 과거 사건으로 전환할 때 직전 사건의 문장이 섞이면 안 된다.
    await page.evaluate(()=>{const old=collect();delete old.yohang.y_surroundings;delete old.yohang.y_locationEtc;old.yohang.y_jise='평탄';applyForm(old);});
    assert.equal(await page.locator('#y_surroundings').inputValue(),'');
    assert.equal(await page.locator('#y_locationEtc').inputValue(),'');
    assert.equal(await page.locator('#y_jise').inputValue(),'평탄한');
    await page.locator('#y_jise').fill('등고평탄한');
    await page.locator('#y_surroundings').fill(surroundings);
    await page.locator('#y_locationEtc').fill(locationEtc);
    // 다운로드
    const dl=page.waitForEvent('download');await page.locator('#btnYohang2').click();
    const file=path.join(out,'요항표.hwpx');await (await dl).saveAs(file);
    const res=await page.evaluate(async bytes=>{
      const entries=await ArapCheonggu.parseZip(Uint8Array.from(bytes).buffer);
      const dec=new TextDecoder();let text='',redRuns=0,left=[],redText='';
      // 빨강 글자모양 id 를 양식에서 찾아 둔다(채운 값이 그 글자모양으로 남아야 한다)
      const head=dec.decode(entries.find(e=>e.name==='Contents/header.xml').data);
      const hdoc=new DOMParser().parseFromString(head,'application/xml');
      const redIds=new Set(Array.from(hdoc.getElementsByTagNameNS('*','charPr'))
        .filter(p=>(p.getAttribute('textColor')||'').toUpperCase()==='#FF0000').map(p=>p.getAttribute('id')));
      for(const e of entries.filter(e=>/^Contents\/section\d+\.xml$/.test(e.name))){
        const xml=dec.decode(e.data);
        (xml.match(/\{\{[^}]+\}\}/g)||[]).forEach(t=>left.push(t));
        const doc=new DOMParser().parseFromString(xml,'application/xml');
        if(doc.querySelector('parsererror'))throw Error('XML 오류');
        Array.from(doc.getElementsByTagNameNS('*','run')).forEach(r=>{
          if(!redIds.has(r.getAttribute('charPrIDRef')))return;
          redRuns++;redText+=r.textContent+'\n';
        });
        text+=doc.documentElement.textContent;
      }
      return {text,redRuns,redText,left:[...new Set(left)],redIds:[...redIds]};
    },Array.from(fs.readFileSync(file)));
    console.log('남은 토큰',res.left,'| 빨강런',res.redRuns);
    console.log('빨강 글자:',JSON.stringify(res.redText.split('\n').filter(Boolean)));
    for(const m of ['여수동','성남여수초등학교 북서측','성남여수동행정복지센터 버스정류장','등고평탄','정방형','주상용 건부지','남서측','북측','철근콘크리트구조 지상 4층','몰탈위 페인팅 마감','샷시','제1종일반주거지역','가축사육제한구역','<추가기재>'])
      assert(res.text.includes(m),'문서에 없음: '+m);
    assert.deepEqual(res.left,['{{사용자_메모}}'],'사용자 입력 토큰만 문자 그대로 보존');
    for(const line of [...surroundings.split('\n'),...locationEtc.split('\n')])assert(res.text.includes(line));
    // 앱이 채운 자리는 **빨강 그대로** 남는다(평가사가 한글에서 확인·수정하기 쉽게)
    assert(res.redRuns>0,'채운 값이 빨강 글자모양으로 남아야 합니다');
    for(const m of ['여수동','성남여수초등학교 북서측','성남여수동행정복지센터 버스정류장','등고평탄','정방형','주상용 건부지','철근콘크리트구조 지상 4층','몰탈위 페인팅 마감','샷시','제1종일반주거지역'])
      assert(res.redText.includes(m),'빨강으로 나가야 함: '+m);
    assert(!res.redText.includes('본건까지 차량의 진출입이 가능하며'),'양식 고정 문구는 검정 그대로');
    assert(res.text.includes('대비 등고평탄한 정방형의 토지임.'));
    assert(!res.text.includes('등고평탄한한'));
    assert(res.text.includes('본건 남서측으로 노폭 약 0m, 북측으로 노폭 약 0m 내외의 아스팔트 포장도로와 각각 접하고 있음.'));
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({status:'PASS',auto},null,1));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
