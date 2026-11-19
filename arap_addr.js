/* arap_addr.js — 도로명주소로 넣어도 지번(PNU)으로 찾게 하는 공용 도우미 (2026-11-15)
 * 브이월드 주소검색은 category=parcel(지번)일 때만 id가 PNU(19자리)다. 도로명(category=road) 결과는 id가 PNU가 아니라서
 * 그 결과에 붙어 오는 지번 주소로 한 번 더 지번 검색을 한다(apt_nearby.html findSubject·arap_bldrgst.js search와 같은 방식).
 * 쓰는 곳: 토지건물·기준시가·집합건물_기준시가(condo-standard-ui.js)·건축물대장·토지조회·arap_map.js(위치도 주소 찾기)
 *
 * ArapAddr.resolve(q, search) → Promise<[{id(PNU), addr(지번), road(도로명), item(지번 검색 원본)}]>
 *   search(query, category) → Promise<items 배열>  (각 화면의 브이월드 호출 함수를 넘긴다. 실패·결과 없음은 [] 또는 throw)
 */
(function(){
  var SIDO=/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)/;
  function txt(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();}
  // 「갯벌로 72」「세무서2길 64」「테헤란로 123」 — '…로/길 숫자'가 있고 '동/리/가 숫자'(지번)가 없으면 도로명
  function looksRoad(q){q=txt(q);return /(로|길)\s*\d+/.test(q)&&!/[동리가]\s*(산\s*)?\d+(-\d+)?\s*$/.test(q);}
  // 도로명 검색 결과 한 줄 → 지번 주소. 시·도가 빠져 있으면 도로명 주소 앞부분(시·도 시·군·구)을 붙인다
  function parcelOf(it){
    var a=(it&&it.address)||{},road=txt(a.road)||txt(it&&it.title),parcel=txt(a.parcel);
    if(!parcel)return null;
    if(!SIDO.test(parcel)){var m=road.match(/^(\S+\s+\S+(?:구|군|시)(?:\s+\S+(?:구|군))?)\s/);if(m)parcel=m[1]+' '+parcel;}
    return {parcel:parcel,road:road};
  }
  function safe(p){return Promise.resolve().then(p).then(function(a){return Array.isArray(a)?a:[];},function(){return [];});}
  function parcelHits(items,q,road){
    var seen={},out=[];
    (items||[]).forEach(function(it){
      var id=String(it&&it.id||'');if(!/^\d{19}$/.test(id)||seen[id])return;seen[id]=1;
      var a=it.address||{};
      out.push({id:id,addr:txt(a.parcel)||txt(a.road)||txt(it.title)||q,road:road||txt(a.road),item:it});
    });
    return out;
  }
  function viaRoad(q,search){
    return safe(function(){return search(q,'road');}).then(function(list){
      var seen={},jobs=[];
      list.forEach(function(it){
        var p=parcelOf(it);if(!p||seen[p.parcel])return;seen[p.parcel]=1;
        jobs.push(safe(function(){return search(p.parcel,'parcel');}).then(function(pl){return parcelHits(pl,p.parcel,p.road).slice(0,1);}));
      });
      return Promise.all(jobs.slice(0,10));
    }).then(function(groups){
      var seen={},out=[];
      groups.forEach(function(g){g.forEach(function(h){if(!seen[h.id]){seen[h.id]=1;out.push(h);}});});
      return out;
    });
  }
  function resolve(q,search){
    q=txt(q);if(!q)return Promise.resolve([]);
    var parcelFirst=function(){return safe(function(){return search(q,'parcel');}).then(function(l){return parcelHits(l,q);});};
    if(looksRoad(q))return viaRoad(q,search).then(function(r){return r.length?r:parcelFirst();});
    return parcelFirst().then(function(r){return r.length?r:viaRoad(q,search);});
  }
  window.ArapAddr={looksRoad:looksRoad,parcelOf:parcelOf,resolve:resolve};
})();
