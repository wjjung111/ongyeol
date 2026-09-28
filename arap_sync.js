/* arap_sync.js — 저장건 GitHub 자동 백업(비공개 Gist) 공용 모듈
 * - ArapCred: GitHub 토큰을 크롬 비밀번호 관리자에 저장/불러오기(쿠키·사이트 데이터를 지워도 비밀번호는 남는다)
 * - ArapSyncLite.create(cfg): 토지건물처럼 React 밖 화면용 동기화 엔진 + 패널
 *   집합건물(s3r86w8a.html)의 window.ArapSync 와 같은 토큰(arap-gh-token)·같은 Gist(arap-gh-gist-id)를 쓰고,
 *   파일만 따로(cfg.file) 둔다 — 한 Gist 안에 앱별 파일이 나란히 들어가 서로 덮어쓰지 않는다.
 */
(function(){
  var TOKEN_KEY='arap-gh-token',GIST_KEY='arap-gh-gist-id',CRED_ID='온결 GitHub 토큰';
  var ALL_FILES=['arap_sync.json','arap_sync_toji.json'];
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){console.error('sync ls set',e);}}

  // ── 크롬 비밀번호 관리자 연동 ──
  var ArapCred={
    ok:function(){return !!(window.PasswordCredential&&navigator.credentials);},
    save:function(tok){if(!tok||!ArapCred.ok())return Promise.resolve(false);
      try{return navigator.credentials.store(new PasswordCredential({id:CRED_ID,password:tok,name:CRED_ID})).then(function(){return true;},function(){return false;});}
      catch(e){return Promise.resolve(false);}},
    load:function(){if(!ArapCred.ok())return Promise.resolve('');
      return navigator.credentials.get({password:true,mediation:'optional'}).then(function(c){return (c&&c.password)||'';},function(){return '';});}
  };
  window.ArapCred=ArapCred;

  function hdrs(t){return {'Authorization':'Bearer '+t,'Accept':'application/vnd.github+json'};}
  // 앱들이 함께 쓰는 Gist 찾기 — 저장된 id가 없으면 온결 파일이 든 Gist를 찾는다
  function findGist(t){
    var id=lsGet(GIST_KEY);
    function scan(p){
      if(p>3)return Promise.resolve(null);
      return fetch('https://api.github.com/gists?per_page=100&page='+p,{headers:hdrs(t)}).then(function(r){
        if(!r.ok)throw new Error('GitHub 응답 '+r.status+(r.status===401?' — 토큰이 잘못되었거나 만료됨':''));
        return r.json();
      }).then(function(arr){
        if(!arr.length)return null;
        var g=arr.find(function(x){return x.files&&ALL_FILES.some(function(f){return x.files[f];});});
        if(g){lsSet(GIST_KEY,g.id);return fetch('https://api.github.com/gists/'+g.id,{headers:hdrs(t)}).then(function(r){return r.json();});}
        return scan(p+1);
      });
    }
    if(id)return fetch('https://api.github.com/gists/'+id,{headers:hdrs(t)}).then(function(r){return r.ok?r.json():scan(1);});
    return scan(1);
  }

  /* cfg: {file, listKey, caseKey:id=>key, memoKey:id=>key, trashKey, onPulled(changed)} */
  function create(cfg){
    var timer=null,status='',listeners=[];
    function token(){return lsGet(TOKEN_KEY)||'';}
    function setStatus(s){status=s;listeners.forEach(function(f){try{f(s);}catch(e){console.error('sync status',e);}});}
    function readList(){try{return JSON.parse(lsGet(cfg.listKey)||'[]')||[];}catch(e){return [];}}
    function snapshot(){
      var out={v:1,savedAt:new Date().toISOString(),list:readList(),cases:{},memos:{}};
      out.list.forEach(function(it){
        var d=lsGet(cfg.caseKey(it.id));if(d!=null)out.cases[it.id]=d;
        if(cfg.memoKey){var m=lsGet(cfg.memoKey(it.id));if(m!=null)out.memos[it.id]=m;}
      });
      return out;
    }
    // 원격이 더 최신이거나 여기 없는 건만 받는다. 이 기기에서 그 뒤에 휴지통으로 보낸 건은 되살리지 않는다.
    function merge(remote){
      if(!remote||!remote.list)return 0;
      var local=readList(),byId={},changed=0,trash=[];
      local.forEach(function(it){byId[it.id]=it;});
      if(cfg.trashKey){try{trash=JSON.parse(lsGet(cfg.trashKey)||'[]')||[];}catch(e){}}
      remote.list.forEach(function(rit){
        var data=remote.cases&&remote.cases[rit.id];if(data==null)return;
        var lit=byId[rit.id];
        if(!lit&&trash.some(function(x){return x.id===rit.id&&x.t>=Date.parse(rit.updated||0);}))return;
        if(!lit||String(rit.updated||'')>String(lit.updated||'')){
          lsSet(cfg.caseKey(rit.id),data);
          if(cfg.memoKey&&remote.memos&&remote.memos[rit.id]!=null&&lsGet(cfg.memoKey(rit.id))==null)lsSet(cfg.memoKey(rit.id),remote.memos[rit.id]);
          byId[rit.id]=Object.assign({},rit);changed++;
        }
      });
      if(changed)lsSet(cfg.listKey,JSON.stringify(Object.keys(byId).map(function(k){return byId[k];})
        .sort(function(a,b){return String(b.updated||'').localeCompare(String(a.updated||''));})));
      return changed;
    }
    function pull(){
      var t=token();if(!t)return Promise.resolve({changed:0,skipped:true});
      return findGist(t).then(function(g){
        if(!g||!g.files||!g.files[cfg.file])return {changed:0,none:true};
        var f=g.files[cfg.file];
        return (f.truncated?fetch(f.raw_url).then(function(r){return r.text();}):Promise.resolve(f.content)).then(function(c){
          var remote=null;try{remote=JSON.parse(c||'null');}catch(e){console.error('sync remote parse',e);}
          return {changed:merge(remote)};
        });
      });
    }
    function push(){
      var t=token();if(!t)return Promise.resolve({skipped:true});
      var files={};files[cfg.file]={content:JSON.stringify(snapshot())};
      var id=lsGet(GIST_KEY);
      return (id?Promise.resolve(id):findGist(t).then(function(g){return g&&g.id;})).then(function(gid){
        return gid?fetch('https://api.github.com/gists/'+gid,{method:'PATCH',headers:hdrs(t),body:JSON.stringify({files:files})})
                  :fetch('https://api.github.com/gists',{method:'POST',headers:hdrs(t),body:JSON.stringify({description:'EXACT 저장건 동기화 (자동 생성 — 지우지 마세요)',public:false,files:files})});
      }).then(function(r){
        if(!r.ok)throw new Error('업로드 실패 '+r.status+(r.status===401?' — 토큰 확인':r.status===403?' — 토큰에 gist 권한 필요':''));
        return r.json();
      }).then(function(g){if(g&&g.id)lsSet(GIST_KEY,g.id);return {ok:true};});
    }
    function now(){return new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});}
    // 저장할 때마다 부른다 — 3초 모아서 한 번 업로드
    function touch(){
      if(!token())return;
      clearTimeout(timer);setStatus('⏳ 백업 대기...');
      timer=setTimeout(function(){setStatus('⏫ 백업 중...');
        push().then(function(){setStatus('☁️ 백업됨 '+now());},function(e){console.error('sync push',e);setStatus('⚠️ '+e.message);});},3000);
    }
    function syncNow(){
      setStatus('⏬ 받는 중...');
      return pull().then(function(p){setStatus('⏫ 올리는 중...');return push().then(function(){setStatus('☁️ 백업됨 '+now());return p;});})
        .catch(function(e){console.error('syncNow',e);setStatus('⚠️ '+e.message);throw e;});
    }
    function setToken(v){try{v?localStorage.setItem(TOKEN_KEY,v.trim()):localStorage.removeItem(TOKEN_KEY);}catch(e){}}
    // 연결: 토큰 저장 → 받고 올리기 → 비밀번호 관리자에 보관
    function connect(tok){
      tok=(tok||'').trim();setToken(tok);
      if(!tok){setStatus('연결 해제됨');return Promise.resolve({changed:0});}
      return syncNow().then(function(p){ArapCred.save(tok);if(p&&p.changed&&cfg.onPulled)cfg.onPulled(p.changed);return p;});
    }
    // 목록 패널 아래에 붙이는 연결 칸(토지건물용, 순수 DOM)
    function panelHtml(){
      var on=!!token();
      return '<div class="arap-sync">'+
        '<div class="arap-sync-row"><b>☁️ GitHub 자동 백업</b>'+
        '<input type="password" class="arap-sync-tok" autocomplete="current-password" placeholder="GitHub 토큰 (gist 권한) — 기기당 1회" value="'+(on?'••••••••':'')+'">'+
        '<button class="btn sm arap-sync-go">'+(on?'지금 백업':'연결')+'</button>'+
        (ArapCred.ok()?'<button class="btn sm gh arap-sync-cred" title="크롬 비밀번호 관리자에 저장해 둔 토큰을 불러와 연결">🔑 저장된 토큰으로 연결</button>':'')+
        '<span class="arap-sync-st'+(status.indexOf('⚠️')===0?' err':'')+'">'+status+'</span></div>'+
        '<div class="arap-sync-help">'+(on?'저장할 때마다 GitHub(비공개)에 자동 백업돼요. 크롬 기록을 지워도 「🔑 저장된 토큰으로 연결」 한 번이면 전부 돌아와요.':
          '연결해 두면 저장할 때마다 GitHub(비공개)에 자동 백업 → 크롬 기록·쿠키를 지워도 복구돼요. 토큰 발급: github.com → Settings → Developer settings → Personal access tokens(classic) → \'gist\' 권한만 체크. 집합건물과 같은 토큰이라 한쪽에서 연결하면 둘 다 연결돼요.')+'</div></div>';
    }
    function bindPanel(root){
      var inp=root.querySelector('.arap-sync-tok'),go=root.querySelector('.arap-sync-go'),cr=root.querySelector('.arap-sync-cred');
      if(!inp||!go)return;
      inp.addEventListener('focus',function(){if(inp.value==='••••••••')inp.value='';});
      go.addEventListener('click',function(){var v=inp.value==='••••••••'||!inp.value?token():inp.value;go.disabled=true;
        connect(v).then(null,function(){}).then(function(){go.disabled=false;});});
      if(cr)cr.addEventListener('click',function(){ArapCred.load().then(function(tok){
        if(!tok){alert('크롬에 저장된 토큰이 없습니다. 토큰을 직접 붙여넣고 「연결」을 눌러 주세요.');return;}
        cr.disabled=true;connect(tok).then(null,function(){}).then(function(){cr.disabled=false;});});});
    }
    // 접속 때: 연결돼 있으면 한 번 받아 온다
    if(token())setTimeout(function(){pull().then(function(p){setStatus('☁️ 연결됨');if(p.changed&&cfg.onPulled)cfg.onPulled(p.changed);},
      function(e){console.error('sync pull on load',e);setStatus('⚠️ '+e.message);});},800);
    return {touch:touch,syncNow:syncNow,connect:connect,token:token,getStatus:function(){return status;},
      onStatus:function(f){listeners.push(f);},panelHtml:panelHtml,bindPanel:bindPanel,_snapshot:snapshot,_merge:merge};
  }
  window.ArapSyncLite={create:create};
})();
