/*
 * Ongyeol — 건축물대장 조회 공용 모듈 (window.ArapBldrgst)
 *
 * 집합건물 앱(s3r86w8a.html) '② 대상물건개요'에서 건축물대장 PDF 없이
 * 주소 → (V-World PNU) → 국토부 건축HUB 표제부·총괄표제부·지역지구·전유부·전유공용면적을 받아
 * 건물 단위 칸(용도지역·주구조·주용도·사용승인일·단지규모·대지면적·연면적·층수·도로명주소·건물명)과
 * 호 단위 칸(동·층·호·전유면적·공용면적·주용도(전유부))을 채운다.
 * 조회 로직은 건축물대장.html과 같다(프록시 경유). 등기에서만 나오는 값(소유자·대지권·명세표 구조·층별면적)은 다루지 않는다.
 *
 * 사용: <script src="arap_bldrgst.js"></script> (React 로드 뒤). React 화면에는 ArapBldrgst.Panel 컴포넌트를 쓴다.
 *   <Panel S={S} C={C} ov={ov} multi={false} onApply={(fields,{onlyEmpty})=>...}/>
 * Copyright (c) 2026 정우진 감정평가사. All Rights Reserved.
 */
(function(){
'use strict';
var API_BASE='https://api.vworld.kr';
var KEY_STORAGE='exact-vworld-key';
var DEFAULT_VKEY='8D5CB15B-426D-3015-9680-618B587ACBCB';
var PROXY_BASE='https://ongyeol-proxy.woojin-apr.workers.dev';
function getKey(){try{return localStorage.getItem(KEY_STORAGE)||DEFAULT_VKEY;}catch(e){return DEFAULT_VKEY;}}

// ── 호출 (fetch → V-World만 JSONP 보조) ──
function tryFetch(u){return fetch(u).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();});}
function tryJsonp(u){return new Promise(function(res,rej){
  var cb='__arapcb'+Math.floor(Math.random()*1e9),sc=document.createElement('script'),done=false;
  window[cb]=function(d){done=true;cl();res(d);};
  function cl(){delete window[cb];if(sc.parentNode)sc.parentNode.removeChild(sc);}
  sc.onerror=function(){if(!done){cl();rej(new Error('JSONP 실패'));}};
  setTimeout(function(){if(!done){cl();rej(new Error('JSONP 시간초과'));}},8000);
  sc.src=u+(u.indexOf('?')>=0?'&':'?')+'callback='+cb;document.head.appendChild(sc);});}
function callApi(u){
  if(u.indexOf(API_BASE)===0)return tryFetch(u).catch(function(){return tryJsonp(u);});
  return tryFetch(u);
}

// ── 유틸 ──
function txt(v){return String(v==null?'':v).trim();}
function items(d){
  var b=d&&d.response&&d.response.body,h=d&&d.response&&d.response.header;
  if(h&&h.resultCode&&!/^0+$/.test(h.resultCode))throw new Error((h.resultMsg||'오류')+' ('+h.resultCode+')');
  var it=b&&b.items&&b.items.item;
  return it?(Array.isArray(it)?it:[it]):[];
}
function joinPurps(main,etc){var a=txt(main),b=txt(etc);return b?(a?a+'('+b+')':b):a;}
function dot(v){var m=String(v||'').match(/(\d{4})\D?(\d{2})\D?(\d{2})/);return m?(m[1]+'.'+m[2]+'.'+m[3]):'';}
function numStr(v){var x=Number(v);if(v===''||v==null||isNaN(x))return'';return String(Number(x.toFixed(4)));}
function stripDong(s){return txt(s).replace(/^제/,'').replace(/동$/,'').trim();}
function stripHo(s){return txt(s).replace(/^제/,'').replace(/호$/,'').trim();}
function hoNum(s){var m=String(s||'').match(/\d+/);return m?Number(m[0]):0;}

function bldUrl(pnu,op,extra){
  var x=extra||{},qs='';
  ['pageNo','numOfRows','dongNm','hoNm'].forEach(function(k){if(x[k]!=null&&x[k]!=='')qs+='&'+k+'='+encodeURIComponent(x[k]);});
  return PROXY_BASE+'/bld?op='+op+'&pnu='+pnu+qs;
}
// 여러 페이지를 끝까지 받아 합친다(건축물대장.html과 동일)
async function fetchAll(pnu,op,extra){
  var out=[],page=1,rows=200,total=null,proxyOld=false;
  for(;page<=25;page++){
    var d=await callApi(bldUrl(pnu,op,Object.assign({pageNo:page,numOfRows:rows},extra||{})));
    var b=d&&d.response&&d.response.body||{};
    var it=items(d),gotPage=Number(b.pageNo);
    if(page>1&&!isNaN(gotPage)&&gotPage!==page){proxyOld=true;break;}
    out=out.concat(it);
    total=Number(b.totalCount);
    if(!it.length||isNaN(total)||!(total>out.length))break;
  }
  if(total==null||isNaN(total))total=out.length;
  return{items:out,total:total,truncated:total>out.length,proxyOld:proxyOld};
}

// ── V-World 주소 → PNU 후보 [{id,addr}] ──
async function vworldSearch(q,category){
  var su=API_BASE+'/req/search?service=search&request=search&version=2.0&size=10&page=1&query='+encodeURIComponent(q)
        +'&type=address&category='+category+'&format=json&errorformat=json&key='+getKey();
  var sd=await callApi(su),rp=sd&&sd.response;
  if(!rp||rp.status!=='OK'||!rp.result||!rp.result.items||!rp.result.items.length)return[];
  return rp.result.items;
}
function parcelCands(list,q){
  var seen={},cands=[];
  list.forEach(function(it){
    var id=String(it.id||'');if(!/^\d{19}$/.test(id)||seen[id])return;seen[id]=1;
    cands.push({id:id,addr:(it.address&&(it.address.parcel||it.address.road))||it.title||q});
  });
  return cands;
}
var SIDO=/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)/;
// 지번 주소인지 도로명 주소인지 대충 가른다 — '…로/길 숫자'가 있고 '동/리 숫자'가 없으면 도로명
function looksRoad(q){return /(로|길)\s*\d+/.test(q)&&!/[동리가]\s*\d+/.test(q);}
// 등기 지번주소(예: '서울특별시 서초구 방배동 1344, 1344-1, 1344-2' / '… 456 외 8필지')에서 첫 필지만
function firstParcel(s){return txt(s).split(/[,，]/)[0].replace(/\s*외\s*\d+\s*필지.*$/,'').replace(/번지/g,'').trim();}
async function search(q){
  q=txt(q);if(!q)throw new Error('주소를 입력하세요');
  var cands;
  if(looksRoad(q)){
    var list=await vworldSearch(q,'road'),seen={};cands=[];
    for(var i=0;i<list.length;i++){
      var a=list[i].address||{},road=txt(a.road)||txt(list[i].title),parcel=txt(a.parcel);
      if(!parcel)continue;
      if(!SIDO.test(parcel)){var m=road.match(/^(\S+\s+\S+(?:구|군|시)(?:\s+\S+(?:구|군))?)\s/);if(m)parcel=m[1]+' '+parcel;}
      if(seen[parcel])continue;seen[parcel]=1;
      var pc=parcelCands(await vworldSearch(parcel,'parcel'),parcel);
      if(pc.length)cands=cands.concat([{id:pc[0].id,addr:road+' → '+pc[0].addr}]);
    }
  }else{
    cands=parcelCands(await vworldSearch(q,'parcel'),q);
    if(!cands.length&&/(로|길)\s*\d+/.test(q)){var l2=await vworldSearch(q,'road');if(l2.length){var p2=txt((l2[0].address||{}).parcel);if(p2)cands=parcelCands(await vworldSearch(p2,'parcel'),p2);}}
  }
  if(!cands.length)throw new Error('주소를 찾지 못했습니다: '+q+' (시·구·동까지 쓰세요)');
  return cands;
}

// ── 건축물대장 로드: 표제부·총괄표제부·지역지구 ──
async function load(pnu,addr){
  var res=await Promise.all([
    callApi(bldUrl(pnu,'getBrTitleInfo',{numOfRows:200})),
    callApi(bldUrl(pnu,'getBrRecapTitleInfo',{numOfRows:50})).catch(function(){return null;}),
    callApi(bldUrl(pnu,'getBrJijiguInfo',{numOfRows:200})).catch(function(){return null;})
  ]);
  var titles=items(res[0]);
  var recap=res[1]?items(res[1]):[];
  var jijigu=res[2]?items(res[2]):[];
  if(!titles.length){
    var bun=pnu.slice(11,15),ji=pnu.slice(15,19);
    throw new Error('이 지번의 건축물대장(표제부)이 없습니다. 조회 주소: '+addr+' (지번 '+String(Number(bun))+(Number(ji)?'-'+Number(ji):'')+'). 여러 필지 단지는 대표 지번(총괄표제부 지번)으로 다시 조회하세요.');
  }
  // 주건축물 먼저, 동 이름 순
  titles.sort(function(a,b){var ma=/부속/.test(txt(a.mainAtchGbCdNm))?1:0,mb=/부속/.test(txt(b.mainAtchGbCdNm))?1:0;if(ma!==mb)return ma-mb;return hoNum(a.dongNm)-hoNum(b.dongNm)||txt(a.dongNm).localeCompare(txt(b.dongNm));});
  var seen={},dongs=[];
  titles.forEach(function(t){if(/부속/.test(txt(t.mainAtchGbCdNm)))return;var d=txt(t.dongNm);if(seen[d])return;seen[d]=1;dongs.push(d);});
  if(!dongs.length)dongs=[txt(titles[0].dongNm)];
  var isJiphap=titles.some(function(t){return /집합/.test(txt(t.regstrGbCdNm)+' '+txt(t.regstrKindCdNm));});
  return{pnu:pnu,addr:addr,titles:titles,recap:recap[0]||null,jijigu:jijigu,dongs:dongs,isJiphap:isJiphap};
}
function titleOf(st,dong){
  var t=st.titles.find(function(x){return txt(x.dongNm)===txt(dong)&&!/부속/.test(txt(x.mainAtchGbCdNm));});
  return t||st.titles.find(function(x){return txt(x.dongNm)===txt(dong);})||st.titles[0];
}
// 건물 단위 칸 — 앱 ov 키 그대로
function buildingFields(st,dong){
  var t=titleOf(st,dong)||{},r=st.recap||{};
  function uniq(a){return a.filter(function(v,i){return v&&a.indexOf(v)===i;});}
  var jj=uniq(st.jijigu.filter(function(x){return /지역/.test(txt(x.jijiguGbCdNm));}).map(function(x){return txt(x.jijiguCdNm);}));
  if(jj.length>1)jj=jj.filter(function(v){return !/^(도시|관리|농림|자연환경보전)지역$/.test(v);});   // 큰 분류는 세부 용도지역이 있으면 뺀다
  var strct=joinPurps(t.strctCdNm,t.etcStrct);
  var roof=txt(t.etcRoof)||txt(t.roofCdNm);
  if(roof&&!/지붕|슬래브|슬라브/.test(roof))roof+='지붕';
  var plat=txt(r.platPlc)||txt(t.platPlc)||st.addr;
  plat=plat.replace(/번지/g,'').replace(/\s+/g,' ').trim();
  var mainCnt=Number(r.mainBldCnt)||0,hhld=Number(r.hhldCnt)||0;
  if(!mainCnt)mainCnt=st.dongs.length;
  if(!hhld)st.titles.forEach(function(x){if(!/부속/.test(txt(x.mainAtchGbCdNm)))hhld+=Number(x.hhldCnt)||0;});
  var landArea=numStr(r.platArea)||numStr(t.platArea);
  return{
    jibun:plat,
    road:txt(r.newPlatPlc)||txt(t.newPlatPlc),
    buildingName:txt(r.bldNm)||txt(t.bldNm),
    zoning:jj.join(', '),
    structure:(strct+(roof?' '+roof:'')).trim(),
    mainUse:joinPurps(t.mainPurpsCdNm,t.etcPurps)||joinPurps(r.mainPurpsCdNm,r.etcPurps),
    approvalDate:dot(t.useAprDay)||dot(r.useAprDay),
    complexScale:(mainCnt&&hhld)?(mainCnt+'/'+hhld):'',
    landAreaTotal:landArea,
    totalFloorArea:numStr(t.totArea),
    floors:(txt(t.grndFlrCnt)||txt(t.ugrndFlrCnt))?((txt(t.grndFlrCnt)||'0')+'/'+(txt(t.ugrndFlrCnt)||'0')):''
  };
}
// 동의 호 목록(전유부) [{hoNm,flrNo,flrGb,purps}]
async function hoList(pnu,dong){
  var r=await fetchAll(pnu,'getBrExposInfo',{dongNm:dong});
  var seen={},list=[];
  r.items.forEach(function(x){
    if(dong&&txt(x.dongNm)!==dong)return;
    var h=txt(x.hoNm);if(!h||seen[h])return;seen[h]=1;
    list.push({hoNm:h,flrNo:Number(x.flrNo)||0,flrGb:txt(x.flrGbCdNm),purps:joinPurps(x.mainPurpsCdNm,x.etcPurps)});
  });
  list.sort(function(a,b){return (a.flrGb>b.flrGb?1:a.flrGb<b.flrGb?-1:0)||(a.flrNo-b.flrNo)||(hoNum(a.hoNm)-hoNum(b.hoNm))||a.hoNm.localeCompare(b.hoNm);});
  return{list:list,truncated:r.truncated,total:r.total,got:r.items.length,proxyOld:r.proxyOld};
}
// 호 하나의 전유·공용 → 앱 ov 키
async function unitFields(pnu,dong,ho){
  var r=await fetchAll(pnu,'getBrExposPubuseAreaInfo',{dongNm:dong,hoNm:ho});
  var rows=r.items.filter(function(x){return (!dong||txt(x.dongNm)===dong)&&txt(x.hoNm)===ho;});
  if(!rows.length)throw new Error('이 호의 전유공용면적 행이 없습니다.'+(r.proxyOld?' (프록시가 구버전 — 문서/클라우드플레어_프록시_설정.md 재배포)':''));
  var expos=0,pub=0,ex=null;
  rows.forEach(function(x){var a=Number(x.area)||0;if(/전유/.test(txt(x.exposPubuseGbCdNm))){expos+=a;if(!ex&&!/부속/.test(txt(x.mainAtchGbCdNm)))ex=x;}else pub+=a;});
  if(!ex)ex=rows.find(function(x){return /전유/.test(txt(x.exposPubuseGbCdNm));})||rows[0];
  var flrNo=txt(ex.flrNo)!==''?String(Number(ex.flrNo)):txt(ex.flrNoNm).replace(/층$/,'');
  if(/지하/.test(txt(ex.flrGbCdNm))&&flrNo&&!/지/.test(flrNo))flrNo='지'+flrNo;
  var purps=txt(ex.mainPurpsCdNm)||joinPurps(ex.mainPurpsCdNm,ex.etcPurps);
  return{dong:stripDong(txt(ex.dongNm)||dong),floor:flrNo,ho:stripHo(ho),area:numStr(expos),commonArea:numStr(pub),mainUseJeonyu:purps,
    _sum:{dong:txt(ex.dongNm)||dong,ho:ho,expos:Number(expos.toFixed(4)),pub:Number(pub.toFixed(4)),rows:rows.length}};
}

// ── React 패널 ──
// props: S,C(앱 스타일), ov(현재 값 — 동·호 선택에 사용), multi(여러호수: 호 고르면 표에 추가), onApply(fields,{onlyEmpty,kind:'building'|'unit'})
function Panel(props){
  var R=window.React,h=R.createElement,useState=R.useState,useRef=R.useRef;
  var S=props.S||{},C=props.C||{},ov=props.ov||{};
  var st=useState(''),q=st[0],setQ=st[1];
  var st2=useState(''),msg=st2[0],setMsg=st2[1];
  var st3=useState(''),err=st3[0],setErr=st3[1];
  var st4=useState(false),busy=st4[0],setBusy=st4[1];
  var st5=useState(null),cands=st5[0],setCands=st5[1];
  var st6=useState(null),bld=st6[0],setBld=st6[1];         // load() 결과
  var st7=useState(''),dong=st7[0],setDong=st7[1];
  var st8=useState([]),hos=st8[0],setHos=st8[1];
  var st9=useState(''),ho=st9[0],setHo=st9[1];
  var st10=useState(true),onlyEmpty=st10[0],setOnlyEmpty=st10[1];
  var st11=useState(''),hoMsg=st11[0],setHoMsg=st11[1];
  var lastUnit=useRef(null);   // 마지막으로 채운 호 값 — 체크 해제 때 덮어쓰기 재적용용

  var opts={onlyEmpty:onlyEmpty};
  function fail(e){console.error('건축물대장',e);setErr('실패: '+(e&&e.message||e));}
  async function doSearch(){
    setErr('');setMsg('');setCands(null);setBld(null);setHos([]);setHo('');setHoMsg('');
    setBusy(true);
    try{
      setMsg('주소 확인 중… '+q);
      var c=await search(q);
      if(c.length===1)await pick(c[0]);
      else{setCands(c);setMsg('같은 지번이 '+c.length+'곳에 있습니다 — 아래에서 고르세요.');}
    }catch(e){fail(e);setMsg('');}finally{setBusy(false);}
  }
  async function pick(c){
    setCands(null);setBusy(true);setErr('');
    try{
      setMsg('건축물대장 조회 중… ('+c.addr+')');
      var b=await load(c.id,c.addr);
      setBld(b);
      // 등기에서 읽은 동이 있으면 그 동을 미리 고른다
      var want=stripDong(ov.dong),d0=b.dongs.find(function(d){return stripDong(d)===want&&want!=='';});
      if(d0==null)d0=b.dongs[0];
      setMsg('✅ '+c.addr+' · 동 '+b.dongs.length+'개'+(b.isJiphap?'':' · 집합건물 대장이 아닙니다(호 목록 없음)'));
      await chooseDong(b,d0);
    }catch(e){fail(e);setMsg('');}finally{setBusy(false);}
  }
  async function chooseDong(b,d){
    setDong(d);setHos([]);setHo('');setHoMsg('');lastUnit.current=null;
    props.onApply&&props.onApply(buildingFields(b,d),Object.assign({kind:'building'},opts));
    if(!b.isJiphap)return;
    try{
      setHoMsg('호 목록 불러오는 중…');
      var r=await hoList(b.pnu,d);
      setHos(r.list);
      setHoMsg(r.list.length?(r.list.length+'호'+(r.truncated?' ⚠ 일부만 받음('+r.got+'/'+r.total+')'+(r.proxyOld?' — 프록시 구버전':''):'')):'이 동의 호 목록(전유부)이 없습니다.');
      // 등기에서 읽은 호가 목록에 있으면 미리 고르되, 채우기는 사용자가 확인하도록 버튼/선택으로
      var want=stripHo(ov.ho);
      if(want&&!props.multi){var h0=r.list.find(function(x){return stripHo(x.hoNm)===want;});if(h0){setHo(h0.hoNm);await chooseHo(b,d,h0.hoNm);}}
    }catch(e){console.error('호 목록',e);setHoMsg('호 목록 조회 실패: '+e.message);}
  }
  async function chooseHo(b,d,hn){
    setHo(hn);if(!hn)return;
    setBusy(true);
    try{
      setHoMsg('전유·공용 면적 조회 중… '+(d?d+' ':'')+hn);
      var f=await unitFields(b.pnu,d,hn);
      var sum=f._sum;delete f._sum;lastUnit.current=f;
      props.onApply&&props.onApply(f,Object.assign({kind:'unit'},opts));
      setHoMsg('✅ '+(sum.dong?sum.dong+' ':'')+sum.ho+' · 전유 '+sum.expos+'㎡ · 공용 '+sum.pub+'㎡'+(props.multi?' → 상세물건정보 표에 넣었습니다':' → 칸에 채웠습니다'));
    }catch(e){console.error('호 상세',e);setHoMsg('실패: '+e.message);}finally{setBusy(false);}
  }
  // '빈칸만 채우기'를 바꾸면 이미 조회한 건물·호 값을 새 규칙으로 다시 적용(끄면 대장 값으로 덮어씀)
  function toggleOnlyEmpty(v){
    setOnlyEmpty(v);
    if(!bld||!props.onApply)return;
    props.onApply(buildingFields(bld,dong),{kind:'building',onlyEmpty:v});
    if(lastUnit.current)props.onApply(Object.assign({},lastUnit.current),{kind:'unit',onlyEmpty:v});
  }
  var inp=Object.assign({},S.inp||{});
  var btn=Object.assign({},S.btn||{},{background:C.acc||'#2563eb',color:'#fff'});
  var gh=Object.assign({},S.btn||{},{background:'#fff',color:C.acc||'#2563eb',border:'1px solid '+(C.acc||'#2563eb'),padding:'4px 10px',fontSize:11});
  var hint={fontSize:11,color:'#666'};
  return h('div',{style:Object.assign({},S.card||{},{background:'#f0fdf4',border:'1px solid #bbf7d0'})},
    h('div',{style:S.h2||{}},'🏢 건축물대장 불러오기 ',h('span',{style:{fontSize:11,fontWeight:400,color:'#666'}},'(PDF 없이 주소로 조회 — 등기·접수 인식 뒤 남은 빈칸을 채웁니다)')),
    h('div',{style:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:6}},
      h('span',{style:Object.assign({},S.lbl||{},{minWidth:70})},'주소'),
      h('input',{style:Object.assign({},inp,{flex:1,minWidth:260}),value:q,onChange:function(e){setQ(e.target.value);},placeholder:'조회할 지번주소 또는 도로명주소를 입력하세요',onKeyDown:function(e){if(e.key==='Enter'&&!busy)doSearch();}}),
      h('button',{style:Object.assign({},btn,busy?{background:'#94a3b8'}:{}),disabled:busy,onClick:doSearch},busy?'조회 중…':'🔍 조회'),
      h('label',{style:Object.assign({},hint,{display:'inline-flex',alignItems:'center',gap:4,cursor:'pointer'})},
        h('input',{type:'checkbox',checked:onlyEmpty,onChange:function(e){toggleOnlyEmpty(e.target.checked);}}),'빈칸만 채우기'),
      h('span',{style:hint},'(끄면 대장 값으로 덮어씀)')),
    msg?h('div',{style:{fontSize:12,color:'#166534',fontWeight:600,marginBottom:4}},msg):null,
    err?h('div',{style:{padding:'6px 10px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:4,color:'#dc2626',fontSize:12,marginBottom:4}},err):null,
    cands?h('div',{style:{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}},cands.map(function(c,i){return h('button',{key:i,style:gh,onClick:function(){pick(c);}},c.addr);})):null,
    bld?h('div',{style:{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}},
      h('span',{style:Object.assign({},S.lbl||{},{minWidth:70})},'동 / 호'),
      h('select',{style:Object.assign({},S.sel2||inp,{minWidth:110}),value:dong,disabled:busy,onChange:function(e){chooseDong(bld,e.target.value);}},
        bld.dongs.map(function(d){return h('option',{key:d,value:d},d||'(동 구분 없음)');})),
      bld.isJiphap?h('select',{style:Object.assign({},S.sel2||inp,{minWidth:130}),value:ho,disabled:busy||!hos.length,onChange:function(e){chooseHo(bld,dong,e.target.value);}},
        [h('option',{key:'',value:''},hos.length?(props.multi?'호를 고르면 표에 추가':'호를 선택하세요'):'호 목록 없음')].concat(hos.map(function(x){return h('option',{key:x.hoNm,value:x.hoNm},x.hoNm+(x.purps?' · '+x.purps:''));}))):null,
      h('span',{style:Object.assign({},hint,/실패|⚠/.test(hoMsg)?{color:'#dc2626',fontWeight:600}:{})},hoMsg),
      h('span',{style:hint},'· 동을 바꾸면 건물 칸(층수·연면적 등)이 그 동 기준으로 다시 채워집니다')):null
  );
}

window.ArapBldrgst={search:search,load:load,buildingFields:buildingFields,hoList:hoList,unitFields:unitFields,firstParcel:firstParcel,Panel:Panel,
  _internal:{stripDong:stripDong,stripHo:stripHo,looksRoad:looksRoad,numStr:numStr,dot:dot}};
})();
