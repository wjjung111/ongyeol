// 입주권 요항표 — 검정 문구도 모두 수정(ov.yhText) → 4. 요항표 hwpx에 그대로, 고친 항목은 기본 문구를 회색으로 함께 표시
//  · 사업 단계 「준공·입주(이전고시 전)」이면 접면도로·건물 구조·이용상태·설비 기본 문구가 준공 문구로 자동
//  · 같은 글자 「해당사항 없음.」이 여러 번 있어도 제목 순서로 그 항목만 바뀜, 꼬리말 낀 5번 문단도 바뀜
// node tests/ipj_yohang_text.cjs
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
const texts=xml=>(xml.match(/<hp:t>[^<]*<\/hp:t>/g)||[]).map(t=>t.replace(/<\/?hp:t>/g,''));
const bodyAfter=(xml,h)=>{const T=texts(xml),i=T.indexOf(h);assert(i>=0,h);return T[i+1];};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ipjyh-'));
  try{
    const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(url)?r.continue():r.abort();});
    await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await page.goto(url+'/입주권.html',{waitUntil:'domcontentloaded'});await page.waitForSelector('text=② 접수개요',{timeout:60000});
    await page.click('text=② 접수개요');
    const ta=l=>page.getByRole('textbox',{name:l,exact:true});
    // 기본: 양식 문구가 칸에 들어 있고 Ⅱ. 건물상황도 보임
    assert.equal(await ta('요항표 4. 접면도로 상황').inputValue(),'아파트단지 내 포장도로를 통해 외곽 공도와 연계될 예정임.');
    assert.equal(await ta('요항표 1. 건물의 구조').inputValue(),'기준시점 현재 신축예정임.');
    // 사업 단계 준공·입주 → 4개 문구가 기본값으로
    await page.click('text=① 대상물건개요');await page.locator('.stage-btn',{hasText:'준공'}).click();await page.click('text=② 접수개요');
    assert.equal(await ta('요항표 4. 접면도로 상황').inputValue(),'아파트단지 내 포장도로를 통해 외곽 공도와 연계되어 있음.');
    assert.equal(await page.locator('.yh-item[data-k="1-4"]').getByText(/기본 문구:/).count(),0,'단계 기본값이면 고친 것 아님');
    await ta('요항표 4. 접면도로 상황').fill('아파트단지 내 도로를 통해 공도와 연계되어 있음.');
    assert(await page.locator('.yh-item[data-k="1-4"]').getByText('기본 문구: 아파트단지 내 포장도로를 통해 외곽 공도와 연계되어 있음.').isVisible(),'기본 문구 회색 표시');
    // 직접 수정: Ⅰ-6 기타사항 / Ⅰ-5(꼬리말 문단) / Ⅰ-1 뒤 조각(파란 칸 사이 문구)
    await ta('요항표 6. 기타사항').first().fill('본건은 기준시점 현재 입주 완료된 상태임.');
    await ta('요항표 5. 토지이용계획 및 공법상제한사항').fill('기준시점 현재 이전고시 전으로 지적 미정리된 상태임.');
    await ta('요항표 1. 지리적 위치 3').fill(' 인근에 소재함.');
    await page.waitForTimeout(300);
    const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.click('text=④ 가격산출').then(()=>page.getByRole('button',{name:'5. 요항표'}).click())]);
    const f=path.join(tmp,'yh.hwpx');await dl.saveAs(f);const z=unzip(fs.readFileSync(f));const xml=z['Contents/section0.xml'].toString('utf8');
    assert(!xml.includes('{{'),'미치환 토큰 없음');
    assert.equal(bodyAfter(xml,'4. 접면도로 상황'),'아파트단지 내 도로를 통해 공도와 연계되어 있음.');
    assert.equal(bodyAfter(xml,' 1. 건물의 구조'),'기준시점 현재 준공되어 입주 중인 상태임.');
    assert.equal(bodyAfter(xml,' 2. 이용상태'),'공동주택(아파트)로 이용 중임.');
    assert.equal(bodyAfter(xml,' 3. 위생 및 냉·난방설비, 기타설비'),'기본적인 위생설비, 급배수·급탕설비, 난방설비, 승강기설비, 소방설비 등이 구비되어 있음.');
    assert.equal(bodyAfter(xml,'6. 기타사항'),'본건은 기준시점 현재 입주 완료된 상태임.');
    assert.equal(bodyAfter(xml,' 6. 기타사항'),'해당사항 없음.','Ⅱ-6은 그대로');
    assert.equal(texts(xml).filter(t=>t==='해당사항 없음.').length,3,'Ⅱ-4·5·6 해당사항 없음 유지');
    assert(texts(xml).includes('기준시점 현재 이전고시 전으로 지적 미정리된 상태임.'),'5번(꼬리말 문단) 수정');
    assert(xml.includes('<hp:footer'),'꼬리말 유지');
    const T=texts(xml),i1=T.indexOf('1. 지리적 위치 ');assert.equal(T.slice(i1+1,T.indexOf('2. 부근상황')).join(''),"대상물건은 서울특별시 서초구 방배동 소재 지하철 7호선 '이수역' 동측 인근에 소재함.",'Ⅰ-1 조각 수정 + 파란 칸 값');
    // ↺ 기본 문구로
    await page.click('text=② 접수개요');
    await page.locator('.yh-item[data-k="1-4"]').locator('xpath=preceding-sibling::div[1]').getByText('↺ 기본 문구로').click();
    assert.equal(await ta('요항표 4. 접면도로 상황').inputValue(),'아파트단지 내 포장도로를 통해 외곽 공도와 연계되어 있음.','↺ = 단계 기본값');
    await page.locator('.yh-item[data-k="1-4"]').locator('xpath=preceding-sibling::div[1]').locator('.yh-undo').click();
    assert.equal(await ta('요항표 4. 접면도로 상황').inputValue(),'아파트단지 내 도로를 통해 공도와 연계되어 있음.','↩ 고친 문구로');
    assert.deepEqual(errors,[]);await ctx.close();console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
