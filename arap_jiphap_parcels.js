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
  g.ArapJiphapParcels=parcels;
})(typeof window==='undefined'?globalThis:window);
