/* 한글(hwpx) 표 테두리 통일 — 사용자가 고친 「평가대상 토지」 표 서식(2026-11-23)을 모든 표에.
 *   · 표 맨 위·맨 아래 선   = 실선 0.4mm #BFBFBF (예전 0.5mm)
 *   · 머리줄(진한 밤색 칸)끼리 = 실선 0.1mm #BFBFBF (그대로)
 *   · 머리줄 ↔ 본문 경계     = 실선 0.1mm #A6A6A6
 *   · 본문 세로선            = 실선 0.1mm #A6A6A6
 *   · 본문 줄 사이 가로선     = 실선 0.12mm #A6A6A6 (줄을 늘린 표의 가운데 굵은 선도 이것으로)
 *   · 선 없음(NONE)·표 왼쪽·오른쪽 끝은 양식 그대로
 * 대상 = 머리줄 밤색(#521414) 칸이 있거나 0.5mm #BFBFBF 선을 쓰는 표(온결 양식 표)만. 검정 선 표·제목 상자는 손대지 않는다.
 * header.xml의 borderFill은 지우거나 고치지 않고, 필요한 조합만 목록 끝에 새 번호로 덧붙인다(번호 연속·itemCnt 일치).
 * DOM 없이 문자열만 다룬다(Node 검증 tests/tbl_border.cjs). */
(function(root){
var HEAD='#521414';
var LINE={outer:['SOLID','0.4 mm','#BFBFBF'],head:['SOLID','0.1 mm','#BFBFBF'],mix:['SOLID','0.1 mm','#A6A6A6'],
  vbody:['SOLID','0.1 mm','#A6A6A6'],hbody:['SOLID','0.12 mm','#A6A6A6']};
var SIDES=['left','right','top','bottom'];
function parseFills(header){
  var fills={},max=0;
  header.replace(/<hh:borderFill id="(\d+)"[\s\S]*?<\/hh:borderFill>/g,function(x,id){
    var f={id:id,xml:x,side:{}};
    SIDES.forEach(function(s){var m=x.match(new RegExp('<hh:'+s+'Border type="([^"]*)" width="([^"]*)" color="([^"]*)"'));f.side[s]=m?[m[1],m[2],m[3]]:null;});
    var fc=x.match(/faceColor="([^"]*)"/);f.face=fc?fc[1].toUpperCase():'';
    fills[id]=f;max=Math.max(max,+id);return x;});
  return {fills:fills,max:max};
}
// 칸 끝(</hp:tc>) 위치 — 칸 안 중첩 표의 칸은 건너뛴다
function tcEnd(s,from){var re=/<hp:tc |<\/hp:tc>/g,d=0,m;re.lastIndex=from;
  while((m=re.exec(s))){if(m[0]==='<hp:tc ')d++;else if(--d===0)return m.index;}return s.length;}
// 표 하나(중첩 표 제외)의 직속 칸 목록
function tableCells(t){
  var head=t.match(/^<hp:tbl [^>]*>/)[0],body=t.slice(head.length),cells=[],depth=0,re=/<hp:tbl |<\/hp:tbl>|<hp:tc [^>]*>/g,m,open=null;
  while((m=re.exec(body))){
    if(m[0]==='<hp:tbl '){depth++;continue;}
    if(m[0]==='</hp:tbl>'){depth--;continue;}
    if(depth)continue;
    var end=tcEnd(body,m.index),seg=body.slice(m.index,end);
    // 칸 안에 중첩 표가 있으면 cellAddr는 그 표가 끝난 뒤(칸 끝 쪽)에 있다 — 마지막 것을 쓴다
    var addrs=seg.match(/<hp:cellAddr colAddr="(\d+)" rowAddr="(\d+)"\/>/g)||[],spans=seg.match(/<hp:cellSpan colSpan="(\d+)" rowSpan="(\d+)"\/>/g)||[];
    if(!addrs.length||!spans.length)continue;
    var a=addrs[addrs.length-1].match(/(\d+)" rowAddr="(\d+)/),s=spans[spans.length-1].match(/(\d+)" rowSpan="(\d+)/);
    cells.push({pos:head.length+m.index,tag:m[0],bf:(m[0].match(/borderFillIDRef="(\d+)"/)||[])[1],c:+a[1],r:+a[2],cs:+s[1],rs:+s[2]});
  }
  var rc=head.match(/rowCnt="(\d+)" colCnt="(\d+)"/);
  return {cells:cells,rows:rc?+rc[1]:0,cols:rc?+rc[2]:0};
}
function same(a,b){return a&&b&&a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];}
function apply(header,sections){
  var P=parseFills(header),fills=P.fills,next=P.max,added=[],cache={};
  var isFamily=function(cells){return cells.some(function(c){var f=fills[c.bf];if(!f)return false;
    return f.face===HEAD||SIDES.some(function(s){var v=f.side[s];return v&&v[0]==='SOLID'&&v[1]==='0.5 mm'&&v[2].toUpperCase()==='#BFBFBF';});});};
  // 바꾼 네 변으로 borderFill 찾기/만들기
  var fillFor=function(f,want){
    var key=f.id+'|'+SIDES.map(function(s){return want[s].join(',');}).join('|');
    if(cache[key])return cache[key];
    if(SIDES.every(function(s){return same(f.side[s],want[s]);}))return cache[key]=f.id;
    next++;var id=String(next),xml=f.xml.replace(/^<hh:borderFill id="\d+"/,'<hh:borderFill id="'+id+'"');
    SIDES.forEach(function(s){xml=xml.replace(new RegExp('<hh:'+s+'Border type="[^"]*" width="[^"]*" color="[^"]*"'),'<hh:'+s+'Border type="'+want[s][0]+'" width="'+want[s][1]+'" color="'+want[s][2]+'"');});
    added.push(xml);fills[id]={id:id,xml:xml,side:want,face:f.face};return cache[key]=id;
  };
  var out=sections.map(function(sec){
    // 안쪽 표부터 처리해도 칸 위치가 바뀌지 않게, 표 범위만 찾고 칸 태그 치환은 위치 목록으로 한 번에
    var edits=[],stack=[],re=/<hp:tbl |<\/hp:tbl>/g,m;
    while((m=re.exec(sec))){
      if(m[0]==='<hp:tbl '){stack.push(m.index);continue;}
      var s=stack.pop();if(s==null)continue;
      var T=tableCells(sec.slice(s,m.index+m[0].length));
      if(!T.cells.length||!isFamily(T.cells))continue;
      var grid=[];T.cells.forEach(function(c,i){for(var r=c.r;r<c.r+c.rs;r++)for(var k=c.c;k<c.c+c.cs;k++){(grid[r]=grid[r]||[])[k]=i;}});
      var head=function(i){var f=fills[T.cells[i].bf];return !!f&&f.face===HEAD;};
      var around=function(c,side){var out=[];
        if(side==='top'||side==='bottom'){var r=side==='top'?c.r-1:c.r+c.rs;if(grid[r])for(var k=c.c;k<c.c+c.cs;k++)if(grid[r][k]!=null)out.push(grid[r][k]);}
        else{var col=side==='left'?c.c-1:c.c+c.cs;for(var r2=c.r;r2<c.r+c.rs;r2++)if(grid[r2]&&grid[r2][col]!=null)out.push(grid[r2][col]);}
        return out;};
      T.cells.forEach(function(c,i){
        var f=fills[c.bf];if(!f||SIDES.some(function(s){return !f.side[s];}))return;
        var want={};
        SIDES.forEach(function(side){
          var cur=f.side[side];want[side]=cur;
          if(cur[0]==='NONE')return;                                     // 선 없음은 그대로
          var nb=around(c,side),vert=side==='left'||side==='right';
          if(!nb.length){if(!vert)want[side]=LINE.outer;return;}          // 표 맨 위·맨 아래 / 왼쪽·오른쪽 끝은 그대로
          var me=head(i),hs=nb.map(head);
          if(me&&hs.every(Boolean))want[side]=LINE.head;
          else if(!me&&!hs.some(Boolean))want[side]=vert?LINE.vbody:LINE.hbody;
          else want[side]=LINE.mix;
        });
        var id=fillFor(f,want);
        if(id!==c.bf)edits.push({pos:s+c.pos,tag:c.tag,rep:c.tag.replace(/borderFillIDRef="\d+"/,'borderFillIDRef="'+id+'"')});
      });
    }
    edits.sort(function(a,b){return b.pos-a.pos;});
    edits.forEach(function(e){sec=sec.slice(0,e.pos)+e.rep+sec.slice(e.pos+e.tag.length);});
    return sec;
  });
  if(added.length){
    header=header.replace(/(<hh:borderFills[^>]*>[\s\S]*?)(<\/hh:borderFills>)/,function(x,a,b){return a+added.join('')+b;})
      .replace(/<hh:borderFills itemCnt="\d+"/,'<hh:borderFills itemCnt="'+next+'"');
  }
  return {header:header,sections:out,added:added.length};
}
// 완성된 hwpx(zip 바이트)에 바로 적용 — arap_cheonggu.js의 zip 엔진 사용
async function applyZip(bytes){
  var A=root.ArapCheonggu;if(!A||!A.parseZip)return bytes;
  var buf=bytes.buffer?bytes.buffer.slice(bytes.byteOffset||0,(bytes.byteOffset||0)+bytes.byteLength):bytes;
  var entries=await A.parseZip(buf),dec=new TextDecoder(),enc=new TextEncoder();
  var head=entries.find(function(e){return e.name==='Contents/header.xml';}),secs=entries.filter(function(e){return /^Contents\/section\d+\.xml$/.test(e.name);});
  if(!head||!secs.length)return bytes;
  var r=apply(dec.decode(head.data),secs.map(function(e){return dec.decode(e.data);}));
  head.data=enc.encode(r.header);secs.forEach(function(e,i){e.data=enc.encode(r.sections[i]);});
  var mi=entries.findIndex(function(e){return e.name==='mimetype';});if(mi>0)entries.unshift(entries.splice(mi,1)[0]);
  return A.createZipStored(entries);
}
var api={apply:apply,applyZip:applyZip,LINE:LINE};
root.ArapTblBorder=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
