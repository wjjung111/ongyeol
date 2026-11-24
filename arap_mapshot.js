/* arap_mapshot.js — 위치도 화면 캡처 → 한글(hwpx) 광역위치도·상세위치도 (2026-11-24)
 *
 *  ArapMapShot.RATIO                       그림 칸 세로÷가로 (화면 틀도 이 비율)
 *  ArapMapShot.capture(frameEl)  → Promise<{dataUrl,w,h}>
 *      크롬·엣지 화면 공유(getDisplayMedia, 「이 탭」)로 지금 보이는 그대로(말풍선 배치 포함) 찍어 frameEl 영역만 잘라 PNG로.
 *      버튼 클릭 안에서 바로 불러야 한다(브라우저가 사용자 동작 없이 화면 공유를 막음).
 *  ArapMapShot.buildHwpx(tplBuf, {addr, wide, detail}) → Promise<Uint8Array>
 *      템플릿(토건 위치도 템플릿.hwpx: 0쪽 광역위치도, 1쪽 상세위치도)의 소재지 칸에 addr, 그림 칸에 캡처 그림.
 *      그림은 사용자 완성본(2026-11-24)과 같은 방식 — 칸 안 글 앞에 떠 있는 그림(treatAsChar=0, 문단 기준 0,0).
 *      그림 칸 폭에 꽉 차게(50228) + 세로 56000, 표 위 빈 줄은 두 쪽 모두 5줄로 맞춤(상세 쪽 6줄 → 5줄) — 한 쪽 안(아래 여유 약 1900).
 */
(function(g){
'use strict';
var PIC_W=50228,PIC_H=56000;            // 셀 폭 50510 − 안 여백 141×2 / 세로는 쪽 높이에 맞춘 값(표 위 5줄 + 표 + 끝 줄 = 본문 76666 중 약 74770)
var RATIO=PIC_H/PIC_W;
var BLANK_KEEP=4;                       // 표 바로 위 빈 문단 수 — 쪽 첫 문단(쪽 설정) 1줄 + 4 = 5줄. 템플릿 광역 4개·상세 5개라 상세가 한 줄 아래였음
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ── 캡처 ──
function nextFrame(v){return new Promise(function(r){
  if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(function(){r();});else setTimeout(r,120);
  setTimeout(r,800);});}   // 화면이 안 바뀌면 새 프레임이 안 올 수 있음 → 0.8초면 그냥 진행
async function capture(frameEl){
  var md=navigator.mediaDevices;
  if(!md||!md.getDisplayMedia)throw new Error('이 브라우저는 화면 캡처를 지원하지 않습니다 — 크롬 또는 엣지에서 사용해 주세요.');
  var stream=await md.getDisplayMedia({video:{displaySurface:'browser',frameRate:10},audio:false,
    preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',monitorTypeSurfaces:'exclude'});
  var track=stream.getVideoTracks()[0];
  try{
    var st=(track.getSettings&&track.getSettings())||{};
    if(st.displaySurface&&st.displaySurface!=='browser')throw new Error('「이 탭」(지금 보고 있는 탭)을 골라 공유해 주세요 — 창·전체 화면은 쓸 수 없습니다.');
    frameEl.scrollIntoView({block:'center',inline:'nearest'});
    // 크롭 대상(Region Capture, 크롬 104+) — 공유 막대가 생기며 화면이 밀려도 틀 영역만 정확히
    var cropped=false;
    if(g.CropTarget&&track.cropTo){try{await track.cropTo(await g.CropTarget.fromElement(frameEl));cropped=true;}catch(e){console.warn('cropTo 실패 — 직접 자름',e);}}
    var v=document.createElement('video');v.muted=true;v.playsInline=true;v.srcObject=stream;
    await v.play();
    await sleep(500);await nextFrame(v);await nextFrame(v);   // 공유 막대·스크롤 뒤 화면이 자리 잡을 때까지
    var vw=v.videoWidth,vh=v.videoHeight;if(!vw||!vh)throw new Error('화면을 받지 못했습니다. 다시 눌러 주세요.');
    var sx,sy,sw,sh;
    if(cropped){sx=0;sy=0;sw=vw;sh=vh;}
    else{
      var r=frameEl.getBoundingClientRect(),kx=vw/g.innerWidth,ky=vh/g.innerHeight;
      if(Math.abs(kx-ky)/kx>0.04)throw new Error('지금 탭이 아닌 다른 화면이 공유된 것 같습니다 — 「이 탭」을 골라 주세요.');
      if(r.top<-1||r.left<-1||r.bottom>g.innerHeight+1||r.right>g.innerWidth+1)throw new Error('틀 일부가 화면 밖에 있습니다 — 창을 키우거나 화면을 스크롤해 틀이 다 보이게 한 뒤 다시 눌러 주세요.');
      sx=Math.round(r.left*kx);sy=Math.round(r.top*ky);sw=Math.round(r.width*kx);sh=Math.round(r.height*ky);
    }
    if(Math.abs(sh/sw-RATIO)/RATIO>0.03)throw new Error('틀 일부가 화면 밖에 있습니다 — 틀이 다 보이게 한 뒤 다시 눌러 주세요.');
    var c=document.createElement('canvas');c.width=sw;c.height=sh;
    var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,sw,sh);x.drawImage(v,sx,sy,sw,sh,0,0,sw,sh);
    v.srcObject=null;
    return {dataUrl:c.toDataURL('image/png'),w:sw,h:sh,at:Date.now()};
  }finally{stream.getTracks().forEach(function(t){t.stop();});}
}

// ── hwpx ──
function picXml(n,binId,w,h){
  var ow=Math.max(1,Math.round(w*75)),oh=Math.max(1,Math.round(h*75));   // 원본 크기: 96dpi 1px = 75 HWPUNIT
  var id=1255965944+n,f=function(v){return (Math.round(v*1e6)/1e6).toString();};
  return '<hp:pic id="'+id+'" zOrder="'+(4+n)+'" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="'+(182224121+n)+'" reverse="0">'
    +'<hp:offset x="0" y="0"/><hp:orgSz width="'+ow+'" height="'+oh+'"/><hp:curSz width="'+PIC_W+'" height="'+PIC_H+'"/>'
    +'<hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="'+Math.round(PIC_W/2)+'" centerY="'+Math.round(PIC_H/2)+'" rotateimage="1"/>'
    +'<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="'+f(PIC_W/ow)+'" e2="0" e3="0" e4="0" e5="'+f(PIC_H/oh)+'" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>'
    +'<hc:img binaryItemIDRef="'+binId+'" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>'
    +'<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="'+ow+'" y="0"/><hc:pt2 x="'+ow+'" y="'+oh+'"/><hc:pt3 x="0" y="'+oh+'"/></hp:imgRect>'
    +'<hp:imgClip left="0" right="'+ow+'" top="0" bottom="'+oh+'"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="'+ow+'" dimheight="'+oh+'"/><hp:effects/>'
    +'<hp:sz width="'+PIC_W+'" widthRelTo="ABSOLUTE" height="'+PIC_H+'" heightRelTo="ABSOLUTE" protect="0"/>'
    +'<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
    +'<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment>그림입니다.\n원본 그림의 크기: 가로 '+w+'pixel, 세로 '+h+'pixel</hp:shapeComment></hp:pic>';
}
var LSA=/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/;
// 한 쪽(section) 채우기: 소재지 + (있으면) 그림 + 빈 줄 조절. pic = {n,binId,w,h} 또는 null
function fillSection(xml,addr,pic){
  // ① 소재지 — 「소재지」 칸 다음 칸의 첫 글자
  var a=xml.indexOf('>소재지<');
  if(a>=0&&addr){
    var t=xml.indexOf('<hp:t>',a),te=t>=0?xml.indexOf('</hp:t>',t):-1;
    if(t>=0&&te>t&&t<xml.indexOf('</hp:tr>',a))xml=xml.slice(0,t+6)+esc(addr)+xml.slice(te);
  }
  // ② 지도 표(2행) 찾기
  var tb=xml.indexOf('rowCnt="2"');if(tb<0)return xml;
  tb=xml.lastIndexOf('<hp:tbl',tb);
  var pStart=xml.lastIndexOf('<hp:p ',tb);
  // ③ 그림 칸(2행, 두 칸 합친 칸)
  var ca=xml.indexOf('rowAddr="1"/><hp:cellSpan colSpan="2"',tb);
  if(ca>0){
    var tc=xml.lastIndexOf('<hp:tc ',ca),tcEnd=xml.indexOf('</hp:tc>',ca)+8,cell=xml.slice(tc,tcEnd);
    var rowH=PIC_H+282;
    cell=cell.replace(/<hp:cellSz width="(\d+)" height="\d+"\/>/,'<hp:cellSz width="$1" height="'+rowH+'"/>');
    if(pic){
      cell=cell.replace(LSA,'');   // 줄 배치 캐시(그림 없는 값) 버림 — 이 문단만
      var m=/<hp:run charPrIDRef="(\d+)"\s*\/>/.exec(cell);
      if(m)cell=cell.slice(0,m.index)+'<hp:run charPrIDRef="'+m[1]+'">'+picXml(pic.n,pic.binId,pic.w,pic.h)+'<hp:t/></hp:run>'+cell.slice(m.index+m[0].length);
      else{var r2=/<hp:run charPrIDRef="\d+">/.exec(cell);if(r2)cell=cell.slice(0,r2.index+r2[0].length)+picXml(pic.n,pic.binId,pic.w,pic.h)+cell.slice(r2.index+r2[0].length);}
    }
    xml=xml.slice(0,tc)+cell+xml.slice(tcEnd);
    // 표 전체 높이 = 1행 + 그림 행
    var szRe=/(<hp:tbl [^>]*rowCnt="2"[^>]*><hp:sz width="\d+" widthRelTo="ABSOLUTE" height=")(\d+)(")/;
    var r1=/<hp:cellAddr colAddr="0" rowAddr="0"\/><hp:cellSpan colSpan="1" rowSpan="1"\/><hp:cellSz width="\d+" height="(\d+)"\/>/.exec(xml.slice(tb));
    xml=xml.replace(szRe,function(_,p1,h,p3){return p1+((r1?+r1[1]:3401)+rowH)+p3;});
  }
  // ④ 표가 든 문단의 줄 배치 캐시 버림(표 높이가 바뀜) — 맨 끝 linesegarray
  var pEnd=xml.indexOf('</hp:p>',xml.indexOf('</hp:tbl>',tb));
  var lastL=xml.lastIndexOf('<hp:linesegarray>',pEnd);
  if(lastL>xml.indexOf('</hp:tbl>',tb))xml=xml.slice(0,lastL)+xml.slice(xml.indexOf('</hp:linesegarray>',lastL)+18);
  // ⑤ 표 위 빈 줄을 BLANK_KEEP개로 — 표 문단 바로 앞의 빈 문단부터 지움(그 밖 문단의 캐시는 그대로)
  var blankRe=/<hp:p id="0" paraPrIDRef="\d+" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="\d+"\/>(?:<hp:linesegarray>(?:(?!<\/hp:p>)[\s\S])*?<\/hp:linesegarray>)?<\/hp:p>$/;
  var head=xml.slice(0,pStart),tail=xml.slice(pStart),blanks=[],h=head,mm;
  while((mm=blankRe.exec(h))){blanks.push(mm[0]);h=h.slice(0,mm.index);}
  var drop=Math.max(0,blanks.length-BLANK_KEEP);
  if(drop)head=head.slice(0,head.length-blanks.slice(0,drop).reduce(function(s,b){return s+b.length;},0));
  return head+tail;
}
async function buildHwpx(tplBuf,o){
  var A=g.ArapCheonggu;if(!A)throw new Error('한글 엔진(arap_cheonggu.js)이 없습니다.');
  var entries=await A.parseZip(tplBuf.slice?tplBuf.slice(0):tplBuf),dec=new TextDecoder(),enc=new TextEncoder();
  var mi=entries.findIndex(function(e){return e.name==='mimetype';});if(mi>0)entries.unshift(entries.splice(mi,1)[0]);
  var shots=[o.wide||null,o.detail||null],bins=[];
  shots.forEach(function(s,i){
    if(!s||!/^data:image\/png;base64,/.test(s.dataUrl||''))return;
    var id='image'+(bins.length+1),bin=atob(s.dataUrl.split(',')[1]),u=new Uint8Array(bin.length);
    for(var k=0;k<bin.length;k++)u[k]=bin.charCodeAt(k);
    bins.push({sec:i,id:id,name:'BinData/'+id+'.png',data:u,w:s.w,h:s.h,n:bins.length});
  });
  entries.forEach(function(e){
    var m=/^Contents\/section(\d)\.xml$/.exec(e.name);if(!m)return;
    var sec=+m[1],b=bins.filter(function(x){return x.sec===sec;})[0];
    e.data=enc.encode(fillSection(dec.decode(e.data),o.addr,b?{n:b.n,binId:b.id,w:b.w,h:b.h}:null));
  });
  if(bins.length){
    var hpf=entries.find(function(e){return e.name==='Contents/content.hpf';}),x=dec.decode(hpf.data);
    var items=bins.map(function(b){return '<opf:item id="'+b.id+'" href="'+b.name+'" media-type="image/png" isEmbeded="1"/>';}).join('');
    x=x.replace(/(<opf:item id="header"[^>]*\/>)/,'$1'+items);
    hpf.data=enc.encode(x);
    // 그림 파일은 Contents 앞(한글 저장본 순서: mimetype 다음 BinData)
    var at=entries.findIndex(function(e){return e.name!=='mimetype'&&e.name!=='version.xml';});
    bins.forEach(function(b,k){entries.splice(at+k,0,{name:b.name,data:b.data});});
  }
  return A.createZipStored(entries);
}
g.ArapMapShot={RATIO:RATIO,PIC_W:PIC_W,PIC_H:PIC_H,capture:capture,buildHwpx:buildHwpx,fillSection:fillSection};
})(window);
