/*
  온결 공통 날짜칸 자동 정리 (arap_date.js)
  - data-date 속성이 붙은 입력칸에서 20260501 처럼 숫자 8자리를 치면 2026.05.01 로 바꿔 보여준다.
    2026-05-01, 2026/5/1, 2026.5.1 도 칸을 벗어날 때 2026.05.01 로 맞춘다. 날짜로 안 읽히는 값은 건드리지 않는다.
  - 값을 바꾼 뒤 input 이벤트를 다시 쏘므로, 칸에 걸린 oninput(저장·재계산)이 그대로 따라간다.
  - 사용 방법: <body> 아래에서 <script src="arap_date.js"></script> 를 읽고, 날짜 입력칸에 data-date 를 붙인다.
    (집합건물·입주권 앱은 React 안에서 autoDateFmt 로 같은 일을 이미 하므로 이 파일을 붙이지 않는다)
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
  function apply(el,onlyDigits){
    if(!el||el.tagName!=="INPUT"||!el.hasAttribute("data-date"))return;
    var raw=el.value;
    if(onlyDigits&&!/^\d{8}$/.test(raw.trim()))return;   // 치는 중에는 8자리 숫자만 바꾼다 (2026-0 처럼 쓰는 중인 값은 그대로)
    var n=norm(raw);
    if(n==null||n===raw)return;
    el.value=n;
    try{el.dispatchEvent(new Event("input",{bubbles:true}));}catch(e){}
  }
  document.addEventListener("input",function(e){apply(e.target,true);},true);
  document.addEventListener("change",function(e){apply(e.target,false);},true);
  window.arapDateNorm=norm;
})();
