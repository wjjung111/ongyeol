"""Run from the repository root: python tools/ipj_v1/render.py input.json out.hwpx."""
import json
import sys
from pathlib import Path
from engine import model, render
from build import TARGET, ROOT

if __name__ == '__main__':
    data=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    if data.get('image'):
        image=Path(data['image'])
        data['image']=str(image if image.is_absolute() else ROOT/image)
    render(TARGET/'입주권v1_의견서.hwpx',sys.argv[2],model(data))
    print('Created:',sys.argv[2])