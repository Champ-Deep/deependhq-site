"""Install upstream source in an excluded sandbox, not in runtime dependencies."""
import json
import os
from pathlib import Path
import subprocess
import runpy
import requests

root = Path(__file__).resolve().parents[1]
m = runpy.run_path(str(root / 'scripts/editorial-registry.py'))
out = m['out']
stage = root / '.registry-v4'
stage.mkdir(exist_ok=True)
(stage / 'package.json').write_text(json.dumps({'name':'editorial-source-review','private':True,'dependencies':{'react':'^19.3.1'}}))
(stage / 'tsconfig.json').write_text(json.dumps({'compilerOptions':{'baseUrl':'.','paths':{'@/*':['./*']}}}))
(stage / 'style.css').write_text('@import "tailwindcss";\n')
(stage / 'components.json').write_text(json.dumps({'$schema':'https://ui.shadcn.com/schema.json','style':'new-york','rsc':False,'tsx':True,'tailwind':{'config':'','css':'style.css','baseColor':'neutral','cssVariables':True},'aliases':{'components':'@/components','utils':'@/lib/utils','ui':'@/components/ui','lib':'@/lib','hooks':'@/hooks'},'registries':{'@21st':{'url':'https://21st.dev/r/{name}','params':{'api_key':'${TWENTY_FIRST_API_KEY}'}}}}))
env = dict(os.environ, TWENTY_FIRST_API_KEY=m['key'])
slugs = ['a11ypros/a11y-accordion', 'felipemenezes098/item-19', 'jatin-yadav05/spotify-card', 'ln-dev7/footer-17']
logs=[]
for slug in slugs:
    command = 'source "$HOME/.nvm/nvm.sh" && nvm use 24 && npx shadcn@latest add @21st/' + slug + ' --yes --overwrite'
    run = subprocess.run(['bash','-c',command],cwd=stage,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=180)
    text=run.stdout.replace(m['key'],'[REDACTED]')
    logs.append({'slug':slug,'exit':run.returncode,'output':text})
    print(slug, 'EXIT',run.returncode, text[-1800:],flush=True)
(out/'install.json').write_text(json.dumps(logs,indent=2))
assert all(x['exit']==0 for x in logs), 'Registry source install failed'
