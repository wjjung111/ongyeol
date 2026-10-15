// 입주권 의견서 문구 지시서(2026-10-15) — 분담금/환급금 유형·처리 방식·사업 단계별 금액과 문구, [별첨], 표 머리, 검증
//  §12 테스트 케이스: 광명 1R(환급①) 1,705,130,000/병기 1,363,000,000 · 방배 이도윤(환급① 일부선지급) 7,657,010,175/7,246,000,000
//   · 방배 이상기(분담) 6,313,565,001 · 광명 1R [별첨] 1,630,000,000 − 342,130,000 = 1,287,870,000 · 헤리스톤(분담 완납가정) 2,950,000,000/2,758,151,524
// node tests/ipj_refund.cjs   (PLAYWRIGHT_MODULE 로 playwright 경로 지정 가능)
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
const paras=xml=>(xml.match(/<hp:p\b(?:(?!<hp:p\b)[\s\S])*?<\/hp:p>/g)||[]).map(p=>(p.match(/<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g)||[]).map(t=>t.replace(/<[^>]+>/g,'')).join(''));
const after=(ps,head,n)=>{const i=ps.indexOf(head);assert(i>=0,head);return ps.slice(i+1,i+1+n);};
const item=(ps,lbl)=>{const i=ps.indexOf('4. 감정평가방법의 적용 및 감정평가액의 산출의견'),j=ps.indexOf('5. 감정평가조건');return ps.slice(i,j).find(t=>t.startsWith(lbl+'. '))||'';};
const sec6=ps=>{const i=ps.indexOf('6. 그 밖의 사항');return ps.slice(i+1,ps.indexOf('Ⅱ. 대상물건 개요')).filter(t=>t.trim());};
const iv2=ps=>{const k=ps.lastIndexOf('합계');return ps.slice(k+1,k+6);};
const G={gwolli:'1,003,430,000',bunyang:'661,300,000'};   // 광명 109-1403
function seed({ov={},unit={},cs={}}){
  const id='ON261012-2101';
  const u={sym:'가',dong:'109',floor:'14',ho:'1403',type:'112',baejeong:'112',jeonyu:'112.6617',gongyong:'38.4749',gonggeup:'151.1366',bunyangMyeon:'151.1366',gyeyak:'223.653',daeji:'51.7181',
    bunyangga:G.bunyang,extFactor:'1.00',intFactor:'1.30',hoFactor:'1.00',etcFactor:'0.99',noteExt:'',noteInt:'',noteHo:'',noteEtc:'',appliedCaseId:'g1',...unit};
  const c={id:'g1',symbol:'㉠',location:'철산동',jibun:'629',aptName:'두산위브',dong:'108',floor:'17',ho:'1701',exclusiveArea:'114.99',price:'930000000',unitPrice:'8087659',tradeDate:'2026-04-14',approvalDate:'2010-01-01',timeAdj:1.09579,timeAdjDetail:'',isShown:true,isSelected:true,...cs};
  const base={caseNo:id,caseNoDisplay:id,client:'강연민',owner:'구춘회',baseDate:'2026.10.12',surveyDate:'2026.10.15',writeDate:'2026.10.15',
    projName:'광명제1R구역 주택재개발정비사업',projType:'재개발',projLoc:'경기도 광명시 광명1동 9-8번지 일대',sigungu:'광명시',beopjeongdong:'광명동',jibun:'9-8',tongching:'광명자이더샵포레나',
    scale:'28개동 3,585세대',moveIn:'2025년 12월',sijeomRegion:'광명시',jongjeon:'913,624,810',birye:'109.83',gwolli:G.gwolli,bunbo:'',paid:'0',
    units:[u],rndDanga:'10000',rndAmt:'1000000',rndDangaMode:'none',rndAmtMode:'round',rndLogic:'arm',finalRndMode:'round',finalRndUnit:'1000000',...ov};
  return {id,data:JSON.stringify({ov:base,cases:[c],fee:null})};
}
// P를 정확히 맞추는 단순 사례(전유 100㎡·요인 1·시점 1·백만원 단위 반올림·최종 그대로)
const flat=(apt,ov,unit)=>({ov:{rndAmt:'100000',finalRndMode:'none',...ov},unit:{jeonyu:'100',intFactor:'1.00',etcFactor:'1.00',...(unit||{})},cs:{unitPrice:String(apt/100),timeAdj:1}});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ipjrefund-'));
  const open=async spec=>{const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});page.setDefaultTimeout(20000);
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(url)?r.continue():r.abort();});
    if(spec){const s=seed(spec);await page.addInitScript(([id,d])=>{try{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('ipj:case-list',JSON.stringify([{id,label:id,updated:'2026.10.15'}]));localStorage.setItem('ipj:case:'+id,d);}catch(e){}},[s.id,s.data]);}
    else await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await page.goto(url+'/입주권.html',{waitUntil:'domcontentloaded'});await page.waitForSelector('text=④ 가격산출',{timeout:60000});return {ctx,page,errors,dialogs};};
  let n=0;const saveZ=async(page,name)=>{const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.getByRole('button',{name}).click()]);const f=path.join(tmp,(n++)+'.hwpx');await dl.saveAs(f);return unzip(fs.readFileSync(f));};
  const save=async(page,name)=>(await saveZ(page,name))['Contents/section0.xml'].toString('utf8');
  // 글자모양 id → 굵게/밑줄 여부
  const charPrs=hdr=>Object.fromEntries((hdr.match(/<hh:charPr\b[\s\S]*?<\/hh:charPr>/g)||[]).map(c=>[c.match(/\bid="(\d+)"/)[1],{bold:/<hh:bold\/>/.test(c),under:/<hh:underline type="BOTTOM"/.test(c)}]));
  const runCpr=(xml,text)=>{const i=xml.indexOf('<hp:t>'+text+'</hp:t>');assert(i>=0,text);const r=xml.lastIndexOf('<hp:run ',i);return xml.slice(r,i).match(/charPrIDRef="(\d+)"/)[1];};
  const sidebar=async page=>(await page.getByText('📋 대상물건(입주권)',{exact:true}).locator('xpath=../..').innerText()).replace(/\s+/g,' ');
  try{
    // A. 광명 ① 미수령 포함 + 병기(기본) — [별첨] 1,287,870,000
    {
      const {ctx,page,errors,dialogs}=await open({});
      await page.click('text=④ 가격산출');
      assert(await page.locator('.appendix-preview').isVisible(),'별첨 미리보기');
      assert((await page.locator('.appendix-preview').innerText()).includes('1,287,870,000'),'미리보기 금액');
      const ps=paras(await save(page,'3. 의견서')),all=ps.join('\n');
      assert.deepEqual(dialogs,[],'확인창 없음');
      assert(!all.includes('{{'),'미치환 토큰 없음');
      const ba=item(ps,'바');
      assert(ba.startsWith('바. 본건 입주권은 조합원 권리가액이 조합원 분양가를 초과하여 환급금 342,130,000원(권리가액 1,003,430,000원 − 조합원분양가 661,300,000원)이 발생하며, 조합 제시자료(조합원 분담금 통지문 및 입주정산금 통지문)에 의하면 기준시점 현재까지 수령한 환급금은 0원인 바'),'바항 7-3');
      assert(ba.includes('미수령 환급금(342,130,000원)의 수령권리가 포함되어 있음.')&&ba.includes('또한 조합 제시 환급금은 추정 금액으로서')&&ba.endsWith('[별첨]에 별도 병기하였음.'),'바항 7-3 + 7-7 + 별첨 한 줄');
      assert(!all.includes('탐문'),'탐문 없음');
      assert(item(ps,'다').includes('다만, 조합원 권리가액이 조합원 분양가를 초과하여 환급금이 발생하는 경우에는'),'다항 환급금 문장');
      assert(item(ps,'가').includes('다음과 같은 감정평가방법을'),'가항 오타 수정');
      assert(item(ps,'마').startsWith('마. 부동산을 취득할 수 있는')&&item(ps,'마').includes('동 규칙 제12조'),'마항 오타 수정');
      assert.deepEqual(after(ps,'5. 감정평가조건',1),['해당사항 없음.'],'조건 없음');
      const s6=sec6(ps);assert.equal(s6.length,4,'6. 가~라');
      assert(s6[2].includes('환급금액 등은 귀 제시목록(조합원 분담금 통지문 및 입주정산금 통지문)')&&s6[2].includes('변동될 수 있으니'),'6.다 환급금형');
      assert(s6[3].startsWith('라. 본건은 기준시점 현재 미수령 환급금 342,130,000원을 포함하여')&&s6[3].includes('금 1,287,870,000원(감정평가액에서 미수령 환급금을 공제한 금액)을 [별첨]에'),'6.라');
      assert(all.includes('※ [병기] 미지급 환급금 미고려 시 입주권 가액 : 금 1,287,870,000원([별첨] 참조)'),'Ⅳ 병기 줄');
      assert(ps.includes('②기수령 환급금(원)')&&ps.includes('①−②+③')&&ps.includes('(ⓒ-ⓓ)환급금'),'표 머리');
      assert(ps.includes('기준시점까지 환급받은 금액(기 환급금)')&&ps.includes('예정 환급금(미수령)'),'Ⅱ 환급금 2칸 표');
      const iv=iv2(ps.slice(0,ps.indexOf('[ 별첨 ] 미지급 환급금 미고려시 입주권 가액')));
      assert.deepEqual(iv,['1,003,430,000','0','628,700,000','1,632,130,000','1,630,000,000'],'Ⅳ-2 합계행');
      const ap=ps.slice(ps.indexOf('[ 별첨 ] 미지급 환급금 미고려시 입주권 가액'));
      assert(ap[1].startsWith('본건은 조합원 입주권에 대한 평가로서'),'별첨 설명');
      assert.deepEqual(ap.slice(2,10),['기호','수량','참고금액(원)','비고','가','1식','1,287,870,000','귀 요청에 의거 별도 병기'],'별첨 표');
      assert(ap.some(t=>t==='※ 기준시점 현재 미지급 환급금 342,130,000원(비례율 109.83% 기준)을 입주권 감정평가액에서 공제한 금액이며, 상기 가액은 단순 참고용으로 병기한 금액으로서 조합원 입주권 감정평가액과는 별개의 금액임.'),'별첨 ※');
      // 선정 사례 행 굵게(목록표 첫 「두산위브」 = ㉠ 행), 선정사유 「사례 ㉠」 굵게·밑줄, 개별요인 소수 둘째 자리
      {const z=await saveZ(page,'3. 의견서'),x=z['Contents/section0.xml'].toString('utf8'),cp=charPrs(z['Contents/header.xml'].toString('utf8'));
        assert(cp[runCpr(x,'두산위브')].bold,'선정 사례 행 굵게');
        {const a=runCpr(x,'사례 '),j=x.indexOf('<hp:t>사례 </hp:t>'),nx=x.slice(j).match(/<hp:run charPrIDRef="(\d+)"><hp:t>([^<]*)<\/hp:t>/);   // 값 색칠 때 「사례 」|「㉠」 두 런으로 나뉨
          assert(cp[a].bold&&cp[a].under&&nx[2]==='㉠'&&cp[nx[1]].bold&&cp[nx[1]].under,'선정사유 사례 ㉠ 굵게·밑줄');}
        const hc=z['Contents/header.xml'].toString('utf8'),ids=(hc.match(/<hh:charPr\b[^>]*\bid="(\d+)"/g)||[]).map(t=>+t.match(/id="(\d+)"/)[1]);
        assert.deepEqual(ids,ids.map((_,i)=>i),'글자모양 id 연속');assert.equal(+hc.match(/<hh:charProperties itemCnt="(\d+)"/)[1],ids.length,'itemCnt 일치');
        const P=paras(x),k=P.indexOf('- 개별요인 비교치');assert(k>0&&P.slice(k).includes('1.00')&&P.slice(k).includes('1.30')&&P.slice(k).includes('0.99'),'개별요인 1.00/1.30/0.99');}
      const gw=paras(await save(page,'2. 괄호감정표'));assert.deepEqual(after(gw,'감정평가조건',1),['-'],'괄감 조건 -');
      assert.deepEqual(errors,[]);await ctx.close();console.log('A 광명 ①+별첨 OK');
    }
    // A-2. 「귀 의뢰인 확인 완료」 체크, 바항에도 병기 문단
    {
      const {ctx,page,errors}=await open({ov:{clientConfirmed:true,altInBody:true}});
      await page.click('text=④ 가격산출');
      const ps=paras(await save(page,'3. 의견서'));
      assert(ps.some(t=>t.includes('(비례율 109.83% 기준, 귀 의뢰인 확인 완료)')),'확인 완료 문구');
      assert(item(ps,'바').includes('미수령 환급금(342,130,000원)을 고려하지 않은 경우의 입주권 가액을 금 1,287,870,000원으로 병기하오니'),'바항 병기 문단');
      assert.deepEqual(errors,[]);await ctx.close();console.log('A-2 확인완료·바항 병기 OK');
    }
    // B. 광명 ② 수령권 제외 — 매매계약서 미확보면 내려받을 때 확인창, 확보면 없음
    {
      const {ctx,page,errors,dialogs}=await open({ov:{refundMode:'exclude'}});
      assert(await page.locator('.exclude-warn').isVisible(),'② 경고');
      await page.click('text=④ 가격산출');
      assert((await page.locator('.op-checks').innerText()).includes('매매계약서'),'검증 안내');
      let ps=paras(await save(page,'3. 의견서'));
      assert(dialogs.some(m=>m.includes('매매계약서')),'확인창');
      await page.click('text=① 대상물건개요');await page.locator('.contract-chk input').check();await page.click('text=④ 가격산출');
      dialogs.length=0;ps=paras(await save(page,'3. 의견서'));assert.deepEqual(dialogs,[],'확보 후 확인창 없음');
      const all=ps.join('\n'),ba=item(ps,'바');
      assert(ba.startsWith('바. 본건은 매매계약상 조합 제시자료(조합원 분담금 통지문 및 입주정산금 통지문)상 환급금 342,130,000원의 수령권이 원조합원에게 귀속되는 바'),'바항 7-4');
      assert(ba.includes('미수령 환급금(342,130,000원)의 수령권리를 포함한 경우의 입주권 가액을 금 1,632,130,000원으로 병기하오니'),'7-6② 병기');
      assert(!ba.includes('수령권리가 포함되어'),'① 문구 없음');
      assert.equal(sec6(ps).length,3,'6.라 없음');assert(!all.includes('[ 별첨 ]'),'별첨 없음');
      assert(ps.includes('②지급받을 환급금(원조합원 귀속)(원)'),'② 머리');
      assert.deepEqual(iv2(ps),['1,003,430,000','342,130,000','628,700,000','1,290,000,000','1,290,000,000'],'Ⅳ-2(제외)');
      assert.deepEqual(errors,[]);await ctx.close();console.log('B 광명 ② OK');
    }
    // C. §12 광명 1R(P 701,700,000) / D. 방배 이도윤 / F. 헤리스톤(완납 가정) — 금액
    for(const [name,spec,want,alt] of [
      ['광명 1R',flat(1363000000,{}),'1,705,130,000','1,363,000,000'],
      ['이도윤',flat(7246000000,{gwolli:'4,282,100,175',paid:'345,740,000'},{bunyangga:'3,525,350,000'}),'7,657,010,175','7,246,000,000'],
      ['헤리스톤',flat(2950000000,{gwolli:'938,651,524',contribAssumeFull:true},{bunyangga:'1,130,500,000'}),'2,950,000,000','2,758,151,524'],
    ]){
      const {ctx,page,errors}=await open(spec);
      const sb=await sidebar(page);
      assert(sb.includes(want+' 원'),name+' 감정평가액 '+want+' / '+sb);
      assert(sb.includes(alt+' 원'),name+' 병기 '+alt+' / '+sb);
      if(name==='헤리스톤'){
        await page.click('text=④ 가격산출');
        const ps=paras(await save(page,'3. 의견서'));
        assert(item(ps,'바').startsWith('바. 본건 입주권의 분담금은 191,848,476원이며, 의뢰인 요청에 의한 바 분담금 완납을 전제로 평가하였음.'),'바항 7-2');
        assert.deepEqual(after(ps,'5. 감정평가조건',2),['가. 감정평가조건 부가의 근거','「감정평가에 관한 규칙」 제6조 제2항 제2호 및 제3항에 따라 의뢰인이 요청한 감정평가조건의 합리성, 적법성 및 실현가능성을 검토하여 다음과 같은 조건을 붙여 감정평가하였음.'],'조건 8-2');
        assert(ps.some(t=>t.includes('분담금 191,848,476원이 기준시점 현재 전액 납부된 상태를 가정하여')),'조건 금액');
        assert(ps.includes('※ [병기] 미납 분담금 고려 시(현황) 입주권 가액 : 금 2,758,151,524원'),'Ⅳ 병기');
        assert.deepEqual(iv2(ps),['938,651,524','191,848,476','1,819,500,000','2,950,000,000','2,950,000,000'],'Ⅳ-2(완납 가정)');
        const gw=paras(await save(page,'2. 괄호감정표'));assert.deepEqual(after(gw,'감정평가조건',1),['분담금 완납 가정'],'괄감 조건');
      }
      assert.deepEqual(errors,[]);await ctx.close();console.log(name+' OK');
    }
    // E. 방배 이상기(분담, 샘플) — 6,313,565,001, 바항 7-1, 6.다 분담금형, 표 머리 종전
    {
      const {ctx,page,errors}=await open(null);
      assert((await sidebar(page)).includes('6,313,565,001 원'),'이상기 금액');
      await page.click('text=④ 가격산출');
      const ps=paras(await save(page,'3. 의견서')),all=ps.join('\n');
      assert.equal(item(ps,'바'),'바. 본건 입주권의 분담금은 31,434,999원이며, 조합 제시자료(조합원 분담금 통지문 및 입주정산금 통지문)에 의하면 기준시점 현재까지 납부된 금액은 0원인 바, 이를 고려하여 감정평가하였음.','바항 7-1');
      assert(!item(ps,'다').includes('다만,'),'다항 환급금 문장 없음');
      assert(sec6(ps)[2].includes('분담금액 등은 귀 제시목록(분담금 납부계약서(조합원))'),'6.다 분담금형');
      assert(ps.includes('②평가기준일까지 납입한 금액(원)')&&ps.includes('①+②+③')&&ps.includes('기준시점까지 납부된 금액(원)'),'표 머리 종전');
      assert(!all.includes('병기')&&!all.includes('[ 별첨 ]')&&!all.includes('{{'),'병기·별첨 없음');
      assert.deepEqual(errors,[]);await ctx.close();console.log('E 이상기 OK');
    }
    // G. 사업 단계 「준공·입주(이전고시 전)」 — 나·라·6.다 문구, 요항표 접면도로
    {
      const {ctx,page,errors}=await open({ov:{stage:'done'}});
      await page.click('text=④ 가격산출');
      const ps=paras(await save(page,'3. 의견서'));
      assert(item(ps,'나').startsWith('나. 본건 광명제1R구역 주택재개발정비사업은 관리처분계획인가 후 공사가 완료되어 입주가 진행되었으나'),'나항 준공');
      assert(item(ps,'라').startsWith('라. 본건은 2025년 12월경부터 입주가 진행된 아파트에 대한 입주권으로, 기준시점 현재 재개발사업의 이전고시가'),'라항 준공');
      assert(sec6(ps)[2].startsWith('다. 본 입주권 감정평가는 해당사업 완료에 따라 공동주택으로 이용되는 것을 전제로 하였고,'),'6.다 준공');
      const yh=paras(await save(page,'5. 요항표'));assert.deepEqual(after(yh,'4. 접면도로 상황',1),['아파트단지 내 포장도로를 통해 외곽 공도와 연계되어 있음.'],'요항표 준공 문구');
      assert.deepEqual(errors,[]);await ctx.close();console.log('G 준공 단계 OK');
    }
    // H. 옛 수정값 옮기기 — 마항(숫자 키 7:0)·나항(opProjectStatus) 그대로, 화면에서 ↺로 기본 문구
    {
      const {ctx,page,errors}=await open({ov:{opMethodText:{'7:0':'사용자가 고친 마항 문구.'},opProjectStatus:'사용자 나항 앞부분,'}});
      await page.click('text=④ 가격산출');
      let ps=paras(await save(page,'3. 의견서'));
      assert.equal(item(ps,'마'),'마. 사용자가 고친 마항 문구.','마항 옛 수정값');
      assert(item(ps,'나').startsWith('나. 사용자 나항 앞부분, 도시 및 주거환경정비법제 81조'),'나항 옛 수정값');
      await page.click('text=① 대상물건개요');
      await page.locator('.op-item[data-k="4마"]').getByText('↺ 기본 문구로').click();
      await page.click('text=④ 가격산출');ps=paras(await save(page,'3. 의견서'));
      assert(item(ps,'마').startsWith('마. 부동산을 취득할 수 있는 권리'),'↺ 복원');
      // ↩ 고친 문구로 — 기본 문구로 갔다가 다시 고친 문구로
      await page.click('text=① 대상물건개요');
      await page.locator('.op-item[data-k="4마"] .op-undo').click();
      assert.equal(await page.locator('.op-item[data-k="4마"] .op-undo').count(),0,'↩ 버튼 사라짐');
      await page.click('text=④ 가격산출');ps=paras(await save(page,'3. 의견서'));
      assert.equal(item(ps,'마'),'마. 사용자가 고친 마항 문구.','↩ 고친 문구로');
      assert.deepEqual(errors,[]);await ctx.close();console.log('H 옛 수정값 OK');
    }
    // I. 받은 환급금 = 환급금 전액(수령완료) → 병기·별첨·6.라 없음, ② 342,130,000
    {
      const {ctx,page,errors}=await open({ov:{paid:'342,130,000'}});
      assert(await page.getByText('기준일까지 받은 환급금',{exact:true}).count()>0,'칸 이름');
      await page.click('text=④ 가격산출');
      const ps=paras(await save(page,'3. 의견서')),all=ps.join('\n');
      assert(item(ps,'바').includes('기준시점 현재까지 수령한 환급금은 342,130,000원인 바'),'바항 기수령');
      assert.deepEqual(iv2(ps),['1,003,430,000','342,130,000','628,700,000','1,290,000,000','1,290,000,000'],'Ⅳ-2(수령완료)');
      assert(!all.includes('[ 별첨 ]')&&sec6(ps).length===3,'별첨·6.라 없음');
      assert.deepEqual(errors,[]);await ctx.close();console.log('I 수령완료 OK');
    }
    // J. 유형 버튼 — 분담금/환급금 칸 이름·안내
    {
      const {ctx,page,errors}=await open({});
      const btn=t=>page.locator('.bunbo-type-btn',{hasText:t});
      assert.equal(await btn('환급금 발생 유형').getAttribute('aria-pressed'),'true','숫자로 자동 = 환급금');
      await btn('분담금 발생 유형').click();
      assert(await page.getByText('분담금(자동·수정가능)').count()>0&&await page.locator('.bunbo-type-warn').isVisible(),'분담금 칸·안내');
      await btn('환급금 발생 유형').click();
      assert(await page.getByText('환급금(자동·수정가능)').count()>0&&await page.locator('.bunbo-type-warn').count()===0,'환급금 칸');
      assert.deepEqual(errors,[]);await ctx.close();console.log('J 유형 버튼 OK');
    }
    // K. 병기 끔 — 별첨·6.라·Ⅳ 병기 줄 없음
    {
      const {ctx,page,errors}=await open({ov:{refundShowAlt:false}});
      await page.click('text=④ 가격산출');
      const all=paras(await save(page,'3. 의견서')).join('\n');
      assert(!all.includes('병기')&&!all.includes('[ 별첨 ]')&&all.includes('1,630,000,000'),'병기 없음');
      assert.deepEqual(errors,[]);await ctx.close();console.log('K 병기 끔 OK');
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
