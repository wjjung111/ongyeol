"""Independent 입주권 v1: Decimal calculation and strict native HWPX binding."""
from __future__ import annotations
import copy
import re
from datetime import date
from decimal import Decimal, ROUND_HALF_UP, ROUND_FLOOR
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED
from lxml import etree as E

NS = {k: f'http://www.hancom.co.kr/hwpml/2011/{v}' for k,v in
      [('hp','paragraph'),('hh','head'),('hc','core'),('hs','section')]}
TOKEN = re.compile(r'\{\{([^{}]+)\}\}')
D = lambda x: Decimal(str(x))
def money(n): return f'{D(n):,.0f}'
def number(n): return format(D(n).normalize(), 'f')
def factor(n): return format(D(n).quantize(D('0.000001')).normalize(), 'f')
def rule(spec): return money(spec['quantum'])+'원 단위 '+{'round':'반올림','floor':'내림','none':'정리 없음'}[spec['mode']]
def rounded(n, spec):
    quantum = D(spec['quantum'])
    if quantum <= 0: raise ValueError('정리 단위는 양수여야 합니다')
    mode = spec['mode']
    if mode == 'none': return n
    if mode not in ('round', 'floor'): raise ValueError('정리 방식 오류')
    return (n / quantum).to_integral_value(rounding=ROUND_HALF_UP if mode == 'round' else ROUND_FLOOR)*quantum

def model(data):
    """All display totals come from this single calculation; no positional case fallback."""
    base = date.fromisoformat(data['base_date'])
    cases = {c['id']: c for c in data['cases']}
    if len(cases) != len(data['cases']): raise ValueError('사례 ID 중복')
    if not data['units']: raise ValueError('배정물건 없음')
    if len({u['id'] for u in data['units']}) != len(data['units']): raise ValueError('물건 ID 중복')
    out = dict(data['text'])
    if any(not str(v).strip() for v in out.values()): raise ValueError('필수 문장/자료 출처 빈 값')
    out['조감도'] = data.get('image')
    out.update({'기준시점':base.isoformat(), '서식버전':'IPJ-V1-OPINION-1.0',
                '배정물건':[], '거래사례':[], '물건별평가':[], '거래내역':[]})
    total_value = D(0); total_sale = D(0)
    for c in data['cases']:
        if D(c['area']) <= 0 or D(c['price']) <= 0: raise ValueError('사례 면적/금액 오류')
        out['거래사례'].append({'기호':c['id'], '소재지':c['address'], '용도':c['use'],
            '면적':number(c['area']), '거래일':c['date'], '금액':money(c['price']),
            '단가':money(D(c['price'])/D(c['area'])), '출처':c['source']})
    for u in data['units']:
        if D(u['area']) <= 0 or D(u['sale_price']) < 0: raise ValueError('물건 면적/분양가 오류')
        if u['case_id'] not in cases: raise ValueError('선정 사례 없음: '+u['case_id'])
        c = cases[u['case_id']]
        if c['use'] != u['use']: raise ValueError('물건과 선정사례 용도 불일치')
        time = u['time']
        if time['method'] == 'index':
            if D(time['start']) <= 0 or D(time['end']) <= 0: raise ValueError('지수 오류')
            time_factor = D(time['end'])/D(time['start'])
            time_basis = f"{time['series']} / {time['start_month']} {number(time['start'])} → {time['end_month']} {number(time['end'])} / {time['source']}"
        elif time['method'] == 'manual':
            time_factor = D(time['factor']); time_basis = time['basis']
            if not time_basis.strip(): raise ValueError('직접 시점수정 근거 누락')
        else: raise ValueError('시점수정 방식 오류')
        if time_factor <= 0: raise ValueError('시점수정치 오류')
        ratio = D(u['circumstance']) * time_factor * D(u['regional'])
        if D(u['circumstance']) <= 0 or D(u['regional']) <= 0: raise ValueError('비교치 오류')
        factors=[]; individual=D(1)
        for f in u['factors']:
            if D(f['value']) <= 0: raise ValueError('개별요인 오류')
            individual *= D(f['value'])
            factors.append({'항목':f['name'], '비교치':number(f['value']), '판단근거':f['reason']})
        computed = D(c['price'])/D(c['area']) * ratio * individual
        decided = rounded(computed,u['unit_rounding'])
        if u.get('unit_override') is not None:
            if not u.get('override_reason','').strip(): raise ValueError('단가 결정 근거 누락')
            decided = D(u['unit_override'])
            if decided <= 0: raise ValueError('결정단가 오류')
        value = rounded(decided*D(u['area']),u['amount_rounding'])
        total_value += value; total_sale += D(u['sale_price'])
        unit={'기호':u['id'], '용도':u['use'], '동호':u['allocation'], '면적':number(u['area']),
              '분양가':money(u['sale_price']), '선정사례':u['case_id'], '선정사유':u['selection_reason'],
              '사례단가':money(D(c['price'])/D(c['area'])), '사정보정':number(u['circumstance']),
              '시점수정':factor(time_factor), '시점근거':time_basis, '지역요인':number(u['regional']),
              '개별요인':factors, '개별요인누계':factor(individual), '산정단가':money(computed),
              '결정단가':money(decided), '평가액':money(value),
              '단가결정근거':u.get('override_reason') or rule(u['unit_rounding']),
              '금액정리':rule(u['amount_rounding'])}
        out['배정물건'].append(unit); out['물건별평가'].append(unit)
    paid=D(0); refund=D(0)
    for t in data['transactions']:
        amount=D(t['amount'])
        if amount<0: raise ValueError('납부/환급금액은 양수로 입력')
        if t['kind'] not in ('payment','refund'): raise ValueError('거래 유형 오류')
        included = date.fromisoformat(t['date']) <= base
        if included:
            if t['kind']=='payment': paid+=amount
            else: refund+=amount
        out['거래내역'].append({'일자':t['date'],'유형':'납부' if t['kind']=='payment' else '환급 수령',
            '금액':money(amount),'반영':'포함' if included else '기준시점 이후 제외','증빙':t['source']})
    if not out['거래내역']:
        out['거래내역']=[{'일자':'-','유형':'내역 없음','금액':'0','반영':'-','증빙':'-'}]
    rights=D(data['right_value']); old=D(data['old_value']); rate=D(data['ratio'])
    if min(rights,old,rate)<0: raise ValueError('권리가액/종전자산/비례율 오류')
    premium=total_value-total_sale; raw=rights+paid-refund+premium
    whole=rounded(raw,data['final_rounding'])
    settlement=total_sale-rights
    out.update({'종전자산가액':money(old),'비례율':number(rate), '비례율검산':money(old*rate/D(100)),
        '권리가액':money(rights),'권리가액출처':data['right_source'],
        '권리가액차이':money(rights-old*rate/D(100)),
        '총분양가':money(total_sale),'정산구분':'분담금' if settlement>=0 else '청산금',
        '정산총액':money(abs(settlement)), '납부누계':money(paid),'환급누계':money(refund),
        '배정물건평가합계':money(total_value),'프리미엄':money(premium),
        '정리전입주권가액':money(raw),'전체입주권가액':money(whole),
        '최종금액':money(whole),'최종정리기준':rule(data['final_rounding']),
        '지분평가':[]})
    if data.get('share'):
        s=data['share']; n=D(s['numerator']); d=D(s['denominator'])
        if not (d>0 and 0<n<=d): raise ValueError('지분 오류')
        final=rounded(whole*n/d,s['rounding'])
        out['지분평가']=[{'분자':number(n),'분모':number(d),'지분율':number(n/d*100),
            '지분가액':money(final),'지분정리기준':rule(s['rounding'])}]
        out['최종금액']=money(final)
    return out

def text_of(node): return ''.join(node.itertext())
def replace(node, context):
    for t in node.findall('.//hp:t',NS):
        def sub(m):
            key=m.group(1)
            if key not in context or isinstance(context[key],(dict,list)): raise ValueError('미매핑 토큰: '+key)
            return str(context[key])
        t.text=TOKEN.sub(sub,t.text or '')

def render(template, destination, context):
    """Expand whole blocks and prototype rows, then strictly bind scalar tokens."""
    with ZipFile(template) as z: parts={n:z.read(n) for n in z.namelist()}
    root=E.fromstring(parts['Contents/section0.xml'])
    # The image occupies a whole paragraph; no HTML or remote URLs enter the package.
    for paragraph in list(root):
        if text_of(paragraph).strip() != '{{조감도}}': continue
        for child in list(paragraph): paragraph.remove(child)
        run=E.SubElement(paragraph,'{'+NS['hp']+'}run',charPrIDRef='0')
        if context.get('조감도'):
            from PIL import Image
            import io
            asset=Path(context['조감도'])
            with Image.open(asset) as source:
                source.load(); source=source.convert('RGB')
                width,height=source.size
                if width<=0 or height<=0: raise ValueError('이미지 크기 오류')
                scale=min(49324/width,18000/height)
                w,h=round(width*scale),round(height*scale)
                source.thumbnail((1800,1000))
                buf=io.BytesIO(); source.save(buf,format='PNG')
            pic=E.parse(str(Path(__file__).parent/'picture.xml')).getroot()
            pic.find('hc:img',NS).set('binaryItemIDRef','ipjImage')
            for tag in ('orgSz','sz'):
                pic.find('hp:'+tag,NS).set('width',str(w));pic.find('hp:'+tag,NS).set('height',str(h))
            pic.find('hp:rotationInfo',NS).set('centerX',str(w//2));pic.find('hp:rotationInfo',NS).set('centerY',str(h//2))
            for tag,x,y in [('pt0',0,0),('pt1',w,0),('pt2',w,h),('pt3',0,h)]:
                point=pic.find('hp:imgRect/hc:'+tag,NS);point.set('x',str(x));point.set('y',str(y))
            run.append(pic)
            parts['BinData/ipjImage.png']=buf.getvalue()
            hpf=E.fromstring(parts['Contents/content.hpf'])
            manifest=hpf.find('{http://www.idpf.org/2007/opf/}manifest')
            E.SubElement(manifest,'{http://www.idpf.org/2007/opf/}item',{'id':'ipjImage','href':'BinData/ipjImage.png','media-type':'image/png','isEmbeded':'1'})
            parts['Contents/content.hpf']=E.tostring(hpf,encoding='UTF-8',xml_declaration=True)
        else:
            E.SubElement(run,'{'+NS['hp']+'}t').text='조감도 미첨부'

    def expand(parent, ctx):
        i=0
        while i<len(parent):
            node=parent[i]; marker=text_of(node).strip()
            start=re.fullmatch(r'\{\{#([^{}]+)\}\}',marker)
            if start:
                name=start[1]; end=i+1
                while end<len(parent) and text_of(parent[end]).strip()!='{{/'+name+'}}': end+=1
                if end==len(parent): raise ValueError('반복 블록 닫힘 누락: '+name)
                prototypes=[copy.deepcopy(x) for x in list(parent)[i+1:end]]
                rows=ctx[name]
                if not isinstance(rows,list): raise ValueError('반복값 배열 필요')
                for x in list(parent)[i:end+1]: parent.remove(x)
                count=0
                for item in rows:
                    local={**ctx,name:item,**{name+'.'+k:v for k,v in item.items()},**item}
                    wrapper=E.Element('wrapper')
                    for x in prototypes: wrapper.append(copy.deepcopy(x))
                    expand(wrapper,local)
                    for x in list(wrapper): parent.insert(i+count,x); count+=1
                i+=count; continue
            if node.tag=='{'+NS['hp']+'}tr':
                prefixes={m[1].split('.')[0] for m in TOKEN.finditer(marker) if '.' in m[1]}
                arrays=[p for p in prefixes if isinstance(ctx.get(p),list)]
                if len(arrays)>1: raise ValueError('한 행에서 둘 이상의 배열 반복 불가')
                if arrays:
                    name=arrays[0]; parent.remove(node); count=0
                    for item in ctx[name]:
                        clone=copy.deepcopy(node)
                        replace(clone,{**ctx,**{name+'.'+k:v for k,v in item.items()}})
                        parent.insert(i+count,clone); count+=1
                    i+=count; continue
            expand(node,ctx)
            if node.tag=='{'+NS['hp']+'}t':
                if node.text:
                    def sub(m):
                        key=m[1]
                        if key not in ctx or isinstance(ctx[key],(list,dict)): raise ValueError('미매핑 토큰: '+key)
                        return str(ctx[key])
                    node.text=TOKEN.sub(sub,node.text)
            i+=1
    expand(root,context)
    for tbl in root.findall('.//hp:tbl',NS):
        rows=tbl.findall('hp:tr',NS); tbl.set('rowCnt',str(len(rows)))
        for r,tr in enumerate(rows):
            for cell in tr.findall('hp:tc',NS): cell.find('hp:cellAddr',NS).set('rowAddr',str(r))
    for i,node in enumerate(root.findall('.//hp:p',NS)+root.findall('.//hp:tbl',NS),1): node.set('id',str(100000+i))
    for run in root.findall('.//hp:run',NS):
        if int(run.get('charPrIDRef','0'))>=6: run.set('charPrIDRef',str(int(run.get('charPrIDRef'))-6))
    if TOKEN.search(text_of(root)): raise ValueError('잔여 토큰')
    parts['Contents/section0.xml']=E.tostring(root,encoding='UTF-8',xml_declaration=True)
    parts['Preview/PrvText.txt']='\n'.join(t.text or '' for t in root.findall('.//hp:t',NS)).encode('utf-8')
    write_package(destination,parts)

def write_package(path,parts):
    Path(path).parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(path,'w',ZIP_DEFLATED) as z:
        z.writestr('mimetype',parts['mimetype'],compress_type=ZIP_STORED)
        for k,v in parts.items():
            if k!='mimetype': z.writestr(k,v)
