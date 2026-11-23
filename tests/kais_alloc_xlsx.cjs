// KAIS 실거래 → 토지배분단가 엑셀(downloads/kais_land_alloc.xlsx) 계산 검증 (2026-11-23)
// 생성기(tools/make_kais_alloc_xlsx.py --test)가 WEBSERVICE 대신 예시 대장 JSON(tests/fixtures/kais_alloc_bld.json)을 박은 파일을 만들고,
// LibreOffice로 다시 계산해 결과 칸을 토지건물 앱 tradeCalc와 같은 손계산 값과 대조한다.
// 필요: python3 + openpyxl, soffice(LibreOffice). 없으면 건너뜀. 실행: node tests/kais_alloc_xlsx.cjs
const {spawnSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const has=c=>spawnSync('sh',['-c','command -v '+c]).status===0;
if(!has('python3')||!has('soffice')){console.log('건너뜀: python3/soffice 없음');process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kais-'));
const x=path.join(tmp,'t.xlsx');
let r=spawnSync('python3',['-I',path.join(root,'tools/make_kais_alloc_xlsx.py'),path.join(root,'tests/fixtures/kais_alloc_bdong.json'),x,'--test'],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr);
r=spawnSync('soffice',['--headless','--convert-to','xlsx','--outdir',path.join(tmp,'c'),x],{encoding:'utf8',env:Object.assign({},process.env,{LANG:'C.UTF-8'}),timeout:180000});
assert.equal(r.status,0,r.stderr);
const py=`import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1],data_only=True)
ws=wb['붙여넣기'];gs=wb['결과모음']
def row(s,r,a,b):return [s.cell(r,c).value for c in range(a,b)]
print(json.dumps({'r4':row(ws,4,18,42),'r6':row(ws,6,18,31),'r10':row(ws,10,18,42),'g3':row(gs,3,1,19),'g4':row(gs,4,1,19),'g5':row(gs,5,1,19)},default=str,ensure_ascii=False))`;
r=spawnSync('python3',['-I','-c',py,path.join(tmp,'c','t.xlsx')],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr);
const o=JSON.parse(r.stdout);
// 사례1 192-1: 건물 → 토지 순. 대장 3동(부속 3000㎡ 제외) 중 가장 큰 주건축물 = 철근콘크리트 근생 → 상업 RC 1,402,000 / 50년
// 경과 1998.04.10→2025.10.16 = 27, 잔존 23, 적용단가 round(1402000×23÷50)=644,920, 건물 644,920×1,184.72, 토지 (12.5억−건물)÷1,318 절사
assert.deepEqual(o.r4.slice(0,13),['2','은현면 선암리','192-1','2025-10-16 00:00:00',1402000,50,27,23,644920,1184.72,764049622.4,1318,368702]);
assert.equal(o.r4[14],'철근콘크리트구조');assert.equal(o.r4[19],'철근콘크리트조');assert.equal(o.r4[20],'상업');
assert.match(o.r4[23],/3동 중/);
assert.ok(o.r6.every(v=>v===null),'토지 줄엔 결과 없음');
// 사례2 216-4: 토지 먼저 붙이고 건물(기타주소 열 없는 13열) — 벽돌 단독주택 1,576,000 / 45년, 경과 28, 잔존 17
assert.deepEqual(o.r10.slice(0,13),['1','은현면 선암리','216-4','2026-03-23 00:00:00',1576000,45,28,17,595378,148.33,88312418.74,322,315799]);
assert.equal(o.r10[23],null);
// 결과모음: 사례가 차례로 한 줄씩
assert.deepEqual(o.g3.slice(0,13),o.r4.slice(0,13));
assert.deepEqual(o.g4.slice(0,13),o.r10.slice(0,13));
assert.ok(o.g5.every(v=>v===null));
console.log('kais_alloc_xlsx OK');
