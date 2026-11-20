// 집건 대지권 면적 — 등기 대지권비율 분모가 대지면적과 다르면 대지면적 × 분자 ÷ 분모 (2026-11-20)
// 서초삼풍 19동 403호: 대지 144012.4㎡, 163672분의 73.47 → 64.65(2/10 지분 12.93). 분모 = 대지면적이거나 분모 없으면 분자 그대로
// node tests/jiphap_land_right.cjs
const path=require('path'),fs=require('fs'),assert=require('assert/strict');const root=path.resolve(__dirname,'..');
require(path.join(root,'arap_jiphap_parcels.js'));const P=globalThis.ArapJiphapParcels;
const ov={jibun:'서울특별시 서초구 서초동 1685',landRatioDenom:'163672',landAreaTotal:'',landParcels:[{jibun:'1685',area:'144012.4'}]};
assert.equal(P.landRightText(ov,'73.47'),'64.65');
assert.equal((Math.round(+P.landRightText(ov,'73.47')*0.2*100+1e-7)/100).toFixed(2),'12.93');
assert.equal(P.landRightText({...ov,landParcels:[],landAreaTotal:'144,012.4'},'73.47'),'64.65','필지 없으면 대지면적 칸');
assert.equal(P.landRightText({...ov,areaRound:'floor'},'73.47'),'64.64','절사 옵션');
assert.equal(P.landRightText({...ov,landRatioDenom:'144012.4'},'73.47'),'73.47','분모 = 대지면적이면 그대로');
assert.equal(P.landRightText({...ov,landRatioDenom:''},'73.47'),'73.47','분모 없으면 그대로');
assert.equal(P.landRightText({landRatioDenom:'4700',landAreaTotal:'15537'},'16.8'),'55.54','명세표 예시 15537×16.8/4700');
assert.equal(P.landRightText(ov,'12.345'),'10.862','분자 소수 자릿수 따라감');
assert.equal(P.landRightText(ov,''),'');
assert.equal(P.landRightText({...ov,landParcels:[]},'73.47',''),'73.47','대지면적 모르면 그대로');
assert.equal(P.landRightText({landRatioDenom:'',landAreaTotal:'1000'},'5','2000'),'2.50','호별 분모');
const src=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
assert.equal((src.match(/"대지지분":\(window\.ArapJiphapParcels&&ArapJiphapParcels\.landRightText\?ArapJiphapParcels\.landRightText\(ov,ov\.landArea\)/g)||[]).length,2,'단일호수 두 벌 연결');
assert.ok(fs.readFileSync(path.join(root,'arap_multi_hwpx.js'),'utf8').includes('landRightText(ov,u.landArea,u.landRatioDenom)'),'여러 호수 연결');
console.log('jiphap_land_right OK');
