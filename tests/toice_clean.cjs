// 토지이용계획(토이계) 복붙 정리 검증 — 토지이음의 머리문구 제거 + 탭→공백
// 배경: 날것 탭(U+0009)이 hwpx <hp:t>에 들어가면 한글이 그 런을 잘못 읽어 뒤 글자를 먹는다
//       (실제 사고: '가로구역별 최고높이 제한지역' → '고높이 제한지역'으로 7자 소실)
// node tests/toice_clean.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const TAB=String.fromCharCode(9);

function loadCleanToice(file,startMark){
  const src=fs.readFileSync(path.join(root,file),'utf8');
  const i=src.indexOf(startMark);
  assert.ok(i>=0,file+' 에서 cleanToice 를 찾지 못함');
  const end=src.indexOf('\n}',i)>=0&&src.indexOf('\n}',i)<src.indexOf('\n};',i)?src.indexOf('\n}',i)+2:src.indexOf('\n};',i)+2;
  const body=src.slice(i,end).replace(/^(const cleanToice=|function cleanToice)/,m=>m.startsWith('const')?'':'function cleanToice');
  return eval('('+(body.startsWith('function')?body:body)+')');
}

// 집합건물(화살표 함수) / 토지건물(function 선언) 각각 꺼내 쓴다
const jiphapSrc=(()=>{const s=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
  const i=s.indexOf('const cleanToice=(raw)=>{');return s.slice(i,s.indexOf('\n};',i)+2).replace(/^const cleanToice=/,'');})();
const tojiSrc=(()=>{const s=fs.readFileSync(path.join(root,'토지건물.html'),'utf8');
  const i=s.indexOf('function cleanToice(raw){');return s.slice(i,s.indexOf('\n}',i)+2);})();
const jiphap=eval('('+jiphapSrc+')');
const toji=eval('('+tojiSrc+')');

// 실제 사고 입력 (서초구 방배동 1344, 토지이음 「지역·지구등 지정여부」 복붙)
const RAW=[
 '도시지역 , 제3종일반주거지역 , 도로(접합)',
 '다른 법령 등에 따른 지역ㆍ지구등'+TAB+'가로구역별 최고높이 제한지역<건축법>, 상대보호구역(토지전산망의 내용은 참고사항일뿐 교육청에 반드시 확인요망)<교육환경 보호에 관한 법률>, 절대보호구역(토지전산망의 내용은 참고사항일뿐 교육청에 반드시 확인요망)<교육환경 보호에 관한 법률>, 대공방어협조구역(위탁고도:77-257m)<군사기지 및 군사시설 보호법>, 과밀억제권역<수도권정비계획법>',
 '「토지이용규제 기본법 시행령」',
 '제9조 제4항 각 호에 해당되는 사항',
 '',
 '토지거래계약에관한허가구역(대상자: 외국인 등 / 허가대상: 단독, 다가구, 연립, 다세대, 아파트 / 기간: 2026.8.26.~2027.8.25.),토지거래계약에관한허가구역(허가대상: 건축물의 용도(아파트)로 사용되는 부지, 지정기간: 2025.3.24.~2025.9.30.),토지거래계약에관한허가구역(허가대상:건축물의 용도(아파트)로 사용되는 부지, 지정기간:2025.10.1.~2026.12.31.)'
].join('\n');

const WANT='도시지역 , 제3종일반주거지역 , 도로(접합) 가로구역별 최고높이 제한지역<건축법>, 상대보호구역(토지전산망의 내용은 참고사항일뿐 교육청에 반드시 확인요망)<교육환경 보호에 관한 법률>, 절대보호구역(토지전산망의 내용은 참고사항일뿐 교육청에 반드시 확인요망)<교육환경 보호에 관한 법률>, 대공방어협조구역(위탁고도:77-257m)<군사기지 및 군사시설 보호법>, 과밀억제권역<수도권정비계획법>토지거래계약에관한허가구역(대상자: 외국인 등 / 허가대상: 단독, 다가구, 연립, 다세대, 아파트 / 기간: 2026.8.26.~2027.8.25.),토지거래계약에관한허가구역(허가대상: 건축물의 용도(아파트)로 사용되는 부지, 지정기간: 2025.3.24.~2025.9.30.),토지거래계약에관한허가구역(허가대상:건축물의 용도(아파트)로 사용되는 부지, 지정기간:2025.10.1.~2026.12.31.)';

for(const [name,fn] of [['집합건물',jiphap],['토지건물',toji]]){
  const got=fn(RAW);
  assert.equal(got,WANT,name+' 정리결과 불일치\n실제: '+JSON.stringify(got)+'\n기대: '+JSON.stringify(WANT));
  assert.ok(!got.includes(TAB),name+': 탭이 남으면 안 됨');
  assert.ok(got.includes('가로구역별 최고높이'),name+': 글자 소실');
  console.log('PASS',name,'— 머리문구 제거·탭→공백·글자 보존');
}

// <추가기재>는 별도 줄 유지, 탭은 이 줄에서도 공백으로
const withExtra=jiphap('도시지역'+TAB+'제1종일반주거지역\n<추가기재>\n건축선'+TAB+'2m');
assert.equal(withExtra,'도시지역 제1종일반주거지역\n<추가기재> 건축선 2m','<추가기재> 처리');
assert.ok(!withExtra.includes(TAB),'<추가기재> 줄에도 탭이 남으면 안 됨');
console.log('PASS <추가기재> 줄 분리 유지');

// 빈 값·머리문구만 있는 값
assert.equal(jiphap(''),'','빈 입력');
assert.equal(jiphap('「토지이용규제 기본법 시행령」\n제9조 제4항 각 호에 해당되는 사항'),'','머리문구만 있으면 빈 문자열');
console.log('PASS 빈 입력·머리문구만');
console.log('\n전체 PASS');
