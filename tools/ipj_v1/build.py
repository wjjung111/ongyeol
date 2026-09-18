"""Create the standalone opinion template and its binding specification."""
import copy
import json
import sys
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from engine import NS, write_package, TOKEN

ROOT=Path(__file__).resolve().parents[2]
TARGET=ROOT/'템플릿'/'입주권v1'
fields={}
def el(tag,**attrs):
    prefix,name=tag.split(':'); return E.Element('{'+NS[prefix]+'}'+name,{k:str(v) for k,v in attrs.items()})
def token(name,source='사건 입력',kind='입력',required=True):
    fields.setdefault(name,{'name':name,'source':source,'kind':kind,'required':required,'locations':[]})
    return '{{'+name+'}}'
def p(text='',style=0,page=False):
    node=el('hp:p',id=0,paraPrIDRef=style,styleIDRef=0,pageBreak=int(page),columnBreak=0,merged=0)
    run=el('hp:run',charPrIDRef=style); t=el('hp:t'); t.text=text; run.append(t); node.append(run)
    return node
def table(heads,rows,widths=None):
    n=len(heads); widths=widths or [49324//n]*n; widths[-1]+=49324-sum(widths)
    node=p(); run=node[0]; run.remove(run[0])
    tbl=el('hp:tbl',id=0,zOrder=0,numberingType='TABLE',textWrap='TOP_AND_BOTTOM',textFlow='BOTH_SIDES',lock=0,
           dropcapstyle='None',pageBreak='CELL',repeatHeader=1,rowCnt=len(rows)+1,colCnt=n,cellSpacing=0,borderFillIDRef=3,noAdjust=0)
    tbl.append(el('hp:sz',width=49324,widthRelTo='ABSOLUTE',height=(len(rows)+1)*2400,heightRelTo='ABSOLUTE',protect=0))
    tbl.append(el('hp:pos',treatAsChar=0,affectLSpacing=0,flowWithText=1,allowOverlap=0,holdAnchorAndSO=0,
                  vertRelTo='PARA',horzRelTo='PARA',vertAlign='TOP',horzAlign='LEFT',vertOffset=0,horzOffset=0))
    tbl.append(el('hp:outMargin',left=0,right=0,top=300,bottom=300))
    tbl.append(el('hp:inMargin',left=300,right=300,top=300,bottom=300))
    for r,values in enumerate([heads]+rows):
        tr=el('hp:tr')
        for c,value in enumerate(values):
            tc=el('hp:tc',name='',header=int(r==0),hasMargin=1,protect=0,editable=0,dirty=0,borderFillIDRef=4 if r==0 else 3)
            sub=el('hp:subList',id='',textDirection='HORIZONTAL',lineWrap='BREAK',vertAlign='CENTER',linkListIDRef=0,
                   linkListNextIDRef=0,textWidth=0,textHeight=0,hasTextRef=0,hasNumRef=0)
            for line in str(value).split('\n'): sub.append(p(line,4 if r==0 else 3))
            tc.append(sub); tc.append(el('hp:cellAddr',colAddr=c,rowAddr=r)); tc.append(el('hp:cellSpan',colSpan=1,rowSpan=1))
            tc.append(el('hp:cellSz',width=widths[c],height=2400)); tc.append(el('hp:cellMargin',left=300,right=300,top=350,bottom=350))
            tr.append(tc)
        tbl.append(tr)
    run.append(tbl); run.append(el('hp:t')); return node

def build(seed):
    with ZipFile(seed) as z: parts={n:z.read(n) for n in z.namelist()}
    header=E.fromstring(parts['Contents/header.xml'])
    for f in header.findall('.//hh:font',NS): f.set('face','맑은 고딕')
    for st in header.findall('.//hh:style',NS):
        st.set('name','Normal'); st.set('engName','Normal'); st.set('paraPrIDRef','0'); st.set('charPrIDRef','0')
    chars=header.find('.//hh:charProperties',NS); base=copy.deepcopy(chars[0]); chars.clear(); chars.set('itemCnt','6')
    for i,(size,color,bold) in enumerate([(1000,'#222222',False),(1700,'#19354D',True),(1200,'#19354D',True),
                                         (900,'#222222',False),(900,'#19354D',True),(850,'#667788',False)]):
        cp=copy.deepcopy(base); cp.set('id',str(i)); cp.set('height',str(size)); cp.set('textColor',color)
        for key in cp.find('hh:fontRef',NS).attrib: cp.find('hh:fontRef',NS).set(key,'0')
        if bold: cp.append(el('hh:bold'))
        chars.append(cp)
    for original in list(chars):
        blue=copy.deepcopy(original);blue.set('id',str(int(original.get('id'))+6));blue.set('textColor','#1E67C6');chars.append(blue)
    chars.set('itemCnt',str(len(chars)))
    paras=header.find('.//hh:paraProperties',NS); base=copy.deepcopy(paras[0]); paras.clear(); paras.set('itemCnt','6')
    for i in range(6):
        pp=copy.deepcopy(base); pp.set('id',str(i)); pp.find('hh:align',NS).set('horizontal','LEFT')
        if i in (1,2): pp.find('hh:breakSetting',NS).set('keepWithNext','1')
        for spacing in pp.findall('.//hh:lineSpacing',NS): spacing.set('value','140' if i in (3,4) else '160')
        for m in pp.findall('.//hh:margin',NS): m.find('hc:next',NS).set('value','600' if i in (1,2) else '200')
        paras.append(pp)
    fills=header.find('.//hh:borderFills',NS)
    for i in (3,4):
        bf=copy.deepcopy(fills[0]); bf.set('id',str(i))
        for side in ('left','right','top','bottom'):
            x=bf.find('hh:'+side+'Border',NS); x.set('type','SOLID'); x.set('color','#BAC7D1'); x.set('width','0.12 mm')
        if i==4:
            brush=el('hc:fillBrush'); brush.append(el('hc:winBrush',faceColor='#EDF2F6',hatchColor='#FFFFFF',alpha=0)); bf.append(brush)
        fills.append(bf)
    fills.set('itemCnt',str(len(fills)))
    root=E.fromstring(parts['Contents/section0.xml']); sec=copy.deepcopy(root.find('.//hp:secPr',NS)); col=copy.deepcopy(root.find('.//hp:ctrl',NS)); root.clear()
    page=sec.find('hp:pagePr',NS); margin=page.find('hp:margin',NS)
    for key in ('left','right','top','bottom'): margin.set(key,'5102')
    margin.set('header','2268'); margin.set('footer','2268')
    first=p('온결 감정평가법인  |  입주권',5); first[0].insert(0,sec); first[0].insert(1,col); numbering=el('hp:ctrl'); numbering.append(el('hp:pageNum',pos='BOTTOM_CENTER',formatType='DIGIT',sideChar='-')); first[0].insert(2,numbering); root.append(first)
    location=''
    def add(node):
        for m in TOKEN.finditer(''.join(node.itertext())):
            if m[1] in fields and location not in fields[m[1]]['locations']: fields[m[1]]['locations'].append(location)
        root.append(node)
    def title(text,page=False):
        nonlocal location
        location=text; add(p(text,1,page))
    def section(text): add(p(text,2))
    def t(name,source='사건 입력',kind='입력',required=True): return token(name,source,kind,required)
    def calc(name): return t(name,'engine.model 단일 계산결과','계산')
    def narrative(name): return t(name,'평가사 작성·확정 문장','판단문장')
    title('I. 감정평가 개요')
    add(table(['구분','내용'],[[ '감정서 번호',t('감정서번호')],['평가 목적 / 의뢰인',t('평가목적')+' / '+t('의뢰인')],
         ['제출처 / 소유자',t('제출처')+' / '+t('소유자')],['기준시점 / 조사일',t('기준시점','base_date')+' / '+t('조사일')]], [11000,38324]))
    for label,name in [('1. 감정평가 목적','목적본문'),('2. 근거 및 기준가치','근거기준가치'),('3. 조사 내용 및 범위','조사내용'),
                       ('4. 감정평가 방법','평가방법'),('5. 조건 및 유의사항','평가조건')]:
        section(label); add(p(narrative(name)))
    add(p('서식 '+t('서식버전','고정 버전','상수'),5))
    title('II. 사업 및 배정물건',True)
    add(table(['구분','사업 개요'],[['사업명',t('사업명')],['소재지',t('사업소재지')],['진행 단계',t('사업단계')],['규모 / 일정',t('사업규모일정')]], [11000,38324]))
    section('1. 사업 현황'); add(p(narrative('사업현황')))
    section('2. 배정물건 내역')
    add(table(['기호','용도','동·호 / 배정상태','전유면적(㎡)','조합원 분양가(원)'],[[t('배정물건.'+k,'units[]') for k in ('기호','용도','동호','면적','분양가')]], [3500,6000,15324,8500,16000]))
    add(p('합계 분양가: '+calc('총분양가')+'원'))
    add(p(narrative('배정특이사항')))
    section('3. 조감도 및 자료 출처')
    add(p(t('조감도','image: 로컬 PNG/JPEG 경로; 없으면 미첨부','이미지',False)))
    add(p(t('조감도설명','이미지 슬롯 상태 및 자료 설명','이미지설명')))
    add(p('자료 출처: '+t('조감도출처')))
    title('III. 권리가액 및 정산 내역',True)
    add(table(['항목','금액 / 내용'],[['종전자산가액(원)',t('종전자산가액','old_value')],['비례율(%)',t('비례율','ratio')],
        ['종전자산 × 비례율 검산(원)',calc('비례율검산')],['통지 권리가액(원)',t('권리가액','right_value')],['권리가액 자료',t('권리가액출처','right_source')],
        ['통지액 − 검산액(원)',calc('권리가액차이')],['총분양가(원)',calc('총분양가')],['정산 구분 / 총액(원)',calc('정산구분')+' / '+calc('정산총액')]], [23000,26324]))
    add(p('통지 권리가액을 직접 적용하며, 비례율 검산으로 원자료를 덮어쓰지 않습니다.',5))
    section('기준시점별 납부·환급 내역')
    add(table(['일자','유형','금액(원)','반영 여부','증빙'],[[t('거래내역.'+k,'transactions[]') for k in ('일자','유형','금액','반영','증빙')]], [7800,6800,11000,11724,12000]))
    add(p('기준시점까지 납부 '+calc('납부누계')+'원 / 환급 수령 '+calc('환급누계')+'원'))
    add(p(narrative('정산검토')))
    title('IV. 거래사례 및 배정물건 평가',True)
    section('1. 거래사례 목록')
    add(table(['기호 / 용도','소재지','전유면적(㎡)','거래일','금액(원)'],[[t('거래사례.기호','cases[]')+' / '+t('거래사례.용도','cases[]'),t('거래사례.소재지','cases[]'),t('거래사례.면적','cases[]'),t('거래사례.거래일','cases[]'),t('거래사례.금액','cases[]')]], [6500,14524,6500,7800,14000]))
    section('2. 사례 출처 및 면적 기준')
    add(table(['사례','전유면적 기준 단가(원/㎡)','자료 출처'],[[t('거래사례.기호','cases[]'),t('거래사례.단가','cases[].price / area','계산'),t('거래사례.출처','cases[]')]], [6500,17000,25824]))
    add(p(narrative('사례검토')))
    add(p('{{#물건별평가}}'))
    title('배정물건 '+t('물건별평가.기호','units[]')+' — '+t('물건별평가.용도','units[]'),True)
    add(p('배정: '+t('물건별평가.동호','units[]')+' / 전유면적 '+t('물건별평가.면적','units[]')+'㎡'))
    section('1. 비교사례 선정 및 시점수정')
    add(p('선정사례 '+t('물건별평가.선정사례','units[].case_id')+' / '+t('물건별평가.선정사유','units[].selection_reason','판단문장')))
    add(p(t('물건별평가.시점근거','units[].time','판단문장')))
    add(table(['사례단가(원/㎡)','사정보정','시점수정','지역요인'],[[t('물건별평가.'+k,'units[] 평가 계산','계산') for k in ('사례단가','사정보정','시점수정','지역요인')]]))
    section('2. 개별요인 비교')
    add(table(['비교 항목','비교치','판단 근거'],[[t('개별요인.'+k,'units[].factors[]','판단문장' if k=='판단근거' else '입력') for k in ('항목','비교치','판단근거')]], [11000,8000,30324]))
    add(p('개별요인 누계: '+t('물건별평가.개별요인누계','units[].factors 곱','계산')))
    section('3. 단가 및 배정물건 가액 결정')
    add(table(['항목','결정 내용'],[['산정단가(원/㎡)',t('물건별평가.산정단가','사례단가 × 비교치','계산')],['결정단가(원/㎡)',t('물건별평가.결정단가','계산 또는 근거 있는 직접결정','계산')],
        ['단가 결정 근거',t('물건별평가.단가결정근거','units[].override_reason 또는 정리기준','판단문장')],['배정물건 평가액(원)',t('물건별평가.평가액','결정단가 × 면적 후 금액정리','계산')],['금액 정리 기준',t('물건별평가.금액정리','units[].amount_rounding')]], [20000,29324]))
    add(p('{{/물건별평가}}'))
    title('V. 입주권 감정평가액 결정',True)
    section('1. 프리미엄 산정')
    add(table(['기호','배정물건 평가액(원)','조합원 분양가(원)'],[[t('배정물건.기호','units[]'),t('배정물건.평가액','units[] 평가 계산','계산'),t('배정물건.분양가','units[]')]], [6500,21412,21412]))
    add(table(['항목','금액(원)'],[['배정물건 평가액 합계 ①',calc('배정물건평가합계')],['총분양가 ②',calc('총분양가')],['프리미엄 ③ = ① − ②',calc('프리미엄')]], [28000,21324]))
    section('2. 전체 입주권 가액')
    add(table(['구분','금액(원)'],[['권리가액 ④',t('권리가액')],['기준시점까지 납부금 ⑤',calc('납부누계')],['기준시점까지 환급 수령액 ⑥',calc('환급누계')],
        ['정리 전 가액 = ④ + ⑤ − ⑥ + ③',calc('정리전입주권가액')],['전체 입주권 가액',calc('전체입주권가액')]], [28000,21324]))
    add(p('전체 가액 정리: '+calc('최종정리기준'),5))
    add(p('{{#지분평가}}')); section('3. 평가대상 지분')
    add(p('평가대상 지분: '+t('지분평가.분자','share.numerator')+' / '+t('지분평가.분모','share.denominator')+' ('+t('지분평가.지분율','share','계산')+'%)'))
    add(p('지분 평가액: '+t('지분평가.지분가액','전체 정리 후 지분 적용 및 정리','계산')+'원 / '+t('지분평가.지분정리기준','share.rounding')))
    add(p('{{/지분평가}}'))
    section('감정평가액: '+calc('최종금액')+'원')
    add(p(narrative('결정의견')))
    for i,x in enumerate(root.findall('.//hp:p',NS)+root.findall('.//hp:tbl',NS),1): x.set('id',str(100000+i))
    for run in root.findall('.//hp:run',NS):
        if any(TOKEN.search(x.text or '') for x in run.findall('hp:t',NS)):
            run.set('charPrIDRef',str(int(run.get('charPrIDRef'))+6))
    parts['Contents/header.xml']=E.tostring(header,encoding='UTF-8',xml_declaration=True)
    parts['Contents/section0.xml']=E.tostring(root,encoding='UTF-8',xml_declaration=True)
    parts['Preview/PrvText.txt']='입주권 v1 의견서 템플릿 / 변수 치환 전'.encode('utf-8')
    # Blank preview, no stale source-report preview or client metadata.
    if 'Contents/content.hpf' in parts:
        hpf=E.fromstring(parts['Contents/content.hpf'])
        for x in hpf.iter():
            if E.QName(x).localname in ('title','creator'): x.text='입주권 v1 의견서'
            if x.get('name') in ('creator','lastsaveby'): x.text='Ongyeol'
            if x.get('name') in ('CreatedDate','ModifiedDate','date'): x.text='2026-09-18T00:00:00Z'
        parts['Contents/content.hpf']=E.tostring(hpf,encoding='UTF-8',xml_declaration=True)
    TARGET.mkdir(parents=True,exist_ok=True)
    write_package(TARGET/'입주권v1_의견서.hwpx',parts)
    (TARGET/'placeholders.json').write_text(json.dumps(list(fields.values()),ensure_ascii=False,indent=2),encoding='utf-8')
    lines=['# 입주권 v1 의견서 플레이스홀더 매핑','',
      '문서 토큰은 `{{이름}}`, 문단 반복은 `{{#물건별평가}}`…`{{/물건별평가}}`, 지분 조건은 0개 또는 1개 배열입니다. 배열 접두어가 있는 표 행은 개수만큼 복제합니다. 고정 슬롯은 없습니다.',
      '', '미지정 필드는 출력 오류로 처리합니다. 선택값은 명시적인 `-` 또는 설명문을 입력합니다. 0은 유효값입니다. 동·호 미정은 임의 호수를 만들지 않고 배정상태로 적습니다.', '',
      '조감도는 전용 문단 토큰이며 로컬 PNG/JPEG를 HWPX에 내장합니다. 종횡비를 유지하여 본문 폭과 높이 63.5mm 안에 맞춥니다. 생략하면 미첨부 문구를 출력합니다. 캡션과 출처는 별도 필드입니다.', '',
      '| 토큰 | 구분 | 원천 / 계산 | 삽입 위치 | 필수 / 반복·조건 |','|---|---|---|---|---|']
    for f in fields.values():
        prefix=f['name'].split('.')[0]
        condition='선택; 없으면 미첨부' if f['kind']=='이미지' else '지분 선택 시' if prefix=='지분평가' else ('배열 개수만큼' if '.' in f['name'] else '필수')
        lines.append('| `{{'+f['name']+'}}` | '+f['kind']+' | '+f['source']+' | '+', '.join(f['locations'])+' | '+condition+' |')
    (TARGET/'플레이스홀더_매핑.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(f'Built {TARGET}; {len(fields)} bindings')

if __name__=='__main__': build(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent/'blank.hwpx')
