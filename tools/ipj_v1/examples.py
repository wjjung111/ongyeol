"""Synthetic fixtures only: never publish source-client reports."""
import copy
import json
from pathlib import Path
from engine import model,render
from build import TARGET

HERE=Path(__file__).resolve().parent
R={'mode':'round','quantum':1000}
TEXT={
 '감정서번호':'V1-TEST-001 (가상 시험자료)', '평가목적':'템플릿 기능 검증', '의뢰인':'가상 의뢰인',
 '제출처':'내부 검토용', '소유자':'가상 소유자', '조사일':'2026-09-18',
 '목적본문':'본 문서는 입주권 v1 의견서의 계산 및 출력 기능을 확인하기 위한 가상 시험자료이며 실제 감정평가서가 아닙니다.',
 '근거기준가치':'실제 사건에서는 적용 법령, 평가 목적, 기준가치 및 그 근거를 평가사가 확인하여 이 문장을 작성합니다.',
 '조사내용':'제공자료에 의한 사업 개요, 배정내역, 권리가액, 납부·환급 내역 및 거래사례의 연결 여부를 검증합니다. 실제 현장조사는 수행하지 않았습니다.',
 '평가방법':'배정물건별 비교사례를 선정하고 사정보정, 시점수정, 지역요인 및 개별요인을 적용하여 배정물건 가액을 산정합니다. 배정물건 가액과 조합원 분양가의 차이를 프리미엄으로 산정하고 권리가액 및 기준시점까지의 납부·환급 내역을 반영합니다.',
 '평가조건':'모든 금액, 지수, 주소 및 비교 판단은 기능 검증을 위한 가상 값입니다. 실제 사건에 사용할 경우 자료의 진정성과 평가방법의 적합성을 별도로 확인하여야 합니다.',
 '사업명':'가상 온결 정비사업', '사업소재지':'가상시 예시구 시험동 100', '사업단계':'관리처분계획 인가 후 (가상)',
 '사업규모일정':'공동주택 및 근린생활시설 / 일정은 시험자료', '사업현황':'공동주택과 상가를 포함하는 가상의 정비사업입니다.',
 '배정특이사항':'동·호가 미정인 물건은 배정상태를 표시합니다. 면적은 전유면적을 기준으로 입력하였습니다.',
 '조감도설명':'조감도 미첨부 — 이 시험출력에는 사업 이미지가 없습니다.', '조감도출처':'미첨부',
 '정산검토':'기준시점 이후 거래는 내역에 표시하되 합계에 포함하지 않았습니다. 권리가액과 종전자산·비례율 검산 차이는 원자료에 따라 별도로 검토합니다.',
 '사례검토':'각 물건의 용도에 대응하는 사례를 ID로 선정합니다. 사례 수는 출력 행 수에 제한을 두지 않습니다. 아래 지수와 비교치는 실재 시장자료가 아닙니다.',
 '결정의견':'위 산정 내역에 따라 시험 평가액을 결정하였습니다. 실제 감정평가 판단을 나타내지 않습니다.'}

def unit(i,use='아파트',area=100,sale=700000000):
    return {'id':f'U{i}','use':use,'allocation':'동·호 미정','area':area,'sale_price':sale,'case_id':'C1' if use=='아파트' else 'C3',
        'selection_reason':'동일 용도의 가상 사례를 선택하여 비교 흐름을 검증함.', 'circumstance':1,'regional':1,
        'time':{'method':'index','series':'가상 공동주택 지수','start_month':'2026-06','end_month':'2026-09','start':100,'end':100,'source':'가상 시험자료'} if use=='아파트' else {'method':'manual','factor':1,'basis':'가상 상가 시점수정치 1.000; 실재 지수 아님'},
        'factors':[{'name':name,'value':1,'reason':'시험자료상 대등한 것으로 가정'} for name in (['단지 외부','단지 내부','호별','기타'] if use=='아파트' else ['상권','접근성','건물','층·위치','기타'])],
        'unit_rounding':{'mode':'round','quantum':1000},'amount_rounding':{'mode':'round','quantum':1000000}}

def fixtures():
    data={'text':copy.deepcopy(TEXT),'base_date':'2026-09-18','old_value':400000000,'ratio':125,'right_value':500000000,
      'right_source':'가상 권리가액 통지서', 'units':[unit(1)],
      'cases':[{'id':f'C{i}','use':'근린생활시설' if i==3 else '아파트','address':f'가상시 사례동 {i}',
                'area':100,'price':1000000000,'date':'2026-06-01','source':'가상 거래자료'} for i in range(1,7)],
      'transactions':[{'date':'2026-08-01','kind':'payment','amount':100000000,'source':'가상 납부확인서'},
                      {'date':'2026-10-01','kind':'payment','amount':30000000,'source':'기준시점 이후 시험내역'}],
      'final_rounding':{'mode':'round','quantum':1000000}}
    out={}
    single=copy.deepcopy(data); single['cases']=single['cases'][:2]; out['01_단일_동호미정']=single
    two=copy.deepcopy(data); two['units'].append(unit(2,area=80,sale=600000000)); out['02_아파트2개']=two
    mixed=copy.deepcopy(two); mixed['units'].append(unit(3,'근린생활시설',50,400000000));
    mixed['image']=str(HERE/'test-image.png'); mixed['text']['조감도설명']='그림 슬롯 검증용 이미지 — 실제 사업 조감도 아님'; mixed['text']['조감도출처']='직접 생성한 시험 이미지'
    mixed['right_value']=1900000000; mixed['old_value']=1520000000
    mixed['transactions']=[{'date':'2026-08-01','kind':'refund','amount':50000000,'source':'가상 환급확인서'}]
    out['03_아파트2_상가1_청산금']=mixed
    refund=copy.deepcopy(single); refund['right_value']=800000000; refund['old_value']=640000000
    refund['transactions']=[{'date':'2026-08-01','kind':'refund','amount':50000000,'source':'가상 환급확인서'}]; out['04_단일_청산금']=refund
    share=copy.deepcopy(single); share['share']={'numerator':2,'denominator':5,'rounding':{'mode':'round','quantum':1000000}}; out['05_지분40퍼센트']=share
    six=copy.deepcopy(single); six['cases']=data['cases']; six['units'][0]['case_id']='C6'; out['06_거래사례6개']=six
    return out

def main():
    path=TARGET/'시험출력'; path.mkdir(exist_ok=True)
    fixture_path=HERE/'fixtures'; fixture_path.mkdir(exist_ok=True)
    for name,data in fixtures().items():
        data['text']['감정서번호']=name+' (가상 시험자료)'
        (fixture_path/(name+'.json')).write_text(json.dumps({**data,**({'image':'tools/ipj_v1/test-image.png'} if data.get('image') else {})},ensure_ascii=False,indent=2),encoding='utf-8')
        render(TARGET/'입주권v1_의견서.hwpx',path/(name+'.hwpx'),model(data))
        print(name,model(data)['최종금액'])

if __name__=='__main__':main()
