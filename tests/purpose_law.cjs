// 의견서 「1. 감정평가의 목적」 — 평가목적에 「자산재평가」면 「상속세 및 증여세법」상 {{평가구분}} 재산에 대한 → 「주식회사 등의 외부감사에 관한 법률」상 유형자산에 대한 (2026-11-15)
// 모든 의견서 템플릿(토건 3종·집건 단일 주거/비주거·집건 여러 호수)에서 문장이 바뀌고, 다른 목적은 그대로인지
// node tests/purpose_law.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
require(path.join(root,'arap_purpose_law.js'));const law=globalThis.arapPurposeLaw;
const tpls=['템플릿/토건 의견서(산출근거) 템플릿.hwpx','템플릿/토지 의견서(산출근거) 템플릿.hwpx','템플릿/건물 의견서(산출근거) 템플릿.hwpx','templates/jiphap_multi_res.hwpx'];
const text=x=>x.replace(/<[^>]+>/g,'').replace(/\{\{(근거법령|재평가대상|담보목적)\}\}/g,(m,k)=>law.VALUES[k]);
for(const t of tpls){
  const xml=execFileSync('unzip',['-p',path.join(root,t),'Contents/section*.xml'],{maxBuffer:1<<28}).toString('utf8');
  assert.ok(xml.includes('「상속세 및 증여세법」상'),t+' 원문 문구');
  assert.ok(law(xml,'일반거래(시가참고)','증여')===xml,t+' 다른 목적은 그대로');
  // 평가구분 빈칸 → 「상속세 및 증여세법」에 의한 {{평가목적}} 목적 (2026-11-20)
  {const bl=law(xml,'일반거래(시가참고)',''),bs=bl.replace(/<[^>]+>/g,'');
   assert.ok(!bl.includes('{{평가구분}}')&&!bs.includes('「상속세 및 증여세법」상'),t+' 빈칸 상·재산에 대한 빠짐');
   assert.match(bs,/으로서, 「상속세 및 증여세법」에 의한 \{\{평가목적\}\} 목적의 감정평가임/,t+' 빈칸 문장');
   assert.equal((bl.match(/<hp:t>/g)||[]).length,(bl.match(/<\/hp:t>/g)||[]).length,t+' 빈칸 태그 짝');
   assert.ok(law(xml,'일반거래(시가참고)')===bl,t+' undefined도 빈칸');}
  const out=law(xml,'자산재평가(IFRS)'),s=text(out);
  assert.ok(!out.includes('「상속세 및 증여세법」상'),t+' 상증세법 문구 빠짐');
  assert.match(s,/으로서, 「주식회사 등의 외부감사에 관한 법률」상 유형자산에 대한 \{\{평가목적\}\} 목적의 감정평가임/,t);
  // 바꾼 두 값은 원래 {{평가구분}} 런 글자모양(검토 색) — 런이 나뉜 양식
  const tok=(xml.match(/<hp:run([^>]*)><hp:t>\{\{평가구분\}\}/)||[])[1];
  if(tok){assert.ok(out.includes('<hp:run'+tok+'><hp:t>{{근거법령}}</hp:t>'),t+' 근거법령 = 값 글자모양');assert.ok(out.includes('<hp:run'+tok+'><hp:t>{{재평가대상}}</hp:t>'),t+' 유형자산 = 값 글자모양');}
  assert.equal((out.match(/<hp:t>/g)||[]).length,(out.match(/<\/hp:t>/g)||[]).length,t+' 태그 짝');
  // 담보(평가목적 또는 평가구분) → 「…으로서, 담보 목적의 감정평가임.」 (2026-11-16)
  for(const [pp,cc] of [['담보',''],['일반거래(시가참고)','담보'],['','담보']]){
    const lo=law(xml,pp,cc),ls=text(lo);
    assert.ok(!lo.includes('「상속세 및 증여세법」상')&&!lo.includes('{{평가구분}}'),t+' 담보 상증세법 빠짐 '+pp+'/'+cc);
    assert.match(ls,/으로서, 담보 목적의 감정평가임/,t+' 담보 문장');
    const pr=(xml.match(/재산에 대한 <\/hp:t><\/hp:run><hp:run([^>]*)><hp:t>\{\{평가목적\}\}/)||[])[1];if(pr)assert.ok(lo.includes('<hp:run'+pr+'><hp:t>{{담보목적}}</hp:t>'),t+' 담보 = 값 글자모양');
    assert.equal((lo.match(/<hp:t>/g)||[]).length,(lo.match(/<\/hp:t>/g)||[]).length,t+' 담보 태그 짝');}
  assert.equal(law(xml,'자산재평가','담보'),out,t+' 자산재평가가 먼저');
}
// 집건 단일호수 템플릿은 s3r86w8a.html 안 base64 — 한 런 안 문구 형태
const one='<hp:run charPrIDRef="1"><hp:t>부동산(구분건물)으로서, 「상속세 및 증여세법」상 {{평가구분}}재산에 대한 {{평가목적}} 목적의 감정평가임. </hp:t></hp:run>';
assert.equal(text(law(one,'일반거래(시가참고)','담보')),'부동산(구분건물)으로서, 담보 목적의 감정평가임. ');
assert.equal(text(law(one,'일반거래(시가참고)','')),'부동산(구분건물)으로서, 「상속세 및 증여세법」에 의한 {{평가목적}} 목적의 감정평가임. ');
assert.equal(text(law(one,'일반거래(시가참고)','상속')),text(one));
assert.equal(text(law(one,'자산재평가')),'부동산(구분건물)으로서, 「주식회사 등의 외부감사에 관한 법률」상 유형자산에 대한 {{평가목적}} 목적의 감정평가임. ');
// 연결 확인
const src=f=>fs.readFileSync(path.join(root,f),'utf8');
assert.match(src('arap_toji_opinion.js'),/arapPurposeLaw\(xml,tojiPurpose\(\),val\('ov_kind'\)\)/);
assert.match(src('s3r86w8a.html'),/arapPurposeLaw\(xml,tokenMap\["평가목적"\],tokenMap\["평가구분"\]\)/);
assert.match(src('arap_multi_hwpx.js'),/L=g\.arapPurposeLaw;x=L\(x,o\.purpose,o\.evalCategory\)/);   // 2026-11-16 담보 문장 추가 때 엔진이 L(...)로 부름
assert.ok(src('토지건물.html').includes('<script src="arap_purpose_law.js">')&&src('s3r86w8a.html').includes('<script src="arap_purpose_law.js">'));
// 서류에 찍을 평가목적 — 평가구분 담보 + 평가목적 비었거나 기본값 → 담보 (2026-11-16)
const pd=globalThis.arapPurposeDoc;
assert.equal(pd('','담보'),'담보');assert.equal(pd('일반거래(시가참고)','담보'),'담보');assert.equal(pd('경매','담보'),'경매');
assert.equal(pd('','증여'),'일반거래(시가참고)');assert.equal(pd('','증여',''),'');assert.equal(pd('담보',''),'담보');
assert.equal(law.otherUse('담보'),'일반거래나 소송 등');assert.equal(law.otherUse('일반거래(시가참고)'),'담보나 소송 등');
// 집건 접수 캡처 평가목적 정리 — 증여·양도·상속·특관자매매 → 일반거래(시가참고)(2026-11-20, 옛 일반시가), 상속·증여면 평가구분 (2026-11-19)
const fc=globalThis.arapPurposeFromCapture;
assert.deepEqual(fc('증여'),{purpose:'일반거래(시가참고)',category:'증여'});
assert.deepEqual(fc('상속목적'),{purpose:'일반거래(시가참고)',category:'상속'});
for(const x of ['양도','특관자매매','특관매','특수관계자간 매매','상속(증여)','일반시가'])assert.deepEqual(fc(x),{purpose:'일반거래(시가참고)',category:''},x);
for(const x of ['담보','자산재평가','소송','일반거래(시가참고)','경매'])assert.equal(fc(x).purpose,x,x);
assert.equal(fc('담보목적').purpose,'담보');assert.equal(fc('').purpose,'');
assert.equal((src('s3r86w8a.html').match(/window\.arapPurposeFromCapture\(next\.purpose\)/g)||[]).length,2,'집건 단일·여러 호수 둘 다');
console.log('purpose_law OK');

// 2026-11-20 옛 값 「일반시가(시가참고)」 — 서류엔 일반거래(시가참고), 화면 불러올 때도 바꿈
assert.equal(globalThis.arapPurposeDoc('일반시가(시가참고)','증여'),'일반거래(시가참고)');
assert.equal(globalThis.arapPurposeDoc('일반시가(시가참고)','담보'),'담보');
assert.deepEqual(globalThis.arapPurposeFixOv({purpose:'일반시가(시가참고)',client:'A'}),{purpose:'일반거래(시가참고)',client:'A'});
const keep={purpose:'담보'};assert.equal(globalThis.arapPurposeFixOv(keep),keep);
console.log('purpose_law 옛 일반시가 → 일반거래 OK');
