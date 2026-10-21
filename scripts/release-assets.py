"""Assert source preservation, public-asset boundaries, identity and dash gates."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
from PIL import Image
root = Path(__file__).resolve().parents[1]
content = json.loads((root / 'content.json').read_text())
assert content['brand']['today_day'] == 354
assert content['brand']['today_date'] == '2026-10-20'
assert len(content['journey']) == 132
base = json.loads(subprocess.check_output(['git','show','origin/main:content.json'],cwd=root))
latest = next(e for e in base['journey'] if e['day'] == 354)
assert next(e for e in content['journey'] if e['day'] == 354) == latest
assets = json.loads((root / 'docs/verification/release/assets.json').read_text())
for name in assets:
    assert not any(part.startswith('.') for part in Path(name).parts), name
    assert not name.startswith(('tests/','docs/','worker/','scripts/','node_modules/','islands/')), name
    assert not re.search(r'\.(sqlite|db|log|md)$',name), name
    if Path(name).suffix in {'.html','.css','.js','.jsx','.json','.txt','.xml','.svg'}:
        text=(root/name).read_text()
        if Path(name).suffix=='.html':assert not re.search('[\u2013\u2014]',text),f'{name}: dash'
        assert '-----BEGIN PRIVATE KEY-----' not in text and '-----BEGIN OPENSSH PRIVATE KEY-----' not in text, name
        assert not re.search(r'\b(?:sk_live_|sk_test_|sk-ant-api)[A-Za-z0-9_-]{16,}',text), name
hashes={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in ['favicon.svg','brand/brandmark.svg','brand/brandmark-reverse.svg','home-islands.js']}
assert hashes['favicon.svg']==hashes['brand/brandmark.svg']==hashes['brand/brandmark-reverse.svg']
assert (root/'favicon.svg').read_bytes()==subprocess.check_output(['git','show','1a47478:favicon.svg'],cwd=root)
sizes={}
for name,expected in [('icon-192.png',(192,192)),('icon-512.png',(512,512)),('icon-mask.png',(512,512)),('apple-touch-icon.png',(180,180))]:
    im=Image.open(root/name);assert im.size==expected,(name,im.size);sizes[name]=im.size
ico=Image.open(root/'favicon.ico');sizes['favicon.ico']=sorted(ico.ico.sizes());assert set(ico.ico.sizes())=={(16,16),(32,32),(48,48)}
assert 'viewBox=' in (root/'favicon.svg').read_text()
assert all(f'id="i-{icon}"' in (root/'brand/icons.svg').read_text() for icon in ['gamepad','music','gi'])
html=(root/'index.html').read_text()
assert html.count('src="home-islands.js"')==1
assert html.count('Single pre-paint scheme controller')==1
assert html.count('data-island=')==4
assert 'src="favicon.svg"' in html
assert not re.search('[\u2013\u2014]',html)
for name in ['lead-scorer.html','account.html','toolkit.html','post.html','company.html','journey.html']:
    text=(root/name).read_text();assert text.count('Single pre-paint scheme controller')==1,name
    assert 'dh_theme' not in text and 'data-theme' not in text,name
result={'day':354,'entries':132,'latest_entry_equal':True,'public_assets':len(assets),'hashes':hashes,'dimensions':sizes,'source_favicon_unchanged':True,'source_svg_viewbox':re.search(r'viewBox="([^"]+)"',(root/'favicon.svg').read_text()).group(1),'dash_count_html':0,'private_key_patterns':0}
(root/'docs/verification/release/assets-proof.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
