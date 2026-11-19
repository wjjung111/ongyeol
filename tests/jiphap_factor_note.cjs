// 여러 호수 「호별 개별요인 비교 의견」 — 비교치 1(또는 빈칸)인 요인의 빈 줄엔 「대체로 대등함」 기본(2026-11-16)
const assert=require('assert/strict'),path=require('path');
global.window=global;require(path.join(__dirname,'..','arap_multi_hwpx.js'));
const f=ArapMultiHwpx.fillEqualNote;
assert.equal(f('',{extFactor:'0.9',intFactor:'1.02'}),'- 외부요인:\n- 내부요인:\n- 호별요인: 대체로 대등함\n- 기타요인: 대체로 대등함');
assert.equal(f(undefined,{extFactor:'1',intFactor:1,hoFactor:'1.000',etcFactor:''}),'- 외부요인: 대체로 대등함\n- 내부요인: 대체로 대등함\n- 호별요인: 대체로 대등함\n- 기타요인: 대체로 대등함');
// 적은 글은 그대로, 빈 줄만
assert.equal(f('- 외부요인: 역세권 열세\n- 내부요인:\n- 호별요인: 저층\n- 기타요인:',{extFactor:'1',intFactor:'1',hoFactor:'1',etcFactor:'1.05'}),'- 외부요인: 역세권 열세\n- 내부요인: 대체로 대등함\n- 호별요인: 저층\n- 기타요인:');
// 다른 줄·자유 문장은 손대지 않음
assert.equal(f('종합적으로 대등함',{}),'종합적으로 대등함');
const fs=require('fs'),html=fs.readFileSync(path.join(__dirname,'..','s3r86w8a.html'),'utf8');
assert.ok(html.includes('value={ArapMultiHwpx.fillEqualNote(u.factorNote,u)}'),'화면 칸도 같은 규칙');
assert.ok(fs.readFileSync(path.join(__dirname,'..','arap_multi_hwpx.js'),'utf8').includes("'개별요인_의견':fillEqualNote(u.factorNote,u)"),'한글도 같은 규칙');
console.log('PASS jiphap_factor_note');
