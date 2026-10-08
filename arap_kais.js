/*
  온결 kais(실거래가) 복붙 파서 (arap_kais.js)  →  window.ArapKais

  거래사례 지도 페이지가 쓴다. 두 ARM 앱의 붙여넣기 파서를 옮겨 온 것이다.
    ArapKais.parseLand(text, defKind)  ← 토지건물.html 의 parseTradeText  (토지·건물 일괄 거래를 한 사례로 합침)
    ArapKais.parseJip(text)            ← s3r86w8a.html 의 parseKaisRow    (집합건물 — 동·층·호 분해, 단가 계산)
    ArapKais.parseAppr(text)           ← 토지건물.html 의 parseApprText   (감정평가정보센터(KAPA) 평가사례)
                                          + 지도 페이지용 추가 칸(locFull·물건·면적·총액·공시지가·도로·형상) — 원본 칸은 그대로

  ⚠ 원본(토지건물.html·s3r86w8a.html)이 이 파일의 주인이다.
     원본 파서를 고치면 **이 파일도 같이 고쳐야** 지도 페이지 결과가 어긋나지 않는다.
     (청구서 엔진 arap_cheonggu.js 와 같은 방식)
*/
(function(){
'use strict';

var MAP_YONGDO={'제1종전용주거지역':'1종전주','제2종전용주거지역':'2종전주','제1종일반주거지역':'1종일주','제2종일반주거지역':'2종일주','제3종일반주거지역':'3종일주','준주거지역':'준주거','중심상업지역':'중심상업','일반상업지역':'일반상업','근린상업지역':'근린상업','유통상업지역':'유통상업','전용공업지역':'전용공업','일반공업지역':'일반공업','준공업지역':'준공업','보전녹지지역':'보전녹지','생산녹지지역':'생산녹지','자연녹지지역':'자연녹지','보전관리지역':'보전관리','생산관리지역':'생산관리','계획관리지역':'계획관리','농림지역':'농림','자연환경보전지역':'자연환경'};

function num(v){var n=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,''));return isNaN(n)?0:n;}
function hasV(v){return String(v==null?'':v).trim()!=='';}
function shortY(v){v=String(v||'').trim();return MAP_YONGDO[v]||v;}
// 여러 날짜 표기(2026-05-01 / 2026.5.1 / 20260501)를 2026.05.01 로
function dot(v){var m=String(v||'').match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/);
  return m?(m[1]+'.'+('0'+m[2]).slice(-2)+'.'+('0'+m[3]).slice(-2)):String(v||'');}

// ── 토지(국토부 실거래가·KAIS) ── 토지건물.html 과 같은 로직
// 엑셀에서 머리글째 복사한 표. 머리글이 여러 번 나올 수 있고(토지 블록 + 건물 블록 따로 복사),
// 같은 소재지·거래일·금액의 토지 행과 건물 행은 한 사례로 합친다.
function parseTsv(text){
  text=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  var rows=[],row=[],cur='',q=false;
  for(var i=0;i<text.length;i++){var ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}
    else{if(ch==='"')q=true;else if(ch==='\t'){row.push(cur);cur='';}
      else if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur='';}else cur+=ch;}}
  if(cur!==''||row.length){row.push(cur);rows.push(row);}
  return rows.map(function(r){return r.map(function(c){return String(c).replace(/\s+/g,' ').trim();});})
             .filter(function(r){return r.join('').trim();});
}
function norm(s){return String(s||'').replace(/[\s"']/g,'');}
function pick(head,r,names){
  var i,j,t;
  for(i=0;i<names.length;i++){t=norm(names[i]);for(j=0;j<head.length;j++)if(norm(head[j])===t)return r[j]||'';}
  for(i=0;i<names.length;i++){t=norm(names[i]);for(j=0;j<head.length;j++)if(norm(head[j]).indexOf(t)>=0)return r[j]||'';}
  return '';
}
function tradeKey(c){return (c.loc||'').trim()+'|'+(c.date||'')+'|'+num(c.total);}
function mergeRec(c,rc){
  var kind=rc.kind||'';
  if(/토지/.test(kind)){c.landA=rc.landA||rc.area||c.landA;}
  else if(/건물/.test(kind)){c.bldA=rc.bldA||rc.area||c.bldA;}
  else{c.landA=c.landA||rc.landA;c.bldA=c.bldA||rc.bldA||rc.area;}
  ['loc','use','jimok','appr','struct','total','date'].forEach(function(f){if(!hasV(c[f])&&hasV(rc[f]))c[f]=rc[f];});
}
function parseLand(text,defKind){
  var rows=parseTsv(text);
  if(rows.length<2)return {err:'머리글 + 데이터 행이 필요합니다. 엑셀에서 머리글째 복사하세요.'};
  var isHead=function(r){var j=r.join('');return j.indexOf('소재지')>=0&&(j.indexOf('지번')>=0||j.indexOf('물건금액')>=0||j.indexOf('거래')>=0);};
  var head=null,recs=[];
  rows.forEach(function(r){
    if(isHead(r)){head=r;return;}
    if(!head)return;
    recs.push({kind:pick(head,r,['상세물건구분','물건구분'])||defKind||'',
      loc:(pick(head,r,['소재지'])+' '+pick(head,r,['지번'])).trim(),
      use:shortY(pick(head,r,['용도지역'])),jimok:pick(head,r,['지목']),
      landA:pick(head,r,['토지면적']),bldA:pick(head,r,['건물면적','연면적']),
      area:pick(head,r,['전용면적'])||pick(head,r,['전체면적','면적']),
      appr:dot(pick(head,r,['사용승인일자','사용승인일'])),struct:pick(head,r,['건물구조','주구조','구조']),
      total:pick(head,r,['물건금액','거래금액','총거래금액']),date:dot(pick(head,r,['거래시점','거래일자']))});
  });
  if(!head)return {err:'머리글(소재지·지번 등)을 찾지 못했습니다. 엑셀에서 머리글째 복사하세요.'};
  recs=recs.filter(function(c){return c.loc.trim()||num(c.total);});
  if(!recs.length)return {err:'데이터 행을 읽지 못했습니다.'};
  var out=[],map={},merged=0;
  recs.forEach(function(rc){
    var key=tradeKey(rc),c=map[key];
    if(!c){c={_n:0};map[key]=c;out.push(c);}
    c._n++;if(c._n===2)merged++;
    mergeRec(c,rc);
  });
  out.forEach(function(c){delete c._n;});
  return {out:out,merged:merged};
}

// ── 집합건물(카이스) ── s3r86w8a.html 의 parseKaisRow 와 같은 로직
function preTSV(text){var r='',q=false;
  for(var i=0;i<text.length;i++){var c=text[i];
    if(c==='"')q=!q;else if(c==='\n'&&q)r+=' ';else r+=c;}
  return r;}
function parseTSV(text){
  var lines=preTSV(String(text||'')).split('\n').filter(function(l){return l.trim();});
  if(lines.length<2)return {h:[],rows:[]};
  var h=lines[0].split('\t').map(function(x){return x.replace(/"/g,'').trim();});
  var rows=lines.slice(1).map(function(l){
    var cells=l.split('\t').map(function(c){return c.trim();}),o={};
    h.forEach(function(k,i){o[k]=cells[i]||'';});return o;});
  return {h:h,rows:rows};
}
function pNum(v){if(v==null)return null;var n=parseFloat(String(v).replace(/,/g,'').trim());return isNaN(n)?null:n;}
function pStr(v){return v==null?'':String(v).trim();}
function parseJip(text){
  var r=parseTSV(text);
  if(!r.rows.length)return {err:'머리글 + 데이터 행이 필요합니다. 카이스에서 머리글째 복사하세요.'};
  var out=r.rows.map(function(row){
    var addr=row['기타주소']||'',dn='',fl='',ho='',apt=addr;
    var m1=addr.match(/(\d+)동/);if(m1)dn=m1[1];
    var m2=addr.match(/(\d+)호/);if(m2)ho=m2[1];
    if(ho&&ho.length>=3)fl=ho.substring(0,ho.length-2);
    apt=apt.replace(/\d+동.*/,'').replace(/외\s*\d+필지\s*/,'').trim();
    var area=pNum(row['전용면적']),price=pNum(row['물건금액']),unitTsv=pNum(row['단가']);
    return {location:pStr(row['소재지']),jibun:pStr(row['지번']),address:addr,aptName:apt,
      dong:dn,floor:fl,ho:ho,tradeDate:dot(pStr(row['거래시점'])),exclusiveArea:area,price:price,
      unitPrice:unitTsv||(price&&area?Math.round(price/area):null),
      approvalDate:dot(pStr(row['사용승인일자']))};
  }).filter(function(c){return c.location||c.address||c.price;});
  if(!out.length)return {err:'데이터 행을 읽지 못했습니다. 소재지·물건금액 열이 있는지 확인해 주세요.'};
  return {out:out};
}

// ── 평가사례(감정평가정보센터 KAPA) ── 토지건물.html 의 parseApprText 와 같은 로직 + 추가 칸
// 원본 칸: no, loc(동 + 지번), use, jimok, cond(이용상황), unit(단가), base(기준시점), purp(평가목적)
// 추가 칸: locFull(시·구까지 + 지번 — 지도 조회용), obj(물건: 토지·집합건물…), area, total, gongsi, gongsiYear, road, shape
// 면적은 「평가액/면적」 머리에 잘못 걸리지 않게 이름이 딱 맞는 칸만 본다.
function pickExact(head,r,names){
  for(var i=0;i<names.length;i++){var t=norm(names[i]);for(var j=0;j<head.length;j++)if(norm(head[j])===t)return r[j]||'';}
  return '';
}
function parseAppr(text){
  var rows=parseTsv(text);
  var hi=-1;for(var i=0;i<Math.min(rows.length,4);i++)if(rows[i].join('').indexOf('평가목적')>=0){hi=i;break;}
  if(hi<0)return {err:'머리글(평가목적 등)을 찾지 못했습니다. 감정평가정보센터에서 머리글째 복사하세요.'};
  var head=rows[hi],out=[];
  for(var i=hi+1;i<rows.length;i++){var r=rows[i];
    var full=pick(head,r,['소재지']).trim(),loc=full.split(' ').filter(Boolean).pop()||'';
    var raw=pick(head,r,['지번'])||pick(head,r,['지번(*)']),jib=raw.replace(/\*/g,'').trim();   // 온전한 지번 칸이 비면 가린 칸이라도
    out.push({no:'',loc:(loc+' '+jib).trim(),use:pick(head,r,['(개별)용도지역','용도지역/구조','용도지역']),
      jimok:pick(head,r,['(개별)지목','지목/건물용도','지목']),cond:pick(head,r,['(개별)이용상황','이용상황']),
      unit:pick(head,r,['단가']),base:pick(head,r,['기준시점']),purp:pick(head,r,['평가목적']),
      masked:/\*/.test(raw),locFull:(full+' '+jib.replace(/\s+/g,'')).trim(),obj:pickExact(head,r,['물건','물건구분']),
      area:pickExact(head,r,['면적','토지면적','평가면적','공부면적']),
      total:pick(head,r,['감정평가총액','평가액(개별)']),gongsi:pick(head,r,['(개별)공시지가','개별공시지가','공시지가']),
      gongsiYear:pick(head,r,['(개별)공시연도','공시연도']),road:pick(head,r,['(개별)도로교통','도로교통','도로조건']),
      shape:pick(head,r,['(개별)형상','형상'])});}
  out=out.filter(function(a){return a.loc.trim()||num(a.unit);});
  if(!out.length)return {err:'데이터 행을 읽지 못했습니다. 머리글째 다시 복사해보세요.'};
  return {out:out};
}

window.ArapKais={parseAppr:parseAppr,parseLand:parseLand,parseJip:parseJip,parseTsv:parseTsv,pick:pick,dot:dot,shortY:shortY};
})();
