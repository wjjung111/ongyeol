import copy
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile
from decimal import Decimal
from lxml import etree as E
from engine import model,render,rounded,NS,TOKEN
from examples import fixtures
from build import TARGET

class OpinionTests(unittest.TestCase):
    def setUp(self): self.f=fixtures(); self.single=self.f['01_단일_동호미정']
    def test_independently_expected_totals(self):
        expected=['900,000,000','1,100,000,000','2,450,000,000','1,050,000,000','360,000,000','900,000,000']
        for data,total in zip(self.f.values(),expected): self.assertEqual(model(data)['최종금액'],total)
    def test_date_cutoff_zero_and_refund(self):
        self.single['transactions']=[{'date':'2026-09-18','kind':'payment','amount':20,'source':'a'},
          {'date':'2026-09-19','kind':'payment','amount':999,'source':'b'},
          {'date':'2026-09-18','kind':'refund','amount':10,'source':'c'}]
        x=model(self.single); self.assertEqual(x['납부누계'],'20'); self.assertEqual(x['환급누계'],'10')
        self.single['transactions']=[]; self.assertEqual(model(self.single)['납부누계'],'0')
    def test_selected_case_id_not_position(self):
        self.single['units'][0]['case_id']='C2'; self.single['cases'][1]['price']=1200000000
        self.assertEqual(model(self.single)['배정물건평가합계'],'1,200,000,000')
        self.single['units'][0]['case_id']='missing'
        with self.assertRaises(ValueError): model(self.single)
    def test_direct_value_and_negative_premium(self):
        self.single['units'][0]['unit_override']=5000000; self.single['units'][0]['override_reason']='시험 직접결정'
        self.assertEqual(model(self.single)['프리미엄'],'-200,000,000')
        self.single['units'][0]['override_reason']=''
        with self.assertRaises(ValueError): model(self.single)
    def test_notice_never_overwritten(self):
        self.single['right_value']=501000000
        self.assertEqual(model(self.single)['권리가액'],'501,000,000')
        self.assertEqual(model(self.single)['권리가액차이'],'1,000,000')
    def test_time_and_factor_precision(self):
        u=self.single['units'][0]; u['time']['end']=102; u['factors'][0]['value']='1.03'
        self.assertEqual(model(self.single)['물건별평가'][0]['산정단가'],'10,506,000')
        self.assertEqual(rounded(Decimal('125'),{'mode':'round','quantum':50}),Decimal('150'))
    def test_invalid_inputs(self):
        for key,value in [('area',0),('sale_price',-1),('regional',0)]:
            d=copy.deepcopy(self.single);d['units'][0][key]=value
            with self.assertRaises(ValueError):model(d)
        self.single['share']={'numerator':1,'denominator':0,'rounding':{'mode':'round','quantum':1000}}
        with self.assertRaises(ValueError):model(self.single)
    def test_hwpx_expansion_and_strict_mapping(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name,data in self.f.items():
                target=Path(tmp)/(name+'.hwpx'); render(TARGET/'입주권v1_의견서.hwpx',target,model(data))
                with ZipFile(target) as z:
                    self.assertEqual(z.infolist()[0].filename,'mimetype'); self.assertEqual(z.infolist()[0].compress_type,0)
                    root=E.fromstring(z.read('Contents/section0.xml')); text=''.join(root.itertext())
                    self.assertFalse(TOKEN.search(text)); self.assertNotIn('\ufffd',text)
                    self.assertIn(model(data)['최종금액'],text)
                    self.assertEqual('평가대상 지분:' in text, bool(data.get('share')))
                    self.assertEqual(text.count('산정단가(원/㎡)'),len(data['units']))
                    self.assertEqual(text.count('배정물건 평가액(원)'),len(data['units'])+1)
                    self.assertEqual('BinData/ipjImage.png' in z.namelist(),bool(data.get('image')))
                    for tbl in root.findall('.//hp:tbl',NS):
                        rows=tbl.findall('hp:tr',NS); self.assertEqual(int(tbl.get('rowCnt')),len(rows))
                        for r,row in enumerate(rows):
                            self.assertTrue(all(int(c.find('hp:cellAddr',NS).get('rowAddr'))==r for c in row.findall('hp:tc',NS)))
            x=model(self.single); del x['평가목적']
            with self.assertRaisesRegex(ValueError,'미매핑'): render(TARGET/'입주권v1_의견서.hwpx',Path(tmp)/'bad.hwpx',x)

if __name__=='__main__':unittest.main(verbosity=2)
