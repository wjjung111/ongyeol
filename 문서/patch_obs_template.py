# 사용자 수정 의견서 템플릿(관찰감가 문장 + 실제/유효경과연수 열)에 토큰을 넣어 저장소 템플릿으로 만든다.
import zipfile,re,sys
src,dst=sys.argv[1],sys.argv[2]
zin=zipfile.ZipFile(src)
s=zin.read('Contents/section0.xml').decode('utf-8')
# 1) 산출개요: 빨간 표시(charPr 57)는 검토용 — 원래 검정(36)으로. 첫 문장은 종전처럼 한 런으로 합친다.
a='원가법을 적용하였으며, </hp:t></hp:run><hp:run charPrIDRef="57"><hp:t>감가수정은 경제적'
assert s.count(a)==1; s=s.replace(a,'원가법을 적용하였으며, 감가수정은 경제적')
b='<hp:run charPrIDRef="57"><hp:t>감가수정은 현상 및 관리상태 등을 감안하여 관찰감가법을 병홍하였음.</hp:t></hp:run>'
assert s.count(b)==1; s=s.replace(b,'<hp:run charPrIDRef="36"><hp:t>감가수정은 현상 및 관리상태 등을 감안하여 관찰감가법을 병용하였음.</hp:t></hp:run>')
# 2) 잔가율 표의 빈 유효경과연수 칸(colAddr 6, 행 1~5)에 토큰
i=s.find('{{층1_경과연수}}')
while '{{층1_잔가율}}' not in s[i:s.find('</hp:tbl>',i)]: i=s.find('{{층1_경과연수}}',i+1)
t0=s.rfind('<hp:tbl ',0,i); t1=s.find('</hp:tbl>',i)
tbl=s[t0:t1]
for n in range(1,6):
    pat=re.compile(r'<hp:run charPrIDRef="28"/>(<hp:linesegarray>(?:(?!</hp:tc>).)*?</hp:subList><hp:cellAddr colAddr="6" rowAddr="%d"/>)'%n,re.S)
    tbl,k=pat.subn(r'<hp:run charPrIDRef="28"><hp:t>{{층%d_유효경과연수}}</hp:t></hp:run>\1'%n,tbl)
    assert k==1,(n,k)
s=s[:t0]+tbl+s[t1:]
zout=zipfile.ZipFile(dst,'w')
for info in zin.infolist():
    data=s.encode('utf-8') if info.filename=='Contents/section0.xml' else zin.read(info.filename)
    zi=zipfile.ZipInfo(info.filename,info.date_time);zi.compress_type=info.compress_type;zi.external_attr=info.external_attr
    zout.writestr(zi,data)
zout.close();print('ok')
