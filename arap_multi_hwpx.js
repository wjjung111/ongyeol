/* 여러 호수 주거용 HWPX: 사용자 양식의 표/글꼴을 유지하며 행을 복제한다. */
(function(g){'use strict';
const HP='http://www.hancom.co.kr/hwpml/2011/paragraph',HC='http://www.hancom.co.kr/hwpml/2011/core',HH='http://www.hancom.co.kr/hwpml/2011/head',OPF='http://www.idpf.org/2007/opf/';
const num=v=>{if(v==null||String(v).trim()==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null;};
const blank=v=>v==null||String(v).trim()==='';
function resolveCase(u,cases){
 const selected=cases.filter(c=>c.isSelected);
 if(u?.appliedCaseId!=null)return selected.find(c=>String(c.id)===String(u.appliedCaseId))||null;
 if(u?.appliedSymbol)return selected.find(c=>String(c.symbol)===String(u.appliedSymbol))||null;
 return selected.find(c=>c.timeAdj)||selected[0]||null;
}
const effectiveArea=u=>num([u.assessedArea,u.evalArea,u.area].find(v=>!blank(v)));
function calculateUnit(u,appC,settings,h){
 const factor=k=>blank(u[k])?1:num(u[k]);
 const ext=factor('extFactor'),intF=factor('intFactor'),ho=factor('hoFactor'),etc=factor('etcFactor'),totFac=[ext,intF,ho,etc].every(v=>v>0)?ext*intF*ho*etc:null,ua=effectiveArea(u);
 const hasAdjU=!!(num(appC?.unitPrice)>0&&num(appC?.timeAdj)>0&&[ext,intF,ho,etc].every(v=>v>0));
 const raw=hasAdjU?num(appC.unitPrice)*num(appC.timeAdj)*totFac:null;
 const rnd=hasAdjU?h.applyR(raw,h.getUV(settings.uD),settings.uM):null,ready=hasAdjU&&ua>0;
 const rawAmt=ready?rnd*ua:null,finalAmt=ready?h.applyR(rawAmt,h.getUV(settings.tD),settings.tM):null;
 return {ext,intF,ho,etc,totFac,ua,raw,rnd,rawAmt,finalAmt,appC,hasAdjU,ready};
}
const fmt=v=>v==null||!Number.isFinite(Number(v))?'':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:4});
const text=v=>v==null?'':String(v),sym=i=>'가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허그느드르므브스으즈츠크트프흐'[i]||String(i+1);
const FACTOR_NOTE_DEFAULT='- 외부요인:\n- 내부요인:\n- 호별요인:\n- 기타요인:';
const all=(n,name)=>Array.from(n.getElementsByTagNameNS(HP,name));
const children=(n,name)=>Array.from(n.children).filter(e=>e.localName===name);
const xml=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('한글 문서 XML을 읽지 못했습니다.');return d;};
const serial=d=>new XMLSerializer().serializeToString(d);
const visible=n=>all(n,'t').map(x=>x.textContent).join('');
function caseValues(c,idx,parse,ov){
 c=c||{};const t=parse(c.timeAdjDetail||'',c.tradeDate,ov.baseDate),kind=t.유형||(/오피스텔/.test(c.aptName+' '+ov.kind)?'오피스텔':ov.kind||'');
 return {'선정_기호':c.symbol!=null?'#'+c.symbol:'','선정_법정동':c.location||'','선정_지번':c.jibun||'','선정_건물명':c.aptName||'','선정_동층호':[c.dong,c.floor,c.ho].some(v=>!blank(v))?[c.dong,c.floor,c.ho].map(text).join('/'):'','선정_전유면적':fmt(num(c.exclusiveArea)),'선정_가격':fmt(num(c.price)),'선정_단가':fmt(num(c.unitPrice)),'선정_거래시점':c.tradeDate||'','선정_승인일':c.approvalDate||'',
 '시점수정_용도':kind,'지수출처':kind==='오피스텔'?'한국부동산원 오피스텔 가격동향조사':'한국부동산원 전국주택가격동향조사','지수기준월':idx?.tables?.[kind]?.baseMonth||'',
 '거래지수기간':t.거래지수기간,'기준지수기간':t.기준지수기간,'거래지수값':t.거래지수값,'기준지수값':t.기준지수값,'지수지역':t.지역,'시점수정산식':t.시점수정산식||c.timeAdjDetail||'','상승률':c.timeAdj?((Number(c.timeAdj)-1)*100).toFixed(3):'','적용_시점수정':c.timeAdj?Number(c.timeAdj).toFixed(5):''};
}
function model(input,h){
 const {ov,cases=[],uD,uM,tD,tM}=input,selected=cases.filter(c=>c.isSelected),ref=selected.find(c=>c.timeAdj)||selected[0];
 const shown=cases.filter(c=>c.isShown||c.isSelected);const numbered=shown.map((c,i)=>({...c,symbol:i+1,originalSymbol:c.symbol}));
 const findCase=u=>{const c=resolveCase(u,cases);return c?numbered.find(x=>x.id===c.id)||c:null;};
 const units=(ov.units||[]).filter(u=>u&&(u.ho||u.dong||u.floor||num(u.area)>0));
 if(!units.length)throw Error('② 대상물건개요에 호수를 입력하세요.');
 const rows=units.map((u,i)=>{const c=findCase(u),cal=calculateUnit(u,c,input,h),{ext,intF,ho,etc,totFac:factor,ua:area,raw,rnd:unit,finalAmt:amount,ready}=cal;
 const cv=caseValues(c,g.ARAP_INDEX_DATA,h.parseTimeAdjDetail,ov);
 return {u,c,area,unit,amount,ready,values:{...cv,'일련번호':sym(i),'동':u.dong||'','층':u.floor||'','호수':u.ho||'','동층호':[u.dong,u.floor,u.ho].map(text).join('/'),'대지지분':fmt(num(u.landArea)),'전유면적':fmt(num(u.area)),'평가면적':fmt(area),'공용면적':fmt(num(u.commonArea)),'합계면적':num(u.area)!=null&&num(u.commonArea)!=null?fmt(num(u.area)+num(u.commonArea)):'',
 '외부_비교치':ext==null?'':ext.toFixed(3),'내부_비교치':intF==null?'':intF.toFixed(3),'호별_비교치':ho==null?'':ho.toFixed(3),'기타_비교치':etc==null?'':etc.toFixed(3),'가형요_합계':factor==null?'':factor.toFixed(3),'개별요인_의견':u.factorNote||FACTOR_NOTE_DEFAULT,'적용_사례단가':c?fmt(num(c.unitPrice)):'','적용_사정보정':c?'1.000':'','적용_지역요인':c?'1.000':'','적용_가형요':factor==null?'':factor.toFixed(3),'적용_산출단가':fmt(raw==null?null:Math.round(raw)),'적용_결정단가':fmt(unit),'감정평가액':fmt(amount)}};});
 const total=rows.every(r=>r.ready)?rows.reduce((n,r)=>n+r.amount,0):null,used=[];rows.forEach(r=>{if(r.c&&!used.some(c=>c.id===r.c.id))used.push(r.c);});
 const name=g.ArapBldrgst?g.ArapBldrgst.buildingNameOnly(ov.buildingName):ov.buildingName||'',floors=text(ov.floors).split('/'),parts=text(ov.jibun).match(/^(.*?)([^\s]+(?:동|리|가))\s+(.+)$/);
 const common={...caseValues(used[0],g.ARAP_INDEX_DATA,h.parseTimeAdjDetail,ov),'의뢰인':ov.client||'','접수번호':ov.caseNoDisplay||ov.caseNo||'','건명':[ov.jibun,name,rows[0].values['동층호']+'호'+(rows.length>1?' 외 '+(rows.length-1)+'개호':'')].filter(Boolean).join(' '),'감정평가액':fmt(total),'감정평가액한글':total!=null?h.numberToKoreanMoney(total)+'원':'','소유자':ov.owner||'','제출처':ov.submitTo||'','평가목적':ov.purpose||'','평가구분':ov.evalCategory||'','기준시점':ov.baseDate||'','조사기간':ov.surveyDate||'','작성일자':ov.writeDate||'','감정평가사':ov.appraiserName||'','심사자':ov.reviewerName||'','세대':rows.length+'개호','세대_사정':rows.length+'개호','유형':ov.kind||ov.mainUseJeonyu||'','건물명':name,'소재지_동까지':parts?(parts[1]+parts[2]).trim():ov.jibun||'','소재지_시군구':parts?parts[1].trim():'','소재지_지번':parts?(parts[2]+' '+parts[3]):ov.jibun||'','규모':floors[0]?('지상 '+floors[0]+'층'+(floors[1]?' / 지하 '+floors[1]+'층':'')):'','주구조':ov.structure||'','주용도_표제부':ov.mainUse||'','사용승인일':ov.approvalDate||'','인근위치설명':ov.nearDesc||'','기준시점근거구':ov.baseDateBasis==='현장조사완료일인'?'대상물건의 가격조사를 완료한 날짜인':ov.baseDateBasis||'','사례선정이유':ov.caseSelectionReason||(used.length?'대상물건과의 위치·용도·규모 및 가격형성요인의 유사성을 고려하여 '+used.map(c=>'#'+c.symbol).join(', ')+'을 비교 거래사례로 선정하였음.':''),'사정보정치':used.length?'1.000':''};
 for(const key of ['위생','급배수','급탕','난방','냉방','승강기','소방','방송','비고'])common['설비_'+key]=ov['facility'+key]||'';
 return {ov,rows,shown:numbered,used,total,common,images:ov.reportImages||[],toice:h.assembleToice(ov),roundNote:tM==='none'?'':`※ 호별 감정평가액은 ${tD} 단위에서 ${tM==='round'?'반올림':'절사'}하여 결정하였음.`,adjusted:rows.some(r=>r.area!==num(r.u.area))};
}
function render(entries,m,h,mode){
 const byName=new Map(entries.map(e=>[e.name,e]));const read=n=>new TextDecoder().decode(byName.get(n).data),write=(n,s)=>{const data=new TextEncoder().encode(s);if(byName.has(n))byName.get(n).data=data;else{const e={name:n,data};entries.push(e);byName.set(n,e);}};
 const header=xml(read('Contents/header.xml')),black={};const chars=header.getElementsByTagNameNS(HH,'charProperties')[0];let cid=Math.max(...Array.from(chars.children).map(e=>+e.getAttribute('id')))+1;
 Array.from(chars.children).forEach(c=>{if(!/^#?(000000|FFFFFF)$/i.test(c.getAttribute('textColor')||'')){const b=c.cloneNode(true);black[c.getAttribute('id')]=String(cid);b.setAttribute('id',cid++);b.setAttribute('textColor','#000000');chars.appendChild(b);}});chars.setAttribute('itemCnt',chars.children.length);
 const reset=n=>all(n,'linesegarray').forEach(x=>x.remove());
 function setText(cell,value){const ps=cell.localName==='p'?[cell]:all(cell,'p'),p=ps[0];if(!p)return;ps.slice(1).forEach(x=>x.remove());const runs=children(p,'run');const run=runs[0]||p.appendChild(p.ownerDocument.createElementNS(HP,'hp:run'));runs.slice(1).forEach(x=>x.remove());Array.from(run.children).forEach(x=>x.remove());const t=p.ownerDocument.createElementNS(HP,'hp:t');t.textContent=text(value);run.appendChild(t);run.setAttribute('charPrIDRef',black[run.getAttribute('charPrIDRef')]||run.getAttribute('charPrIDRef')||'28');reset(cell);}
 function fill(n,values){all(n,'t').forEach(t=>{if(!t.textContent.includes('{{'))return;t.textContent=t.textContent.replace(/\{\{([^}]+)\}\}/g,(_,k)=>text(values[k]));const r=t.parentNode;if(black[r.getAttribute('charPrIDRef')])r.setAttribute('charPrIDRef',black[r.getAttribute('charPrIDRef')]);let p=r;while(p&&p.localName!=='p')p=p.parentNode;if(p)reset(p);});}
 function repair(t){const rows=children(t,'tr');t.setAttribute('rowCnt',rows.length);t.setAttribute('pageBreak','CELL');t.setAttribute('repeatHeader','1');t.setAttribute('noAdjust','0');const pos=children(t,'pos')[0];if(pos){pos.setAttribute('treatAsChar','0');pos.setAttribute('horzRelTo','COLUMN');pos.setAttribute('vertRelTo','PARA');}let height=0;rows.forEach((r,i)=>{let rh=0;children(r,'tc').forEach(c=>{const a=children(c,'cellAddr')[0];if(a)a.setAttribute('rowAddr',i);const sz=children(c,'cellSz')[0];if(sz)rh=Math.max(rh,+sz.getAttribute('height')/(+children(c,'cellSpan')[0]?.getAttribute('rowSpan')||1));});height+=rh;});const sz=children(t,'sz')[0];if(sz)sz.setAttribute('height',Math.ceil(height));reset(t);}
 function expand(t,start,count,maps,mutate){const old=children(t,'tr').slice(start,start+count),anchor=old[0];maps.forEach((map,i)=>{old.forEach((r,j)=>{const clone=r.cloneNode(true);if(mutate)mutate(clone,map,i,j);fill(clone,{...m.common,...map});t.insertBefore(clone,anchor);});});old.forEach(r=>r.remove());children(t,'tr').forEach((r,i)=>children(r,'tc').forEach(c=>c.setAttribute('header',i<start?'1':'0')));repair(t);}
 const full=mode==='full',doc=xml(read('Contents/section1.xml')),tables=all(doc,'tbl');
 if(tables.length!==10||[1,7,5,2,3,14,9,3,2,2].some((n,i)=>children(tables[i],'tr').length!==n))throw Error('여러 호수 템플릿의 표 구조가 변경되었습니다. 템플릿 버전을 확인하세요.');
 // 템플릿의 빈 문단과 페이지 여백은 고정 머리말과 본문 사이의 실제 간격이다.
 // 이를 제거하거나 재계산하면 한글에서 장 제목이 본문과 겹치므로 원형을 보존한다.

 // Building-level overview name has no dong suffix; units retain their own dong/floor/ho.
 all(tables[1],'tc').filter(c=>visible(c).includes('{{건물명}}')).forEach(c=>setText(c,'{{건물명}}'));
 setText(children(children(tables[1],'tr')[5],'tc')[1],'동/층/호수');
 expand(tables[1],6,1,m.rows.map(r=>r.values),(r,v)=>{const cs=children(r,'tc');setText(cs[0],v['일련번호']);setText(cs[1],v['동층호']);});
 const caseMaps=m.shown.map(c=>{const v=caseValues(c,g.ARAP_INDEX_DATA,h.parseTimeAdjDetail,m.ov),out={'사례기호':'#'+c.symbol};for(const k in v)if(k.startsWith('선정_'))out[k.replace('선정_','사례1_')]=v[k];return out;});while(caseMaps.length<4)caseMaps.push({});
 children(tables[2],'tr').slice(2).forEach(r=>r.remove());
 expand(tables[2],1,1,caseMaps,(r,v)=>setText(children(r,'tc')[0],v['사례기호']||''));
 const selectedMaps=m.used.map(c=>caseValues(c,g.ARAP_INDEX_DATA,h.parseTimeAdjDetail,m.ov));
 expand(tables[3],1,1,selectedMaps.length?selectedMaps:[{}]);
 expand(tables[4],1,2,selectedMaps.length?selectedMaps:[{}]);
 expand(tables[7],1,2,m.rows.map(r=>r.values),(r,v,i,j)=>{if(!j)setText(children(r,'tc')[0],v['일련번호']);});
 expand(tables[8],1,1,m.rows.map(r=>r.values),(r,v)=>{setText(children(r,'tc')[0],v['일련번호']);setText(children(r,'tc').at(-1),v['적용_결정단가']);});
 setText(children(children(tables[9],'tr')[0],'tc')[1],'동/층/호수');if(m.adjusted)setText(children(children(tables[9],'tr')[0],'tc')[2],'사정면적\n(㎡)');
 expand(tables[9],1,1,m.rows.map(r=>r.values),(r,v)=>{const cs=children(r,'tc');setText(cs[0],v['일련번호']);setText(cs[1],v['동층호']);setText(cs[2],v['평가면적']);});
 const totalRow=children(tables[9],'tr').at(-1).cloneNode(true);["합계","",fmt(m.rows.reduce((n,r)=>n+(r.area||0),0)),"",fmt(m.total)].forEach((v,i)=>setText(children(totalRow,'tc')[i],v));tables[9].appendChild(totalRow);repair(tables[9]);
 // 감정평가 목적 문단은 사용자 템플릿의 고정 문구와 서식을 유지하고 입력 필드만 치환한다.
 // Source bases differ by series; never reuse the apartment base month for officetels.
 all(doc,'p').filter(p=>!all(p,'tbl').length&&visible(p).includes('{{지수출처}}')).forEach(p=>setText(p,'[출처: '+[...new Set(selectedMaps.map(v=>v['지수출처']))].join(', ')+']'));
 fill(doc,m.common);
 function paragraph(value,pageBreak=false){const base=Array.from(doc.documentElement.children).find(p=>p.localName==='p'&&p.getAttribute('paraPrIDRef')===(pageBreak?'35':'54')&&!all(p,'tbl').length&&all(p,'t').length);const p=base.cloneNode(true);Array.from(p.children).filter(x=>x.localName!=='run').forEach(x=>x.remove());setText(p,value);p.setAttribute('pageBreak',pageBreak?'1':'0');p.setAttribute('columnBreak','0');doc.documentElement.appendChild(p);return p;}
 paragraph(m.roundNote);
 const cover=xml(read('Contents/section0.xml'));fill(cover,m.common);
 if(full){write('Contents/section0.xml',serial(cover));write('Contents/section1.xml',serial(doc));}
 else {write('Contents/section0.xml',serial(doc));entries=entries.filter(e=>e.name!=='Contents/section1.xml');header.documentElement.setAttribute('secCnt','1');const pkg=xml(read('Contents/content.hpf'));Array.from(pkg.getElementsByTagNameNS(OPF,'item')).filter(e=>e.getAttribute('id')==='section1').forEach(e=>e.remove());Array.from(pkg.getElementsByTagNameNS(OPF,'itemref')).filter(e=>e.getAttribute('idref')==='section1').forEach(e=>e.remove());write('Contents/content.hpf',serial(pkg));}
 write('Contents/header.xml',serial(header));write('Preview/PrvText.txt',visible(full?cover:doc));
 return {entries,doc,cover,paragraph,write,byName,serial,full};
}
let templatePromise;
async function build(input,h,mode='opinion'){
 const m=model(input,h);if(!templatePromise)templatePromise=fetch('templates/jiphap_multi_res.hwpx').then(r=>{if(!r.ok)throw Error('여러 호수 한글 템플릿을 불러오지 못했습니다.');return r.arrayBuffer();}).catch(e=>{templatePromise=null;throw e;});
 const entries=await h.parseZip((await templatePromise).slice(0)),r=render(entries,m,h,mode);
 const bytes=h.createZipStored(r.entries);return {bytes,model:m};
}
function appendImages(r,m){
 const doc=r.doc,pkg=xml(new TextDecoder().decode(r.byName.get('Contents/content.hpf').data)),manifest=pkg.getElementsByTagNameNS(OPF,'manifest')[0],source=all(r.cover,'pic')[0];
 m.images.forEach((im,i)=>{if(!/^data:image\/(jpeg|png);base64,/.test(im.dataUrl||''))return;
  r.paragraph(im.kind==='location'?'위치도':'현황사진',true);r.paragraph(im.caption||'');
  const pic=doc.importNode(source,true),id='multiImage'+i,ext=im.dataUrl.startsWith('data:image/png')?'png':'jpg';
  const width=50000,height=Math.min(48000,width*(im.height||1)/(im.width||1)),w=Math.min(width,height*(im.width||1)/(im.height||1)),h=height;
  pic.setAttribute('id',String(1800000010+i));pic.setAttribute('instid',String(1800000010+i));pic.setAttribute('textWrap','TOP_AND_BOTTOM');pic.setAttribute('zOrder',i);
  children(pic,'offset')[0].setAttribute('x','0');children(pic,'offset')[0].setAttribute('y','0');
  for(const k of ['orgSz','curSz','sz']){const e=children(pic,k)[0];e.setAttribute('width',Math.round(w));e.setAttribute('height',Math.round(h));}
  const rot=children(pic,'rotationInfo')[0];rot.setAttribute('centerX',Math.round(w/2));rot.setAttribute('centerY',Math.round(h/2));
  Array.from(pic.getElementsByTagNameNS(HC,'transMatrix')).concat(Array.from(pic.getElementsByTagNameNS(HC,'scaMatrix')),Array.from(pic.getElementsByTagNameNS(HC,'rotMatrix'))).forEach(e=>['1','0','0','0','1','0'].forEach((v,j)=>e.setAttribute('e'+(j+1),v)));
  const img=pic.getElementsByTagNameNS(HC,'img')[0];img.setAttribute('binaryItemIDRef',id);img.setAttribute('effect','REAL_PIC');
  const rect=children(pic,'imgRect')[0];Array.from(rect.children).forEach((p,j)=>{p.setAttribute('x',j===1||j===2?Math.round(w):0);p.setAttribute('y',j>=2?Math.round(h):0);});
  const clip=children(pic,'imgClip')[0];clip.setAttribute('left',0);clip.setAttribute('top',0);clip.setAttribute('right',Math.round(w));clip.setAttribute('bottom',Math.round(h));
  const dim=children(pic,'imgDim')[0];dim.setAttribute('dimwidth',Math.round(w));dim.setAttribute('dimheight',Math.round(h));children(pic,'effects').forEach(e=>e.remove());
  const pos=children(pic,'pos')[0];Object.entries({treatAsChar:'1',affectLSpacing:'0',flowWithText:'1',allowOverlap:'0',vertRelTo:'PARA',horzRelTo:'COLUMN',vertOffset:'0',horzOffset:'0'}).forEach(([k,v])=>pos.setAttribute(k,v));
  children(pic,'shapeComment')[0].textContent=im.caption|| (im.kind==='location'?'위치도':'현황사진');const p=r.paragraph('');children(p,'run')[0].appendChild(pic);
  const bytes=Uint8Array.from(atob(im.dataUrl.split(',')[1]),c=>c.charCodeAt(0)),name='BinData/'+id+'.'+ext;r.entries.push({name,data:bytes});const item=pkg.createElementNS(OPF,'opf:item');Object.entries({id,href:name,'media-type':ext==='png'?'image/png':'image/jpeg',isEmbeded:'1'}).forEach(([k,v])=>item.setAttribute(k,v));manifest.appendChild(item);
 });
 r.write('Contents/section1.xml',serial(doc));r.write('Contents/content.hpf',serial(pkg));
}
function Attachments({ov,setOv}){
 const R=g.React,h=R.createElement,[busy,setBusy]=R.useState(false),[error,setError]=R.useState('');const images=ov.reportImages||[];
 async function add(files,kind){setBusy(true);setError('');try{const incoming=[];for(const file of files){if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('PNG·JPG·WEBP 이미지를 선택하세요.');const bmp=await createImageBitmap(file);const ratio=Math.min(1,1400/Math.max(bmp.width,bmp.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bmp.width*ratio);canvas.height=Math.round(bmp.height*ratio);const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close();incoming.push({id:Date.now()+Math.random(),kind,caption:file.name.replace(/\.[^.]+$/,''),dataUrl:canvas.toDataURL('image/jpeg',.78),width:canvas.width,height:canvas.height});}if(JSON.stringify([...images,...incoming]).length>2500000)throw Error('첨부 이미지가 많습니다. 일부를 줄이거나 작은 이미지로 추가하세요.');setOv(p=>({...p,reportImages:[...(p.reportImages||[]),...incoming]}));}catch(e){setError(e.message);}finally{setBusy(false);}}
 const update=(id,v)=>setOv(p=>({...p,reportImages:(p.reportImages||[]).map(i=>i.id===id?{...i,...v}:i)}));
 return h('div',{style:{padding:16,border:'1px solid #ddd',borderRadius:6,marginBottom:14,background:'#fff'}},h('b',null,'한글 감정평가서 출력 정보'),h('div',{style:{display:'flex',gap:12,flexWrap:'wrap',marginTop:10}},[['appraiserName','감정평가사'],['reviewerName','심사자']].map(([key,label])=>h('label',{key},label+' ',h('input',{'aria-label':label,value:ov[key]||'',onChange:e=>setOv(p=>({...p,[key]:e.target.value}))})))),h('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}},['위생','급배수','급탕','난방','냉방','승강기','소방','방송','비고'].map(label=>h('label',{key:label},label+' ',h('select',{'aria-label':'설비 '+label,value:ov['facility'+label]||'',onChange:e=>setOv(p=>({...p,['facility'+label]:e.target.value}))},h('option',{value:''},'미입력'),h('option',{value:'○'},'있음'),h('option',{value:'-'},'없음'))))),h('p',{style:{fontSize:12}},'전체 감정평가서에는 명세표·필지별 토지이용계획과 첨부한 위치도·현황사진이 포함됩니다. 위치도는 지도에서 캡처한 이미지를 추가하세요.'),['location','photo'].map(kind=>h('label',{key:kind,style:{display:'inline-block',padding:8,background:'#eef2ff',marginRight:8,cursor:'pointer'}},kind==='location'?'위치도 이미지 추가':'현황사진 추가',h('input',{type:'file',accept:'image/png,image/jpeg,image/webp',multiple:true,disabled:busy,style:{display:'none'},onChange:e=>{add(Array.from(e.target.files),kind);e.target.value='';}}))),error&&h('p',{role:'alert',style:{color:'#dc2626'}},error),busy&&h('span',null,'이미지 처리 중…'),images.map((im,i)=>h('div',{key:im.id,style:{display:'flex',gap:8,alignItems:'center',marginTop:8}},h('img',{src:im.dataUrl,alt:im.caption,style:{width:90,height:65,objectFit:'contain'}}),h('span',null,im.kind==='location'?'위치도':'사진'),h('input',{'aria-label':'첨부 이미지 설명',value:im.caption,onChange:e=>update(im.id,{caption:e.target.value})}),h('button',{type:'button',disabled:i===0,onClick:()=>setOv(p=>{const a=[...(p.reportImages||[])];[a[i-1],a[i]]=[a[i],a[i-1]];return {...p,reportImages:a};})},'↑'),h('button',{type:'button',onClick:()=>setOv(p=>({...p,reportImages:(p.reportImages||[]).filter(x=>x.id!==im.id)}))},'삭제'))));
}

g.ArapMultiHwpx={model,build,Attachments,calculateUnit,effectiveArea,resolveCase};
})(window);
