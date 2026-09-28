/*
  온결 공통 날짜칸 자동 정리 (arap_date.js)
  - data-date 속성이 붙은 입력칸에서 20260501 처럼 숫자 8자리를 치면 2026.05.01 로 바꿔 보여준다.
    2026-05-01, 2026/5/1, 2026.5.1 도 칸을 벗어날 때 2026.05.01 로 맞춘다. 날짜로 안 읽히는 값은 건드리지 않는다.
  - 값을 바꾼 뒤 input 이벤트를 다시 쏘므로, 칸에 걸린 oninput(저장·재계산)이 그대로 따라간다.
  - 사용 방법: <body> 아래에서 <script src="arap_date.js"></script> 를 읽고, 날짜 입력칸에 data-date 를 붙인다.
    (집합건물·입주권 앱은 React 안에서 autoDateFmt 로 같은 일을 이미 하므로 이 파일을 붙이지 않는다)
  - data-date-sep="/" 를 붙이면 2026/05/01 로 맞춘다(청구서용 의뢰일 — 집합건물과 같은 형식).
  - 달력 팝업: 이 파일을 읽기 전에 window.ARAP_DATE_POPUP=true 를 두면, 표 밖의 날짜칸을 누를 때
    집합건물 앱(DateF·CalPop)과 같은 달력이 칸 아래에 뜬다. 날짜를 누르면 칸에 채우고 닫힘(‹ › 달 이동, 「오늘」).
*/
(function(){
  function norm(v){
    var s=String(v==null?"":v).trim();
    if(!s)return null;
    var m=s.match(/^(\d{4})(\d{2})(\d{2})$/)||s.match(/^(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})\s*\.?$/);
    if(!m)return null;
    var y=+m[1],mo=+m[2],d=+m[3];
    if(y<1900||y>2100||mo<1||mo>12||d<1||d>31)return null;
    return y+"."+String(mo).padStart(2,"0")+"."+String(d).padStart(2,"0");
  }
  function sepOf(el){var s=el&&el.getAttribute&&el.getAttribute("data-date-sep");return s||".";}
  function withSep(n,sep){return sep==="."?n:n.split(".").join(sep);}
  function apply(el,onlyDigits){
    if(!el||el.tagName!=="INPUT"||!el.hasAttribute("data-date"))return;
    var raw=el.value;
    if(onlyDigits&&!/^\d{8}$/.test(raw.trim()))return;   // 치는 중에는 8자리 숫자만 바꾼다 (2026-0 처럼 쓰는 중인 값은 그대로)
    var n=norm(raw);
    if(n!=null)n=withSep(n,sepOf(el));
    if(n==null||n===raw)return;
    el.value=n;
    try{el.dispatchEvent(new Event("input",{bubbles:true}));}catch(e){}
  }
  document.addEventListener("input",function(e){apply(e.target,true);},true);
  document.addEventListener("change",function(e){apply(e.target,false);},true);
  window.arapDateNorm=norm;

  // ── 달력 팝업 (집합건물 CalPop과 같은 모양) ──
  if(!window.ARAP_DATE_POPUP)return;
  var pop=null,target=null,ym=null;
  function pad(n){return String(n).padStart(2,"0");}
  function close(){if(pop){pop.remove();pop=null;}target=null;}
  function pick(d){
    if(!target)return;var el=target;
    el.value=d.getFullYear()+sepOf(el)+pad(d.getMonth()+1)+sepOf(el)+pad(d.getDate());
    try{el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}catch(e){}
    close();
  }
  function draw(){
    if(!pop||!target)return;
    var m=String(target.value||"").match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/);
    var sel=m?{y:+m[1],mo:+m[2]-1,d:+m[3]}:null,now=new Date(),tod={y:now.getFullYear(),mo:now.getMonth(),d:now.getDate()};
    var same=function(d,o){return o&&d.getFullYear()===o.y&&d.getMonth()===o.mo&&d.getDate()===o.d;};
    var start=new Date(ym.y,ym.mo,1).getDay(),h='';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><b style="font-size:13px">'+ym.y+'년 '+(ym.mo+1)+'월</b>'+
       '<span><button type="button" data-nav="-1" style="border:none;background:transparent;cursor:pointer;font-size:15px;color:#555;padding:0 6px">‹</button>'+
       '<button type="button" data-nav="1" style="border:none;background:transparent;cursor:pointer;font-size:15px;color:#555;padding:0 6px">›</button></span></div>';
    h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:11px;color:#888;margin-bottom:2px">'+
       ["일","월","화","수","목","금","토"].map(function(d){return '<span style="padding:2px 0">'+d+'</span>';}).join("")+'</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center">';
    for(var i=0;i<42;i++){var d=new Date(ym.y,ym.mo,i-start+1),cur=d.getMonth()===ym.mo,isSel=same(d,sel),isTod=same(d,tod);
      h+='<button type="button" data-day="'+d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate()+'" style="border:'+(isTod&&!isSel?'1px solid #1a73e8':'1px solid transparent')+
         ';background:'+(isSel?'#1a73e8':'transparent')+';color:'+(isSel?'#fff':cur?'#333':'#c5c9d0')+
         ';border-radius:50%;width:28px;height:28px;margin:1px auto;font-size:12px;cursor:pointer;line-height:1;padding:0;font-family:inherit">'+d.getDate()+'</button>';}
    h+='</div><div style="margin-top:6px"><button type="button" data-today="1" style="border:none;background:transparent;color:#1a73e8;font-size:12px;font-weight:700;cursor:pointer;padding:0;font-family:inherit">오늘</button></div>';
    pop.innerHTML=h;
  }
  function place(){
    if(!pop||!target)return;var r=target.getBoundingClientRect();
    pop.style.left=Math.max(4,Math.min(r.left+window.scrollX,window.scrollX+document.documentElement.clientWidth-244))+"px";
    pop.style.top=(r.bottom+window.scrollY+4)+"px";
  }
  function open(el){
    if(target===el&&pop)return;close();target=el;
    var m=String(el.value||"").match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/),now=new Date();
    ym=m?{y:+m[1],mo:+m[2]-1}:{y:now.getFullYear(),mo:now.getMonth()};
    pop=document.createElement("div");pop.className="arap-calpop";
    pop.style.cssText="position:absolute;z-index:3000;background:#fff;border:1px solid #dadce0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);padding:10px 12px;width:236px;font-family:inherit;font-size:13px;color:#1a2744";
    // 달력을 눌러도 칸의 포커스가 빠지지 않게(빠지면 먼저 닫혀 버림)
    pop.addEventListener("mousedown",function(e){e.preventDefault();});
    pop.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;
      if(b.getAttribute("data-nav")){var t=new Date(ym.y,ym.mo+(+b.getAttribute("data-nav")),1);ym={y:t.getFullYear(),mo:t.getMonth()};draw();return;}
      if(b.getAttribute("data-today")){pick(new Date());return;}
      var p=(b.getAttribute("data-day")||"").split("-");if(p.length===3)pick(new Date(+p[0],+p[1],+p[2]));});
    document.body.appendChild(pop);draw();place();
  }
  function eligible(el){return el&&el.tagName==="INPUT"&&el.hasAttribute("data-date")&&!el.closest("table")&&!el.readOnly&&!el.disabled;}
  document.addEventListener("focusin",function(e){if(eligible(e.target))open(e.target);else if(pop&&!pop.contains(e.target))close();});
  document.addEventListener("focusout",function(e){if(e.target===target)setTimeout(function(){if(document.activeElement!==target)close();},0);});
  document.addEventListener("keydown",function(e){if(pop&&e.key==="Escape")close();},true);
  document.addEventListener("input",function(e){if(pop&&e.target===target){var m=String(target.value||"").match(/^(\d{4})\D?(\d{1,2})\D?(\d{1,2})$/);if(m){ym={y:+m[1],mo:+m[2]-1};}draw();}});
  window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
})();
