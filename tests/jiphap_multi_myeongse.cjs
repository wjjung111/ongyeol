/* 여러 호수 명세표(xlsx) — 시트 1개 한 장 형식 검증. 실제 Chromium에서 s3r86w8a.html(여러호수 모드)을 띄워 ArapMultiMyeongse.build를 돌린다.
 * 실행: node tests/jiphap_multi_myeongse.cjs  → ../multi-myeongse-results/*.xlsx */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'..','multi-myeongse-results');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}let data=fs.readFileSync(f);if(f.endsWith('s3r86w8a.html'))data=data.toString().replace("ReactDOM.createRoot(document.getElementById('root-multi'))","window.multiHelpers={applyR,getUV,parseZip,createZipStored};ReactDOM.createRoot(document.getElementById('root-multi'))");res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(data);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url().includes('arap_access.js')?r.fulfill({body:''}):r.request().url().startsWith(base)?r.continue():r.abort());
await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','multi');});
await page.goto(base+'/s3r86w8a.html');await page.waitForFunction(()=>window.multiHelpers&&window.ArapMultiMyeongse);
// 사용자 그림(당산동6가 오피스텔 5개호)과 같은 입력
const input=await page.evaluate(()=>{
 const cases=[0,1].map(i=>({id:'c'+i,symbol:i+1,isShown:true,isSelected:true,location:'서울특별시 영등포구 당산동6가',jibun:'100-'+i,aptName:'검증 오피스텔',dong:'101',floor:'3',ho:String(301+i),exclusiveArea:29.983,price:333000000,unitPrice:11000000+i*300000,tradeDate:'2026.02.10',timeAdj:1.02}));
 const ov={caseNo:'SYNTHETIC',client:'검증용 의뢰인',jibun:'서울특별시 영등포구 당산동6가 280-1 외 1필지',road:'서울특별시 영등포구 당산로50길 8',buildingName:'한강더채움 제101동',zoning:'준공업지역',kind:'오피스텔',mainUse:'업무시설(오피스텔)',structure:'철근콘크리트구조',regStructure:'철근콘크리트구조 (철근)콘크리트지붕',floors:'10/1',floorDetail:'1층 16.146\n2~10층 (각) 148.339\n옥탑1층(연면적제외) 15.951',landParcels:[{jibun:'280-1',area:661.2},{jibun:'280-9',area:403.3}],landRatioDenom:'1064.5',
  units:[['3','302'],['5','501'],['6','602'],['6','603'],['8','801']].map(([floor,ho],i)=>({id:i+1,dong:'101',floor,ho,area:'29.983',commonArea:'10',landArea:'12.23',extFactor:'1.00',intFactor:'1.00',hoFactor:'1.00',appliedSymbol:'1'}))};
 return {ov,cases,uD:'천원',uM:'round',tD:'백만원',tM:'round'};
});
const sheetOf=async(inp)=>page.evaluate(async inp=>{
 const r=await ArapMultiMyeongse.build(inp,multiHelpers);const es=await multiHelpers.parseZip(r.bytes.buffer),dec=new TextDecoder();
 for(const e of es.filter(e=>/\.xml$|\.rels$/.test(e.name)))if(new DOMParser().parseFromString(dec.decode(e.data),'application/xml').querySelector('parsererror'))throw Error('XML 오류: '+e.name);
 const sheet=dec.decode(es.find(e=>e.name==='xl/worksheets/sheet1.xml').data),d=new DOMParser().parseFromString(sheet,'application/xml');
 const cells={};for(const c of d.getElementsByTagNameNS('*','c')){const f=c.getElementsByTagNameNS('*','f')[0],t=c.getElementsByTagNameNS('*','t')[0],v=c.getElementsByTagNameNS('*','v')[0];const val=f?'='+f.textContent:t?t.textContent:v?Number(v.textContent):null;if(val!==null)cells[c.getAttribute('r')]=val;}
 const rows=Array.from(d.getElementsByTagNameNS('*','row')).map(r=>+r.getAttribute('r'));
 const drawing=dec.decode(es.find(e=>e.name==='xl/drawings/drawing1.xml').data),wb=dec.decode(es.find(e=>e.name==='xl/workbook.xml').data);
 return {cells,rows,names:es.map(e=>e.name),sheets:(wb.match(/<sheet /g)||[]).length,printArea:wb.match(/Print_Area[^>]*>([^<]*)/)[1],printTitles:(wb.match(/Print_Titles[^>]*>([^<]*)/)||[])[1],braces:(drawing.match(/name="자유형: 도형 2"/g)||[]).length,ids:drawing.match(/cNvPr id="(\d+)"/g),bytes:btoa(Array.from(r.bytes,b=>String.fromCharCode(b)).join('')),model:{total:r.model.total,amounts:r.model.rows.map(x=>x.amount)},unitRows:r.unitRows,totalRow:r.totalRow,last:r.last,dim:sheet.match(/<dimension ref="([^"]+)"/)[1]};
},inp);
const r5=await sheetOf(input);fs.writeFileSync(path.join(out,'5units.xlsx'),Buffer.from(r5.bytes,'base64'));
const c=r5.cells;
assert.equal(r5.sheets,1);                                  // 시트 1개
assert.deepEqual(r5.rows,r5.rows.map((_,i)=>r5.rows[0]+i)); // 행 번호 연속(빠진 행·중복 없음)
assert.equal(c.C11,'서울특별시');assert.equal(c.C12,'영등포구');assert.equal(c.C13,'당산동6가');
assert.deepEqual([c.D11,c.D12,c.D13,c.D14],['280-1','외 1필지','한강더채움','제101동']);
assert.deepEqual([c.E11,c.E12],['업무시설','(오피스텔)']);assert.deepEqual([c.F11,c.F12,c.F13],['철근콘크리트구조','(철근)콘크리트지붕','10층']);
assert.equal(c.C17,'[도로명주소]');assert.deepEqual([c.C18,c.C19,c.C20,c.C21],['서울특별시','영등포구','당산로50길','8']);
assert.deepEqual([c.F17,c.G17,c.F18,c.G18,c.F19,c.G19],['1층','16.146','2~10층 (각)','148.339','옥탑1층(연면적제외)','15.951']);
assert.deepEqual([c.B25,c.C25,c.D25,c.E25,c.F25,c.G25],[1,'동소','280-1','대','준공업지역',661.2]);assert.deepEqual([c.B27,c.D27,c.G27],[2,'280-9',403.3]);
assert.equal(r5.unitRows.length,5);assert.deepEqual(r5.unitRows.map(u=>u.symbol),['가','나','다','라','마']);
const u0=r5.unitRows[0].row;   // 첫 호수 블록: (내) / 기호행 / 구조2 / 층호 / 대지권 / 분모
assert.equal(c['F'+(u0-1)],'(내)');
assert.deepEqual([c['B'+u0],c['F'+u0],c['G'+u0],c['H'+u0],c['I'+u0],c['J'+u0]],['가','철근콘크리트구조','29.983','=+G'+u0,r5.model.amounts[0],'비준가액']);
assert.deepEqual([c['F'+(u0+1)],c['J'+(u0+1)],c['F'+(u0+2)],c['J'+(u0+2)]],['(철근)콘크리트지붕','(공용면적','제3층 제302호','포함)']);
assert.deepEqual([c['F'+(u0+3)],c['G'+(u0+3)],c['G'+(u0+4)],c['H'+(u0+4)],c['G'+(u0+5)]],['1, 2 소유권 대지권','12.23','=+G'+(u0+5)+'&" ×----"',12.23,'1064.5']);   // 단일호수 원본과 같은 3줄. 분모 1064.5 = 토지 합 → 사정 = 분자
assert.equal(r5.unitRows[1].row-u0,8);                      // 호수 블록 8행 간격((내)·기호·구조2·층호·분자·산식·분모·빈줄)
assert.equal(c['F'+(r5.unitRows[4].row+2)],'제8층 제801호');
assert.equal(c['C'+r5.totalRow],'합  계');assert.equal(c['I'+r5.totalRow],'=SUM(I11:I'+(r5.totalRow-8)+')');assert.equal(r5.totalRow-8,r5.unitRows[4].row+6);
assert.equal(r5.model.total,r5.model.amounts.reduce((a,b)=>a+b,0));assert.ok(r5.model.amounts.every(a=>a>0));
assert.equal(r5.braces,5);assert.equal(new Set(r5.ids).size,r5.ids.length);   // 중괄호 도형 호수마다 1개, 도형 id 중복 없음
assert.equal(r5.printArea,'Sheet2!$B$3:$J$'+r5.last);assert.equal(r5.printTitles,'Sheet2!$3:$9');assert.equal(r5.dim,'B3:J'+r5.last);
assert.ok(!r5.names.includes('xl/calcChain.xml'));
console.log('PASS 5개호 한 장 명세표: 행',r5.last,'합계행',r5.totalRow,'금액',r5.model.amounts);

// 사정면적·분모 없음·미완료 호·동이 다른 호수·층별면적 7줄
const inp2=JSON.parse(JSON.stringify(input));inp2.ov.landRatioDenom='';inp2.ov.floorDetail=Array.from({length:7},(_,i)=>(i+1)+'층 100.00').join('\n');
inp2.ov.units[1].assessedArea='15';inp2.ov.units[2].appliedSymbol='9';inp2.ov.units[3].dong='102';inp2.ov.units[3].regStructure='벽돌조 슬래브지붕';inp2.ov.units[3].landArea='';inp2.ov.units[4].dong='102';
const r2=await sheetOf(inp2);fs.writeFileSync(path.join(out,'mixed.xlsx'),Buffer.from(r2.bytes,'base64'));const k=r2.cells;
assert.deepEqual([k.F23,k.G23],['7층','100.00']);                   // 7번째 층 행이 늘어남
const v1=r2.unitRows[1].row;assert.equal(k['H'+v1],15);                // 사정면적 직접 값
const v2=r2.unitRows[2].row;assert.equal(k['I'+v2],undefined);assert.equal(r2.model.amounts[2],null);assert.equal(r2.model.total,null); // 사례 없는 호는 금액 빈칸
assert.equal(k['G'+(r2.unitRows[0].row+5)],'1064.5');                    // 분모 없으면 토지 면적 합
const v3=r2.unitRows[3].row;assert.equal(k['F'+v3],'벽돌조');assert.equal(k['B'+v3],'라');
assert.equal(k['G'+(v3+3)],undefined);assert.equal(r2.unitRows[4].row-v3,5); // 대지권 없는 호는 대지권 3행 생략
const dongRows=Object.entries(k).filter(([ref,v])=>v==='제102동'||v==='제101동');assert.equal(dongRows.length,2); // 동 2개 → 1동 표시 2번
assert.equal(r2.braces,4);   // 대지권 없는 '라'는 중괄호 없음
console.log('PASS 혼합 입력(사정면적·분모 없음·미완료·동 2개·층 7줄): 행',r2.last);

// 실제 화면 버튼으로 내려받기
await page.evaluate(inp=>{localStorage.setItem('v2:appraisal-case-list',JSON.stringify([{id:'SYNTHETIC',label:'합성 검증'}]));localStorage.setItem('v2:case:SYNTHETIC',JSON.stringify({...inp,propType:'주거용',rnd:{uD:'천원',uM:'round',tD:'백만원',tM:'round'}}));},input);
await page.reload();const scope=page.locator('#root-multi');await scope.getByText('④ 가격산출',{exact:true}).click();
await page.waitForFunction(()=>Array.from(document.querySelectorAll('#root-multi button')).some(b=>b.textContent==='명세표(excel)'&&!b.disabled));
await page.evaluate(()=>{const c=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){window.__dlName=this.download;return c.call(this);};});
const dl=page.waitForEvent('download');await scope.getByRole('button',{name:'명세표(excel)',exact:true}).click();const d=await dl;await d.saveAs(path.join(out,'ui.xlsx'));assert.equal(await page.evaluate(()=>window.__dlName),'2. 명세표_검증용 의뢰인.xlsx');   // 헤드리스 Chromium은 blob 다운로드 이름을 'download'로 주므로 앵커의 파일명을 본다
assert.equal(await scope.getByRole('button',{name:'요항표',exact:true}).count(),0);
await scope.getByText('② 대상물건개요',{exact:true}).click();assert.equal(await scope.locator('div',{hasText:/^대지권비율 분모\(등기\)/}).locator('input').last().inputValue(),'1064.5');
console.log('PASS 화면 버튼 다운로드 / 요항표 버튼 없음 / 분모 칸');
assert.deepEqual(errors,[]);
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
