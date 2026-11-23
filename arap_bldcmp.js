/*
 * Ongyeol — 본건·사례 건물 비교 (window.ArapBldCmp) — 2026-11-23
 * 집건 「가치형성요인 비교」에서 사례를 고르면 본건·사례 건축물대장 표제부를 나란히 보여 주고
 * 단지 내부요인(구조·마감, 규모, 관리·설비, 주차)을 **본건 기준**으로 ▲우세 / ▼열세 / ＝대등 표시.
 *   · 본건 = ov.jibun(첫 필지)·ov.dong, 사례 = c.location + c.jibun(시·구는 본건에서 빌림)·c.dong → ArapBldrgst.search/load
 *   · 대등 = 차이 10% 이내(경과연수는 1년 이내). 「배」 = 큰 값 ÷ 작은 값
 *   · 비교치(숫자)는 넣지 않는다 — 평가사 판단. 의견 초안(사실 문장)만 만들어 「넣기」 버튼으로 의견란에
 *   · 공실·임대료(주거는 난방·관리)는 대장에 없어 현장조사 칸 + 우열 직접 고르기 — 본건 = ov.bcMan, 사례 = c.bcMan
 *   · 사례 주소가 안 맞으면 c.bcAddr(직접 쓴 지번), 동이 여러 개면 c.bcDong
 * 쓰는 곳: s3r86w8a.html 단일(사례 카드 안) · 여러 호수(호별 개별요인 비교 의견 위)
 * 검증: tests/jiphap_bldcmp.cjs
 */
(function(){
'use strict';
function txt(v){return String(v==null?'':v).trim();}
function num(v){var x=Number(String(v==null?'':v).replace(/,/g,''));return isFinite(x)?x:0;}
function comma(x,d){if(!isFinite(x))return'';var s=Number(x).toFixed(d==null?0:d).split('.');s[0]=s[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');return s.join('.');}
function stripDong(s){return txt(s).replace(/^제/,'').replace(/동$/,'').trim();}
function dot(v){var m=String(v||'').match(/(\d{4})\D?(\d{2})\D?(\d{2})/);return m?(m[1]+'.'+m[2]+'.'+m[3]):'';}
function ymd(v){var m=String(v||'').match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/);return m?new Date(+m[1],+m[2]-1,+m[3]):null;}
function joinPurps(main,etc){var a=txt(main),b=txt(etc);if(!b)return a;if(!a||b===a||b.indexOf(a)===0)return b;return a+'('+b+')';}

// ── 대장(load 결과) → 비교용 요약 ──
function titleOf(st,dong){
  var ts=st.titles||[];
  var t=ts.find(function(x){return txt(x.dongNm)===txt(dong)&&!/부속/.test(txt(x.mainAtchGbCdNm));});
  return t||ts.find(function(x){return txt(x.dongNm)===txt(dong);})||ts.find(function(x){return !/부속/.test(txt(x.mainAtchGbCdNm));})||ts[0]||{};
}
function parkOf(o){return num(o.indrAutoUtcnt)+num(o.indrMechUtcnt)+num(o.oudrAutoUtcnt)+num(o.oudrMechUtcnt);}
function summarize(st,dong,resi){
  var t=titleOf(st,dong),r=st.recap||{};
  var mains=[],seen={};
  (st.titles||[]).forEach(function(x){if(/부속/.test(txt(x.mainAtchGbCdNm)))return;var k=txt(x.mgmBldrgstPk)||txt(x.dongNm);if(seen[k])return;seen[k]=1;mains.push(x);});
  var f=(window.ArapBldrgst&&window.ArapBldrgst.buildingFields)?window.ArapBldrgst.buildingFields(st,dong):{};
  var roof=txt(t.etcRoof)||txt(t.roofCdNm);
  // 주차: 비주거 = 그 동 표제부(없으면 총괄), 주거 = 단지 전체(총괄표제부 → 없으면 동 합계)
  var pkT=parkOf(t),pkR=parkOf(r)||num(r.totPkngCnt),pkSum=mains.reduce(function(a,x){return a+parkOf(x);},0);
  var park,pkScope,pkIn,pkOut;
  if(resi){
    if(pkR){park=pkR;pkScope='단지';pkIn=num(r.indrAutoUtcnt)+num(r.indrMechUtcnt);pkOut=num(r.oudrAutoUtcnt)+num(r.oudrMechUtcnt);}
    else{park=pkSum;pkScope=mains.length>1?'단지':'동';pkIn=mains.reduce(function(a,x){return a+num(x.indrAutoUtcnt)+num(x.indrMechUtcnt);},0);pkOut=park-pkIn;}
  }else if(pkT){park=pkT;pkScope='동';pkIn=num(t.indrAutoUtcnt)+num(t.indrMechUtcnt);pkOut=num(t.oudrAutoUtcnt)+num(t.oudrMechUtcnt);}
  else{park=pkR;pkScope=pkR?'단지':'동';pkIn=num(r.indrAutoUtcnt)+num(r.indrMechUtcnt);pkOut=num(r.oudrAutoUtcnt)+num(r.oudrMechUtcnt);}
  var hhld=num(r.hhldCnt)||mains.reduce(function(a,x){return a+num(x.hhldCnt);},0);
  return{
    addr:txt(st.addr),dong:txt(dong),name:txt(t.bldNm)||txt(r.bldNm),
    strct:txt(t.strctCdNm)||txt(t.etcStrct),strctFull:joinPurps(t.strctCdNm,t.etcStrct),roof:roof,
    useApr:dot(t.useAprDay)||dot(r.useAprDay),
    grnd:num(t.grndFlrCnt),ugrnd:num(t.ugrndFlrCnt),
    totArea:num(t.totArea),platArea:num(t.platArea)||num(r.platArea),bcRat:num(t.bcRat),vlRat:num(t.vlRat),
    ho:num(t.hoCnt),dongHhld:num(t.hhldCnt),hhld:hhld,mainCnt:num(r.mainBldCnt)||mains.length,
    elevRide:num(t.rideUseElvtCnt),elevEmg:num(t.emgenUseElvtCnt),
    park:park,pkIn:pkIn,pkOut:pkOut,pkScope:pkScope,
    zoning:txt(f.zoning),mainUse:joinPurps(t.mainPurpsCdNm,t.etcPurps)
  };
}

// ── 비교 ──
function ageYears(apr,base){var a=ymd(apr),b=ymd(base)||new Date();if(!a)return null;return (b-a)/(365.2425*864e5);}
function rnd(x,d){var p=Math.pow(10,d);return Math.round(x*p)/p;}
function ratioTxt(x){return x>=10?String(rnd(x,1)):rnd(x,2).toFixed(2);}
// higher: true = 값이 클수록 본건 유리 / false = 작을수록 유리 / null = 참고(우열 없음)
function ratioRow(o,sv,cv){
  var row={id:o.id,grp:o.grp,label:o.label,s:o.fmt(sv,'s'),c:o.fmt(cv,'c'),draft:o.draft||null};
  if(!(sv>0)||!(cv>0)){row.v='na';row.note='대장 값 없음';return row;}
  var big=Math.max(sv,cv)/Math.min(sv,cv),sBig=sv>cv,words=o.words||['큼','작음'];
  var rel=sv===cv?'같음':(ratioTxt(big)+'배 '+(sBig?words[0]:words[1]));
  var extra=o.extra?o.extra(sv,cv):'';
  if(o.higher==null){row.v='ref';row.note=rel+(extra?' ('+extra+')':'');return row;}
  if(big<1.1){row.v='eq';row.note=(sv===cv?'같음':'차이 '+Math.round((big-1)*100)+'%')+(extra?' ('+extra+')':'');return row;}
  var good=(sBig===!!o.higher);
  row.v=good?'up':'dn';row.note=rel+(extra?' ('+extra+')':'')+(good?(o.hintUp?' · '+o.hintUp:''):(o.hintDn?' · '+o.hintDn:''));
  return row;
}
function compare(s,c,opt){
  opt=opt||{};var resi=!!opt.resi,rows=[];
  var m2=function(v){return v>0?comma(v,2):'-';};
  // 구조·마감
  var sameStr=s.strct&&c.strct&&s.strct===c.strct;
  rows.push({id:'strct',grp:'구조·마감',label:'구조 / 지붕',s:[s.strctFull,s.roof].filter(Boolean).join(' / ')||'-',c:[c.strctFull,c.roof].filter(Boolean).join(' / ')||'-',
    v:(!s.strct||!c.strct)?'na':(sameStr?'eq':'ref'),note:(!s.strct||!c.strct)?'대장 값 없음':(sameStr?'같은 구조':'구조 다름 — 직접 판단'),draft:{label:'구조',val:sameStr?s.strct:(s.strct+' / '+c.strct)}});
  var sa=ageYears(s.useApr,opt.baseDate),ca=ageYears(c.useApr,opt.baseDate);
  var ageRow={id:'age',grp:'구조·마감',label:'사용승인일 · 경과연수',s:s.useApr?(s.useApr+' · '+rnd(sa,1).toFixed(1)+'년'):'-',c:c.useApr?(c.useApr+' · '+rnd(ca,1).toFixed(1)+'년'):'-',
    draft:{label:'사용승인 시기',val:(s.useApr||'').slice(0,4)+'년 / '+(c.useApr||'').slice(0,4)+'년'}};
  if(sa==null||ca==null){ageRow.v='na';ageRow.note='대장 값 없음';}
  else{var d=sa-ca,ad=rnd(Math.abs(d),1).toFixed(1);
    if(Math.abs(d)<1){ageRow.v='eq';ageRow.note=Math.abs(d)<0.05?'같은 시기':('본건이 '+ad+'년 '+(d>0?'더 오래됨':'더 새것'));}
    else if(d>0){ageRow.v='dn';ageRow.note='본건이 '+ad+'년 더 노후';}
    else{ageRow.v='up';ageRow.note='본건이 '+ad+'년 더 신축';}}
  rows.push(ageRow);
  // 규모
  rows.push({id:'floors',grp:'규모',label:'층수 (지상/지하)',s:s.grnd||s.ugrnd?(s.grnd+' / '+s.ugrnd):'-',c:c.grnd||c.ugrnd?(c.grnd+' / '+c.ugrnd):'-',v:'ref',
    note:(function(){if(!(s.grnd||s.ugrnd)||!(c.grnd||c.ugrnd))return'';var a=[];if(s.grnd!==c.grnd)a.push('지상 '+Math.abs(s.grnd-c.grnd)+'층 '+(s.grnd>c.grnd?'많음':'적음'));if(s.ugrnd!==c.ugrnd)a.push('지하 '+Math.abs(s.ugrnd-c.ugrnd)+'층 '+(s.ugrnd>c.ugrnd?'많음':'적음'));return a.join(', ')||'같음';})()});
  rows.push(ratioRow({id:'totArea',grp:'규모',label:'연면적(㎡)',higher:true,fmt:m2,draft:{label:'연면적',val:comma(s.totArea)+'㎡ / '+comma(c.totArea)+'㎡'},extra:function(a,b){return '사례의 '+rnd(a/b,2).toFixed(2)+'배';}},s.totArea,c.totArea));
  rows.push(ratioRow({id:'platArea',grp:'규모',label:'대지면적(㎡)',higher:true,fmt:m2,extra:function(a,b){return rnd(a/b,2).toFixed(2)+'배';}},s.platArea,c.platArea));
  rows.push({id:'ratio',grp:'규모',label:'건폐율 / 용적률(%)',s:(s.bcRat||s.vlRat)?(comma(s.bcRat,2)+' / '+comma(s.vlRat,2)):'-',c:(c.bcRat||c.vlRat)?(comma(c.bcRat,2)+' / '+comma(c.vlRat,2)):'-',v:'ref',
    note:(s.bcRat&&c.bcRat)?(function(){var a=rnd(s.bcRat-c.bcRat,1),b=rnd(s.vlRat-c.vlRat,1),sg=function(x){return (x>0?'+':x<0?'−':'')+Math.abs(x).toFixed(1);};return sg(a)+' / '+sg(b)+'%p';})():''});
  if(resi){
    rows.push(ratioRow({id:'hhld',grp:'규모',label:'세대수 (단지)',higher:true,words:['많음','적음'],fmt:function(v,k){var o=k==='s'?s:c;return v>0?(comma(v)+'세대'+(o.mainCnt?' · '+o.mainCnt+'개 동':'')):'-';},draft:{label:'세대수',val:comma(s.hhld)+'세대 / '+comma(c.hhld)+'세대'}},s.hhld,c.hhld));
  }else{
    rows.push(ratioRow({id:'ho',grp:'규모',label:'호수',higher:null,words:['많음','적음'],fmt:function(v){return v>0?comma(v)+'호':'-';},extra:function(a,b){return rnd(a/b,2).toFixed(2)+'배';}},s.ho,c.ho));
  }
  // 관리·설비
  var se=s.elevRide+s.elevEmg,ce=c.elevRide+c.elevEmg,unitW=resi?'세대':'호';
  var su=resi?s.dongHhld:s.ho,cu=resi?c.dongHhld:c.ho;
  rows.push(ratioRow({id:'elev',grp:'관리·설비',label:'승강기 (승용/비상)',higher:true,words:['많음','적음'],fmt:function(v,k){var o=k==='s'?s:c;return (o.elevRide||o.elevEmg)?(v+'대 ('+o.elevRide+' / '+o.elevEmg+')'):'0대';},draft:{label:'승강기',val:se+'대 / '+ce+'대'}},se,ce));
  rows.push(ratioRow({id:'elevPer',grp:'관리·설비',label:'승강기 1대당 '+unitW+'수',higher:false,words:['많음','적음'],hintDn:'승강기 붐빔',hintUp:'승강기 여유',fmt:function(v){return v>0?rnd(v,1)+unitW:'-';}},se&&su?su/se:0,ce&&cu?cu/ce:0));
  // 주차
  rows.push(ratioRow({id:'park',grp:'주차',label:'주차대수 (옥내/옥외)',higher:true,words:['많음','적음'],fmt:function(v,k){var o=k==='s'?s:c;return v>0?(comma(v)+'대 ('+o.pkIn+' / '+o.pkOut+')'+(o.pkScope==='단지'&&!resi?' 단지':'')):'0대';},draft:{label:'주차대수',val:comma(s.park)+'대 / '+comma(c.park)+'대'}},s.park,c.park));
  if(resi){
    rows.push(ratioRow({id:'parkPer',grp:'주차',label:'세대당 주차대수',higher:true,words:['많음','적음'],fmt:function(v){return v>0?rnd(v,2).toFixed(2)+'대':'-';}},s.park&&s.hhld?s.park/s.hhld:0,c.park&&c.hhld?c.park/c.hhld:0));
  }else{
    rows.push(ratioRow({id:'parkArea',grp:'주차',label:'주차 1대당 연면적',higher:false,words:['큼','작음'],hintDn:'주차 여유 부족',hintUp:'주차 여유',fmt:function(v){return v>0?comma(v,1)+'㎡':'-';}},s.park&&s.totArea?s.totArea/s.park:0,c.park&&c.totArea?c.totArea/c.park:0));
    rows.push(ratioRow({id:'parkHo',grp:'주차',label:'호당 주차대수',higher:true,words:['많음','적음'],fmt:function(v){return v>0?rnd(v,2).toFixed(2)+'대':'-';}},s.park&&s.ho?s.park/s.ho:0,c.park&&c.ho?c.park/c.ho:0));
  }
  rows.push({id:'zone',grp:'참고',label:'용도지역 / 주용도',s:[s.zoning,s.mainUse].filter(Boolean).join(' / ')||'-',c:[c.zoning,c.mainUse].filter(Boolean).join(' / ')||'-',v:'ref',note:''});
  return rows;
}
// 대장에 없는 항목 — 현장조사 칸 + 우열 직접
function manualItems(resi){return resi?[{k:'heat',grp:'난방·관리',label:'난방방식'},{k:'mgmt',grp:'난방·관리',label:'동배치·조경·보안'}]
  :[{k:'vac',grp:'공실·임대',label:'공실 현황'},{k:'rent',grp:'공실·임대',label:'임대료 수준'}];}

// ── 의견 초안: 본건 기준 사실 문장(대장 + 현장조사 칸에서 우열 고른 것) ──
function hasBatchim(word){var w=txt(word).replace(/\(.*$/,'').replace(/[^가-힣]/g,'');if(!w)return false;var ch=w.charCodeAt(w.length-1)-0xAC00;return ch>=0&&ch<=11171&&ch%28!==0;}
function draftText(rows,man){
  var g={eq:[],up:[],dn:[]};
  rows.forEach(function(r){if(r.draft&&g[r.v])g[r.v].push(r.draft);});
  (man||[]).forEach(function(m){if(g[m.v])g[m.v].push({label:m.label,val:[m.s,m.c].filter(Boolean).length?(m.s||'-')+' / '+(m.c||'-'):''});});
  var W={eq:'대등',up:'우세',dn:'열세'},segs=[];
  ['eq','up','dn'].forEach(function(k){var a=g[k];if(!a.length)return;
    var last=a[a.length-1].label;
    segs.push(a.map(function(x){return x.label+(x.val?'('+x.val+')':'');}).join('·')+(hasBatchim(last)?'은 ':'는 ')+W[k]);});
  if(!segs.length)return'';
  return '본건은 사례 대비 '+segs.join('하고, ')+'함.';
}
// 여러 호수 「- 내부요인:」 줄에 문장 넣기
function setNoteLine(note,key,text){
  var base=txt(note)?String(note):'- 외부요인:\n- 내부요인:\n- 호별요인:\n- 기타요인:';
  var re=new RegExp('^(\\s*-\\s*'+key+'\\s*:).*$','m');
  if(re.test(base))return base.replace(re,function(_,h){return h+' '+text;});
  return base.replace(/\s*$/,'')+'\n- '+key+': '+text;
}

// ── 주소 ──
var SIDO=/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)/;
function firstParcel(s){return txt(s).split(/[,，]/)[0].replace(/\s*외\s*\d+\s*필지.*$/,'').replace(/번지/g,'').trim();}
function sggOf(addr){var m=firstParcel(addr).match(/^(.*?(?:시|군|구))\s+\S+(?:동|리|가|읍|면|로)(?:\s|\d|$)/);return m?m[1]:'';}
function caseAddr(c,ov){
  if(txt(c.bcAddr))return txt(c.bcAddr);
  var b=(txt(c.location)+' '+txt(c.jibun)).replace(/번지/g,'').replace(/\s+/g,' ').trim();
  if(!b||!/\d/.test(b))return'';
  if(SIDO.test(b))return b;
  var sgg=sggOf(ov&&ov.jibun);if(!sgg)return b;
  var st=sgg.split(' '),bt=b.split(' ');
  while(bt.length>1&&st.indexOf(bt[0])>=0)bt.shift();
  return sgg+' '+bt.join(' ');
}
function subjAddr(ov){return txt(ov&&ov.bcAddr)||firstParcel(ov&&ov.jibun);}
// 앱 배지와 같은 규칙(사례 카드 「동일단지」)
function sameComplex(c,ov){
  var normL=function(s){return (s||'').replace(/^[가-힣]+(특별|광역|특례)?시\s*/,'').replace(/[가-힣]+구\s*/,'').replace(/\s+/g,' ').trim();};
  var cl=normL(txt(c.location)+' '+txt(c.jibun)),sl=normL(ov&&ov.jibun||'');
  return !!(cl&&sl&&(cl===sl||sl.indexOf(cl)>=0||cl.indexOf(sl)>=0));
}
function pickDong(dongs,want,name){
  var w=stripDong(want);
  var d=w?dongs.find(function(x){return stripDong(x)===w;}):null;
  if(d==null&&txt(name))d=dongs.find(function(x){var sx=stripDong(x);return sx&&txt(name).indexOf(sx)>=0;});
  return d==null?dongs[0]:d;
}
var CACHE={};
function fetchAddr(addr,prefer){
  var k=addr;if(CACHE[k])return CACHE[k];
  var B=window.ArapBldrgst;
  if(!B)return Promise.reject(new Error('건축물대장 모듈(arap_bldrgst.js)이 없습니다'));
  CACHE[k]=B.search(addr).then(function(cands){
    var c=cands[0];
    if(prefer&&cands.length>1){var p=cands.find(function(x){return txt(x.addr).indexOf(prefer)>=0;});if(p)c=p;}
    return B.load(c.id,c.addr);
  });
  CACHE[k].catch(function(){delete CACHE[k];});
  return CACHE[k];
}

// ── React 패널 ──
var VSTY={up:{t:'▲ 우세',bg:'#dbeafe',fg:'#1d4ed8'},dn:{t:'▼ 열세',bg:'#fee2e2',fg:'#dc2626'},eq:{t:'＝ 대등',bg:'#f1f5f9',fg:'#475569'},ref:{t:'· 참고',bg:'#f8fafc',fg:'#94a3b8'},na:{t:'－',bg:'#f8fafc',fg:'#94a3b8'}};
function Panel(props){
  var R=window.React,h=R.createElement,useState=R.useState,useEffect=R.useEffect;
  var S=props.S||{},ov=props.ov||{},c=props.c||{},resi=!!props.resi;
  var same=props.same!=null?props.same:sameComplex(c,ov);
  var st0=useState(!same),open=st0[0],setOpen=st0[1];
  var st1=useState(null),sb=st1[0],setSb=st1[1];       // 본건 load 결과
  var st2=useState(null),cb=st2[0],setCb=st2[1];       // 사례 load 결과
  var st3=useState(''),err=st3[0],setErr=st3[1];
  var st4=useState(false),busy=st4[0],setBusy=st4[1];
  var st5=useState(0),tick=st5[0],setTick=st5[1];
  var st6=useState(''),addrIn=st6[0],setAddrIn=st6[1];
  var sA=subjAddr(ov),cA=caseAddr(c,ov),sgg=sggOf(ov.jibun);
  useEffect(function(){
    if(!open)return;
    if(!sA){setErr('본건 지번주소가 비어 있습니다 — 1. 접수 · 대상물건에서 지번주소를 넣으세요.');return;}
    if(!cA){setErr('사례 소재지·지번이 비어 있습니다 — 아래에 사례 지번을 직접 넣으세요.');return;}
    var alive=true;setBusy(true);setErr('');
    Promise.all([fetchAddr(sA,sgg).then(function(b){if(alive)setSb(b);return b;}),fetchAddr(cA,sgg).then(function(b){if(alive)setCb(b);return b;})])
      .catch(function(e){if(alive)setErr('조회 실패: '+(e&&e.message||e));})
      .then(function(){if(alive)setBusy(false);});
    return function(){alive=false;};
  },[open,sA,cA,tick]);
  var man=c.bcMan||{},sman=ov.bcMan||{};
  var rows=null,sDong='',cDong='',sSum=null,cSum=null;
  if(sb&&cb){
    sDong=pickDong(sb.dongs,ov.dong,ov.buildingName);
    cDong=txt(c.bcDong)&&cb.dongs.indexOf(c.bcDong)>=0?c.bcDong:pickDong(cb.dongs,c.dong,c.aptName);
    sSum=summarize(sb,sDong,resi);cSum=summarize(cb,cDong,resi);
    rows=compare(sSum,cSum,{resi:resi,baseDate:ov.baseDate});
  }
  var items=manualItems(resi);
  var manRows=items.map(function(it){return{label:it.label,s:txt(sman[it.k]),c:txt(man[it.k]),v:man[it.k+'J']||''};});
  var draft=rows?draftText(rows,manRows):'';
  var cnt={up:0,dn:0,eq:0};(rows||[]).forEach(function(r){if(cnt[r.v]!=null)cnt[r.v]++;});manRows.forEach(function(m){if(cnt[m.v]!=null)cnt[m.v]++;});

  var th=S.th||{},td=S.td||{},tdL=Object.assign({},td,{textAlign:'left'});
  function chip(v){var x=VSTY[v]||VSTY.na;return h('span',{style:{display:'inline-block',padding:'0 6px',borderRadius:8,fontSize:11,fontWeight:700,background:x.bg,color:x.fg,marginRight:6,whiteSpace:'nowrap'}},x.t);}
  var summary=h('summary',{style:{cursor:'pointer',padding:'7px 10px',fontWeight:700,color:'#1a2744',fontSize:12.5,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',listStyle:'none'},
      onClick:function(e){e.preventDefault();setOpen(!open);}},
    h('span',{style:{display:'inline-block',transform:open?'rotate(90deg)':'none',transition:'transform .15s'}},'▶'),
    '🏢 건물 비교 (본건 ↔ 사례 표제부)',
    same?h('span',{style:{fontWeight:400,color:'#059669',fontSize:11}},'동일단지 — 본건과 같은 건물이라 접어 둠'):null,
    rows?h('span',{style:{fontWeight:400,fontSize:11}},chip('dn'),cnt.dn,' ',chip('up'),cnt.up,' ',chip('eq'),cnt.eq):null,
    busy?h('span',{style:{fontWeight:400,color:'#64748b',fontSize:11}},'조회 중…'):null);
  var body=null;
  if(open){
    var kids=[];
    kids.push(h('div',{key:'src',style:{fontSize:11,color:'#64748b',margin:'0 0 6px',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}},
      '본건: ',h('b',null,sA||'-'),sb&&sb.dongs.length>1?' ('+sDong+')':'',' · 사례: ',h('b',null,cA||'-'),
      cb&&cb.dongs.length>1?h('select',{'aria-label':'사례 동 고르기',value:cDong,style:Object.assign({},S.sel2||{},{fontSize:11,padding:'1px 4px'}),onChange:function(e){props.onCase&&props.onCase('bcDong',e.target.value);}},
        cb.dongs.map(function(d){return h('option',{key:d,value:d},d||'(동 이름 없음)');})):null,
      h('button',{type:'button',style:Object.assign({},S.btn||{},{padding:'2px 8px',fontSize:11,background:'#fff',color:'#1e293b',border:'1px solid #cbd5e1'}),onClick:function(){delete CACHE[sA];delete CACHE[cA];setTick(tick+1);}},'↻ 다시 조회')));
    if(err||c.bcAddr)kids.push(h('div',{key:'addr',style:{fontSize:11,margin:'0 0 6px',display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}},
      err?h('span',{style:{color:'#dc2626'}},err):null,
      h('input',{'aria-label':'사례 지번 직접 입력',style:Object.assign({},S.inp||{},{fontSize:11,width:220}),placeholder:'사례 지번 (예: 성남시 분당구 서현동 312-3)',value:addrIn||c.bcAddr||'',onChange:function(e){setAddrIn(e.target.value);}}),
      h('button',{type:'button',style:Object.assign({},S.btn||{},{padding:'2px 8px',fontSize:11,background:'#fff',color:'#1e293b',border:'1px solid #cbd5e1'}),onClick:function(){props.onCase&&props.onCase('bcAddr',txt(addrIn));setAddrIn('');}},'이 주소로 조회')));
    if(rows){
      var trs=[],grpSpan={};
      rows.forEach(function(r){grpSpan[r.grp]=(grpSpan[r.grp]||0)+1;});
      items.forEach(function(it){grpSpan[it.grp]=(grpSpan[it.grp]||0)+1;});
      var done={};
      var gTd=function(g){if(done[g])return null;done[g]=1;return h('td',{rowSpan:grpSpan[g],style:Object.assign({},td,{background:'#f8fafc',fontWeight:700,color:'#475569',width:70})},g);};
      var hl={totArea:1,parkArea:1,parkPer:1};
      rows.forEach(function(r){
        trs.push(h('tr',{key:r.id,style:hl[r.id]?{background:'#fffbeb'}:null},gTd(r.grp),h('td',{style:td},r.label),h('td',{style:td},r.s),h('td',{style:td},r.c),
          h('td',{style:Object.assign({},tdL,{fontSize:11.5})},chip(r.v),r.note)));
      });
      items.forEach(function(it){
        var put=function(side,k,v){if(side==='s'){props.onOv&&props.onOv('bcMan',Object.assign({},sman,(function(){var o={};o[k]=v;return o;})()));}else{props.onCase&&props.onCase('bcMan',Object.assign({},man,(function(){var o={};o[k]=v;return o;})()));}};
        var inp=function(side,val){return h('input',{'aria-label':(side==='s'?'본건 ':'사례 ')+it.label,style:Object.assign({},S.inp||{},{width:'100%',boxSizing:'border-box'}),value:val||'',placeholder:'현장조사',onChange:function(e){put(side,it.k,e.target.value);}});};
        trs.push(h('tr',{key:'m_'+it.k},gTd(it.grp),h('td',{style:td},it.label),h('td',{style:td},inp('s',sman[it.k])),h('td',{style:td},inp('c',man[it.k])),
          h('td',{style:tdL},h('select',{'aria-label':it.label+' 우열',value:man[it.k+'J']||'',style:Object.assign({},S.sel2||{},{fontSize:11,padding:'1px 4px'}),onChange:function(e){put('c',it.k+'J',e.target.value);}},
            h('option',{value:''},'우열 직접 고르기'),h('option',{value:'up'},'▲ 우세'),h('option',{value:'eq'},'＝ 대등'),h('option',{value:'dn'},'▼ 열세')))));
      });
      kids.push(h('div',{key:'tbl',style:{overflowX:'auto'}},h('table',{style:S.tbl},
        h('thead',null,h('tr',null,h('th',{style:Object.assign({},th,{width:70})},'요인'),h('th',{style:Object.assign({},th,{width:150})},'항목'),
          h('th',{style:Object.assign({},th,{background:'#e0e7ff'})},'본건',h('span',{style:{fontWeight:400,color:'#64748b'}},' ('+(sSum.name||sDong||'')+')')),
          h('th',{style:th},'사례',h('span',{style:{fontWeight:400,color:'#64748b'}},' ('+(cSum.name||cDong||'')+')')),
          h('th',{style:Object.assign({},th,{width:250,background:'#e0e7ff'})},'본건 기준 비교'))),
        h('tbody',null,trs))));
      kids.push(h('div',{key:'lg',style:{fontSize:10.5,color:'#64748b',marginTop:4}},'▼ 열세 = 본건이 불리 · ▲ 우세 = 본건이 유리 · ＝ 대등 = 차이 10% 이내(경과연수는 1년 이내) · 「배」 = 큰 값 ÷ 작은 값 · 비교치 숫자는 평가사가'));
      kids.push(h('div',{key:'dr',style:{marginTop:8,padding:'8px 10px',background:'#f8fafc',border:'1px dashed #cbd5e1',borderRadius:6,fontSize:12}},
        h('b',{style:{color:'#1a2744'}},'✍ 단지 내부요인 의견 초안'),h('span',{style:{fontSize:11,color:'#64748b'}},' (본건 기준 사실 문장 — 넣은 뒤 자유롭게 고치기)'),
        h('div',{style:{margin:'4px 0 6px'},'data-bldcmp-draft':'1'},draft||'-'),
        draft&&props.onDraft?h('button',{type:'button',style:Object.assign({},S.btn||{},{background:'#2563eb',color:'#fff',border:'1px solid #2563eb'}),onClick:function(){props.onDraft(draft);}},props.draftLabel||'↓ 단지 내부요인 의견란에 넣기'):null));
    }else if(!err){kids.push(h('div',{key:'ld',style:{fontSize:12,color:'#64748b'}},'건축물대장 조회 중…'));}
    body=h('div',{style:{padding:'0 10px 10px'}},kids);
  }
  return h('details',{open:open,className:'bldcmp',style:{background:'#fff',border:'1px solid #c7d7f5',borderRadius:6,marginBottom:10}},summary,body);
}

window.ArapBldCmp={summarize:summarize,compare:compare,draftText:draftText,setNoteLine:setNoteLine,caseAddr:caseAddr,subjAddr:subjAddr,sggOf:sggOf,
  sameComplex:sameComplex,pickDong:pickDong,manualItems:manualItems,Panel:Panel,_cache:CACHE};
})();
