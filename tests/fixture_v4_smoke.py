#!/usr/bin/env python3
"""Smoke the v4 fixture routes. Start the server first: python3 tests/fixture_server.py --port 3199"""
import base64, json, sys, urllib.error, urllib.request

B = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3199'
H = {'Authorization': 'Bearer FIXTURE_SESSION_TOKEN', 'Content-Type': 'application/json'}


def post(b):
    r = urllib.request.Request(B + '/api/toolkit', json.dumps(b).encode(), H)
    try:
        x = urllib.request.urlopen(r)
        return x.status, json.load(x)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


urllib.request.urlopen(urllib.request.Request(B + '/fixture/reset', b'{}', H))
s, i = post({'action': 'intake', 'file': {'name': 'a.csv', 'headers': ['Name', 'Job Title', 'Email']}, 'goal': 'clean'})
assert s == 200 and len(i['plan']) == 2, i
s, f = post({'action': 'files_put', 'folder': '/Leads', 'name': 'a.csv', 'content_base64': base64.b64encode(b'x,y\n').decode()})
assert s == 200, f
s, f2 = post({'action': 'files_put', 'folder': '/Leads', 'name': 'a.csv', 'content_base64': base64.b64encode(b'x').decode()})
assert f2['entry']['name'] == 'a (2).csv', f2
s, l = post({'action': 'files_list', 'folder': '/Leads'})
assert len(l['entries']) == 2, l
s, r = post({'action': 'files_list', 'folder': '/'})
assert [e['name'] for e in r['entries']] == ['Leads'], r
s, m = post({'action': 'files_move', 'id': r['entries'][0]['id'], 'name': 'Old'})
assert m['entry']['path'] == '/Old', m
s, l = post({'action': 'files_list', 'folder': '/Old'})
assert len(l['entries']) == 2, l
s, t = post({'action': 'files_mkdir', 'path': '/a/../b'})
assert s == 400, t
req = urllib.request.Request(B + '/api/toolkit/files/' + f['entry']['id'], headers=H)
assert urllib.request.urlopen(req).read() == b'x,y\n'
s, st = post({'action': 'admin_settings_set', 'research_model': 'nope/x'})
assert s == 400, st
s, st = post({'action': 'admin_settings_get'})
assert len(st['models']) == 2, st
s, lg = post({'action': 'admin_ai_log'})
assert lg['rows'][0]['action'] == 'intake', lg
np = json.load(urllib.request.urlopen(B + '/api/now-playing'))
assert np['game']['state'] == 'favorites', np
print('fixture v4 smoke: 13 checks ok')
