// 의견서 「1. 감정평가의 목적」 — 평가목적에 「자산재평가」면 「상속세 및 증여세법」상 {{평가구분}} 재산에 대한 → 「주식회사 등의 외부감사에 관한 법률」상 유형자산에 대한 (2026-11-15)
// 모든 의견서 템플릿(토건 3종·집건 단일 주거/비주거·집건 여러 호수)에서 문장이 바뀌고, 다른 목적은 그대로인지
// node tests/purpose_law.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
require(path.join(root,'arap_purpose_law.js'));const law=globalThis.arapPurposeLaw;
const tpls=['템플릿/토건 의견서(산출근거) 템플릿.hwpx','템플릿/토지 의견서(산출근거) 템플릿.hwpx','템플릿/건물 의견서(산출근거) 템플릿.hwpx','templates/jiphap_multi_res.hwpx'];
const text=x=>x.replace(/<[^>]+>/g,'').replace(/\{\{(근거법령|재평가대상)\}\}/g,(m,k)=>law.VALUES[k]);
for(const t of tpls){
  const xml=execFileSync('unzip',['-p',path.join(root,t),'Contents/section*.xml'],{maxBuffer:1<<28}).toString('utf8');
  assert.ok(xml.includes('「상속세 및 증여세법」상'),t+' 원문 문구');
  assert.equal(law(xml,'일반거래(시가참고)'),xml,t+' 다른 목적은 그대로');
  const out=law(xml,'자산재평가(IFRS)'),s=text(out);
  assert.ok(!out.includes('「상속세 및 증여세법」상'),t+' 상증세법 문구 빠짐');
  assert.match(s,/으로서, 「주식회사 등의 외부감사에 관한 법률」상 유형자산에 대한 \{\{평가목적\}\} 목적의 감정평가임/,t);
  // 바꾼 두 값은 원래 {{평가구분}} 런 글자모양(검토 색) — 런이 나뉜 양식
  const tok=(xml.match(/<hp:run([^>]*)><hp:t>\{\{평가구분\}\}/)||[])[1];
  if(tok){assert.ok(out.includes('<hp:run'+tok+'><hp:t>{{근거법령}}</hp:t>'),t+' 근거법령 = 값 글자모양');assert.ok(out.includes('<hp:run'+tok+'><hp:t>{{재평가대상}}</hp:t>'),t+' 유형자산 = 값 글자모양');}
  assert.equal((out.match(/<hp:t>/g)||[]).length,(out.match(/<\/hp:t>/g)||[]).length,t+' 태그 짝');
}
// 집건 단일호수 템플릿은 s3r86w8a.html 안 base64 — 한 런 안 문구 형태
const one='<hp:run charPrIDRef="1"><hp:t>부동산(구분건물)으로서, 「상속세 및 증여세법」상 {{평가구분}}재산에 대한 {{평가목적}} 목적의 감정평가임. </hp:t></hp:run>';
assert.equal(text(law(one,'자산재평가')),'부동산(구분건물)으로서, 「주식회사 등의 외부감사에 관한 법률」상 유형자산에 대한 {{평가목적}} 목적의 감정평가임. ');
// 연결 확인
const src=f=>fs.readFileSync(path.join(root,f),'utf8');
assert.match(src('arap_toji_opinion.js'),/arapPurposeLaw\(xml,val\('ov_purpose'\)\)/);
assert.match(src('s3r86w8a.html'),/arapPurposeLaw\(xml,tokenMap\["평가목적"\]\)/);
assert.match(src('arap_multi_hwpx.js'),/arapPurposeLaw\(/);
assert.ok(src('토지건물.html').includes('<script src="arap_purpose_law.js">')&&src('s3r86w8a.html').includes('<script src="arap_purpose_law.js">'));
console.log('purpose_law OK');
