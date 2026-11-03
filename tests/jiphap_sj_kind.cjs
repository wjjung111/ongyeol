// 시점수정 유형 자동판정: 「한보미도맨션」(아파트)이 연립다세대로 잡히던 문제(2026-11-03)
// 본건 종류 칸(건축물대장) → 사례 건물명 → 맨션·빌라 순. 의견서 「본건 집합건물(유형)」은 본건 종류 칸이 먼저.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
const grab=name=>{const m=html.match(new RegExp('const '+name+'=\\(\\.\\.\\.texts\\)=>[\\s\\S]*?(?:return null;\\};|:null;)'));assert.ok(m,name+' 없음');return m[0];};
const src=grab('detectSjKind')+'\n'+grab('detectSjKindLoose')+'\nmodule.exports={detectSjKind,detectSjKindLoose};';
const m={exports:{}};new Function('module',src)(m);const {detectSjKind,detectSjKindLoose}=m.exports;
const pick=(c,ov)=>detectSjKind(ov.kind,ov.mainUseJeonyu)||detectSjKind(c.aptName,c.buildingName)||detectSjKindLoose(c.aptName,c.buildingName);
assert.equal(pick({aptName:'한보미도맨션'},{kind:'아파트'}),'아파트');
assert.equal(pick({aptName:'미도맨션아파트'},{kind:''}),'아파트');
assert.equal(pick({aptName:'행복빌라'},{kind:''}),'연립다세대');
assert.equal(pick({aptName:'행복빌라'},{kind:'다세대주택'}),'연립다세대');
assert.equal(pick({aptName:'검증 오피스텔'},{kind:''}),'오피스텔');
assert.equal(pick({aptName:'○○오피스텔'},{kind:'아파트'}),'아파트');  // 본건 종류가 우선
assert.equal(pick({aptName:'래미안'},{kind:'',mainUseJeonyu:'오피스텔'}),'오피스텔');
assert.equal(pick({aptName:'래미안'},{kind:'아파트'}),'아파트');
// 호출 4곳(단일·여러 호수 × 버튼·창) 모두 같은 순서
assert.equal(html.split('detectSjKind(ov.kind,ov.mainUseJeonyu)||detectSjKind(c.aptName,c.buildingName)||detectSjKindLoose(c.aptName,c.buildingName)').length-1,4);
assert.equal((html.match(/const detectSjKindLoose=/g)||[]).length,2);
assert.ok(html.includes('v["유형"]=ov.kind||d["시점수정_용도"]'),'의견서 유형은 본건 종류 먼저');
console.log('PASS jiphap_sj_kind');
