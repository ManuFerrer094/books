"""Package our offline renders; Pillow is a build tool, never an app dependency."""
import ast
import hashlib
import html
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path.cwd()
SOURCE = ROOT / '.tmp/decor-source'
PUBLIC = ROOT / 'frontend/public/assets/decorations'
PUBLIC.mkdir(parents=True, exist_ok=True)
tree = ast.parse((ROOT / 'scripts/render-bookshelf-decor.py').read_text(encoding='utf-8'))
assets = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'ASSETS' for target in node.targets))
catalog, credits = {}, {}
labels = dict(re.findall(r"\['([^']+)', '([^']+)', '[^']+'\]", (ROOT / 'src/library/bookshelf-design.ts').read_text(encoding='utf-8')))
sheet = Image.new('RGB', (900, 220 * 6), '#eee9df')
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('DejaVuSans.ttf', 15)
except OSError:
    try: font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 15)
    except OSError: font = ImageFont.load_default()

for index, (asset, (model, _, _, natural, _)) in enumerate(assets.items()):
    original = Image.open(SOURCE / f'renders/{asset}.png').convert('RGBA')
    mask = Image.open(SOURCE / f'renders/{asset}.mask.png').convert('RGBA')
    if mask.size != original.size: raise ValueError(f'Misaligned mask: {asset}')
    bbox = original.getchannel('A').getbbox()
    if not bbox or not mask.getchannel('A').getbbox(): raise ValueError(f'Empty render or tint mask: {asset}')
    left, top, right, bottom = bbox
    # Same crop for both images is essential for material masks to line up.
    crop = (max(0, left - 2), max(0, top - 2), min(original.width, right + 2), min(original.height, bottom + 2))
    original, mask = original.crop(crop), mask.crop(crop)
    original.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    mask = mask.resize(original.size, Image.Resampling.LANCZOS)
    thumb = original.copy()
    thumb.thumbnail((192, 192), Image.Resampling.LANCZOS)
    source_time = max((SOURCE / f'renders/{asset}.png').stat().st_mtime, (SOURCE / f'renders/{asset}.mask.png').stat().st_mtime)
    outputs = [PUBLIC / f'{asset}{suffix}.webp' for suffix in ('', '.mask', '.thumb')]
    if any(not path.exists() or path.stat().st_mtime < source_time for path in outputs):
        original.save(outputs[0], quality=88, method=4)
        mask.save(outputs[1], lossless=True, method=4)
        thumb.save(outputs[2], quality=82, method=4)
    catalog[asset] = {'src': f'/assets/decorations/{asset}.webp', 'thumbnail': f'/assets/decorations/{asset}.thumb.webp', 'mask': f'/assets/decorations/{asset}.mask.webp', 'naturalColor': natural, 'width': original.width, 'height': original.height}
    ids = ([model] if model else []) + (['planter_pot_clay'] if asset in ('fern', 'flowers') else [])
    sources = []
    for model_id in ids:
        directory = SOURCE / 'models' / model_id
        info = json.loads((directory / 'info.json').read_text(encoding='utf-8'))
        files = json.loads((directory / 'files.json').read_text(encoding='utf-8'))['blend']['1k']['blend']
        sources.append({'id': model_id, 'name': info['name'], 'authors': info['authors'], 'url': f'https://polyhaven.com/a/{model_id}', 'download': files['url'], 'md5': files['md5'], 'license': 'CC0-1.0'})
    credits[asset] = {'name': labels[asset], 'sources': sources, 'adaptation': 'Entre páginas', 'license': 'MIT', 'renderSha256': hashlib.sha256((PUBLIC / f'{asset}.webp').read_bytes()).hexdigest()}
    x, y = (index % 5) * 180, (index // 5) * 220
    sheet.paste(thumb, (x + (180 - thumb.width) // 2, y + 8 + (185 - thumb.height)), thumb)
    draw.text((x + 12, y + 198), asset, font=font, fill='#403c33')

(ROOT / 'frontend/src/bookshelf-decor-assets.json').write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
(PUBLIC / 'sources.json').write_text(json.dumps({'licenseUrl': 'https://polyhaven.com/license', 'recipe': 'scripts/render-bookshelf-decor.py', 'assets': credits}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
(PUBLIC / 'LICENSE.txt').write_text((ROOT / 'LICENSE').read_text(encoding='utf-8'), encoding='utf-8')
cards = []
for asset, credit in credits.items():
    sources = ', '.join(f'<a href="{html.escape(source["url"])}">{html.escape(source["name"])}</a> · {html.escape(", ".join(source["authors"]))} (CC0)' for source in credit['sources']) or 'Modelado original de Entre páginas'
    cards.append(f'<article><img src="{asset}.thumb.webp" alt="" width="120" height="160"><h2>{html.escape(credit["name"])}</h2><p>{sources}</p></article>')
(PUBLIC / 'credits.html').write_text('''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Recursos y autores · Entre páginas</title><style>body{margin:0;background:#f5f1e8;color:#3b3c32;font:16px/1.6 system-ui}main{max-width:960px;margin:auto;padding:32px 24px}h1{font:38px Georgia}a{color:#4b6546}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:20px}article{background:#fffcf6;border-radius:12px;padding:20px}article img{display:block;margin:auto;object-fit:contain}h2{font-size:17px}article p{font-size:13px}footer{margin-top:32px}</style><main><a href="/">Volver a Entre páginas</a><h1>Objetos con historia</h1><p>Este catálogo combina modelos gratuitos de <a href="https://polyhaven.com">Poly Haven</a> y piezas originales de Entre páginas. Los modelos originales de Poly Haven son <a href="https://polyhaven.com/license">CC0</a>. Nuestros renders, máscaras y modelados complementarios se distribuyen con la <a href="LICENSE.txt">licencia MIT del proyecto</a>. Se permite el uso comercial; no requieren suscripciones ni servicios externos.</p><p>Las imágenes se han renderizado y adaptado para esta estantería con Blender. Aquí reconocemos a sus creadores.</p><section>''' + '\n'.join(cards) + '''</section><footer><a href="sources.json">Procedencia y huellas de los recursos</a></footer></main></html>''', encoding='utf-8')
sheet.save(SOURCE / 'contact-sheet.jpg', quality=94)
print(f'Packaged {len(catalog)} decorations: {sum(p.stat().st_size for p in PUBLIC.glob("*.webp")) / 1024 / 1024:.2f} MiB')
