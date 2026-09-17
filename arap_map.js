/*
  온결 공용 지도 엔진 (arap_map.js)  →  window.ArapMap

  하는 일: 소재지 문자열 → 브이월드 주소검색으로 위·경도 → Leaflet 지도에 색깔 핀.
  쓰는 곳: 토지건물.html(위치도 탭), 거래사례 지도 페이지.
  ※ 이 파일을 고치면 두 화면 모두에 반영된다. 반대로 한쪽에서만 필요한 건 여기 넣지 말 것.

  쓰는 방법 — <script src="arap_map.js"></script> 뒤에
    var M = ArapMap.create({
      box:'mapBox',              // 지도가 들어갈 빈 div의 id (높이를 CSS로 줘야 함)
      status:'mapStatus',        // (선택) 상태줄 element id
      miss:'mapMiss',            // (선택) 못 찾은 항목 안내 element id
      baseSel:'mapBaseSel',      // (선택) 바탕지도 <select> id — 값 Base/Satellite/Hybrid/osm
      cadastre:'mapCadastre',    // (선택) 지적선 체크박스 id
      zoning:'mapZoning',        // (선택) 용도지역 체크박스 id
      key:function(){...},       // 브이월드 키를 주는 함수
      onSave:function(){...}     // 좌표가 바뀌었을 때(핀 드래그·조회 성공) 호출 — 저장용
    });
    M.open();                    // 지도 띄우기(처음이면 Leaflet 내려받기) + 새로고침
    M.refresh(items, force);     // items = [{o, kind, label, color, loc, region, pick}]
       o      : 좌표를 붙여 둘 객체 — 조회 결과를 o._xy 에 넣는다(호출한 쪽이 저장하면 됨)
       kind   : '본건' 같은 분류 (팝업에 표시, '본건'이면 거리 기준점이 된다)
       label  : 핀 이름표
       color  : 핀 색
       loc    : 소재지 문자열
       region : 시·군·구가 없을 때 앞에 붙일 지역(본건 시군구) — 없으면 ''
       pick   : true면 굵게 강조

  좌표는 `o._xy = {x:경도, y:위도, addr, q:조회에 쓴 질의문, manual:직접 옮김}`.
  `_xy.q`가 지금 만든 질의문과 같으면 다시 조회하지 않는다(통신 아낌 + 직접 옮긴 핀 보존).
  ※ 항목 객체에 `_`로 시작하는 키를 넣으므로, 그 객체의 "내용 있음" 판정에서 `_` 키는 빼야 한다.
*/
(function(){
'use strict';

var LEAFLET_JS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
var LEAFLET_CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
var SEARCH_BASE='https://api.vworld.kr/req/search';
var loading=null;

// 핀 모양 — 색 원 + 그 옆 이름표. 지도 위에서 글자가 묻히지 않게 흰 바탕을 깐다.
var CSS=[
'.mkr{position:relative;width:0;height:0;}',
'.mkr .dot{position:absolute;left:-8px;top:-8px;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);}',
'.mkr.pick .dot{width:22px;height:22px;left:-11px;top:-11px;border-width:4px;}',
'.mkr .lab{position:absolute;left:11px;top:-10px;white-space:nowrap;font-size:11.5px;font-weight:700;color:#0f172a;background:rgba(255,255,255,.88);border-radius:3px;padding:1px 5px;box-shadow:0 1px 3px rgba(0,0,0,.25);}',
'.mkr.pick .lab{left:14px;background:#0f172a;color:#fff;}',
'.arap-lgd{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:4px;vertical-align:-1px;}'
].join('\n');

function injectCss(){
  if(document.getElementById('arap-map-css'))return;
  var s=document.createElement('style');s.id='arap-map-css';s.textContent=CSS;document.head.appendChild(s);
}
// Leaflet은 지도를 처음 쓸 때만 내려받는다(페이지 첫 로딩을 늦추지 않으려고)
function load(){
  if(window.L&&window.L.map)return Promise.resolve();
  if(loading)return loading;
  loading=new Promise(function(res,rej){
    var css=document.createElement('link');css.rel='stylesheet';css.href=LEAFLET_CSS;document.head.appendChild(css);
    var s=document.createElement('script');s.src=LEAFLET_JS;
    s.onload=function(){res();};
    s.onerror=function(){loading=null;rej(new Error('지도 라이브러리를 내려받지 못했습니다 — 인터넷 연결을 확인해 주세요.'));};
    document.head.appendChild(s);
  });
  return loading;
}

function el(id){return id?document.getElementById(id):null;}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}

// "서울특별시 중랑구 상봉동 74-6" → "서울특별시 중랑구" (동·읍·면·리·가 앞까지)
function sggOfAddr(addr){
  var out=[],ts=String(addr||'').trim().split(/\s+/);
  for(var i=0;i<ts.length;i++){
    if(/(동|읍|면|리|가)$/.test(ts[i])&&i>0)break;
    if(/^\d/.test(ts[i]))break;
    out.push(ts[i]);
  }
  return out.join(' ');
}
// "자양동 617-33"처럼 시·군·구가 없는 주소는 기준 지역을 앞에 붙인다 — 다른 지역 같은 동 이름에 잘못 찍히는 걸 막으려고
function query(loc,region){
  var s=String(loc||'').trim().replace(/\s+/g,' ');
  if(!s||!region)return s;
  var sido=String(region).split(' ')[0];
  if(sido&&s.indexOf(sido)===0)return s;             // 이미 시·도로 시작
  if(/(시|군|구)$/.test(s.split(' ')[0]))return s;    // 이미 시군구로 시작
  return region+' '+s;
}

// ── 주소 → 좌표 ──
// 브이월드 주소검색 응답의 point(x=경도, y=위도)를 쓴다. 화면을 가리지 않도록 JSONP까지만 시도한다.
var GEO={};   // 질의문 → {x,y,addr,q} | null(못 찾음)
function jsonp(url){
  return new Promise(function(res,rej){
    var cb='arapMapCb'+Math.random().toString(36).slice(2,9);
    var s=document.createElement('script'),done=false;
    var clean=function(){if(s.parentNode)s.parentNode.removeChild(s);try{delete window[cb];}catch(e){window[cb]=undefined;}};
    window[cb]=function(d){done=true;clean();res(d);};
    s.src=url+'&callback='+cb;
    s.onerror=function(){clean();rej(new Error('주소 조회 실패'));};
    document.head.appendChild(s);
    setTimeout(function(){if(!done){clean();rej(new Error('주소 조회 시간 초과'));}},12000);
  });
}
function geocode(q,key){
  if(!q)return Promise.resolve(null);
  if(GEO[q]!==undefined)return Promise.resolve(GEO[q]);
  var url=SEARCH_BASE+'?service=search&request=search&version=2.0&size=5&page=1&query='+
    encodeURIComponent(q)+'&type=address&category=parcel&format=json&errorformat=json&key='+key;
  return fetch(url).then(function(r){return r.json();}).catch(function(){return jsonp(url);}).then(function(d){
    var items=(d&&d.response&&d.response.result&&d.response.result.items)||[],it=items[0],p=it&&it.point;
    var x=p&&parseFloat(p.x),y=p&&parseFloat(p.y);
    var v=(isFinite(x)&&isFinite(y))?
      {x:x,y:y,addr:(it.address&&(it.address.parcel||it.address.road))||it.title||q,q:q}:null;
    GEO[q]=v;return v;
  }).catch(function(e){console.error('지오코딩 실패',q,e);GEO[q]=null;return null;});
}
// 두 지점 사이 직선거리(m) — 하버사인
function dist(a,b){
  var R=6371000,rad=Math.PI/180,dy=(b.y-a.y)*rad,dx=(b.x-a.x)*rad,y1=a.y*rad,y2=b.y*rad;
  var h=Math.sin(dy/2)*Math.sin(dy/2)+Math.cos(y1)*Math.cos(y2)*Math.sin(dx/2)*Math.sin(dx/2);
  return Math.round(2*R*Math.asin(Math.min(1,Math.sqrt(h))));
}
function distText(m){return m>=1000?(m/1000).toFixed(2)+'km':m+'m';}

// ── 지도 하나 ──
function create(opt){
  opt=opt||{};
  var getKey=opt.key||function(){return '';};
  var onSave=opt.onSave||function(){};
  var map=null,layers={},markers=[],tileFail=0,wmsWarned=false,items=[];

  function status(msg,err){
    var e=el(opt.status);if(!e)return;
    e.className=(opt.statusClass||'status')+(err?' err':'');e.textContent=msg;
  }
  function vworldTile(kind){
    return L.tileLayer('https://api.vworld.kr/req/wmts/1.0.0/'+getKey()+'/'+kind+'/{z}/{y}/{x}.'+(kind==='Satellite'?'jpeg':'png'),
      {minZoom:6,maxZoom:19,attribution:'&copy; 국토교통부 브이월드'});
  }
  function osmTile(){
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {minZoom:6,maxZoom:19,attribution:'&copy; OpenStreetMap'});
  }
  function vworldWms(layer,opacity){
    return L.tileLayer.wms('https://api.vworld.kr/req/wms?',
      {layers:layer,styles:layer,format:'image/png',transparent:true,version:'1.3.0',
       key:getKey(),domain:location.origin,maxZoom:19,opacity:opacity});
  }
  // 브이월드 타일이 여러 장 연달아 실패하면 바탕지도를 OSM으로 바꾼다(핀은 그대로 보이게)
  function onTileError(){
    if(++tileFail!==8)return;
    var sel=el(opt.baseSel);
    if(!sel||sel.value==='osm')return;
    sel.value='osm';setBase();
    status('브이월드 바탕지도를 불러오지 못해 OSM 지도로 바꿨습니다(핀 위치는 그대로). 지적선도 안 보이면 브이월드 키에 이 주소가 등록돼 있는지 확인이 필요합니다.',true);
  }
  // 도면(WMS)이 막히면 조용히 안 그려지기만 하므로 한 번 알려 준다
  function onWmsError(name){
    return function(){
      if(wmsWarned)return;
      if((this._arapFail=(this._arapFail||0)+1)<6)return;
      wmsWarned=true;
      status(name+' 도면을 불러오지 못했습니다 — 브이월드 키에 이 주소와 2D지도(WMS) 사용이 등록돼 있는지 확인이 필요합니다. 핀 위치는 그대로입니다.',true);
    };
  }
  function setBase(){
    if(!map)return;
    var sel=el(opt.baseSel),v=(sel&&sel.value)||'Base';
    if(layers.base)map.removeLayer(layers.base);
    tileFail=0;
    layers.base=(v==='osm')?osmTile():vworldTile(v);
    layers.base.on('tileerror',onTileError);
    layers.base.addTo(map);layers.base.bringToBack();
  }
  function toggleOverlay(){
    if(!map)return;
    [[opt.cadastre,'cad','lp_pa_cbnd_bubun',0.9,'지적선'],[opt.zoning,'zon','lt_c_uq111',0.35,'용도지역']].forEach(function(t){
      if(!t[0])return;
      var box=el(t[0]),on=!!(box&&box.checked);
      if(on&&!layers[t[1]]){
        layers[t[1]]=vworldWms(t[2],t[3]);
        layers[t[1]].on('tileerror',onWmsError(t[4]));
        layers[t[1]].addTo(map);
      }else if(!on&&layers[t[1]]){map.removeLayer(layers[t[1]]);layers[t[1]]=null;}
    });
  }

  function subjectLL(){
    for(var i=0;i<items.length;i++){
      var it=items[i];
      if(it.kind==='본건'&&it.xy&&isFinite(it.xy.x))return it.xy;
    }
    return null;
  }
  function popup(it){
    var s='<b>'+esc(it.label)+'</b> <span style="color:#626b78">'+esc(it.kind)+'</span><br>'+esc(it.xy.addr||it.loc);
    if(it.info)s+='<br><span style="color:#334155">'+esc(it.info)+'</span>';
    var base=subjectLL();
    if(base&&it.kind!=='본건'&&base!==it.xy)s+='<br><span style="color:#475569">본건에서 직선 '+distText(dist(base,it.xy))+'</span>';
    if(it.xy.manual)s+='<br><span style="color:#b45309">직접 옮긴 위치</span>';
    return s;
  }
  function draw(){
    markers.forEach(function(m){map.removeLayer(m);});markers=[];
    var pts=[];
    items.forEach(function(it){
      if(!it.xy)return;
      var ll=[it.xy.y,it.xy.x];pts.push(ll);
      var icon=L.divIcon({className:'',iconSize:[0,0],iconAnchor:[0,0],
        html:'<div class="mkr'+(it.pick?' pick':'')+'"><div class="dot" style="background:'+it.color+'"></div>'+
             '<div class="lab">'+esc(it.label)+'</div></div>'});
      var m=L.marker(ll,{icon:icon,draggable:true,title:it.label+' — '+it.loc,zIndexOffset:it.pick?1000:0}).addTo(map);
      m.bindPopup(popup(it));
      m.on('dragend',function(){
        var p=m.getLatLng();
        it.xy=it.o._xy={x:p.lng,y:p.lat,addr:it.xy.addr,q:it.xy.q,manual:true};
        m.setPopupContent(popup(it));onSave();
        status('📍 '+it.label+' 위치를 직접 옮겼습니다(저장됨). 「주소 다시 찾기」를 누르면 되돌아갑니다.');
      });
      markers.push(m);
    });
    if(pts.length===1)map.setView(pts[0],17);
    else if(pts.length>1)map.fitBounds(L.latLngBounds(pts),{padding:[45,45],maxZoom:17});
  }

  // force=true면 저장해 둔 좌표(직접 옮긴 핀 포함)를 버리고 주소를 다시 조회한다
  function refresh(list,force){
    if(!window.L||!map)return Promise.resolve();
    items=(list||[]).filter(function(it){return it&&String(it.loc||'').trim();});
    var missEl=el(opt.miss);
    if(!items.length){
      draw();if(missEl)missEl.innerHTML='';
      status(opt.emptyMsg||'소재지가 입력된 항목이 없습니다.');
      return Promise.resolve();
    }
    status('주소 조회 중… (0/'+items.length+')');
    var done=0,miss=[],key=getKey();
    return Promise.all(items.map(function(it){
      var q=query(it.loc,it.region),cached=it.o._xy;
      var usable=cached&&isFinite(cached.x)&&isFinite(cached.y);
      if(!force&&usable&&cached.q===q){it.xy=cached;done++;return Promise.resolve();}
      return geocode(q,key).then(function(v){
        done++;status('주소 조회 중… ('+done+'/'+items.length+')');
        if(v){it.xy=it.o._xy=v;return;}
        if(usable){it.xy=cached;miss.push(it.label+'(주소 재조회 실패 — 이전 위치 유지)');return;}
        miss.push(it.label+' “'+it.loc+'”');
      });
    })).then(function(){
      draw();onSave();
      var ok=items.filter(function(i){return i.xy;}).length;
      status('✅ '+ok+'곳 표시'+(miss.length?(' · '+miss.length+'곳 실패'):'')+(force?' (주소로 다시 찾음)':''));
      if(missEl)missEl.innerHTML=miss.length?
        ('⚠️ 위치를 못 찾은 항목: <b>'+miss.map(esc).join('</b> / <b>')+'</b> — 소재지 칸의 지번을 확인하거나, 지도에서 비슷한 핀을 끌어다 놓아 주세요.'):'';
    });
  }

  // 지도를 띄우고(처음이면 Leaflet을 내려받고) 목록을 그린다. 숨어 있던 탭에서 열려도 크기를 다시 잡는다.
  function open(list,force){
    return load().then(function(){
      injectCss();
      if(!map){
        map=L.map(opt.box).setView(opt.center||[37.5665,126.9780],opt.zoom||16);
        setBase();toggleOverlay();
        L.control.scale({imperial:false}).addTo(map);
      }
      map.invalidateSize();
      return refresh(list===undefined?items:list,force);
    }).catch(function(e){status(e.message,true);});
  }

  return {
    open:open, refresh:refresh, setBase:setBase, toggleOverlay:toggleOverlay,
    status:status, items:function(){return items;},
    leaflet:function(){return map;}, markers:function(){return markers;}
  };
}

window.ArapMap={create:create,load:load,geocode:geocode,query:query,sggOfAddr:sggOfAddr,dist:dist,distText:distText};
})();
