# -*- coding: utf-8 -*-
"""KAIS 실거래 「현재데이터 복사」(건물·토지) → 토지배분단가 엑셀 만들기 (2026-11-23)

엑셀에 건물 줄을 붙여넣으면 WEBSERVICE 함수로 프록시(/bld getBrTitleInfo)를 불러
건축물대장 표제부의 주구조·주용도·사용승인일을 읽고, 기준표(2025 자료집 대표 단가)로
재조달원가·내용연수를 넣는다. 바로 아래 토지 줄을 붙여넣으면 토지단가가 나온다.
계산식은 토지건물.html tradeCalc와 같다:
  경과연수 = 사용승인일→거래시점 만 연수, 잔존 = 내용연수-경과(0 미만이면 0)
  적용단가 = ROUND(재조달원가×잔존÷내용연수), 건물가격 = 적용단가×건물면적
  토지단가 = TRUNC((총액-건물가격)÷토지면적)

쓰는 법:  python3 -I tools/make_kais_alloc_xlsx.py <법정동 json> <출력.xlsx> [--test]
  법정동 json: https://raw.githubusercontent.com/WooilJeong/code/main/code/code_dong/code_bdong.json
  --test: WEBSERVICE 대신 tests/fixtures 예시 JSON을 박아 LibreOffice로 계산 확인용 파일을 만든다.
"""
import json, re, sys, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as CL
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROXY = 'https://ongyeol-proxy.woojin-apr.workers.dev'
FIRST, LAST = 4, 403          # 공식이 들어가는 행(붙여넣기는 A3부터 — 3행은 머리글)
PASTE_COLS = 16               # A:P

# ---------------- 기준표 (2025 건축물 재조달원가 자료집 대표 단가 — 평가사가 고쳐 쓰는 기본값) -------------
GROUPS_S = ['철근콘크리트조', '철골철근콘크리트조', '철골조', '경량철골조', '벽돌조', '블록조', '목조']
GROUPS_U = ['단독주택', '공동주택', '상업', '업무', '공장', '창고']
# (재조달원가, 내용연수, 근거)
BASE = {
 '단독주택': {'철근콘크리트조': (1836000, 50, '일반주택 01-01-05-09 평지붕 3급'), '철골조': (2237000, 45, '일반주택 01-01-06-01 3급'),
            '경량철골조': (955000, 35, '조립식주택 경량철골조 3급'), '벽돌조': (1576000, 45, '일반주택 01-01-02-09 평지붕 3급'),
            '블록조': (1408000, 40, '일반주택 01-01-04-09 평지붕 3급'), '목조': (1332000, 40, '일반주택 01-01-01-01 3급')},
 '공동주택': {'철근콘크리트조': (1594000, 50, '다세대주택 02-03-05-09 3급')},
 '상업': {'철근콘크리트조': (1402000, 50, '점포 및 상가 03-01-05-09 3급'), '철골조': (1420000, 45, '점포 및 상가 03-01-06-09 3급'),
        '경량철골조': (804000, 35, '조립식사무실 경량철골조 4급'), '벽돌조': (1365000, 45, '점포 및 상가 03-01-02-09 3급'),
        '블록조': (1318000, 40, '점포 및 상가 03-01-04-09 3급'), '목조': (1311000, 40, '점포 및 상가 03-01-01-01 3급')},
 '업무': {'철근콘크리트조': (1361000, 50, '사무실(5층이하) 04-01-05-09 3급'), '철골철근콘크리트조': (1588000, 50, '지식산업센터 SRC 3급'),
        '철골조': (1693000, 45, '공공청사 철골조 3급'), '경량철골조': (804000, 35, '조립식사무실 경량철골조 4급'),
        '벽돌조': (1170000, 45, '사무실(5층이하) 04-01-02-09 3급')},
 '공장': {'철근콘크리트조': (1228000, 45, '일반공장 RC 평지붕 6.0m 3급'), '철골철근콘크리트조': (1239000, 45, '일반공장 SRC 6.0m 3급'),
        '철골조': (846000, 40, '일반공장 철골 샌드위치패널 6.0m 3급'), '경량철골조': (813000, 35, '일반공장 경량철골 3급'),
        '벽돌조': (1034000, 40, '일반공장 벽돌 평지붕 3급'), '블록조': (816000, 35, '일반공장 블록 평지붕 4급'),
        '목조': (878000, 25, '일반공장 목조 3급')},
 '창고': {'철근콘크리트조': (985000, 45, '일반창고 RC 평지붕 6.0m 3급'), '철골조': (768000, 40, '일반창고 철골 샌드위치패널 6.0m 3급'),
        '경량철골조': (741000, 35, '일반창고 경량철골 3급'), '벽돌조': (924000, 40, '일반창고 벽돌 평지붕 3급'),
        '블록조': (745000, 35, '일반창고 블록 평지붕 4급'), '목조': (724000, 25, '일반창고 목조 3급')},
}
# 대장 주구조 글자 → 구조군 (위에서부터 먼저 걸리는 것)
KW_S = [('철골철근', '철골철근콘크리트조'), ('철골콘크리트', '철골철근콘크리트조'), ('SRC', '철골철근콘크리트조'),
        ('경량', '경량철골조'), ('판넬', '경량철골조'), ('패널', '경량철골조'), ('조립', '경량철골조'), ('강파이프', '경량철골조'),
        ('철골', '철골조'), ('강구조', '철골조'),
        ('콘크리트', '철근콘크리트조'), ('라멘', '철근콘크리트조'),
        ('벽돌', '벽돌조'), ('조적', '벽돌조'), ('석구조', '벽돌조'),
        ('블록', '블록조'), ('블럭', '블록조'),
        ('목', '목조'), ('통나무', '목조')]
# 대장 주용도 글자 → 용도군 (못 찾으면 「상업」)
KW_U = [('단독주택', '단독주택'), ('다가구', '단독주택'), ('공동주택', '공동주택'), ('아파트', '공동주택'), ('다세대', '공동주택'),
        ('연립', '공동주택'), ('공장', '공장'), ('창고', '창고'), ('동물', '창고'), ('식물', '창고'), ('축사', '창고'),
        ('업무', '업무')]

KAIS_HEAD = ['상세물건번호', '시군구', '소재지', '지번', '상세물건구분', '지목', '용도지역', '기타주소', '거래시점',
             '전체면적', '전용면적', '물건금액', '단가', '사용승인일자']

thin = Side(style='thin', color='B7C3D0')
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
F_HEAD = PatternFill('solid', fgColor='DCE6F1')
F_PASTE = PatternFill('solid', fgColor='FFF9DB')
F_RES = PatternFill('solid', fgColor='E8F5E9')
F_EXT = PatternFill('solid', fgColor='F3F4F6')
BOLD = Font(bold=True)


def load_bdong(path):
    d = json.load(open(path, encoding='utf-8'))['data']
    n = len(d['시도코드'])
    out, seen = [], set()
    for i in range(n):
        r = {k: d[k][str(i)] for k in d}
        if isinstance(r['말소일자'], str):
            continue
        sido = r['시도명']
        if not isinstance(sido, str) or '출장소' in sido:
            continue
        parts = [sido] + [r[k] for k in ('시군구명', '읍면동명', '동리명') if isinstance(r[k], str)]
        if not isinstance(r['읍면동명'], str):
            continue                      # 시도·시군구 줄은 필요 없음
        key = ' '.join(parts)
        code = r['법정동코드']
        for k in {key, key.replace('강원특별자치도', '강원도').replace('전북특별자치도', '전라북도')
                  .replace('제주특별자치도', '제주도')}:
            if k not in seen:
                seen.add(k)
                out.append((k, code))
    out.sort()
    return out


def build(bdong_path, out_path, test=False):
    wb = Workbook()
    # ================= 시트 1: 붙여넣기 =================
    ws = wb.active
    ws.title = '붙여넣기'
    guide = wb.create_sheet('사용법')
    gs = wb.create_sheet('결과모음')
    kb = wb.create_sheet('기준표')
    pd = wb.create_sheet('표준단가2025')
    bd = wb.create_sheet('법정동')

    # ---- 기준표 시트 ----
    kb['A1'] = '설정·기준표 — 노란 칸은 고쳐 써도 됩니다(평가사 판단). 붙여넣기 시트가 이 표를 그대로 씁니다.'
    kb['A1'].font = Font(bold=True, size=12)
    kb['A2'] = '프록시 주소'
    kb['B2'] = PROXY
    kb['B2'].fill = F_PASTE
    kb['A4'] = '① 재조달원가(원/㎡) — 구조군 × 용도군'
    kb['A4'].font = BOLD
    kb['A13'] = '② 내용연수(년) — 구조군 × 용도군'
    kb['A13'].font = BOLD
    kb['A22'] = '③ 근거(2025 건축물 재조달원가 자료집 — 「표준단가2025」 시트에 전체 표)'
    kb['A22'].font = BOLD
    for top in (5, 14, 23):
        kb.cell(top, 1, '구조군 \\ 용도군').fill = F_HEAD
        for j, u in enumerate(GROUPS_U):
            c = kb.cell(top, 2 + j, u)
            c.fill = F_HEAD
            c.font = BOLD
        for i, s in enumerate(GROUPS_S):
            kb.cell(top + 1 + i, 1, s).fill = F_HEAD
    for i, s in enumerate(GROUPS_S):
        for j, u in enumerate(GROUPS_U):
            v = BASE.get(u, {}).get(s)
            c1 = kb.cell(6 + i, 2 + j, v[0] if v else None)
            c2 = kb.cell(15 + i, 2 + j, v[1] if v else None)
            c3 = kb.cell(24 + i, 2 + j, v[2] if v else '(없음 — 쓰려면 위 두 표에 직접)')
            c1.number_format = '#,##0'
            for c in (c1, c2):
                c.fill = F_PASTE
                c.border = BOX
            c3.font = Font(size=9, color='6B7280')
    kb['I4'] = '④ 주구조 글자 → 구조군 (위에서부터 먼저 걸리는 줄)'
    kb['I4'].font = BOLD
    kb['I5'], kb['J5'] = '대장 주구조에 들어 있는 글자', '구조군'
    for i, (k, g) in enumerate(KW_S):
        kb.cell(6 + i, 9, k).fill = F_PASTE
        kb.cell(6 + i, 10, g).fill = F_PASTE
    KS_END = 6 + len(KW_S) + 5          # 빈 줄 5개(추가용)
    for r in range(6 + len(KW_S), KS_END + 1):
        kb.cell(r, 9).fill = F_PASTE
        kb.cell(r, 10).fill = F_PASTE
    kb['L4'] = '⑤ 주용도 글자 → 용도군 (못 찾으면 「상업」)'
    kb['L4'].font = BOLD
    kb['L5'], kb['M5'] = '대장 주용도에 들어 있는 글자', '용도군'
    for i, (k, g) in enumerate(KW_U):
        kb.cell(6 + i, 12, k).fill = F_PASTE
        kb.cell(6 + i, 13, g).fill = F_PASTE
    KU_END = 6 + len(KW_U) + 5
    for r in range(6 + len(KW_U), KU_END + 1):
        kb.cell(r, 12).fill = F_PASTE
        kb.cell(r, 13).fill = F_PASTE
    for c, w in zip('ABCDEFGHIJKLM', (20, 13, 13, 13, 13, 13, 13, 3, 24, 18, 3, 24, 12)):
        kb.column_dimensions[c].width = w
    COST = "기준표!$B$6:$G$12"
    LIFE = "기준표!$B$15:$G$21"
    SROW = "기준표!$A$6:$A$12"
    UCOL = "기준표!$B$5:$G$5"
    KS_K, KS_G = f"기준표!$I$6:$I${KS_END}", f"기준표!$J$6:$J${KS_END}"
    KU_K, KU_G = f"기준표!$L$6:$L${KU_END}", f"기준표!$M$6:$M${KU_END}"

    # ---- 표준단가2025 시트 (참고용 전체 표) ----
    src = open(os.path.join(ROOT, 'arap_building_cost_data.js'), encoding='utf-8').read()
    data = json.loads(src[src.index('{'):src.rindex('}') + 1])
    pd.append(['분류기호', '용도분류', '용도', '구조', '급수', '표준단가(원/㎡)', '내용연수', '내용연수 범위', '자료집 쪽'])
    for c in pd[1]:
        c.fill = F_HEAD
        c.font = BOLD
    for x in data['records']:
        pd.append([x['classificationCode'], x['category'], x['usage'], x['structure'], x['grade'],
                   x['standardUnitCost'], x['usefulLifeYears'],
                   f"{x['usefulLifeMinYears']}~{x['usefulLifeMaxYears']}", x['sourcePage']])
    for r in range(2, pd.max_row + 1):
        pd.cell(r, 6).number_format = '#,##0'
    for c, w in zip('ABCDEFGHI', (14, 12, 22, 44, 6, 15, 9, 12, 9)):
        pd.column_dimensions[c].width = w
    pd.auto_filter.ref = f"A1:I{pd.max_row}"
    pd.freeze_panes = 'A2'

    # ---- 법정동 시트 (숨김) ----
    bd.append(['주소(시도 시군구 읍면동 리)', '법정동코드'])
    rows = load_bdong(bdong_path)
    for k, code in rows:
        bd.append([k, code])
    BD_END = len(rows) + 1
    bd.sheet_state = 'hidden'
    BDR = f"법정동!$A$2:$B${BD_END}"

    # ---- 붙여넣기 시트 ----
    ws['A1'] = 'KAIS 실거래 → 토지배분단가   ①「상세물건정보」에서 건물 줄 「현재데이터 복사」 → A3에 붙여넣기(Ctrl+V)   ② 바로 아래 칸에 토지 줄 붙여넣기   → 초록 칸에 결과'
    ws['A1'].font = Font(bold=True, size=12, color='1F4E79')
    ws['A2'] = '▼ 붙여넣기 칸 (A3부터, 머리글째)'
    ws['A2'].font = Font(bold=True, color='9A6700')
    RES = ['상세물건번호', '소재지', '지번', '거래시점', '건물재조달원가', '내용연수', '경과연수', '잔존연수',
           '적용단가', '건물연면적', '건물가격', '토지면적', '토지단가']
    EXT = ['주구조(대장)', '주용도(대장)', '사용승인일', '대장 연면적(주건물)', '동 수', '구조군', '용도군',
           '총 거래금액', '토지가격', '확인할 것', 'PNU 직접 입력(선택)']
    R0 = 18          # R열
    E0 = R0 + len(RES) + 1   # AF열
    H0 = E0 + len(EXT) + 1   # 도우미 시작
    for j, h in enumerate(RES):
        c = ws.cell(2, R0 + j, h)
        c.fill, c.font, c.border = F_HEAD, BOLD, BOX
        c.alignment = Alignment(horizontal='center', wrap_text=True)
    for j, h in enumerate(EXT):
        c = ws.cell(2, E0 + j, h)
        c.fill, c.font, c.border = F_HEAD, BOLD, BOX
        c.alignment = Alignment(horizontal='center', wrap_text=True)
    ws.cell(1, R0 + len(RES) + 1).value = None

    def col(i):
        return CL(i)
    # 도우미 열 이름
    names = ['TYPE', 'PART', 'SGG', 'LOC', 'JIBUN', 'DATE', 'AREA', 'AMT', 'APPR', 'NO', 'LAREA', 'LAMT',
             'KEY', 'BCODE', 'PNU', 'JSON', 'N'] + [f'A{k}' for k in range(1, 9)] + ['MAIN', 'STR', 'ETC', 'PURP', 'UAPR', 'TOT', 'CASE']
    H = {n: col(H0 + i) for i, n in enumerate(names)}
    for i, n in enumerate(names):
        ws.cell(2, H0 + i, n).font = Font(size=8, color='9CA3AF')
    RC = {h: col(R0 + j) for j, h in enumerate(RES)}
    EC = {h: col(E0 + j) for j, h in enumerate(EXT)}
    P = f"$A{{r}}:${col(PASTE_COLS)}{{r}}"

    def fld(name, r):
        return (f'IFERROR(INDEX($A{r}:${col(PASTE_COLS)}{r},MATCH("{name}",$A{r-1}:${col(PASTE_COLS)}{r-1},0)),"")')

    def num(x):
        return f'IFERROR(IF(ISNUMBER({x}),{x},VALUE(SUBSTITUTE(SUBSTITUTE({x},",","")," ",""))),"")'

    def dt(x):
        return (f'IFERROR(IF({x}="","",IF(ISNUMBER({x}),IF({x}>19000000,DATE(INT({x}/10000),MOD(INT({x}/100),100),MOD({x},100)),{x}),'
                f'IF(LEN({x})=8,DATE(LEFT({x},4),MID({x},5,2),RIGHT({x},2)),DATEVALUE(SUBSTITUTE(TRIM({x}),".","-"))))),"")')

    def jval(js, field, k):
        """JSON 문자열 js에서 k번째 "field": 값(따옴표 있든 없든)"""
        t = f'SUBSTITUTE({js},"""{field}"":","¶",{k})'
        rest = f'TRIM(MID({t},FIND("¶",{t})+1,400))'
        return (f'IFERROR(TRIM(IF(LEFT({rest},1)="""",MID({rest},2,FIND("""",{rest},2)-2),'
                f'LEFT({rest},MIN(IFERROR(FIND(",",{rest}),999),IFERROR(FIND("}}",{rest}),999))-1))),"")')

    test_json = None
    if test:
        test_json = json.load(open(os.path.join(ROOT, 'tests', 'fixtures', 'kais_alloc_bld.json'), encoding='utf-8'))

    numf = '#,##0'
    for r in range(FIRST, LAST + 1):
        h = {k: f'{v}{r}' for k, v in H.items()}
        f = {}
        f['TYPE'] = f'=IF(COUNTA($A{r}:${col(PASTE_COLS)}{r})=0,"",{fld("상세물건구분", r)})'
        sggv = fld('시군구', r)
        f['SGG'] = f'=IF({h["TYPE"]}="","",TRIM({sggv}))'
        f['LOC'] = f'=IF({h["TYPE"]}="","",TRIM({fld("소재지", r)}))'
        j = fld('지번', r)
        f['JIBUN'] = (f'=IF({h["TYPE"]}="","",IF(ISNUMBER({j}),IF({j}>30000,TEXT({j},"m-d"),TEXT({j},"0")),TRIM({j})))')
        f['DATE'] = f'=IF({h["TYPE"]}="","",{dt(fld("거래시점", r))})'
        f['AREA'] = f'=IF({h["TYPE"]}="","",{num(fld("전체면적", r))})'
        f['AMT'] = f'=IF({h["TYPE"]}="","",{num(fld("물건금액", r))})'
        f['APPR'] = f'=IF({h["TYPE"]}="","",{dt(fld("사용승인일자", r))})'
        f['NO'] = f'=IF({h["TYPE"]}="","",{fld("상세물건번호", r)})'

        def cand(d):
            rr = r + d
            return f'AND(${H["TYPE"]}{rr}="토지",${H["JIBUN"]}{rr}={h["JIBUN"]},${H["LOC"]}{rr}={h["LOC"]})'
        f['PART'] = (f'=IF({h["TYPE"]}<>"건물","",IF({cand(2)},{r+2},IF({cand(-2)},{r-2},IF({cand(3)},{r+3},IF({cand(-3)},{r-3},"")))))')
        f['LAREA'] = f'=IF({h["PART"]}="","",INDEX(${H["AREA"]}:${H["AREA"]},{h["PART"]}))'
        f['LAMT'] = f'=IF({h["PART"]}="","",INDEX(${H["AMT"]}:${H["AMT"]},{h["PART"]}))'
        f['KEY'] = f'=IF({h["TYPE"]}<>"건물","",TRIM({h["SGG"]}&" "&{h["LOC"]}))'
        f['BCODE'] = f'=IF({h["KEY"]}="","",IFERROR(VLOOKUP({h["KEY"]},{BDR},2,FALSE),""))'
        jj = f'TRIM(SUBSTITUTE({h["JIBUN"]},"산",""))'
        bun = f'VALUE(LEFT({jj},FIND("-",{jj}&"-")-1))'
        ji = f'IF(ISNUMBER(FIND("-",{jj})),VALUE(MID({jj},FIND("-",{jj})+1,9)),0)'
        manual = f'{EC["PNU 직접 입력(선택)"]}{r}'
        f['PNU'] = (f'=IF({h["TYPE"]}<>"건물","",IF(LEN(TRIM({manual}))=19,TRIM({manual}),IF({h["BCODE"]}="","",'
                    f'IFERROR({h["BCODE"]}&IF(LEFT(TRIM({h["JIBUN"]}),1)="산","2","1")&TEXT({bun},"0000")&TEXT({ji},"0000"),""))))')
        if test:
            key = test_json['json'].get(str(r))
            f['JSON'] = f'=IF({h["PNU"]}="","",' + ('"' + key.replace('"', '""') + '"' if key is not None else '"ERR"') + ')'
        else:
            f['JSON'] = (f'=IF({h["PNU"]}="","",IFERROR(WEBSERVICE(기준표!$B$2&"/bld?op=getBrTitleInfo&numOfRows=8&pnu="&{h["PNU"]}),"ERR"))')
        f['N'] = (f'=IF(OR({h["JSON"]}="",{h["JSON"]}="ERR"),"",(LEN({h["JSON"]})-LEN(SUBSTITUTE({h["JSON"]},"""strctCdNm"":","")))/LEN("""strctCdNm"":"))')
        for k in range(1, 9):
            f[f'A{k}'] = (f'=IF(OR({h["N"]}="",N({h["N"]})<{k}),-1,IF(ISNUMBER(SEARCH("부속",{jval(h["JSON"], "mainAtchGbCdNm", k)})),0,'
                          f'IFERROR(VALUE({jval(h["JSON"], "totArea", k)}),0)))')
        f['MAIN'] = f'=IF(OR({h["N"]}="",N({h["N"]})=0),"",MATCH(MAX({H["A1"]}{r}:{H["A8"]}{r}),{H["A1"]}{r}:{H["A8"]}{r},0))'
        for nm, fieldname in (('STR', 'strctCdNm'), ('ETC', 'etcStrct'), ('PURP', 'mainPurpsCdNm'), ('UAPR', 'useAprDay'), ('TOT', 'totArea')):
            f[nm] = f'=IF({h["MAIN"]}="","",{jval(h["JSON"], fieldname, h["MAIN"])})'
        f['CASE'] = f'=IF({h["TYPE"]}<>"건물","",COUNTIF(${H["TYPE"]}${FIRST}:{h["TYPE"]},"건물"))'

        # ---- 보이는 칸 ----
        e = {k: f'{v}{r}' for k, v in EC.items()}
        rc = {k: f'{v}{r}' for k, v in RC.items()}
        isb = f'{h["TYPE"]}<>"건물"'
        f_e = {}
        f_e['주구조(대장)'] = (f'=IF({isb},"",IF({h["PNU"]}="","",IF({h["JSON"]}="ERR","조회 실패",IF(N({h["N"]})=0,"대장 없음",'
                            f'{h["STR"]}&IF(AND(LEFT({h["STR"]},2)="기타",{h["ETC"]}<>"")," ("&{h["ETC"]}&")","")))))')
        f_e['주용도(대장)'] = f'=IF({isb},"",{h["PURP"]})'
        f_e['사용승인일'] = f'=IF({isb},"",IF({h["APPR"]}<>"",{h["APPR"]},{dt(h["UAPR"])}))'
        f_e['대장 연면적(주건물)'] = f'=IF(OR({isb},{h["TOT"]}=""),"",{num(h["TOT"])})'
        f_e['동 수'] = f'=IF({isb},"",{h["N"]})'
        stxt = f'{h["STR"]}&"/"&{h["ETC"]}'
        f_e['구조군'] = (f'=IF(OR({isb},{h["STR"]}=""),"",IFERROR(INDEX({KS_G},MATCH(1,INDEX(({KS_K}<>"")*ISNUMBER(SEARCH({KS_K},{stxt})),0),0)),""))')
        f_e['용도군'] = (f'=IF(OR({isb},{h["PURP"]}=""),"",IFERROR(INDEX({KU_G},MATCH(1,INDEX(({KU_K}<>"")*ISNUMBER(SEARCH({KU_K},{h["PURP"]})),0),0)),"상업"))')
        f_e['총 거래금액'] = f'=IF({isb},"",{h["AMT"]})'
        f_e['토지가격'] = f'=IF(OR({isb},{rc["건물가격"]}="",{h["PART"]}=""),"",{e["총 거래금액"]}-{rc["건물가격"]})'
        f_e['확인할 것'] = (f'=IF({isb},"",IF({h["PART"]}="","토지 줄 붙여넣기 대기 · ","")'
                        f'&IF(AND({h["BCODE"]}="",LEN(TRIM({e["PNU 직접 입력(선택)"]}))<>19),"주소코드 못 찾음(오른쪽 칸에 PNU 19자리) · ","")'
                        f'&IF({h["JSON"]}="ERR","대장 조회 실패(엑셀 WEBSERVICE·인터넷 확인) · ","")'
                        f'&IF(AND({h["STR"]}<>"",{e["구조군"]}=""),"구조군 못 정함 — 기준표 ④ · ","")'
                        f'&IF(AND({e["구조군"]}<>"",{rc["건물재조달원가"]}=""),"기준표 빈칸 — 재조달원가·내용연수 직접 · ","")'
                        f'&IF(N({h["N"]})>1,{h["N"]}&"동 중 가장 큰 주건축물 기준 · ","")'
                        f'&IF(AND({h["PART"]}<>"",{h["LAMT"]}<>{h["AMT"]}),"토지·건물 물건금액이 다름(일괄거래 아닐 수 있음) · ","")'
                        f'&IF(AND({e["토지가격"]}<>"",N({e["토지가격"]})<0),"건물가격이 총액보다 큼 · ",""))')
        f_e['PNU 직접 입력(선택)'] = None
        rf = {}
        rf['상세물건번호'] = f'=IF({isb},"",{h["NO"]})'
        rf['소재지'] = f'=IF({isb},"",{h["LOC"]})'
        rf['지번'] = f'=IF({isb},"",{h["JIBUN"]})'
        rf['거래시점'] = f'=IF({isb},"",{h["DATE"]})'
        rf['건물재조달원가'] = (f'=IF(OR({isb},{e["구조군"]}="",{e["용도군"]}=""),"",IFERROR(1/(1/INDEX({COST},MATCH({e["구조군"]},{SROW},0),MATCH({e["용도군"]},{UCOL},0))),""))')
        rf['내용연수'] = (f'=IF(OR({isb},{e["구조군"]}="",{e["용도군"]}=""),"",IFERROR(1/(1/INDEX({LIFE},MATCH({e["구조군"]},{SROW},0),MATCH({e["용도군"]},{UCOL},0))),""))')
        rf['경과연수'] = f'=IF(OR({isb},{e["사용승인일"]}="",{rc["거래시점"]}=""),"",IFERROR(DATEDIF({e["사용승인일"]},{rc["거래시점"]},"Y"),0))'
        rf['잔존연수'] = f'=IF(OR({isb},{rc["내용연수"]}="",{rc["경과연수"]}=""),"",MAX({rc["내용연수"]}-{rc["경과연수"]},0))'
        rf['적용단가'] = f'=IF(OR({isb},{rc["건물재조달원가"]}="",{rc["잔존연수"]}="",{rc["내용연수"]}=""),"",ROUND({rc["건물재조달원가"]}*{rc["잔존연수"]}/{rc["내용연수"]},0))'
        rf['건물연면적'] = f'=IF({isb},"",{h["AREA"]})'
        rf['건물가격'] = f'=IF(OR({isb},{rc["적용단가"]}="",{rc["건물연면적"]}=""),"",{rc["적용단가"]}*{rc["건물연면적"]})'
        rf['토지면적'] = f'=IF({isb},"",{h["LAREA"]})'
        rf['토지단가'] = f'=IF(OR({isb},{rc["건물가격"]}="",{rc["토지면적"]}="",N({rc["토지면적"]})=0),"",TRUNC(({e["총 거래금액"]}-{rc["건물가격"]})/{rc["토지면적"]}))'

        for k, v in f.items():
            ws[f'{H[k]}{r}'] = v
        for k, v in rf.items():
            c = ws[f'{RC[k]}{r}']
            c.value = v
            c.fill = F_RES
        for k, v in f_e.items():
            c = ws[f'{EC[k]}{r}']
            if v is not None:
                c.value = v
                c.fill = F_EXT
            else:
                c.fill = F_PASTE
                c.number_format = '@'
        for k in ('거래시점',):
            ws[f'{RC[k]}{r}'].number_format = 'yyyy-mm-dd'
        ws[f'{EC["사용승인일"]}{r}'].number_format = 'yyyy-mm-dd'
        for k in ('건물재조달원가', '적용단가', '건물가격', '토지단가'):
            ws[f'{RC[k]}{r}'].number_format = numf
        for k in ('건물연면적', '토지면적'):
            ws[f'{RC[k]}{r}'].number_format = '#,##0.00'
        for k in ('총 거래금액', '토지가격'):
            ws[f'{EC[k]}{r}'].number_format = numf
        ws[f'{EC["대장 연면적(주건물)"]}{r}'].number_format = '#,##0.00'
        ws[f'{H["DATE"]}{r}'].number_format = 'yyyy-mm-dd'
        ws[f'{H["APPR"]}{r}'].number_format = 'yyyy-mm-dd'
    # 붙여넣기 칸은 텍스트 서식(「5-3」 같은 지번이 날짜로 바뀌지 않게)
    for r in range(3, LAST + 1):
        for cc in range(1, PASTE_COLS + 1):
            ws.cell(r, cc).number_format = '@'
    for cc in range(1, PASTE_COLS + 1):
        ws.cell(2, cc).fill = F_PASTE
    if test:
        for i, row in enumerate(test_json['paste']):
            for j, v in enumerate(row):
                ws.cell(3 + i, 1 + j, v)
    widths = {1: 9, 2: 13, 3: 13, 4: 8, 5: 9, 6: 5, 7: 11, 8: 8, 9: 11, 10: 9, 11: 9, 12: 13, 13: 6, 14: 11}
    for cc in range(1, PASTE_COLS + 1):
        ws.column_dimensions[col(cc)].width = widths.get(cc, 7)
    ws.column_dimensions[col(PASTE_COLS + 1)].width = 2
    for j, w in enumerate((8, 13, 8, 11, 12, 7, 7, 7, 10, 10, 13, 9, 10)):
        ws.column_dimensions[col(R0 + j)].width = w
    ws.column_dimensions[col(R0 + len(RES))].width = 2
    for j, w in enumerate((16, 16, 11, 11, 5, 13, 8, 14, 14, 40, 20)):
        ws.column_dimensions[col(E0 + j)].width = w
    ws.column_dimensions[col(E0 + len(EXT))].width = 2
    ws.row_dimensions[2].height = 30
    for i in range(len(names)):
        ws.column_dimensions[col(H0 + i)].hidden = True
    ws.freeze_panes = 'A3'

    # ---- 결과모음 시트 ----
    gs['A1'] = '결과모음 — 붙여넣기 시트의 사례를 차례로 모은 표. 범위를 복사해 내 엑셀에 「값 붙여넣기」(Ctrl+Alt+V → 값)'
    gs['A1'].font = Font(bold=True, color='1F4E79')
    allc = RES + [None] + ['주구조(대장)', '주용도(대장)', '사용승인일', '확인할 것']
    for j, hname in enumerate(allc):
        if hname is None:
            continue
        c = gs.cell(2, 1 + j, hname)
        c.fill, c.font, c.border = F_HEAD, BOLD, BOX
        c.alignment = Alignment(horizontal='center', wrap_text=True)
    CASE = f"붙여넣기!${H['CASE']}${FIRST}:${H['CASE']}${LAST}"
    for k in range(1, 151):
        r = k + 2
        for j, hname in enumerate(allc):
            if hname is None:
                continue
            srccol = RC.get(hname) or EC.get(hname)
            rng = f"붙여넣기!${srccol}${FIRST}:${srccol}${LAST}"
            c = gs.cell(r, 1 + j, f'=IFERROR(INDEX({rng},MATCH({k},{CASE},0))&"","")' if hname in ('주구조(대장)', '주용도(대장)', '확인할 것', '상세물건번호', '소재지', '지번')
                        else f'=IFERROR(IF(INDEX({rng},MATCH({k},{CASE},0))="","",INDEX({rng},MATCH({k},{CASE},0))),"")')
            if hname in ('거래시점', '사용승인일'):
                c.number_format = 'yyyy-mm-dd'
            elif hname in ('건물재조달원가', '적용단가', '건물가격', '토지단가'):
                c.number_format = numf
            elif hname in ('건물연면적', '토지면적'):
                c.number_format = '#,##0.00'
    for j, w in enumerate((8, 13, 8, 11, 12, 7, 7, 7, 10, 10, 13, 9, 10, 2, 16, 16, 11, 40)):
        gs.column_dimensions[col(1 + j)].width = w
    gs.row_dimensions[2].height = 30
    gs.freeze_panes = 'A3'

    # ---- 사용법 ----
    lines = [
        ('KAIS 실거래 → 토지배분단가 (토지건물 앱 거래사례비교법과 같은 계산)', True),
        ('', False),
        ('1. KAIS 실거래 「상세정보」 창 → 상세물건정보에서 「건물」 줄을 골라 「현재데이터 복사」', False),
        ('2. 「붙여넣기」 시트 A3 칸을 누르고 Ctrl+V  → 오른쪽 초록 칸에 주구조·재조달원가·내용연수·잔존연수·적용단가가 바로 나옴', False),
        ('   (건축물대장은 인터넷으로 자동 조회 — 1~3초)', False),
        ('3. 같은 창에서 「토지」 줄 「현재데이터 복사」 → 건물 붙인 줄 바로 아래(A5)에 Ctrl+V  → 토지면적·토지단가가 나옴', False),
        ('4. 다음 사례는 그 아래(A7)에 같은 순서로 계속. 순서는 토지 먼저여도 됨(같은 지번끼리 짝지음)', False),
        ('5. 「결과모음」 시트에 사례가 한 줄씩 모임 → 복사해서 내 엑셀에 「값 붙여넣기」(Ctrl+Alt+V → 값)', False),
        ('', False),
        ('계산식', True),
        ('  경과연수 = 사용승인일 → 거래시점 만(滿) 연수 / 잔존연수 = 내용연수 − 경과연수(0 미만은 0)', False),
        ('  적용단가 = 재조달원가 × 잔존연수 ÷ 내용연수 (원 단위 반올림) / 건물가격 = 적용단가 × 건물 전체면적', False),
        ('  토지단가 = (총 거래금액 − 건물가격) ÷ 토지면적 (원 미만 절사)', False),
        ('', False),
        ('재조달원가·내용연수는 「기준표」 시트의 기본값(2025 재조달원가 자료집 대표 단가 3급 중심)입니다.', True),
        ('  - 대장 주구조 → 구조군(기준표 ④), 대장 주용도 → 용도군(기준표 ⑤) → 표에서 값을 꺼냄', False),
        ('  - 평소 쓰시는 단가로 기준표 노란 칸을 고치면 모든 사례에 반영. 사례 한 건만 바꾸려면 초록 칸에 숫자를 직접 치면 됨', False),
        ('  - 전체 자료집 표는 「표준단가2025」 시트(필터로 찾기)', False),
        ('  - 여러 동이면 부속건축물을 뺀 주건축물 중 연면적이 가장 큰 동의 구조·용도를 씀(「확인할 것」에 표시)', False),
        ('', False),
        ('처음 열 때 / 안 될 때', True),
        ('  - 다운로드한 파일은 「제한된 보기」로 열림 → 위 노란 줄 「편집 사용」을 눌러야 조회가 됨', False),
        ('  - 윈도우용 엑셀(2013 이상)에서만 자동 조회(WEBSERVICE 함수). 맥·웹 엑셀은 조회 안 됨', False),
        ('  - 주구조 칸이 「조회 실패」면 인터넷 연결 확인 후 Ctrl+Alt+F9(전체 다시 계산)', False),
        ('  - 「주소코드 못 찾음」: 2024.8 이후 새로 생긴 구(화성 4구, 인천 제물포·영종·서해·검단구 등)는 표에 없음 → 「PNU 직접 입력」 칸에 19자리', False),
        ('  - 붙여넣기 칸은 텍스트 서식이라 「5-3」 같은 지번이 날짜로 바뀌지 않음. 붙여넣기 칸 서식은 바꾸지 마세요', False),
    ]
    for i, (t, b) in enumerate(lines):
        c = guide.cell(1 + i, 1, t)
        if b:
            c.font = Font(bold=True, size=12 if i == 0 else 11)
    guide.column_dimensions['A'].width = 130
    wb.move_sheet('사용법', offset=-1)
    wb.active = 1
    wb.save(out_path)
    print('saved', out_path, 'bdong rows', len(rows))


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    build(a[0], a[1], test='--test' in sys.argv)
