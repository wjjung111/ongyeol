// 토건 의견서 조사 을/를 — 끝 글자 읽는 소리 (2026-11-15 「평가사례 a을」 → 「평가사례 a를」)
// node tests/toji_josa.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','arap_toji_opinion.js'),'utf8');
const body=src.slice(src.indexOf('function josaEul('));const fn=body.slice(0,body.indexOf('\n}\n')+3);
const josaEul=new Function(fn+';return josaEul;')();
const cases={'평가사례 a':'를','평가사례 b':'를','평가사례 c':'를','평가사례 A':'를','평가사례 f':'을','평가사례 l':'을','평가사례 m':'을','평가사례 n':'을','평가사례 r':'을',
  '거래사례 #1':'을','거래사례 #2':'를','표준지 기호 3':'을','기호 ㉢':'을','기호 ㉠':'을','본건':'을','평가사례':'를','평가사례 a)':'를'};
for(const [w,j] of Object.entries(cases))assert.equal(josaEul(w),j,w);
assert.equal(josaEul('…'),null,'모르는 글자는 양식 그대로');
console.log('toji_josa OK');
