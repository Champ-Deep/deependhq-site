"""Read-only 21st MCP research. Never log authentication material."""
import json
import os
from pathlib import Path
import requests


root = Path(__file__).resolve().parents[1]
out = root / 'docs/verification/editorial-v4'
out.mkdir(parents=True, exist_ok=True)
key = os.getenv('TWENTY_FIRST_API_KEY')
assert key, 'TWENTY_FIRST_API_KEY is not configured'
headers = {'x-api-key': key, 'Accept': 'application/json, text/event-stream'}
def call(method, params):
    response = requests.post('https://21st.dev/api/mcp', headers=headers, json={'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}, timeout=90)
    response.raise_for_status()
    text = response.text
    if text.startswith('event:') or text.startswith('data:'):
        text = next(line[6:] for line in text.splitlines() if line.startswith('data: '))
    data = json.loads(text)
    assert 'error' not in data, str(data.get('error'))
    return data['result']

if __name__ == '__main__':
    import sys
    if len(sys.argv) == 1:
        result = call('tools/list', {})
    else:
        result = call('tools/call', {'name': sys.argv[1], 'arguments': json.loads(sys.argv[2])})
    text = json.dumps(result, indent=2).replace(key, '[REDACTED]')
    (out / ('registry-' + (sys.argv[1] if len(sys.argv) > 1 else 'tools') + '.json')).write_text(text)
    print(text)
