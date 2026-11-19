// 주거용 시점수정 아파트 전국 17개 시도(2026-10-29) — 실제 지수 파일로 주소 자동인식(집건 두 벌·입주권).
// 동명 구(중구·남구·서구·강서구·고성군)는 주소의 시도대로, 지수 없는 군은 그 시도 전체.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
global.window={};eval(fs.readFileSync(path.join(root,'arap_index_data.js'),'utf8'));
const idxData=()=>window.ARAP_INDEX_DATA;
const CASES=[
  ['부산광역시 해운대구 우동','해운대구'],['부산광역시 중구 중앙동','부산 중구'],['부산광역시 강서구 명지동','부산 강서구'],['서울특별시 강서구 화곡동','강서구'],
  ['경상남도 창원시 성산구 상남동','성산구'],['경상북도 포항시 남구 대잠동','경북 남구'],['경상북도 포항시 북구 양덕동','경북 북구'],
  ['충청북도 청주시 상당구 용암동','상당구'],['충청남도 천안시 동남구 신부동','동남구'],['세종특별자치시 나성동','세종'],['제주특별자치도 제주시 노형동','제주시'],
  ['울산광역시 울주군 범서읍','울주군'],['울산광역시 중구 성안동','울산 중구'],['대전광역시 유성구 봉명동','유성구'],['대전광역시 서구 둔산동','대전 서구'],
  ['강원특별자치도 춘천시 퇴계동','춘천시'],['강원도 원주시 무실동','원주시'],['경상남도 고성군 고성읍','경남'],['강원특별자치도 고성군 간성읍','강원'],
  ['경기도 광주시 오포읍','광주시'],['광주광역시 남구 봉선동','전남광주 남구'],['인천광역시 연수구 송도동','연수구'],['경상남도 김해시 장유동','김해시'],
  ['충청남도 홍성군 홍북읍','홍성군'],['경상북도 칠곡군 석적읍','칠곡군'],['경상남도 거창군 거창읍','경남'],['대구광역시 수성구 범어동','수성구'],
];
for(const f of ['s3r86w8a.html','입주권.html']){
  const src=fs.readFileSync(path.join(root,f),'utf8');const re=/const detectSjRegion=[\s\S]*?\n  return null;\};/g;let m,n=0;
  while((m=re.exec(src))){n++;const det=eval('('+m[0].replace(/^const detectSjRegion=/,'').replace(/;$/,'')+')');
    for(const [a,want] of CASES)assert.equal(det(a),want,`${f}#${n} ${a}`);}
  assert.ok(n>=1);console.log(f,n,'벌',CASES.length,'건 OK');
}
console.log('PASS');
