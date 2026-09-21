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
    M.setVisible({'평가사례':false});  // 분류(kind)별 보이기/숨기기 — 화면 위치는 그대로 두고 다시 그린다
                                      //   준 분류만 바뀌고 나머지는 그대로. 숨겨도 항목·좌표는 남는다.
       o      : 좌표를 붙여 둘 객체 — 조회 결과를 o._xy 에 넣는다(호출한 쪽이 저장하면 됨)
       kind   : '본건' 같은 분류 (팝업에 표시, '본건'이면 거리 기준점이 된다)
       label  : 핀 이름표
       labelGroup : 같은 값인 항목의 경계는 모두 표시하고 이름표는 하나만 표시(선택)
       boundaryLeader : 화살촉이 중심 대신 실제 필지 경계를 가리킴(선택)
       color  : 핀 색
       loc    : 소재지 문자열
       region : 시·군·구가 없을 때 앞에 붙일 지역(본건 시군구) — 없으면 ''
       pick   : true면 굵게 강조 + 필지 안쪽을 옅게 칠한다(안 주면 테두리만)

  좌표는 `o._xy = {x:경도, y:위도, addr, q:조회에 쓴 질의문, manual:직접 옮김}`.
  `_xy.q`가 지금 만든 질의문과 같으면 다시 조회하지 않는다(통신 아낌 + 직접 옮긴 핀 보존).
  ※ 항목 객체에 `_`로 시작하는 키를 넣으므로, 그 객체의 "내용 있음" 판정에서 `_` 키는 빼야 한다.
*/
(function(){
'use strict';

var LEAFLET_JS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
var LEAFLET_CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
var SEARCH_BASE='https://api.vworld.kr/req/search';
var DATA_BASE='https://api.vworld.kr/req/data';
var loading=null;

// 핀 모양 — 필지 도형이 있으면 테두리 + 화살표 이름표, 없으면 색 원 + 이름표.
// 지도 위에서 글자가 묻히지 않게 흰 바탕을 깐다.
var CSS=[
'.mkr{position:relative;width:0;height:0;}',
'.mkr .dot{position:absolute;left:-8px;top:-8px;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);}',
'.mkr.pick .dot{width:22px;height:22px;left:-11px;top:-11px;border-width:4px;}',
'.mkr .lab{position:absolute;left:11px;top:-10px;white-space:nowrap;font-size:11.5px;font-weight:700;color:#0f172a;background:rgba(255,255,255,.9);border-radius:3px;padding:1px 5px;box-shadow:0 1px 3px rgba(0,0,0,.25);}',
'.mkr.pick .lab{left:14px;background:#0f172a;color:#fff;}',
// 필지형: 이름표를 옆으로 빼고 화살표로 필지를 가리킨다(줌과 무관한 고정 픽셀 위치)
'.mkr.par .ldr{position:absolute;overflow:visible;pointer-events:none;z-index:1;}',
// z-index로 이름표를 화살표 위에 올린다 — 안 그러면 선이 글자를 가로지른다
'.mkr.par .lab{transform:translate(-50%,-50%);border:1.5px solid currentColor;background:#fff;padding:2px 7px;font-size:12px;z-index:2;}',
'.mkr.par.pick .lab{background:#0f172a;color:#fff;border-color:#0f172a;}',
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
    // 주소검색 결과의 id가 곧 PNU — 필지 도형을 지번으로 정확히 집을 때 쓴다
    var v=(isFinite(x)&&isFinite(y))?
      {x:x,y:y,addr:(it.address&&(it.address.parcel||it.address.road))||it.title||q,q:q,pnu:it.id||''}:null;
    GEO[q]=v;return v;
  }).catch(function(e){console.error('지오코딩 실패',q,e);GEO[q]=null;return null;});
}

// ── 필지 경계(연속지적도) ──
// 브이월드 데이터API(2.0)로 LP_PA_CBND_BUBUN 한 필지의 GeoJSON 도형을 받는다.
// PNU를 알면 지번으로 정확히 집고(attrFilter), 모르면(핀을 직접 옮긴 경우) 그 점이 속한 필지를 집는다(geomFilter).
var PARCEL={};   // pnu 또는 좌표 → geometry | null(못 받음)
function parcel(q,key){
  var id=q.pnu||('@'+Number(q.x).toFixed(6)+','+Number(q.y).toFixed(6));
  if(PARCEL[id]!==undefined)return Promise.resolve(PARCEL[id]);
  var url=DATA_BASE+'?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&version=2.0'+
    '&key='+key+'&domain='+encodeURIComponent(location.origin)+
    '&format=json&errorformat=json&size=1&page=1&geometry=true&attribute=false&crs=EPSG:4326'+
    (q.pnu?('&attrFilter=pnu:=:'+encodeURIComponent(q.pnu))
          :('&geomFilter='+encodeURIComponent('POINT('+q.x+' '+q.y+')')));
  return fetch(url).then(function(r){return r.json();}).catch(function(){return jsonp(url);}).then(function(d){
    var fc=d&&d.response&&d.response.result&&d.response.result.featureCollection;
    var f=fc&&fc.features&&fc.features[0],g=f&&f.geometry;
    var ok=g&&g.coordinates&&(g.type==='Polygon'||g.type==='MultiPolygon')?g:null;
    PARCEL[id]=ok;return ok;
  }).catch(function(e){console.error('필지 도형 실패',id,e);PARCEL[id]=null;return null;});
}
// 저장소(localStorage)에 넣기엔 너무 큰 도형은 버린다 — 화면에는 그려도 저장은 안 한다
function geomFits(g){try{return JSON.stringify(g).length<=8000;}catch(e){return false;}}
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
  var map=null,layers={},markers=[],shapes=[],tileFail=0,wmsWarned=false,items=[];
  var hidden={};   // 분류(kind) → true면 지도에서 감춘다. 항목·좌표는 그대로 두고 그리기만 건너뛴다.

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

  // ── 분류(kind)별 보이기/숨기기 ──
  // 준 분류만 바꾸고(예 {'평가사례':false}) 나머지는 그대로 둔다. 항목·좌표·이름표 위치는 그대로라
  // 다시 켜면 있던 자리에 그대로 돌아온다. 기본은 화면 위치 유지 — refit=true면 보이는 것에 맞춰 다시 맞춘다.
  function setVisible(m,refit){
    if(m)Object.keys(m).forEach(function(k){if(m[k])delete hidden[k];else hidden[k]=true;});
    if(map&&window.L)draw(!refit);
    return hidden;
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
  // 이름표를 빼낼 방향(단위벡터). 가까운 필지끼리 이름표가 겹치지 않게 차례로 돌려 쓴다.
  var DIRS=[[0.78,-0.63],[-0.78,-0.63],[0.78,0.63],[-0.78,0.63],[0,-1],[0,1],[1,0],[-1,0]];
  // 이름표를 필지 **바깥**에 놓는다. 확대하면 필지가 화면에서 커지므로 그만큼 더 밀어낸다 —
  // 고정 거리로 두면 확대했을 때 이름표가 필지 안에 파묻혀 화살표가 뜻을 잃는다.
  // 평가사가 직접 끌어다 놓은 이름표는 그 자리를 그대로 지킨다(자동 배치보다 우선).
  function labelOffset(it,n,poly){
    var man=it.xy&&it.xy.labOff;
    if(man&&isFinite(man[0])&&isFinite(man[1]))return [man[0],man[1]];
    var d=DIRS[n%DIRS.length],away=46;
    if(poly&&map){
      var pb=poly.getBounds();
      if(pb.isValid()){
        var nw=map.latLngToLayerPoint(pb.getNorthWest()),se=map.latLngToLayerPoint(pb.getSouthEast());
        var hw=Math.abs(se.x-nw.x)/2,hh=Math.abs(se.y-nw.y)/2;
        var tx=Math.abs(d[0])>0.01?hw/Math.abs(d[0]):Infinity;
        var ty=Math.abs(d[1])>0.01?hh/Math.abs(d[1]):Infinity;
        away=Math.min(tx,ty)+30;           // 필지 테두리에서 30px 떨어뜨린다
      }
    }
    away=it.labelGroup?Math.max(44,away):Math.max(44,Math.min(away,150));  // 너무 붙지도, 화면 밖으로 날아가지도 않게
    return [Math.round(d[0]*away),Math.round(d[1]*away)];
  }
  // 선택한 필지 묶음의 실제 경계 중 이름표에 가장 가까운 점(화살촉 위치).
  function boundaryTip(it,poly,dx,dy){
    if(!it.boundaryLeader||!poly||!map)return null;
    var origin=map.latLngToLayerPoint(poly.getBounds().getCenter()),best=null,dist2=Infinity;
    function ring(coords){
      for(var i=0;i<coords.length-1;i++){
        var a=map.latLngToLayerPoint([coords[i][1],coords[i][0]]),b=map.latLngToLayerPoint([coords[i+1][1],coords[i+1][0]]);
        var ax=a.x-origin.x,ay=a.y-origin.y,vx=b.x-a.x,vy=b.y-a.y;
        var den=vx*vx+vy*vy,t=den?Math.max(0,Math.min(1,((dx-ax)*vx+(dy-ay)*vy)/den)):0;
        var x=ax+t*vx,y=ay+t*vy,d=(dx-x)*(dx-x)+(dy-y)*(dy-y);
        if(d<dist2){dist2=d;best=[x,y];}
      }
    }
    function visit(g){
      if(!g)return;
      if(g.type==='FeatureCollection')g.features.forEach(visit);
      else if(g.type==='Feature')visit(g.geometry);
      else if(g.type==='GeometryCollection')g.geometries.forEach(visit);
      else if(g.type==='Polygon')ring(g.coordinates[0]);
      else if(g.type==='MultiPolygon')g.coordinates.forEach(function(p){ring(p[0]);});
    }
    visit(poly.toGeoJSON());return best;
  }
  // 이름표 → 필지로 향하는 화살표. 아이콘 원점(필지 중심)이 SVG 한가운데에 오게 놓는다.
  function leader(dx,dy,color,tip){
    var W=420,H=420,cx=W/2,cy=H/2;
    var ex=tip?tip[0]:0,ey=tip?tip[1]:0;
    var len=Math.sqrt((ex-dx)*(ex-dx)+(ey-dy)*(ey-dy))||1,ux=(ex-dx)/len,uy=(ey-dy)/len;   // 이름표 → 필지 방향
    var tx=cx+ex+(tip?0:ux*2),ty=cy+ey+(tip?0:uy*2);                                  // 화살촉 끝(필지 쪽)
    var bx=tx-ux*11,by=ty-uy*11;                                // 화살촉 밑변 중심
    var px=-uy*5,py=ux*5;
    return '<svg class="ldr" width="'+W+'" height="'+H+'" style="left:'+(-cx)+'px;top:'+(-cy)+'px">'+
      '<line x1="'+(cx+dx)+'" y1="'+(cy+dy)+'" x2="'+bx+'" y2="'+by+'" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>'+
      '<line x1="'+(cx+dx)+'" y1="'+(cy+dy)+'" x2="'+bx+'" y2="'+by+'" stroke="'+color+'" stroke-width="2" stroke-linecap="round"/>'+
      '<polygon points="'+[tx+','+ty,(bx+px)+','+(by+py),(bx-px)+','+(by-py)].join(' ')+
      '" fill="'+color+'" stroke="#fff" stroke-width="1"/></svg>';
  }
  function dotIcon(it){
    return L.divIcon({className:'',iconSize:[0,0],iconAnchor:[0,0],
      html:'<div class="mkr'+(it.pick?' pick':'')+'"><div class="dot" style="background:'+it.color+'"></div>'+
           '<div class="lab">'+esc(it.label)+'</div></div>'});
  }
  var LAB_TIP='끌어서 이름표만 옮깁니다(필지와 화살촉은 그대로). 두 번 누르면 제자리로.';
  function parcelIcon(it,n,poly){
    var o=labelOffset(it,n,poly),dx=o[0],dy=o[1];
    return L.divIcon({className:'',iconSize:[0,0],iconAnchor:[0,0],
      html:'<div class="mkr par'+(it.pick?' pick':'')+'" style="color:'+it.color+'">'+leader(dx,dy,it.color,boundaryTip(it,poly,dx,dy))+
           '<div class="lab" title="'+esc(it.boundaryLeader?'끌어서 이름표를 옮깁니다(화살촉은 필지 경계). 두 번 누르면 제자리로.':LAB_TIP)+'" style="left:'+dx+'px;top:'+dy+'px">'+esc(it.label)+'</div></div>'});
  }
  // 확대·축소하면 필지의 화면 크기가 달라지므로 이름표를 다시 밀어낸다(직접 옮긴 것은 그대로)
  var labeled=[];   // [{marker, it, n, poly}]
  function relabel(){
    labeled.forEach(function(r){r.marker.setIcon(parcelIcon(r.it,r.n,r.poly));bindLabelDrag(r);});
  }

  // ── 이름표 끌기 ──
  // 마커는 필지 중심에 못 박아 두고(=화살촉 고정), 끌면 이름표의 **화면 픽셀 오프셋**만 바꾼다.
  // 그래서 이름표와 화살표 꼬리만 따라 움직이고 필지·화살촉은 제자리에 있는다.
  // 옮긴 자리는 `_xy.labOff`에 저장돼 새로고침해도 유지된다. 다른 필지 위에 놓아도 그 필지를 고르지 않는다.
  function evPt(e){
    var t=(e.touches&&e.touches[0])||(e.changedTouches&&e.changedTouches[0])||e;
    return (t&&isFinite(t.clientX))?{x:t.clientX,y:t.clientY}:null;
  }
  function bindLabelDrag(r){
    var root=r.marker.getElement();if(!root)return;
    var wrap=root.querySelector('.mkr'),box=root.querySelector('.lab');
    if(!wrap||!box)return;
    var start=null,base=[0,0],moved=false;
    function paint(dx,dy){
      box.style.left=dx+'px';box.style.top=dy+'px';
      var svg=wrap.querySelector('svg.ldr');
      if(svg)svg.outerHTML=leader(dx,dy,r.it.color,boundaryTip(r.it,r.poly,dx,dy));
    }
    function onMove(e){
      var p=evPt(e);if(!p||!start)return;
      moved=true;
      paint(Math.round(base[0]+p.x-start.x),Math.round(base[1]+p.y-start.y));
      e.preventDefault();
    }
    function onUp(){
      document.removeEventListener('mousemove',onMove,true);
      document.removeEventListener('mouseup',onUp,true);
      document.removeEventListener('touchmove',onMove,{capture:true});
      document.removeEventListener('touchend',onUp,true);
      if(map.dragging)map.dragging.enable();
      if(moved){
        r.it.xy.labOff=[parseInt(box.style.left,10)||0,parseInt(box.style.top,10)||0];
        onSave();
        status('🏷️ '+r.it.label+' 이름표를 옮겼습니다(저장됨). '+(r.it.boundaryLeader?'화살촉은 필지 경계를 가리킵니다.':'필지와 화살촉은 그대로입니다.'));
      }else if(start){
        r.marker.openPopup();   // 끌지 않고 그냥 눌렀으면 종전처럼 설명을 띄운다
      }
      start=null;
    }
    function onDown(e){
      var p=evPt(e);if(!p)return;
      start=p;moved=false;
      base=labelOffset(r.it,r.n,r.poly);
      if(map.dragging)map.dragging.disable();
      document.addEventListener('mousemove',onMove,true);
      document.addEventListener('mouseup',onUp,true);
      document.addEventListener('touchmove',onMove,{passive:false,capture:true});
      document.addEventListener('touchend',onUp,true);
      e.preventDefault();e.stopPropagation();
    }
    box.style.cursor='move';
    box.addEventListener('mousedown',onDown);
    box.addEventListener('touchstart',onDown,{passive:false});
    // 클릭이 지도까지 올라가면 Leaflet이 방금 연 설명창을 바로 닫아 버린다
    box.addEventListener('click',function(e){e.stopPropagation();});
    // 두 번 누르면 자동 배치로 되돌린다(지도 확대가 같이 걸리지 않게 막는다)
    box.addEventListener('dblclick',function(e){
      e.preventDefault();e.stopPropagation();
      r.marker.closePopup();   // 두 번 누르면 첫 클릭으로 열린 설명이 남으므로 닫아 준다
      if(r.it.xy)delete r.it.xy.labOff;
      onSave();r.marker.setIcon(parcelIcon(r.it,r.n,r.poly));bindLabelDrag(r);
      status('🏷️ '+r.it.label+' 이름표를 제자리로 되돌렸습니다.');
    });
  }

  // 점 핀(집합건물)을 직접 옮기면 그 자리로 위치를 고친다
  function moved(it,p){
    it.xy=it.o._xy={x:p.lng,y:p.lat,addr:it.xy.addr,q:it.xy.q,manual:true};
    onSave();
    status('📍 '+it.label+' 위치를 직접 옮겼습니다(저장됨). 「주소 다시 찾기」를 누르면 되돌아갑니다.');
  }

  // keepView=true면 화면 위치를 그대로 두고 다시 그리기만 한다(핀을 옮긴 직후 등)
  function draw(keepView){
    markers.forEach(function(m){map.removeLayer(m);});markers=[];
    shapes.forEach(function(s){map.removeLayer(s);});shapes=[];
    labeled=[];
    var pts=[],bnd=null,n=0,groups=Object.create(null);
    items.forEach(function(it){
      if(!it.labelGroup||!it.xy||hidden[it.kind])return;
      var g=groups[it.labelGroup]||(groups[it.labelGroup]={leader:it,features:[]});
      if(it.xy.geom){g.features.push(it.xy.geom);if(!g.leader.xy.geom)g.leader=it;}
    });
    Object.keys(groups).forEach(function(k){var g=groups[k];
      if(g.features.length)g.poly=L.featureGroup(g.features.map(function(geom){return L.geoJSON(geom);}));
    });
    items.forEach(function(it){
      if(!it.xy)return;
      // 이름표 방향 번호는 숨김과 상관없이 매긴다 — 체크를 껐다 켤 때마다 이름표가 딴 쪽으로 튀지 않게
      var myN=it.xy.geom?n++:0;
      if(hidden[it.kind])return;
      var ll=[it.xy.y,it.xy.x],icon,myPoly=null;
      if(it.xy.geom){
        // 채우기는 **선정된 것(본건·채택 사례)에만**. 나머지는 테두리만 — 필지가 겹칠 때 색이 쌓여
        // 바탕지도·지적선이 가려지는 것을 막는다. 안 채운 필지도 `fill:true`는 그대로 둬야
        // 필지 **안쪽을 눌러도 설명창이 뜬다**(이름표를 멀리 치워 뒀을 때 누를 곳).
        var poly=L.geoJSON(it.xy.geom,{style:{color:it.color,weight:it.pick?4:3,opacity:1,
          fill:true,fillColor:it.color,fillOpacity:it.pick?0.16:0}}).addTo(map);
        poly.bindPopup(popup(it));   // 필지를 눌러도 설명이 뜬다(이름표를 멀리 치워 뒀을 때)
        shapes.push(poly);
        var pb=poly.getBounds();
        if(pb.isValid()){
          ll=[pb.getCenter().lat,pb.getCenter().lng];
          bnd=bnd?bnd.extend(pb):L.latLngBounds(pb.getSouthWest(),pb.getNorthEast());
        }
        myPoly=poly;
        icon=parcelIcon(it,myN,myPoly);
      }else{
        icon=dotIcon(it);
      }
      pts.push(ll);
      var group=it.labelGroup&&groups[it.labelGroup];
      if(group&&group.leader!==it)return; // 경계·팝업은 전부 유지하고 묶음 이름표만 하나 표시
      if(group&&group.poly){
        myPoly=group.poly;var center=myPoly.getBounds().getCenter();ll=[center.lat,center.lng];
        icon=parcelIcon(it,0,myPoly);myN=0;
      }
      // 필지형 마커는 필지 중심에 못 박는다(화살촉 고정) — 이름표만 따로 끌 수 있게 한다.
      // 점 핀(집합건물)은 종전대로 마커째 끌어서 위치를 고친다.
      var m=L.marker(ll,{icon:icon,draggable:!myPoly,title:myPoly?'':(it.label+' — '+it.loc),
        zIndexOffset:it.pick?1000:0}).addTo(map);
      m.bindPopup(popup(it));
      if(!myPoly)m.on('dragend',function(){moved(it,m.getLatLng());});
      markers.push(m);
      if(myPoly){var rec={marker:m,it:it,n:myN,poly:myPoly};labeled.push(rec);bindLabelDrag(rec);}
    });
    if(keepView)return;
    pts.forEach(function(p){bnd=bnd?bnd.extend(p):L.latLngBounds(p,p);});
    if(pts.length===1&&!shapes.length)map.setView(pts[0],17);
    else if(bnd&&bnd.isValid())map.fitBounds(bnd,{padding:[55,55],maxZoom:18});
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
      if(force&&cached){delete cached.geom;delete cached.geomTried;}   // 다시 찾기면 필지 도형도 새로
      if(!force&&usable&&cached.q===q){it.xy=cached;done++;return Promise.resolve();}
      return geocode(q,key).then(function(v){
        done++;status('주소 조회 중… ('+done+'/'+items.length+')');
        if(v){it.xy=it.o._xy=v;return;}
        if(usable){it.xy=cached;miss.push(it.label+'(주소 재조회 실패 — 이전 위치 유지)');return;}
        miss.push(it.label+' “'+it.loc+'”');
      });
    })).then(function(){
      // 필지 경계 — poly를 요청한 항목(토지)만. 한 번 시도한 것은 다시 부르지 않는다.
      var need=items.filter(function(it){return it.poly&&it.xy&&!it.xy.geom&&!it.xy.geomTried;});
      if(!need.length)return;
      var pn=0;
      status('필지 경계 불러오는 중… (0/'+need.length+')');
      return Promise.all(need.map(function(it){
        var q=(it.xy.pnu&&!it.xy.manual)?{pnu:it.xy.pnu}:{x:it.xy.x,y:it.xy.y};
        return parcel(q,key).then(function(g){
          pn++;status('필지 경계 불러오는 중… ('+pn+'/'+need.length+')');
          it.xy.geomTried=true;
          if(g&&geomFits(g))it.xy.geom=g;
        });
      }));
    }).then(function(){
      draw();onSave();
      var ok=items.filter(function(i){return i.xy&&!hidden[i.kind];}).length;
      var hid=items.filter(function(i){return i.xy&&hidden[i.kind];}).length;
      var want=items.filter(function(i){return i.poly&&i.xy;}).length;
      var got=items.filter(function(i){return i.xy&&i.xy.geom;}).length;
      // 필지 경계를 한 건도 못 받으면 조용히 점만 찍히므로 이유를 알려 준다(키에 데이터API 권한이 없는 경우)
      var pmsg=want?(got?(' · 필지 경계 '+got+'/'+want):' · 필지 경계를 못 받아 점으로 표시합니다(브이월드 키에 데이터API 권한 확인 필요)'):'';
      status('✅ '+ok+'곳 표시'+(hid?(' · 체크를 꺼 '+hid+'곳 숨김'):'')+(miss.length?(' · '+miss.length+'곳 실패'):'')+pmsg+(force?' (주소로 다시 찾음)':''),want&&!got);
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
        map.on('zoomend',relabel);   // 확대·축소에 맞춰 이름표를 필지 바깥으로 다시 민다
      }
      map.invalidateSize();
      return refresh(list===undefined?items:list,force);
    }).catch(function(e){status(e.message,true);});
  }

  return {
    open:open, refresh:refresh, setBase:setBase, toggleOverlay:toggleOverlay, setVisible:setVisible,
    status:status, items:function(){return items;},
    leaflet:function(){return map;}, markers:function(){return markers;}
  };
}

window.ArapMap={create:create,load:load,geocode:geocode,query:query,sggOfAddr:sggOfAddr,dist:dist,distText:distText};
})();
