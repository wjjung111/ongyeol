// 입주권 요항표·의견서 양식 검증 — ② 접수개요의 요항표 카드(Ⅰ. 입지조건 1~6, 파란 칸 3개) → 4. 요항표 hwpx(토큰 3개 치환·파랑→검정·미치환 0)
//   + 3. 의견서 hwpx(글자모양 57개·id 연속·파랑 0·'상속(증여)' 빨강 유지)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/ipj_yohang.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),zlib=require('zlib');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.IPJ_TEST_OUTPUT||path.join(root,'..','ipj-yohang-test'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
// stored/deflate zip 읽기 (hwpx)
function unzip(buf){const files={};let p=0;
  while(p+30<=buf.length&&buf.readUInt32LE(p)===0x04034b50){const method=buf.readUInt16LE(p+8),csz=buf.readUInt32LE(p+18),nl=buf.readUInt16LE(p+26),el=buf.readUInt16LE(p+28);
    const name=buf.slice(p+30,p+30+nl).toString('utf8');const data=buf.slice(p+30+nl+el,p+30+nl+el+csz);
    files[name]=method===8?zlib.inflateRawSync(data):data;p=p+30+nl+el+csz;}
  return files;}
const runsOf=(xml,cp)=>[...xml.matchAll(new RegExp('<hp:run charPrIDRef="'+cp+'">((?:(?!</hp:run>).)*)</hp:run>','gs'))].map(m=>(m[1].match(/<hp:t[^>]*>(.*?)<\/hp:t>/gs)||[]).map(t=>t.replace(/<\/?hp:t[^>]*>/g,'')).join(''));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message)); // 콘솔의 Babel 용량 안내·사용기록 전송 실패(외부 차단)는 무관
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await page.goto(base+'/입주권.html',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('text=② 접수개요',{timeout:60000});
    await page.click('text=② 접수개요');
    await page.locator('div:has(> span:text-is("평가구분")) input').first().fill('증여');
    // 카드: Ⅰ. 입지조건 1~6 모두 보이고 파란 칸 3개(샘플 값)
    for(const h of ['Ⅰ. 입지조건','1. 지리적 위치','2. 부근상황','3. 교통상황','4. 접면도로 상황','5. 토지이용계획 및 공법상제한사항','6. 기타사항'])assert.ok(await page.locator('text='+h).first().isVisible(),h);
    const blanks=page.locator('input[title*="파란 플레이스홀더"]');assert.equal(await blanks.count(),3);
    assert.deepEqual(await blanks.evaluateAll(els=>els.map(e=>e.value)),["서울특별시 서초구 방배동","지하철 7호선 '이수역' 동측","지하철 7호선 '이수역'"]);
    assert.ok(await page.locator('text=본건 주위는 아파트단지 및 근린생활시설 등이 혼재하는 지대로서, 제반 입지여건 무난한 편임.').isVisible());
    assert.ok(await page.locator('text=기준시점 현재 지적 미정리된 상태임.').isVisible());
    assert.ok((await page.locator('input[title*="파란 플레이스홀더"]').count())===3);
    // 직접 입력 → 파일에 그대로
    await blanks.nth(0).fill('경기도 성남시 수정구 여수동');await blanks.nth(1).fill('성남시청 북서측');await blanks.nth(2).fill('지하철 8호선 \'모란역\'');
    // 시점수정 창: 본건(방배동, 시군구 '서초구')이면 지역이 서초구로 자동 선택(집합건물과 같은 동작), 구 목록은 가나다순
    await page.click('text=③ 사례 등 입력');await page.locator('td:has-text("1.01500")').first().click();await page.waitForSelector('text=지수 자동계산');
    const sjSel=page.locator('div:has(> b:text("지수 자동계산")) select');assert.equal(await sjSel.nth(0).inputValue(),'아파트');assert.equal(await sjSel.nth(1).inputValue(),'서초구');
    const gus=(await sjSel.nth(1).evaluate(s=>[...s.options].map(o=>o.value))).filter(v=>/구$/.test(v));assert.deepEqual(gus,[...gus].sort((a,b)=>a.localeCompare(b,'ko')));
    await page.click('button:has-text("취소")');
    await page.click('text=④ 가격산출');
    // ④ 가격산출 — 집합건물과 같은 구성: 사례 선택(체크) → 가치형성요인 비교(호수별 블록) → 적용단가 → 입주권 감정평가액 결정
    for(const h of ['사례 선택','가치형성요인 비교','결정단가 · 아파트감정가 처리','입주권 감정평가액 결정'])assert.ok(await page.locator('text='+h).first().isVisible(),h);
    const chk=page.locator('table:has(th:text-is("선정")) input[type=checkbox]');assert.equal(await chk.count(),4);
    assert.deepEqual(await chk.evaluateAll(els=>els.map(e=>e.checked)),[true,false,false,true]);
    const facT=page.locator('table:has(th:has-text("비교사례"))');assert.equal(await facT.locator('td[rowspan]').filter({hasText:/^가$/}).count(),1);assert.equal(await facT.locator('td[rowspan]').filter({hasText:/^나$/}).count(),1);assert.equal(await facT.locator('th:has-text("결정단가(원/㎡)")').count(),2);
    assert.equal(await facT.locator('input[placeholder*="대등함"], input').count()>=8,true);
    const finalBefore=await page.locator('text=金').first().innerText();
    // 결정단가 처리 '없음' → 결정단가=산출단가 그대로 → 최종액 변동
    await page.locator('select').filter({hasText:'반올림'}).first().selectOption('none');
    assert.ok(await page.locator('text=산정단가를 그대로 결정단가로 적용').isVisible());
    assert.notEqual(await page.locator('text=金').first().innerText(),finalBefore);
    await page.locator('select').filter({hasText:'반올림'}).first().selectOption('round');
    assert.equal(await page.locator('text=金').first().innerText(),finalBefore);
    // 사례 ㉠ 선정 해제 → 본건 가는 남은 선정 사례(㉣)로 자동 이동, 다시 선정하면 복귀 가능
    await chk.nth(0).uncheck();await page.waitForTimeout(200);
    assert.equal(await facT.locator('td:has-text("(㉣)")').count(),2);
    await chk.nth(0).check();await page.waitForTimeout(200);
    const dl=async(label,name)=>{const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.click('button:has-text("'+label+'")')]);const f=path.join(out,name);await d.saveAs(f);return f;};
    const yf=await dl('4. 요항표','4. 요항표.hwpx');
    const y=unzip(fs.readFileSync(yf));const yx=y['Contents/section0.xml'].toString('utf8');
    assert.equal((yx.match(/\{\{[^}]+\}\}/g)||[]).length,0,'요항표 미치환 토큰');
    assert.equal(yx.includes('charPrIDRef="45"'),false,'파란 글자모양이 남음');
    assert.ok(yx.includes('<hp:t>대상물건은 </hp:t></hp:run><hp:run charPrIDRef="38"><hp:t>경기도 성남시 수정구 여수동 </hp:t></hp:run><hp:run charPrIDRef="38"><hp:t>소재 </hp:t></hp:run><hp:run charPrIDRef="38"><hp:t>성남시청 북서측 </hp:t></hp:run><hp:run charPrIDRef="38"><hp:t>인근에 위치하고 있음.</hp:t>'),'지리적 위치 문장');
    assert.ok(yx.includes('인근에 버스정류장 및 </hp:t></hp:run><hp:run charPrIDRef="38"><hp:t>지하철 8호선 &apos;모란역&apos;</hp:t></hp:run><hp:run charPrIDRef="38"><hp:t>이 소재하는 등 대중교통 상황은 보통임.')||yx.includes('<hp:t>지하철 8호선 \'모란역\'</hp:t></hp:run><hp:run charPrIDRef="38"><hp:t>이 소재하는 등'),'교통상황 문장');
    // 값이 들어간 문단은 줄배치 캐시가 없어야(겹침 방지), 고정 문단은 그대로
    const paraOf=s=>{const i=yx.indexOf(s);const a=yx.lastIndexOf('<hp:p ',i),b=yx.indexOf('</hp:p>',i);return yx.slice(a,b);};
    assert.equal(paraOf('대상물건은 ').includes('linesegarray'),false);assert.equal(paraOf('버스정류장').includes('linesegarray'),false);
    assert.equal(paraOf('본건 주위는').includes('linesegarray'),true);
    assert.ok(yx.includes('<hp:t>기준시점 현재 지적 미정리된 상태임.</hp:t>'),'5번 고정 문구');
    // 의견서
    const uf=await dl('3. 의견서','3. 의견서.hwpx');const u=unzip(fs.readFileSync(uf));const ux=u['Contents/section0.xml'].toString('utf8'),uh=u['Contents/header.xml'].toString('utf8');
    const ids=[...uh.matchAll(/<hh:charPr id="(\d+)"/g)].map(m=>+m[1]);assert.deepEqual(ids,[...Array(57).keys()]);assert.ok(uh.includes('<hh:charProperties itemCnt="57"'));
    for(const b of ['50','51','52'])assert.equal(ux.includes('charPrIDRef="'+b+'"'),false,'의견서 파란 글자모양 '+b);
    assert.equal(ux.includes('charPrIDRef="53"'),false,'평가구분 빨강이 검정으로');
    assert.ok(ux.includes('「상속세 및 증여세법」상 </hp:t></hp:run><hp:run charPrIDRef="54"><hp:t>증여</hp:t></hp:run><hp:run charPrIDRef="39"><hp:t>재산에 대한 일반거래(시가참고) 목적의 감정평가임.'),'평가구분·평가목적 문장');
    assert.ok(ux.includes('본건은 일반거래(시가참고) 목적의 감정평가로서'),'나. 평가목적');
    const gf=await dl('2. 괄호감정표','2. 괄호감정표.hwpx');const gx=unzip(fs.readFileSync(gf))['Contents/section0.xml'].toString('utf8');
    assert.ok(gx.includes('<hp:t>일반거래(시가참고)</hp:t>'),'괄호감정표 평가목적');assert.deepEqual(gx.match(/\{\{[^}]+\}\}/g)||[],[]);
    assert.ok(runsOf(ux,'55').some(t=>t.includes('방배')),'의견서 값이 검정 쌍둥이(55)로');
    const left=[...new Set(ux.match(/\{\{[^}]+\}\}/g)||[])];assert.deepEqual(left,[],'의견서 미치환 '+left);
    assert.deepEqual(errors,[]);
    console.log('OK ipj_yohang:',path.basename(yf),path.basename(uf));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
