(function(){
  'use strict';
  const $=id=>document.getElementById(id), G=window.CondoStandardIndices, C=window.CondoStandardPrice;
  const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const fmt=v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:4});
  const won=v=>fmt(v)+'원';
  let rows=[],lands=[blankLand()],result=null,titles=[],pnu='',revision=0,unitRevision=0,lastSummary='';
  function blankLand(){return {method:'area',area:'',parcelArea:'',numerator:'',denominator:'',price:''};}
  function blankRow(){return {label:'',area:'',structNo:4,group:1,useIndex:'',adjustment:1};}
  function nowKorea(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10);}
  $('date').value=nowKorea();
  function getInput(){return {date:$('date').value,mode:$('mode').value,built:$('built').value,remodel:$('remodel').value,rows,lands,priceConfirmed:$('priceConfirmed').checked,rowsConfirmed:$('rowsConfirmed').checked,sjConfirmed:$('sjConfirmed').checked,officialTotal:$('officialTotal').value,officialConfirmed:$('officialConfirmed').checked};}
  function renderRows(){
    $('rows').innerHTML=rows.map((r,i)=>`<div class="row-card" data-row="${i}"><div class="row-head"><input aria-label="부분 ${i+1} 명칭" data-k="label" value="${esc(r.label)}" placeholder="전유 사무실 / 공용 주차장 등"><button type="button" data-remove-row="${i}" aria-label="부분 ${i+1} 삭제">삭제</button></div><div class="row-grid"><label>면적 (㎡)<input type="number" min="0.0001" step="any" data-k="area" value="${esc(r.area)}"></label><label>구조<select data-k="structNo">${G.STRUCT.map(s=>`<option value="${s[0]}" ${+r.structNo===s[0]?'selected':''}>${esc(s[1])}</option>`).join('')}</select></label><label>내용연수<select data-k="group">${[50,40,30,20].map((n,j)=>`<option value="${j+1}" ${+r.group===j+1?'selected':''}>${n}년</option>`).join('')}</select></label><label>용도지수 (%)<input type="number" min="1" data-k="useIndex" value="${esc(r.useIndex)}" list="uses" placeholder="용도표 참조"></label><label>상속·증여 조정률 (배율)<input type="number" min="0.001" step="any" data-k="adjustment" value="${esc(r.adjustment)}"><small>예: 130% → 1.3, 주차장 등은 별도 검토</small></label></div></div>`).join('');
    update();
  }
  function renderLands(){
    $('lands').innerHTML=lands.map((l,i)=>`<div class="land-card" data-land="${i}"><div class="row-head"><strong>필지 ${i+1}</strong><button class="remove" type="button" data-remove-land="${i}" aria-label="필지 ${i+1} 삭제">삭제</button></div><label>등기부 입력 방식<select data-k="method"><option value="area" ${l.method==='area'?'selected':''}>대지권 면적 직접 입력</option><option value="ratio" ${l.method==='ratio'?'selected':''}>전체 필지면적 × 대지권 비율</option></select></label><div class="grid"><label>전체 필지면적 (㎡)<input type="number" data-k="parcelArea" step="any" min="0.0001" value="${esc(l.parcelArea)}" placeholder="여러 필지의 위치지수 계산 시 필요"></label><label>개별공시지가 (원/㎡)<input type="number" data-k="price" step="1" min="1" value="${esc(l.price)}" placeholder="반올림하지 않은 원 단위"></label>${l.method==='area'?`<label>대지권 면적 (㎡)<input type="number" data-k="area" step="any" min="0.0001" value="${esc(l.area)}" placeholder="등기부에서 직접 입력"></label>`:`<label>대지권 분자<input type="number" data-k="numerator" step="any" min="0.0001" value="${esc(l.numerator)}" placeholder="등기부 ○분의 △ 중 △"></label><label>대지권 분모<input type="number" data-k="denominator" step="any" min="0.0001" value="${esc(l.denominator)}" placeholder="등기부 ○분의 △ 중 ○"></label>`}</div></div>`).join('');update();
  }
  function pair(k,v){return `<div class="pair"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`;}
  function update(){
    const mode=$('mode').value; $('manualPanel').hidden=mode!=='manual';$('officialPanel').hidden=!['official','housing'].includes(mode);
    result=C.calculate(getInput());$('copy').disabled=!!result.errors.length;lastSummary='';
    if(result.errors.length){$('resultTitle').textContent='계산에 필요한 정보를 확인하세요';$('amount').textContent='—';$('verdict').textContent='입력을 완료하면 해당 호 전체 기준으로 판단합니다.';$('breakdown').innerHTML='';$('messages').innerHTML=result.errors.map(e=>`<p class="error">${esc(e)}</p>`).join('');return;}
    $('resultTitle').textContent='소득세법 기준시가';$('amount').textContent=won(result.total);
    $('verdict').textContent=result.institutions===1?'10억 원 이하 · 감정기관 1곳 가능':'10억 원 초과 · 감정기관 2곳 이상 평균';
    $('breakdown').innerHTML=(result.official?pair('호별 일괄가격',won(result.total)):pair('토지 지분',won(result.land))+pair('건물 전유·공용',won(result.building))+pair('건물 면적 합계',fmt(result.totalArea)+'㎡')+pair('위치지수',result.loc.idx+'%'))+pair('10억 원과의 차이',won(Math.abs(result.gap))+(result.gap>=0?' 미달':' 초과'))+(result.sjTotal!==null&&result.sjTotal!==undefined?pair('상속·증여 보충적 평가 참고',won(result.sjTotal)):'');
    $('messages').innerHTML=result.near?'<p class="warning">10억 원과의 차이가 1천만 원 미만입니다. 공시 시점·면적·용도지수 원자료를 다시 확인하세요.</p>':'';
    const label=[$('address').value,$('dong').selectedOptions[0]?.textContent,$('ho').value].filter(Boolean).join(' ');
    lastSummary=['집합건물 기준시가 계산',label,'평가기준일: '+$('date').value,'계산방식: '+$('mode').selectedOptions[0].textContent,'소득세법 기준시가: '+won(result.total),$('verdict').textContent];
    if(!result.official){lastSummary.push('토지: '+won(result.land),'건물: '+won(result.building),'신축가격기준액: '+won(result.base)+'/㎡, 위치지수: '+result.loc.idx+'%');for(const l of lands){const a=l.method==='ratio'?Number(l.parcelArea)*Number(l.numerator)/Number(l.denominator):Number(l.area);lastSummary.push('대지권 '+fmt(a)+'㎡ × 공시지가 '+won(l.price)+'/㎡');}for(const l of result.lines)lastSummary.push((l.label||'부분')+': '+fmt(l.area)+'㎡ × '+won(l.unit)+'/㎡ = '+won(l.value)+' (구조 '+l.si+', 용도 '+l.useIndex+'%, 잔가율 '+l.rr+')');if(result.sjTotal!==null)lastSummary.push('상속·증여 보충적 평가 참고: '+won(result.sjTotal));}
    lastSummary.push('근거: 상증세법 시행령 제49조 제6항 · 소득세법 제99조 · 해당 연도 국세청 건물 기준시가 고시','감정기관 수 요건 검토용. 평가기간 등 다른 시가 인정 요건은 별도 확인.'); lastSummary=lastSummary.join('\n');
  }
  $('rows').addEventListener('input',e=>{const k=e.target.dataset.k,card=e.target.closest('[data-row]');if(!k||!card)return;rows[+card.dataset.row][k]=e.target.value;if(k==='structNo'){rows[+card.dataset.row].group=G.GROUP_OF[+e.target.value];renderRows();}$('rowsConfirmed').checked=false;$('sjConfirmed').checked=false;update();});
  $('rows').addEventListener('click',e=>{const b=e.target.closest('[data-remove-row]');if(!b)return;rows.splice(+b.dataset.removeRow,1);$('rowsConfirmed').checked=false;renderRows();});
  $('lands').addEventListener('input',e=>{const k=e.target.dataset.k,card=e.target.closest('[data-land]');if(!k||!card)return;lands[+card.dataset.land][k]=e.target.value;$('priceConfirmed').checked=false;if(k==='method')renderLands();else update();});
  $('lands').addEventListener('click',e=>{const b=e.target.closest('[data-remove-land]');if(!b)return;lands.splice(+b.dataset.removeLand,1);$('priceConfirmed').checked=false;renderLands();});
  $('addRow').onclick=()=>{rows.push(blankRow());$('rowsConfirmed').checked=false;renderRows();};
  $('addLand').onclick=()=>{lands.push(blankLand());$('priceConfirmed').checked=false;renderLands();};
  for(const id of ['date','mode','built','remodel','top','rowsConfirmed','priceConfirmed','sjConfirmed','officialTotal','officialConfirmed'])$(id).addEventListener('input',()=>{if(id==='date'){$('rowsConfirmed').checked=false;}if(['date','built','remodel','top'].includes(id)){$('priceConfirmed').checked=false;$('sjConfirmed').checked=false;$('officialConfirmed').checked=false;}update();});
  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(lastSummary);$('copyStatus').textContent='계산 근거를 복사했습니다.';}catch{ $('copyStatus').textContent='복사 권한을 사용할 수 없습니다. 인쇄 / PDF를 이용하세요.';}};
  $('print').onclick=()=>window.print();

  // Public address/building APIs; no registry/ownership API or inferred land-right area.
  const PROXY='https://ongyeol-proxy.woojin-apr.workers.dev', VW='https://api.vworld.kr';
  const DEFAULT_VKEY='8D5CB15B-426D-3015-9680-618B587ACBCB'; // same public, domain-scoped key as existing tools
  const apiKey=()=>{try{return localStorage.getItem('exact-vworld-key')||DEFAULT_VKEY;}catch{return DEFAULT_VKEY;}};
  async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('조회 서버 응답 오류 ('+r.status+')');return r.json();}
  function jsonp(url){return new Promise((resolve,reject)=>{const cb='__condo_'+Math.random().toString(36).slice(2),s=document.createElement('script');let timer;function clean(){clearTimeout(timer);delete window[cb];s.remove();}window[cb]=d=>{clean();resolve(d);};s.onerror=()=>{clean();reject(new Error('공공자료 조회 실패. 수동 입력을 이용하세요.'));};timer=setTimeout(()=>{clean();reject(new Error('조회 시간이 초과되었습니다.'));},12000);s.src=url+'&callback='+cb;document.head.appendChild(s);});}
  const vworld=url=>json(url).catch(()=>jsonp(url));
  async function bld(op,pnu,extra={}){let list=[];for(let page=1;page<=30;page++){const qs=new URLSearchParams({op,pnu,pageNo:String(page),numOfRows:'200',...extra});const d=await json(PROXY+'/bld?'+qs),b=d.response?.body;if(!b)throw new Error('건축물대장 응답이 없습니다.');const code=d.response?.header?.resultCode;if(code&&!['00','0','0000'].includes(String(code)))throw new Error('건축물대장 조회 실패');const raw=b.items?.item,items=raw?(Array.isArray(raw)?raw:[raw]):[];if(page>1&&Number(b.pageNo)!==page)throw new Error('대장 조회 서버의 페이지 처리를 확인해야 합니다.');list.push(...items);if(!items.length||list.length>=Number(b.totalCount||0))return list;}throw new Error('대장 자료가 많아 전체 조회를 마치지 못했습니다. 수동 입력하세요.');}
  function setStatus(text){$('status').textContent=text;}
  function resetUnit(){unitRevision++;rows=[];$('built').value='';$('top').value='';$('remodel').value='';$('rowsConfirmed').checked=false;$('sjConfirmed').checked=false;$('ho').innerHTML='<option value="">동을 선택하세요</option>';$('source').textContent='';renderRows();}
  function resetProperty(){resetUnit();pnu='';titles=[];lands=[blankLand()];$('priceConfirmed').checked=false;$('dong').innerHTML='<option value="">주소를 먼저 조회하세요</option>';$('officialTotal').value='';$('officialConfirmed').checked=false;renderLands();}
  $('address').addEventListener('input',()=>{revision++;resetProperty();$('candidatesPanel').hidden=true;setStatus('새 주소를 조회하세요. 이전 대상의 입력값을 비웠습니다.');});
  $('search').onclick=async()=>{
    const q=$('address').value.trim();if(!q){setStatus('지번주소를 입력하세요.');return;}
    const rev=++revision;resetProperty();$('search').disabled=true;setStatus('주소 조회 중…');
    try{const url=VW+'/req/search?'+new URLSearchParams({service:'search',request:'search',version:'2.0',size:'10',page:'1',query:q,type:'address',category:'parcel',format:'json',errorformat:'json',key:apiKey()});const d=await vworld(url);if(rev!==revision)return;const a=d.response?.result?.items||[];if(!a.length)throw new Error('해당 지번주소를 찾지 못했습니다.');$('candidates').innerHTML='<option value="">주소를 선택하세요</option>'+a.map(x=>`<option value="${esc(x.id)}">${esc(x.address?.parcel||x.title)}</option>`).join('');$('candidatesPanel').hidden=false;setStatus('조회된 주소를 선택하세요.');if(a.length===1){$('candidates').value=a[0].id;await chooseParcel(a[0].id,rev);}}catch(e){if(rev===revision)setStatus(e.message+' 직접 입력도 가능합니다.');}finally{$('search').disabled=false;}
  };
  $('candidates').onchange=()=>{const value=$('candidates').value;const rev=++revision;resetProperty();if(value)chooseParcel(value,rev);};
  async function chooseParcel(value,rev){
    pnu=value;setStatus('동 목록·공시지가 조회 중…');
    try{const [t,ld]=await Promise.all([bld('getBrTitleInfo',value),vworld(VW+'/ned/data/getLandCharacteristics?'+new URLSearchParams({key:apiKey(),pnu:value,format:'json',numOfRows:'100',pageNo:'1'})).catch(()=>null)]);if(rev!==revision)return;
      titles=t.filter(x=>/집합/.test((x.regstrGbCdNm||'')+(x.regstrKindCdNm||'')));if(!titles.length)throw new Error('집합건물 표제부를 찾지 못했습니다.');
      $('dong').innerHTML='<option value="">동을 선택하세요</option>'+titles.map((x,i)=>`<option value="${i}">${esc(x.dongNm||x.bldNm||'동 구분 없음')}</option>`).join('');
      const fields=ld?.landCharacteristicss?.field||[],arr=Array.isArray(fields)?fields:[fields],year=C.yearOf($('date').value),lf=arr.filter(x=>+x.stdrYear===year).sort((a,b)=>String(b.stdrMt||'').localeCompare(String(a.stdrMt||'')))[0];
      lands=[blankLand()];if(lf){lands[0].price=String(lf.pblntfPclnd||'');lands[0].parcelArea=String(lf.lndpclAr||'');}renderLands();setStatus('동을 선택하세요. '+(lf?year+'년 공시지가 조회값을 불러왔습니다. 적용 공시 시점은 직접 확인하세요.':'평가기준일 연도의 공시지가가 없어 비워 두었습니다. 직접 입력하세요.'));
      if(titles.length===1){$('dong').value='0';await chooseDong(rev);}
    }catch(e){if(rev===revision)setStatus(e.message+' 수동 입력을 이용하세요.');}
  }
  $('dong').onchange=()=>chooseDong(revision);
  async function chooseDong(rev){resetUnit();lands.forEach(l=>{l.area='';l.numerator='';l.denominator='';});$('priceConfirmed').checked=false;renderLands();const idx=$('dong').value;if(idx==='')return;const t=titles[+idx],u=unitRevision;setStatus('호 목록 조회 중…');try{const list=await bld('getBrExposInfo',pnu,{dongNm:t.dongNm||''});if(rev!==revision||u!==unitRevision)return;const hs=[...new Set(list.filter(x=>(x.dongNm||'')===(t.dongNm||'')).map(x=>String(x.hoNm||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));if(!hs.length)throw new Error('호 목록이 없습니다.');$('ho').innerHTML='<option value="">호를 선택하세요</option>'+hs.map(x=>`<option>${esc(x)}</option>`).join('');$('built').value=String(t.useAprDay||'').slice(0,4);$('top').value=t.grndFlrCnt||'';$('source').textContent='표제부: '+(t.bldNm||t.dongNm||'')+' · 사용승인 '+(t.useAprDay||'미확인')+' · 건물 전체 연면적 '+fmt(t.totArea||0)+'㎡';setStatus('호를 선택하세요. 대지권은 등기부에서 직접 입력합니다.');update();}catch(e){if(rev===revision&&u===unitRevision)setStatus(e.message);}}
  $('ho').onchange=async()=>{const ho=$('ho').value,t=titles[+$('dong').value],rev=revision,u=++unitRevision;rows=[];$('rowsConfirmed').checked=false;$('sjConfirmed').checked=false;lands.forEach(l=>{l.area='';l.numerator='';l.denominator='';});$('priceConfirmed').checked=false;renderLands();renderRows();if(!ho||!t)return;setStatus('전유·공용부분 조회 중…');try{const all=await bld('getBrExposPubuseAreaInfo',pnu,{dongNm:t.dongNm||'',hoNm:ho});if(rev!==revision||u!==unitRevision)return;const data=all.filter(x=>String(x.hoNm||'')===ho&&(x.dongNm||'')===(t.dongNm||''));if(!data.length)throw new Error('전유·공용면적 자료가 없습니다.');rows=C.registerRows(data,C.yearOf($('date').value));renderRows();setStatus(ho+' · '+data.length+'개 부분 불러옴. 구조·용도지수를 검토하고 대지권을 직접 입력하세요.');}catch(e){if(rev===revision&&u===unitRevision)setStatus(e.message);}};
  const dl=document.createElement('datalist');dl.id='uses';dl.innerHTML=G.USE.flatMap(g=>g[1].map(x=>`<option value="${G.useIdx(C.yearOf($('date').value),x[0])}">${esc(x[1])}</option>`)).join('');document.body.append(dl);
  rows=[blankRow()];renderRows();renderLands();
})();
