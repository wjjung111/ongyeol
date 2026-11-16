# 여러 호수 의견서 템플릿에 「- 개별요인 비교항목(상업용)」 표 2개 추가 — 2026-11-16
# 근생 등 비주거 호수가 있으면 엔진이 이 블록을 남기고, 없으면 뺀다(주거용도 마찬가지).
# 표는 주거용 표(조건|항목|세항목)를 복제해 줄을 다시 짬 — 같은 글꼴·테두리. 항목 문구는 단일호수 비주거 템플릿과 같음.
import sys,zipfile,re,copy
import xml.etree.ElementTree as ET
src,dst=sys.argv[1],sys.argv[2]
HPN='http://www.hancom.co.kr/hwpml/2011/paragraph';HP='{'+HPN+'}'
zin=zipfile.ZipFile(src);s=zin.read('Contents/section1.xml').decode('utf-8')
assert '개별요인 비교항목(상업용)' not in s,'이미 있음'
def top_paras(s):
    out=[];pos=0
    body=s.index('>',s.index('<hs:sec'))+1;pos=body
    while True:
        m=re.compile(r'<hp:p ').search(s,pos)
        if not m:break
        d=0
        for t in re.finditer(r'<hp:p |</hp:p>',s[m.start():]):
            d+=1 if t.group()=='<hp:p ' else -1
            if d==0:end=m.start()+t.end();break
        out.append((m.start(),end));pos=end
    return out
vis=lambda x:''.join(re.findall(r'<hp:t>([^<]*)</hp:t>',x))
P=top_paras(s)
hi=[k for k,(a,b) in enumerate(P) if vis(s[a:b]).strip()=='- 개별요인 비교항목(주거용)'][0]
tix=[k for k in range(hi+1,hi+6) if '<hp:tbl' in s[P[k][0]:P[k][1]]];t1,t2=tix[0],tix[1]
assert t2==t1+1 or all('<hp:tbl' not in s[P[k][0]:P[k][1]] for k in range(t1+1,t2))
assert '<hp:tbl' in s[P[t1][0]:P[t1][1]] and '<hp:tbl' in s[P[t2][0]:P[t2][1]]
assert '단지외부요인' in vis(s[P[t1][0]:P[t1][1]]) and '호별요인' in vis(s[P[t2][0]:P[t2][1]])
# 네임스페이스 접두어를 지키려고 문자열로 다룸: 표 문단을 통째로 복제한 뒤 행(tr) 단위로 다시 짠다
def rows_of(x):
    rs=[];pos=0
    while True:
        a=x.find('<hp:tr>',pos)
        if a<0:break
        b=x.index('</hp:tr>',a)+8;rs.append((a,b));pos=b
    return rs
def cells_of(r):
    cs=[];pos=0
    while True:
        a=r.find('<hp:tc ',pos)
        if a<0:break
        b=r.index('</hp:tc>',a)+8;cs.append(r[a:b]);pos=b
    return cs
def set_cell(c,text,row,col,rowspan=1,height=None,colspan=None):
    # 첫 문단·첫 런만 남기고 글자 교체, 줄배치 캐시 삭제
    a=c.index('<hp:subList');sa=c.index('>',a)+1;sb=c.index('</hp:subList>')
    inner=c[sa:sb];p0a=inner.index('<hp:p ');p0b=inner.index('</hp:p>',p0a)+7;p=inner[p0a:p0b]
    p=re.sub(r'<hp:linesegarray>.*?</hp:linesegarray>','',p)
    ra=p.index('<hp:run ');rb=p.index('</hp:run>',ra)+9;run=p[ra:rb]
    rh=run[:run.index('>')+1];run=rh+'<hp:t>'+text+'</hp:t></hp:run>'
    p=p[:p.index('>')+1]+run+'</hp:p>'
    c=c[:sa]+p+c[sb:]
    c=re.sub(r'<hp:cellAddr colAddr="\d+" rowAddr="\d+"/>',f'<hp:cellAddr colAddr="{col}" rowAddr="{row}"/>',c)
    c=re.sub(r'<hp:cellSpan colSpan="(\d+)" rowSpan="\d+"/>',lambda m:f'<hp:cellSpan colSpan="{colspan or m.group(1)}" rowSpan="{rowspan}"/>',c)
    if height:c=re.sub(r'(<hp:cellSz width="\d+" height=")\d+(")',lambda m:m.group(1)+str(height)+m.group(2),c)
    return c
def hgt(sub):
    n=len(sub);return 4648 if n>60 else 3248 if n>30 else 1986
def build(tblpara,groups,last_span_row=None,newid=None):
    x=tblpara;rs=rows_of(x)
    rows=[x[a:b] for a,b in rs]
    head=rows[0];first=rows[1];item=rows[2]
    fc=cells_of(first);ic=cells_of(item)
    out=[head];r=1
    for label,items in groups:
        n=len(items);hs=[hgt(sub) if sub is not None else 2552 for _,sub in items];tot=sum(hs)
        for k,(name,sub) in enumerate(items):
            if sub is None:   # 항목+세항목을 한 칸(colSpan 2)
                cc=cells_of(last_span_row)[0];cells=[set_cell(cc,name,r,1,1,hs[k],2)]
                src_row=last_span_row
            elif k==0:
                cells=[set_cell(fc[0],label,r,0,n,tot),set_cell(fc[1],name,r,1,1,hs[k]),set_cell(fc[2],sub,r,2,1,hs[k])];src_row=first
            else:
                cells=[set_cell(ic[0],name,r,1,1,hs[k]),set_cell(ic[1],sub,r,2,1,hs[k])];src_row=item
            if k==0 and sub is None:raise SystemExit('첫 항목은 세항목 필요')
            tr_head=src_row[:src_row.index('<hp:tc ')]
            out.append(tr_head+''.join(cells)+'</hp:tr>');r+=1
    body=x[:rs[0][0]]+''.join(out)+x[rs[-1][1]:]
    body=re.sub(r'rowCnt="\d+"',f'rowCnt="{r}"',body,count=1)
    hh=int(re.search(r'<hp:cellSz width="\d+" height="(\d+)"',head).group(1));allh=hh+sum(sum(hgt(sub) if sub is not None else 2552 for _,sub in items) for _,items in groups)
    body=re.sub(r'(<hp:sz width="\d+" widthRelTo="ABSOLUTE" height=")\d+(")',lambda m:m.group(1)+str(allh)+m.group(2),body,count=1)   # 표 높이 = 줄 높이 합
    body=re.sub(r'<hp:tbl id="(\d+)"',lambda m:f'<hp:tbl id="{newid}"',body,count=1)
    te=body.rindex('</hp:tbl>');ls=body.find('<hp:linesegarray>',te)
    if ls>=0:body=body[:ls]+body[body.index('</hp:linesegarray>',ls)+18:]   # 바깥 문단 줄배치 캐시만
    return body
A1,B1=P[t1];A2,B2=P[t2]
G1=[('단지외부요인',[('주요시설과의 접근성','상업지역 중심의 접근성, 공공시설(관공서 등)의 거리 및 편의성'),
  ('교통의 편의성','인근 교통시설과의 거리 및 편의성, 차량이용의 편리성(가로의 폭, 계통, 접면), 교통규제의 정도(일방통행, 주정차 금지 등)'),
  ('상권의 특성','고객의 유동성 및 적합성, 인근 이용상황과의 관계성, 유효수요권의 크기, 고객군의 특성, 상권의 역동성')]),
 ('단지내부요인',[('건물의 규모','건물의 전체 층수(지상층수, 지하층수), 총 호수 등'),
  ('건물의 구조 및 설비','건물의 구조 및 재질, 각종 설비상태(승강기, 에스컬레이터 등), 층간 이동경로의 편의성'),
  ('건물의 노후도 및 관리상태','건물의 노후도 및 관리상태 등'),
  ('주차의 편리성','지상·지하 주차시설의 규모 및 상태, 전용 주차공간의 유무, 기계식 주차장의 유무 및 비율'),
  ('공실률 및 입점업체 구성','건물 전체 공실률, 입점업체의 인지도·선호도 및 규모 등')])]
G2=[('호별요인',[('층별 효용','층별 효용 등'),
  ('위치별 효용','호의 배치(전면, 후면, 측면, 내부 등), 주출입구와의 접근성, 승강기 및 에스컬레이터와의 접근성, 외부 접근성 및 가시성(간판, 전면부 등)'),
  ('전유면적 및 대지사용권','전유부분의 면적 크기, 대지사용권의 크기')]),
 ('기타요인',[('개발사업 가능성','재개발·재건축사업, 도시재생사업 등의 편입 여부'),('행정적 규제','행정적 규제 등'),('기타 가치에 영향을 미치는 요인',None)])]
T2rows=rows_of(s[A2:B2]);last=s[A2:B2][T2rows[-1][0]:T2rows[-1][1]]
N1=build(s[A1:B1],G1,newid='1148691901');N2=build(s[A2:B2],G2,last_span_row=last,newid='1148691902')
HA,HB=P[hi];H=re.sub(r'<hp:linesegarray>.*?</hp:linesegarray>','',s[HA:HB]).replace('개별요인 비교항목(주거용)','개별요인 비교항목(상업용)')
out=s[:B2]+H+N1+N2+s[B2:]
ET.fromstring(out)
zout=zipfile.ZipFile(dst,'w')
for it in zin.infolist():
    data=out.encode('utf-8') if it.filename=='Contents/section1.xml' else zin.read(it.filename)
    zi=zipfile.ZipInfo(it.filename,date_time=it.date_time);zi.compress_type=it.compress_type;zout.writestr(zi,data)
zout.close();print('ok',dst)
