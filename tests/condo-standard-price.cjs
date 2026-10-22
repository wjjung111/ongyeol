// Synthetic arithmetic fixtures only. No property addresses, owners or registry files.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const ctx={window:{}};vm.createContext(ctx);const root=path.join(__dirname,'..');
for(const f of ['condo-standard-indices.js','condo-standard-price.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const C=ctx.window.CondoStandardPrice;
const row=(area,adjustment=1)=>({label:'가상 부분',area,structNo:4,group:1,useIndex:115,adjustment});
function fixture(){return {date:'2026-10-22',mode:'manual',built:2023,priceConfirmed:true,rowsConfirmed:true,lands:[{method:'area',area:94,parcelArea:24444.4,price:2077000}],rows:[row(373.5),row(315.58),row(62.64)]};}
let r=C.calculate(fixture());assert.equal(r.errors.length,0);assert.equal(r.total,996571520);assert.equal(r.building,801333520);assert.equal(r.land,195238000);assert.equal(r.institutions,1);assert.equal(r.near,true);assert.equal(r.lines[0].unit,1066000);
let x=fixture();x.rows=x.rows.slice(0,1);assert.equal(C.calculate(x).building,398151000,'전유만 계산한 값은 공용 포함과 달라야 함');
x=fixture();x.lands[0]={method:'ratio',parcelArea:24444.4,numerator:94,denominator:24444.4,price:2077000};assert.equal(C.calculate(x).total,r.total,'등기부 비율 환산');
x=fixture();x.lands[0].area='';assert.ok(C.calculate(x).errors.length,'누락된 대지권 추정 금지');
x=fixture();x.priceConfirmed=false;assert.ok(C.calculate(x).errors.length);x=fixture();x.rowsConfirmed=false;assert.ok(C.calculate(x).errors.length);
for(const date of ['2024-10-22','2027-01-01','2026-02-30','']){x=fixture();x.date=date;assert.ok(C.calculate(x).errors.length,'지원하지 않는 날짜 차단');}
x=fixture();x.built=2027;assert.ok(C.calculate(x).errors.length);x=fixture();x.rows[0].area=-1;assert.ok(C.calculate(x).errors.length);
x=fixture();x.lands[0].method='ratio';x.lands[0].numerator=2;x.lands[0].denominator=1;assert.ok(C.calculate(x).errors.length);
for(const total of [999999999,1000000000,1000000001]){r=C.calculate({date:'2026-01-01',mode:'official',officialConfirmed:true,officialTotal:total,lands:[{area:999999,price:999999}]});assert.equal(r.total,total,'일괄고시 토지 이중가산 금지');assert.equal(r.institutions,total<=1e9?1:2);}
r=C.calculate({date:'2026-01-01',mode:'housing',officialConfirmed:true,officialTotal:500000000});assert.equal(r.total,500000000);
x=fixture();x.sjConfirmed=true;x.rows.forEach(a=>a.adjustment=1.3);r=C.calculate(x);assert.equal(r.institutions,1,'상증 조정률이 복수감정 판단에 섞이지 않음');assert.ok(r.sjTotal>1e9);assert.equal(r.total,996571520);
const original=r.total;x.remodel=2025;r=C.calculate(x);assert.equal(r.total,original,'대수선 할증은 소득세법 기준에 미적용');assert.ok(r.sjTotal>1e9);
const mapped=C.registerRows([{exposPubuseGbCdNm:'전유',strctCdNm:'프리케스트콘크리트구조',mainPurpsCdNm:'기타공장',etcPurps:'공장(지식산업센터)',area:100},{exposPubuseGbCdNm:'공용',strctCdNm:'프리케스트콘크리트구조',etcPurps:'주차장',area:40}],2026);
assert.equal(mapped[0].useIndex,115);assert.equal(mapped[1].useIndex,115);assert.equal(mapped[0].structNo,4);assert.equal(mapped[0].group,1);
x=fixture();x.lands=[{method:'area',area:10,parcelArea:100,price:1000000},{method:'area',area:10,parcelArea:300,price:3000000}];r=C.calculate(x);assert.equal(r.land,40000000);assert.equal(r.loc.idx,116,'전체 필지면적 가중평균 250만원');
console.log('PASS: condo arithmetic, 1bn boundary, official routes, missing values, date, land ratio, mapping and basis separation');
