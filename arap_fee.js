/* arap_fee.js — 감정평가수수료 자동 계산(수수료 계산 사이트 대신).
 * 근거: 「감정평가법인등의 보수에 관한 기준」 [시행 2026.2.9. 국토교통부공고 제2026-145호] 제4조 별표 감정평가수수료 체계.
 *  - 구간별 「누적 기본액 + 구간 하한 초과액 × 요율」, 하한 = 초과액 부분 × 0.8, 상한 = × 1.2 (누적 기본액은 표의 하한·기준·상한 값 그대로).
 *  - 5천만원 이하는 하한·기준·상한 모두 250,000원.
 *  - 원 단위 반올림(수수료 계산 사이트 계산서와 같은 값 — 1,815,216.288 → 1,815,216, 2,128,259.5 → 2,128,260).
 *  - 할증·할인(제5조·제6조)·보상 특례(제7조)는 여기서 하지 않는다 — 청구서 화면의 배수 칸으로.
 * 청구서의 (가)평가수수료 천원 미만 처리는 이 파일이 아니라 각 앱의 청구서 계산(computeCheonggu)이 한다.
 * window.ArapFee = { calc(감정평가액), parse(계산서 텍스트), check(계산서 텍스트), scanSaved() }
 */
(function(){
'use strict';
// [구간 하한(초과), 하한 기본액, 기준 기본액, 상한 기본액, 요율(만분의)] — 별표 그대로
var TABLE=[
  [1e12,245566000,306895000,368224000,1],
  [6e11,181566000,226895000,272224000,2],
  [3e11,109566000,136895000,164224000,3],
  [1e11,45566000,56895000,68224000,4],
  [5e10,25566000,31895000,38224000,5],
  [1e10,6366000,7895000,9424000,6],
  [5e9,3566000,4395000,5224000,7],
  [1e9,1006000,1195000,1384000,8],
  [5e8,646000,745000,844000,9],
  [5e7,250000,250000,250000,11]
];
function won(n){return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');}
function korAmt(n){   // 5억원·1,000억원·1조원
  if(n>=1e12)return (n/1e12)+'조원';
  if(n>=1e8)return won(n/1e8)+'억원';
  return (n/1e7)+'천만원';
}
function calc(v){
  v=Number(String(v==null?'':v).replace(/[^\d.]/g,''))||0;
  if(!(v>0))return null;
  for(var i=0;i<TABLE.length;i++){
    var t=TABLE[i];
    if(v>t[0]){
      var ex=(v-t[0])*t[4]/10000,next=i?TABLE[i-1][0]:null;
      return {예상평가액:v,
        하한수수료:Math.round(t[1]+ex*0.8),기준수수료:Math.round(t[2]+ex),상한수수료:Math.round(t[3]+ex*1.2),
        구간:korAmt(t[0])+' 초과'+(next?' '+korAmt(next)+' 이하':''),요율:t[4]+'/10,000'};
    }
  }
  return {예상평가액:v,하한수수료:250000,기준수수료:250000,상한수수료:250000,구간:'5천만원 이하',요율:'-'};
}
// 사이트 계산서 모양의 글 — 계산서를 읽는 기존 코드(각 앱 parseFeeStatement)에 그대로 넣을 수 있다
function statementText(v){
  var a=calc(v);if(!a)return '';
  return ['1 예상평가액 '+won(a.예상평가액)+' 자동계산','2 하한 수수료 '+won(a.하한수수료)+' '+a.구간,
    '3 기준 수수료 '+won(a.기준수수료)+' '+a.구간,'4 상한 수수료 '+won(a.상한수수료)+' '+a.구간].join('\n');
}
// 수수료 계산 사이트 「계산서1」 붙여넣기 글 — 각 앱의 parseFeeStatement와 같은 규칙(라벨 뒤 첫 콤마 숫자)
function parse(text){
  var pick=function(label){
    var line=String(text||'').split('\n').find(function(l){return l.replace(/\s+/g,' ').indexOf(label)>=0;});
    if(!line)return null;
    var m=line.slice(line.indexOf(label.slice(-3))).match(/[\d,]{4,}/);
    return m?parseInt(m[0].replace(/,/g,''),10):null;
  };
  return {예상평가액:pick('예상평가액'),하한수수료:pick('하한 수수료'),기준수수료:pick('기준 수수료'),상한수수료:pick('상한 수수료')};
}
// 붙여넣은 계산서를 같은 예상평가액의 자동 계산과 맞춰 본다 — {ok, site, auto, diffs:[항목]} (계산서를 못 읽으면 null)
function check(text){
  var s=parse(text);if(!s.예상평가액||!s.하한수수료)return null;
  var a=calc(s.예상평가액),diffs=[];
  ['하한수수료','기준수수료','상한수수료'].forEach(function(k){if(s[k]!=null&&s[k]!==a[k])diffs.push(k);});
  return {ok:!diffs.length,site:s,auto:a,diffs:diffs};
}
// 이 브라우저에 저장된 건 전부(집합건물·입주권·토지건물 — 같은 주소라 저장소를 같이 씀)에서 붙여넣어 둔 계산서를 찾아 검증
function scanSaved(){
  var rows=[],seen={};
  var walk=function(o,key,depth){
    if(depth>6||o==null)return;
    if(typeof o==='string'){
      if(o.indexOf('하한 수수료')<0)return;
      var r=check(o);if(!r)return;
      var sig=r.site.예상평가액+'|'+r.site.하한수수료+'|'+r.site.기준수수료+'|'+r.site.상한수수료;
      if(seen[sig])return;seen[sig]=1;
      rows.push(Object.assign({key:key},r));return;
    }
    if(typeof o==='object')Object.keys(o).forEach(function(k){walk(o[k],key,depth+1);});
  };
  try{
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i),raw=localStorage.getItem(k);
      if(!raw||raw.indexOf('하한 수수료')<0)continue;
      var o=raw;try{o=JSON.parse(raw);}catch(e){}
      walk(o,k,0);
    }
  }catch(e){}
  return rows;
}
window.ArapFee={calc:calc,statementText:statementText,parse:parse,check:check,scanSaved:scanSaved,TABLE:TABLE};
})();
