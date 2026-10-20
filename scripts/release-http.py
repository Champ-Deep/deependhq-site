"""Read back every staged public asset and the combined Worker routes."""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import os
import urllib.request
import urllib.error
root=Path(__file__).resolve().parents[1]
base=os.environ.get('RELEASE_BASE','http://127.0.0.1:3277').rstrip('/')
assets=json.loads((root/'docs/verification/release/assets.json').read_text())
routes=['/','/journey','/post/week-48-the-receipts-arc','/company/lake-b2b','/toolkit','/lead-scorer','/account']
def fetch(path):
    try:
        response=urllib.request.urlopen(urllib.request.Request(base+'/'+path.lstrip('/'),headers={'User-Agent':'DeepEndHQ-release-verifier/1.0'}),timeout=30)
    except urllib.error.HTTPError as error:
        response=error
    with response as r:
        body=r.read();return {'path':path,'status':r.status,'content_type':r.headers.get('content-type'),'csp':r.headers.get('content-security-policy'),'hash':hashlib.sha256(body).hexdigest(),'body':body}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results=list(pool.map(fetch,assets+routes))
print('Non-200 responses:',[(row['path'],row['status']) for row in results if row['status']!=200])
for row in results:
    assert row['status']==(404 if row['path']=='_headers' else 200),{k:v for k,v in row.items() if k!='body'}
    if row['path'] in routes:assert row['csp'],row['path']
    if row['path'] in ['favicon.svg','favicon.ico','home-islands.js','islands.css','scheme-tokens.css','brand/icons.svg']:
        assert row['hash']==hashlib.sha256((root/row['path']).read_bytes()).hexdigest(),row['path']
    if row['path']=='/':
        assert b'I lead B2B growth and build the systems behind it.' in row['body']
        assert b'data-day="354"' in row['body']
        assert row['body'].count(b'data-island=')==4
    del row['body']
report={'base':base,'assets':len(assets),'routes':len(routes),'results':results}
(root/'docs/verification/release/http-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'{len(assets)-1} public assets and {len(routes)} routes read back; platform _headers is correctly not served. Exact favicon/island/style/sprite hashes match.')
