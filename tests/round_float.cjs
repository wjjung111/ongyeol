// 끝수 처리(applyR·ipjRound) 부동소수점 오차 — 29.5억 × 7/10 = 2,064,999,999.9999998 이 「백만원 단위 반올림」에서 20.6억으로 내려가던 문제(2026-11-09)
// node tests/round_float.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function grab(file,re){const s=fs.readFileSync(path.join(root,file),'utf8');const m=s.match(re);assert.ok(m,file+' 함수 못 찾음');return m;}
const fns=[];
for(const f of ['s3r86w8a.html','입주권.html']){
  const all=fs.readFileSync(path.join(root,f),'utf8').match(/const applyR=\(val,uv,m\)=>\{.*?\};/g);assert.ok(all&&all.length,f);
  all.forEach(src=>fns.push([f+' applyR',new Function(src+'return applyR;')()]));
}
const ipj=grab('입주권.html',/const ipjRound=\(v,unit,mode\)=>\{[\s\S]*?\n\};/)[0];
fns.push(['입주권 ipjRound',new Function(ipj+'return ipjRound;')()]);
for(const [name,fn] of fns){
  assert.equal(fn(2950000000*0.7,1000000,'round'),2070000000,name+' 반올림 20.7억');
  assert.equal(fn(2950000000*0.7,1000000,'floor'),2060000000,name+' 절사 20.6억');
  assert.equal(fn(0.7*1e8,1000000,'floor'),70000000,name+' 절사 정확한 배수 유지');
  assert.equal(fn(2062863000,1000000,'round'),2060000000,name+' 일반 반올림');
  assert.equal(fn(16268717,10000,'round'),16300000,name+' 만원 단위 반올림');
}
console.log('OK',fns.length,'개 함수');
