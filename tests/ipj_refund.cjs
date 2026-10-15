// 입주권 환급금 건 — 권리가액 > 조합원분양가 (광명제1R 109동 1403호 실값: 권리가액 1,003,430,000 · 분양가 661,300,000 · 환급금 342,130,000)
//  ① 미수령 환급금 포함(기본): 1,003,430,000 + 0 + 628,700,000 = 1,632,130,000 → 1,630,000,000 / 병기 1,287,870,000 (하감 별첨과 같은 값)
//  ② 전액 수령 가정: 1,003,430,000 − 342,130,000 + 628,700,000 = 1,290,000,000 / 감정평가조건 문구 · 괄감 조건 칸 / 병기 1,632,130,000
//  ③ 병기 끄면 6.라·Ⅳ 병기 줄 없음  ④ 환급금 없는 건(방배 샘플)은 종전 바항 그대로
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
const CASE={ov:null,cases:[{id:'g1',symbol:'㉠',location:'철산동',jibun:'629',aptName:'두산위브',dong:'108',floor:'17',ho:'1701',exclusiveArea:'114.99',
  price:'930000000',unitPrice:'8087659',tradeDate:'2026-04-14',approvalDate:'2010-01-01',timeAdj:1.09579,timeAdjDetail:'',isShown:true,isSelected:true}],fee:null};
function seed(ov){
  const id='ON261012-2101';
  const unit={sym:'가',dong:'109',floor:'14',ho:'1403',type:'112',baejeong:'112',jeonyu:'112.6617',gongyong:'38.4749',gonggeup:'151.1366',bunyangMyeon:'151.1366',gyeyak:'223.653',daeji:'51.7181',
    bunyangga:'661,300,000',extFactor:'1.00',intFactor:'1.30',hoFactor:'1.00',etcFactor:'0.99',noteExt:'',noteInt:'',noteHo:'',noteEtc:'',appliedCaseId:'g1'};
  const base={caseNo:id,caseNoDisplay:id,client:'강연민',owner:'구춘회',baseDate:'2026.10.12',surveyDate:'2026.10.15',writeDate:'2026.10.15',
    projName:'광명제1R구역 주택재개발정비사업',projType:'재개발',projLoc:'경기도 광명시 광명1동 9-8번지 일대',sigungu:'광명시',beopjeongdong:'광명동',jibun:'9-8',tongching:'광명자이더샵포레나',
    scale:'28개동 3,585세대',moveIn:'2025년 12월',sijeomRegion:'광명시',jongjeon:'913,624,810',birye:'109.83',gwolli:'1,003,430,000',bunbo:'',paid:'0',
    units:[unit],rndDanga:'10000',rndAmt:'1000000',rndDangaMode:'none',rndAmtMode:'round',rndLogic:'arm',finalRndMode:'round',finalRndUnit:'1000000',...ov};
  return {id,data:JSON.stringify({...CASE,ov:base})};
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ipjrefund-'));
  const open=async ov=>{const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(url)?r.continue():r.abort();});
    if(ov){const s=seed(ov);await page.addInitScript(([id,d])=>{try{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('ipj:case-list',JSON.stringify([{id,label:id,updated:'2026.10.15'}]));localStorage.setItem('ipj:case:'+id,d);}catch(e){}},[s.id,s.data]);}
    else await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await page.goto(url+'/입주권.html',{waitUntil:'domcontentloaded'});await page.waitForSelector('text=④ 가격산출',{timeout:60000});return {ctx,page,errors};};
  let n=0;const save=async(page,name)=>{const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.getByRole('button',{name}).click()]);const f=path.join(tmp,(n++)+'.hwpx');await dl.saveAs(f);return unzip(fs.readFileSync(f))['Contents/section0.xml'].toString('utf8');};
  try{
    // ① 미수령 환급금 포함(기본)
    {
      const {ctx,page,errors}=await open({});
      assert(await page.getByText('💰 환급금 발생 건').isVisible(),'환급금 칸 보임');
      await page.click('text=④ 가격산출');
      await page.getByText('병기 금액(전액 수령 가정 시)').waitFor();
      assert(await page.getByText('1,287,870,000원',{exact:true}).isVisible(),'화면 병기 1,287,870,000');
      const ps=paras(await save(page,'3. 의견서'));
      const all=ps.join('\n');
      assert(!all.includes('{{'),'미치환 토큰 없음');
      assert(all.includes('환급금 342,130,000원이 발생하며, 기준시점 현재까지 수령한 환급금은 0원'),'바항 = 환급금 문장(포함)');
      assert(!all.includes('본건 입주권의 분담금은'),'옛 바항 없음');
      assert.deepEqual(after(ps,'5. 감정평가조건',1),['해당사항 없음.'],'조건 없음');
      assert(all.includes('환급금 전액이 수령된 것으로 가정한 경우의 입주권 가액 금1,287,870,000원'),'6.라 병기');
      assert(all.includes('※ [병기] 환급금 전액 수령 가정 시 입주권 가액 : 금1,287,870,000원'),'Ⅳ 병기 줄');
      assert(ps.includes('②평가기준일까지 납입한 금액(환급금 차감)(원)'),'② 머리');
      assert(ps.includes('기준시점까지 수령한 환급금(원)'),'Ⅱ-2 머리');
      const iv=ps.slice(ps.lastIndexOf('합계'));assert.deepEqual(iv.slice(1,6),['1,003,430,000','0','628,700,000','1,632,130,000','1,630,000,000'],'Ⅳ-2 합계행');
      assert(ps.includes('(ⓒ-ⓓ)환급금')&&!ps.includes('(ⓓ-ⓒ)분담금'),'Ⅱ-2 머리 = 환급금');
      assert(await page.getByText('환급금(자동·수정가능)').count()>0&&await page.getByText('분담금(자동·수정가능)').count()===0,'화면 칸 이름 = 환급금');
      const gw=paras(await save(page,'2. 괄호감정표'));
      assert.deepEqual(after(gw,'감정평가조건',1),['-'],'괄감 조건 -');
      assert(gw.join('').includes('1,630,000,000'),'괄감 금액');
      assert.deepEqual(errors,[]);await ctx.close();console.log('① 포함 OK');
    }
    // ② 전액 수령 가정
    {
      const {ctx,page,errors}=await open({refundMode:'assume'});
      await page.click('text=④ 가격산출');
      await page.getByText('병기 금액(수령 가정 안 한 경우)').waitFor();
      const ps=paras(await save(page,'3. 의견서')),all=ps.join('\n');
      assert(!all.includes('{{'),'미치환 토큰 없음');
      assert(all.includes('귀 의뢰인의 요청에 따라 환급금 전액이 기준시점 현재 수령된 것으로 가정하여'),'바항 = 가정 문장');
      const cond=after(ps,'5. 감정평가조건',3);
      assert(cond[0].startsWith('가. 감정평가조건의 내용 및 부가 이유')&&cond[0].includes('예정 환급금 342,130,000원이 기준시점 현재 전액 수령된'),'조건 가');
      assert(cond[1].startsWith('나. 감정평가조건의 검토')&&cond[2].startsWith('다. 조건부 감정평가액의 사용상 유의사항'),'조건 나·다');
      assert(all.includes('입주권 가액 금1,632,130,000원을 별도로 병기'),'6.라 병기(가정 안 함)');
      const iv=ps.slice(ps.lastIndexOf('합계'));assert.deepEqual(iv.slice(1,6),['1,003,430,000','-342,130,000','628,700,000','1,290,000,000','1,290,000,000'],'Ⅳ-2 합계행(가정)');
      const gw=paras(await save(page,'2. 괄호감정표'));
      assert.deepEqual(after(gw,'감정평가조건',1),['환급금 전액 수령 가정'],'괄감 조건 칸');
      assert(gw.join('').includes('1,290,000,000'),'괄감 금액');
      // 문구 직접 수정 → 그대로 나감
      await page.getByRole('textbox',{name:'의견서 5. 감정평가조건'}).fill('가. 직접 고친 조건 문구\n나. 둘째 문단');
      await page.waitForTimeout(300);
      const ps2=paras(await save(page,'3. 의견서'));
      assert.deepEqual(after(ps2,'5. 감정평가조건',2),['가. 직접 고친 조건 문구','나. 둘째 문단'],'고친 조건 문구');
      assert.deepEqual(errors,[]);await ctx.close();console.log('② 가정 OK');
    }
    // ②-1 환급금 수령권 제외(원조합원 귀속) — 바항 = 사용자 문구, 조건 없음
    {
      const {ctx,page,errors}=await open({refundMode:'exclude'});
      await page.click('text=④ 가격산출');
      const ps=paras(await save(page,'3. 의견서')),all=ps.join('\n');
      assert(!all.includes('{{'),'미치환 토큰 없음');
      assert(all.includes('바. 본건은 매매계약상 조합 제시자료(조합원 분담금 통지문 및 입주정산금 통지문)상 환급금 342,130,000원의 수령권이 원조합원에게 귀속되는 바, 환급금 수령권을 제외한 조합원 입주권을 평가대상으로 하였으며'),'바항 = 수령권 제외 문구');
      assert.deepEqual(after(ps,'5. 감정평가조건',1),['해당사항 없음.'],'조건 없음');
      const iv=ps.slice(ps.lastIndexOf('합계'));assert.deepEqual(iv.slice(1,6),['1,003,430,000','-342,130,000','628,700,000','1,290,000,000','1,290,000,000'],'Ⅳ-2 합계행(제외)');
      assert(all.includes('환급금 수령권을 포함한 경우(기준시점 현재 미수령 환급금 342,130,000원 포함)의 입주권 가액 금1,632,130,000원'),'6.라 병기(수령권 포함)');
      const gw=paras(await save(page,'2. 괄호감정표'));
      assert.deepEqual(after(gw,'감정평가조건',1),['-'],'괄감 조건 없음');
      assert.deepEqual(errors,[]);await ctx.close();console.log('②-1 수령권 제외 OK');
    }
    // ②-2 받은 환급금 = 납입액 칸에 342,130,000 (사용자 표 「환급금 수령완료」) → 1,290,000,000, 가정·병기 없음
    {
      const {ctx,page,errors}=await open({paid:'342,130,000'});
      assert(await page.getByText('기준일까지 받은 환급금',{exact:true}).count()>0,'칸 이름 = 기준일까지 받은 환급금');
      await page.click('text=④ 가격산출');
      const ps=paras(await save(page,'3. 의견서')),all=ps.join('\n');
      assert(all.includes('기준시점 현재까지 수령한 환급금은 342,130,000원'),'바항 기수령');
      const iv=ps.slice(ps.lastIndexOf('합계'));assert.deepEqual(iv.slice(1,6),['1,003,430,000','-342,130,000','628,700,000','1,290,000,000','1,290,000,000'],'Ⅳ-2(수령완료)');
      assert(!all.includes('병기')&&!all.includes('{{'),'병기 없음');
      assert.deepEqual(errors,[]);await ctx.close();console.log('②-2 수령완료 OK');
    }
    // ③ 병기 끔
    {
      const {ctx,page,errors}=await open({refundShowAlt:false});
      await page.click('text=④ 가격산출');
      const all=paras(await save(page,'3. 의견서')).join('\n');
      assert(!all.includes('병기'),'병기 문구 없음');
      assert(all.includes('1,630,000,000'),'금액');
      assert.deepEqual(errors,[]);await ctx.close();console.log('③ 병기 끔 OK');
    }
    // ④ 환급금 없는 건(방배 샘플) — 종전 그대로
    {
      const {ctx,page,errors}=await open(null);
      assert.equal(await page.getByText('💰 환급금 발생 건').count(),0,'환급금 칸 없음');
      await page.click('text=④ 가격산출');
      const ps=paras(await save(page,'3. 의견서')),all=ps.join('\n');
      assert(all.includes('본건 입주권의 분담금은 31,434,999원으로, 기준시점 현재까지 납부된 금액은 0원으로'),'종전 바항');
      assert(ps.includes('②평가기준일까지 납입한 금액(원)')&&ps.includes('기준시점까지 납부된 금액(원)'),'종전 머리');
      assert(!all.includes('병기')&&!all.includes('{{'),'병기 없음·토큰 없음');
      assert.deepEqual(errors,[]);await ctx.close();console.log('④ 종전 건 OK');
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
