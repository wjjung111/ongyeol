/*
  온결 접속 기록 (arap_visit.js)  →  window.arapVisitLog(action, detail)
  - 이름 게이트(arap_name.js)로 적은 이름 + 기기·브라우저 + IP·지역을 관리자 수신함 '접속' 탭에 보낸다(관리자.html·test.html 「접속 기록」에서 조회).
  - IP·지역은 앱스 스크립트가 알 수 없어 브라우저가 IP 조회 서비스(ipwho.is → 실패 시 ipapi.co)에서 받아 함께 보낸다. 실패해도 기기·시각은 기록.
  - 사용: <script src="arap_name.js"></script> 다음에  <script>window.ARAP_VISIT_PAGE='거래사례 위치도';</script><script src="arap_visit.js"></script>
    이름이 확정되면 '접속'을 자동으로 한 번 보낸다. 그 뒤 의미 있는 동작은 arapVisitLog('붙여넣기','KAIS 토지 3건')처럼.
  - 시점수정(arm_시점수정.html)은 같은 내용을 페이지 안에 따로 갖고 있다(원본). 이 파일은 그것을 페이지 이름만 받게 옮긴 것.
  - 실패해도 페이지 동작에는 영향 없음.
*/
(function(){
  'use strict';
  var URL_='https://script.google.com/macros/s/AKfycbxx2D6-vWHBS7UPUrhdd4Fz5iayqUlgM4IZcqlNCAuERxY3Wpijdo3xw29Xz3_gs_7Leg/exec';
  if(!window.ARAP_USAGE_URL)window.ARAP_USAGE_URL=URL_;
  var page=window.ARAP_VISIT_PAGE||document.title||'기타';
  var ua=navigator.userAgent||'';
  var touchMac=/Macintosh/.test(ua)&&navigator.maxTouchPoints>1;          // iPadOS는 데스크톱 UA로 위장
  var mobile=(navigator.userAgentData&&navigator.userAgentData.mobile)||/Mobi|Android|iPhone|iPod/i.test(ua);
  var device=(/iPad|Tablet/i.test(ua)||touchMac)?'태블릿':mobile?'휴대폰':'PC';
  var os=/Windows/i.test(ua)?'Windows':/iPhone|iPad|iPod/i.test(ua)||touchMac?'iOS':/Android/i.test(ua)?'Android':/Mac OS/i.test(ua)?'macOS':'';
  var browser=/Whale/i.test(ua)?'웨일':/SamsungBrowser/i.test(ua)?'삼성브라우저':/Edg\//i.test(ua)?'엣지':/KAKAOTALK/i.test(ua)?'카카오톡':/NAVER\(/i.test(ua)?'네이버앱':/Chrome\//i.test(ua)?'크롬':/Safari\//i.test(ua)?'사파리':/Firefox/i.test(ua)?'파이어폭스':'기타';
  var KO={'South Korea':'대한민국','Korea':'대한민국','Seoul':'서울','Busan':'부산','Incheon':'인천','Daegu':'대구','Daejeon':'대전','Gwangju':'광주','Ulsan':'울산','Sejong':'세종','Gyeonggi-do':'경기','Gangwon-do':'강원','Chungcheongbuk-do':'충북','Chungcheongnam-do':'충남','Jeollabuk-do':'전북','Jeollanam-do':'전남','Gyeongsangbuk-do':'경북','Gyeongsangnam-do':'경남','Jeju-do':'제주'};
  function ko(s){return KO[s]||s||'';}
  function uniq(v,i,a){return v&&a.indexOf(v)===i;}
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function fetchJson(url){
    var c=new AbortController(),t=setTimeout(function(){c.abort();},5000);
    return fetch(url,{signal:c.signal,cache:'no-store'}).then(function(r){return r.json();}).finally(function(){clearTimeout(t);});
  }
  var geoP=null;
  function geo(){
    return geoP||(geoP=fetchJson('https://ipwho.is/').then(function(j){
      if(j&&j.success!==false&&j.ip)return {ip:j.ip,region:[ko(j.country),ko(j.region),ko(j.city)].filter(uniq).join(' '),isp:(j.connection&&(j.connection.isp||j.connection.org))||''};
      throw new Error('ipwho 실패');
    }).catch(function(e){console.error('geo1',e);
      return fetchJson('https://ipapi.co/json/').then(function(j){
        if(j&&!j.error&&j.ip)return {ip:j.ip,region:[ko(j.country_name),ko(j.region),ko(j.city)].filter(uniq).join(' '),isp:j.org||''};
        throw new Error('ipapi 실패');
      });
    }).catch(function(e){console.error('geo2',e);return {ip:'',region:'확인 실패',isp:''};}));
  }
  window.arapVisitLog=function(action,detail){
    return geo().then(function(g){
      var p={visit:'1',page:page,user:lsGet('arap-user-name')||'(이름 미등록)',action:action||'',
        device:device+(os?' · '+os:''),browser:browser,ip:g.ip,region:g.region,isp:g.isp,detail:String(detail||'').slice(0,300)};
      return fetch(window.ARAP_USAGE_URL+'?'+new URLSearchParams(p).toString(),{cache:'no-store'});
    }).catch(function(e){console.error('visit log',e);});
  };
  // 이름을 적은 뒤에 '접속'을 보낸다(이미 저장돼 있으면 즉시) — 이름 없는 접속 기록이 남지 않게
  if(window.arapNameReady)window.arapNameReady(function(){window.arapVisitLog('접속','');});
  else window.arapVisitLog('접속','');
})();
