# 여러 호수 의견서 템플릿에 「자본수익률(비주거 사례)」 블록 추가 — 2026-11-16
# 4. 시점수정: 가. 매매가격지수(기존) / 나. 자본수익률(새: 제목·출처·표) / 다. 시점수정치의 결정(기존 나.) + 상업용 문장(새)
# 표는 기존 매매가격지수 표를 복제해 글자만 바꿈(같은 서식·테두리). 플레이스홀더는 파란 charPr(54·55·58) 그대로.
import sys,zipfile,re
src,dst=sys.argv[1],sys.argv[2]
zin=zipfile.ZipFile(src)
s=zin.read('Contents/section1.xml').decode('utf-8')
def para_at(text_pred,start=0):
    for m in re.finditer(r'<hp:p ',s[start:]):
        a=start+m.start();d=0
        for t in re.finditer(r'<hp:p |</hp:p>',s[a:]):
            d+=1 if t.group()=='<hp:p ' else -1
            if d==0:b=a+t.end();break
        if text_pred(''.join(re.findall(r'<hp:t>([^<]*)</hp:t>',s[a:b])),s[a:b]):return a,b
    raise SystemExit('para not found')
h_a,h_b=para_at(lambda t,x:t.startswith('가. ') and '매매가격지수' in t)
src_a,src_b=para_at(lambda t,x:'{{지수출처}}' in t,h_b)
tb_a,tb_b=para_at(lambda t,x:'<hp:tbl' in x and '{{거래지수기간}}' in t,src_b)
d_a,d_b=para_at(lambda t,x:t.strip().startswith('나. 시점수정치의 결정'),tb_b)
r_a,r_b=para_at(lambda t,x:t.startswith('본건은 주거용부동산으로서'),d_b)
assert h_b<=src_a and src_b<=tb_a and tb_b<=d_a and d_b<=r_a
noseg=lambda x:re.sub(r'<hp:linesegarray>.*?</hp:linesegarray>','',x)
H=noseg(s[h_a:h_b]).replace('<hp:run charPrIDRef="50"><hp:t>가. </hp:t></hp:run><hp:run charPrIDRef="58"><hp:t>{{시점수정_용도}}</hp:t></hp:run><hp:run charPrIDRef="50"><hp:t> 매매가격지수</hp:t></hp:run>',
  '<hp:run charPrIDRef="50"><hp:t>나. 자본수익률(</hp:t></hp:run><hp:run charPrIDRef="58"><hp:t>{{자본수익률_유형}}</hp:t></hp:run><hp:run charPrIDRef="50"><hp:t>)</hp:t></hp:run>')
assert '{{자본수익률_유형}}' in H
SRC=noseg(s[src_a:src_b])
SRC=re.sub(r'(<hp:p [^>]*>).*(</hp:p>)',lambda m:m.group(1)+'<hp:run charPrIDRef="34"><hp:t>                                      [출처: 한국부동산원 임대동향조사]</hp:t></hp:run>'+m.group(2),SRC,flags=re.S)
T=s[tb_a:tb_b]
T=T.replace('id="1148691653"','id="1148691777"',1)
rep=[('<hp:t>매매가격지수</hp:t>','<hp:t>시점</hp:t>'),
 ('<hp:run charPrIDRef="54"><hp:t>{{선정_기호}}</hp:t></hp:run>','<hp:run charPrIDRef="54"><hp:t>{{자본_기호}}</hp:t></hp:run>'),
 ('<hp:run charPrIDRef="54"><hp:t>{{거래지수기간}}</hp:t></hp:run>','<hp:run charPrIDRef="28"><hp:t>거래시점</hp:t></hp:run>'),
 ('<hp:run charPrIDRef="54"><hp:t>{{거래지수값}}</hp:t></hp:run>','<hp:run charPrIDRef="54"><hp:t>{{자본_거래일}}</hp:t></hp:run>'),
 ('<hp:run charPrIDRef="54"><hp:t>{{지수지역}}</hp:t></hp:run>','<hp:run charPrIDRef="54"><hp:t>{{자본_분기내역}}</hp:t></hp:run>'),
 ('<hp:run charPrIDRef="54"><hp:t>{{시점수정산식}}</hp:t></hp:run>','<hp:run charPrIDRef="54"><hp:t>{{자본_산식}}</hp:t></hp:run>'),
 ('<hp:run charPrIDRef="54"><hp:t>{{상승률}}</hp:t></hp:run>','<hp:run charPrIDRef="54"><hp:t>{{자본_상승률}}</hp:t></hp:run>'),
 ('<hp:run charPrIDRef="54"><hp:t>{{적용_시점수정}}</hp:t></hp:run>','<hp:run charPrIDRef="54"><hp:t>{{자본_적용}}</hp:t></hp:run>'),
 ('<hp:run charPrIDRef="54"><hp:t>{{기준지수기간}}</hp:t></hp:run>','<hp:run charPrIDRef="28"><hp:t>기준시점</hp:t></hp:run>'),
 ('<hp:run charPrIDRef="54"><hp:t>{{기준지수값}}</hp:t></hp:run>','<hp:run charPrIDRef="54"><hp:t>{{자본_기준일}}</hp:t></hp:run>')]
for o,n in rep:
    assert T.count(o)==1,(o,T.count(o));T=T.replace(o,n)
D=s[d_a:d_b].replace('<hp:t>나. 시점수정치의 결정 </hp:t>','<hp:t>다. 시점수정치의 결정 </hp:t>')
assert D!=s[d_a:d_b]
R2=noseg(s[r_a:r_b])
R2=re.sub(r'(<hp:p [^>]*>).*(</hp:p>)',lambda m:m.group(1)+'<hp:run charPrIDRef="34"><hp:t>본건 중 상업용부동산은 대상부동산의 가격변동추이를 적절히 반영하는 것으로 판단되는 자본수익률(</hp:t></hp:run><hp:run charPrIDRef="55"><hp:t>{{자본수익률_유형}}</hp:t></hp:run><hp:run charPrIDRef="34"><hp:t>)을 기준으로 비교 거래사례의 거래시점으로부터 기준시점 현재까지의 시점수정치를 산정하였음.</hp:t></hp:run>'+m.group(2),R2,flags=re.S)
out=s[:tb_b]+H+SRC+T+s[tb_b:d_a]+D+s[d_b:r_b]+R2+s[r_b:]
zout=zipfile.ZipFile(dst,'w')
for it in zin.infolist():
    data=out.encode('utf-8') if it.filename=='Contents/section1.xml' else zin.read(it.filename)
    zi=zipfile.ZipInfo(it.filename,date_time=it.date_time);zi.compress_type=it.compress_type
    zout.writestr(zi,data)
zout.close();print('ok',dst)
