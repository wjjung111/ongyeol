/* 집합건물 공통 필지 목록: 토지이용계획과 위치도가 같은 필지를 사용한다. */
(function(g){
  'use strict';
  function parcels(ov){
    if(typeof ov==='string')ov={jibun:ov};ov=ov||{};
    var address=String(ov.jibun||'').replace(/외\s*\d+\s*필지.*$/,'').trim();
    var prefix=(address.match(/^(.*[동읍면리가])\s+(?:산\s*)?\d/)||[])[1]||'';
    var out=[],seen={};
    function add(value,area){
      var text=String(value||'').trim(),full=text.match(/^(.*[동읍면리가])\s+((?:산\s*)?\d+(?:-\d+)?)\s*(?:번지)?$/);
      var pre=full?full[1]:prefix,tail=full?full[2]:text;
      if(!/^(?:산\s*)?\d+(?:-\d+)?\s*(?:번지)?$/.test(tail))return;
      var jibun=tail.replace(/번지$/,'').replace(/산\s+/,'산').trim(),loc=[pre,jibun].filter(Boolean).join(' ');
      if(seen[loc]){if(area)seen[loc].area=area;return;}
      var p={jibun:jibun,address:loc,area:area||''};seen[loc]=p;out.push(p);
    }
    // 공부에서 인식한 순서를 유지하여 기존 필지별 입력과 맞춘다.
    (Array.isArray(ov.landParcels)?ov.landParcels:[]).forEach(function(p){if(p)add(p.jibun,p.area);});
    address.replace(prefix,'').split(/[,，、;\n]+/).forEach(function(p){add(p);});
    return out;
  }
  // 대지권 면적(㎡) — 등기 대지권비율 「분모분의 분자」에서 분모가 대지면적과 다르면 분자는 면적이 아님
  //   → 대지면적 × 분자 ÷ 분모 (2026-11-20 사용자: 서초삼풍 144012.4 × 73.47 ÷ 163672 = 64.65, 그 2/10 지분 = 12.93)
  //   대지면적 = 등기 「대지권의 목적인 토지」 필지 면적 합, 없으면 대지면적 칸. 분모가 없거나 대지면적과 같으면 분자 그대로(종전)
  //   단일호수 명세표 H38(대지면적×분자/분모)과 같은 계산. unitDen = 호별 분모(여러 호수, 건물 공통과 다를 때)
  function toN(v){if(v==null||String(v).trim()==='')return null;var n=Number(String(v).replace(/,/g,''));return isFinite(n)?n:null;}
  function landTotal(ov){ov=ov||{};
    var t=(Array.isArray(ov.landParcels)?ov.landParcels:[]).filter(function(p){return p&&p.jibun;}).reduce(function(a,p){return a+(toN(p.area)||0);},0);
    return t>0?t:(toN(ov.landAreaTotal)||0);}
  function landRightArea(ov,numer,unitDen){var n=toN(numer);if(n==null)return null;
    var den=toN(unitDen)||toN(ov&&ov.landRatioDenom),tot=landTotal(ov);
    if(!den||!tot||Math.abs(tot-den)<0.0001)return n;
    return tot*n/den;}
  // 서류 표기 문자열 — 바뀌지 않으면 입력 그대로, 계산하면 분자 소수 자릿수(최소 2)로 반올림(사정면적 옵션이 절사면 절사)
  function landRightText(ov,numer,unitDen){var n=toN(numer),v=landRightArea(ov,numer,unitDen);
    if(v==null||v===n)return numer==null?'':String(numer);
    var dp=Math.max(2,(String(numer).split('.')[1]||'').length),f=Math.pow(10,dp),x=v*f+1e-7;
    return ((ov&&ov.areaRound==='floor'?Math.floor(x):Math.round(x))/f).toFixed(dp);}
  parcels.landRightArea=landRightArea;parcels.landRightText=landRightText;parcels.landTotal=landTotal;
  g.ArapJiphapParcels=parcels;
})(typeof window==='undefined'?globalThis:window);
