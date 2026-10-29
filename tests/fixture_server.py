#!/usr/bin/env python3
"""FIXTURE server for Lead Scorer browser verification.

Serves the repo's static files plus three explicitly fake backends, so the UI
can be tested with real network responses that are never production data:

  GET  /api/toolkit/config        fixture config, clerk script on this origin
  POST /api/toolkit               fixture usage/quote/run/run_detail/admin
  GET  /fixture/clerk.js          FIXTURE Clerk browser SDK stand-in
  GET  /fixture/calls             every API call received, in arrival order
  POST /fixture/reset             clear call log and run idempotency store
  POST /fixture/delay {"ms":N}    add artificial run latency (cancel tests)
  POST /fixture/config {"configured":0|1}  flip the configured flag

V4 (docs/toolkit-v4-api.md), deterministic and in memory:
  POST /api/toolkit intake               canned reply built from the headers you send
  POST /api/toolkit files_*              one fixture user's desktop; GET /api/toolkit/files/<id>
  POST /api/toolkit admin_settings_*     two fixture models
  POST /api/toolkit admin_ai_log(_export) the intake calls made so far, values already [value]
  GET  /api/now-playing                  the launch state (no Spotify, favorites)

No live keys, no provider calls, no real people. Run a port and point a
browser, audit.py or shoot.py at it:

  python3 tests/fixture_server.py --port 8787
"""

import argparse
import base64
import json
import math
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent

LOCK = threading.Lock()
STATE = {
    "configured": 1,
    "billing": 1,
    "admin": 1,
    "run_delay_ms": 0,
    "calls": [],
    "runs": {},          # request_id -> stored run response (idempotency)
    "n": 0,              # global fixture row counter for cycling statuses
    "users": None,
    "global": None,
    "files": {},         # id -> {entry..., "bytes": b""}
    "ai_log": [],
    "models": {"intake_model": "deepseek/deepseek-v4.1-flash", "research_model": "deepseek/deepseek-v4.1-flash"},
}

FIXTURE_MODELS = [
    {"id": "deepseek/deepseek-v4.1-flash", "prompt_micro_per_mtok": 140000, "completion_micro_per_mtok": 280000},
    {"id": "fixture/bigger-model", "prompt_micro_per_mtok": 1000000, "completion_micro_per_mtok": 4000000},
]
FIELD_GUESS = [("email", "email"), ("mail", "email"), ("title", "title"), ("role", "title"), ("company", "company"),
               ("domain", "domain"), ("website", "domain"), ("linkedin", "linkedin_url"), ("first", "first_name"),
               ("last", "last_name"), ("name", "person_name"), ("phone", "phone"), ("city", "city"), ("country", "country")]


def intake_reply(body):
    f = body.get("file") or {}
    headers = f.get("headers") or []
    if not headers or not isinstance(headers, list):
        return 400, {"error": "invalid_intake", "message": "file.headers must be 1 to 200 distinct names of 200 characters or less."}
    mapping, plan = [], []
    for h in headers:
        low = str(h).lower()
        field = next((v for k, v in FIELD_GUESS if k in low), "other")
        mapping.append({"source": h, "field": field, "keep": True})
        if field == "title":
            plan.append({"column": h, "op": "normalize_title", "engine": "jev"})
        if field == "email":
            plan.append({"column": h, "op": "verify_email", "engine": "treg"})
    turn = len(body.get("history") or [])
    with LOCK:
        STATE["ai_log"].append({"id": str(uuid.uuid4()), "ts": iso(datetime.now(timezone.utc)), "user_id": "user_fixture",
                                "action": "intake", "model": STATE["models"]["intake_model"], "headers_json": json.dumps(headers),
                                "prompt": "[fixture prompt, samples as [value]]", "response": "[fixture reply]", "cost_micro": 900, "outcome": "ok"})
    return 200, {
        "reply": "Fixture reply %d: I found %d columns. I mapped them and suggested %d steps." % (turn + 1, len(headers), len(plan)),
        "question": None if turn else "Do you want the job titles cleaned up?",
        "mapping": mapping, "plan": plan[:8],
        "chips": ["Clean up titles", "Verify emails", "Add a research column"],
        "model": STATE["models"]["intake_model"], "cost_micro": 900,
    }


def _fentry(e):
    return {k: e[k] for k in ("id", "kind", "name", "path", "size", "mime", "updated")}


def files_action(action, body):
    files = STATE["files"]
    by_path = {e["path"]: e for e in files.values()}
    now = iso(datetime.now(timezone.utc))

    def norm(p):
        if not isinstance(p, str) or not p.startswith("/"):
            raise ValueError("Paths start with \"/\".")
        segs = [x for x in p.rstrip("/").split("/")[1:]] if p != "/" else []
        if any(x in ("", ".", "..") or len(x) > 120 or "\\" in x for x in segs):
            raise ValueError("Names must be 1 to 120 characters, with no slashes, and not \".\" or \"..\".")
        return "/" + "/".join(segs)

    def mkdirs(path):
        cur = ""
        for seg in [x for x in path.split("/") if x]:
            cur += "/" + seg
            if cur not in by_path:
                e = {"id": str(uuid.uuid4()), "kind": "folder", "name": seg, "path": cur, "size": 0, "mime": "", "updated": now, "bytes": b""}
                files[e["id"]] = by_path[cur] = e

    try:
        if action == "files_list":
            folder = norm(body.get("folder", "/"))
            kids = [e for e in files.values() if (e["path"].rsplit("/", 1)[0] or "/") == folder]
            kids.sort(key=lambda e: (e["kind"] != "folder", e["name"]))
            return 200, {"entries": [_fentry(e) for e in kids], "used_bytes": sum(e["size"] for e in files.values()), "quota_bytes": 50 * 1024 * 1024}
        if action == "files_mkdir":
            path = norm(body.get("path"))
            mkdirs(path)
            return 200, {"entry": _fentry(by_path[path])}
        if action == "files_put":
            folder, name = norm(body.get("folder", "/")), str(body.get("name") or "")
            if not name or "/" in name or len(name) > 120:
                raise ValueError("Names must be 1 to 120 characters, with no slashes.")
            ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            if ext not in ("csv", "xlsx", "json", "txt", "md", "pdf"):
                return 400, {"error": "bad_type", "message": "Allowed file types: csv, xlsx, json, txt, md, pdf."}
            data = base64.b64decode(body.get("content_base64") or "")
            mkdirs(folder)
            path = (folder if folder != "/" else "") + "/" + name
            if path in by_path:
                stem, dot, suf = name.rpartition(".")
                n = 2
                while (folder if folder != "/" else "") + "/%s (%d).%s" % (stem, n, suf) in by_path:
                    n += 1
                name = "%s (%d).%s" % (stem, n, suf)
                path = (folder if folder != "/" else "") + "/" + name
            e = {"id": str(uuid.uuid4()), "kind": "file", "name": name, "path": path, "size": len(data), "mime": "", "updated": now, "bytes": data}
            files[e["id"]] = e
            return 200, {"entry": _fentry(e)}
        if action in ("files_move", "files_delete"):
            e = files.get(body.get("id"))
            if not e:
                return 404, {"error": "not_found", "message": "No such file or folder."}
            old = e["path"]
            if action == "files_delete":
                for k in [k for k, x in files.items() if x["path"] == old or x["path"].startswith(old + "/")]:
                    del files[k]
                return 200, {"ok": True}
            folder = norm(body["folder"]) if "folder" in body else (old.rsplit("/", 1)[0] or "/")
            name = body.get("name", e["name"])
            new = (folder if folder != "/" else "") + "/" + name
            if new in by_path and new != old:
                return 409, {"error": "name_taken", "message": "Something with that name is already there."}
            mkdirs(folder)
            for x in files.values():
                if x["path"] == old or x["path"].startswith(old + "/"):
                    x["path"] = new + x["path"][len(old):]
            e["name"], e["updated"] = name, now
            return 200, {"entry": _fentry(e)}
    except ValueError as err:
        return 400, {"error": "invalid_path", "message": str(err)}
    return 400, {"error": "fixture: unknown action " + str(action)}

FIXTURE_TOKEN = "FIXTURE_SESSION_TOKEN"
PK = "pk_test_" + base64.b64encode(b"fixture.example.accounts.dev$").decode()

EMAIL_STATES = ["deliverable", "risky", "undeliverable", "unknown", "not_checked"]
EMAIL_REASONS = {
    "deliverable": "fixture: mailbox accepted the address",
    "risky": "fixture: catch-all domain, accept all",
    "undeliverable": "fixture: mailbox rejected the address",
    "unknown": "fixture: provider gave no answer",
    "not_checked": "verification not requested for this row",
}
FITS = ["Strong fit", "Possible fit", "Weak fit", "Not a fit", "Unjudged"]


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def day():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def seed():
    now = datetime.now(timezone.utc)
    if STATE["users"] is None:
        STATE["users"] = [
            {"id": "user_FIXTURE0001", "email": "fixture.operator@example.com",
             "daily_credit_cap": 10000, "daily_row_cap": 500, "disabled": 0,
             "credits_available": 4800, "credits_used": 200, "credits_held": 120,
             "spent_micro": 196000, "rows": 14},
            {"id": "user_FIXTURE0002", "email": "second.person@example.com",
             "daily_credit_cap": 2000, "daily_row_cap": 100, "disabled": 1,
             "credits_available": 0, "credits_used": 3400, "credits_held": 0,
             "spent_micro": 3400000, "rows": 96},
            {"id": "user_FIXTURE0003", "email": "third.person@example.com",
             "daily_credit_cap": 0, "daily_row_cap": 0, "disabled": 0,
             "credits_available": 500, "credits_used": 0, "credits_held": 0,
             "spent_micro": 0, "rows": 0},
        ]
    if STATE["global"] is None:
        STATE["global"] = {
            "daily_cap_micro": 5000000,
            "spent_micro": 196000,
            "held_micro": 118000,
            "welcome_credits": 500,
            "trial_pool_credits": 20000,
            "default_daily_credit_cap": 2000,
            "default_daily_row_cap": 100,
        }
    STATE.setdefault("_seeded_runs", False)
    if not STATE.get("_seeded_runs"):
        STATE["runs_seed"] = [
            {"id": "run_FIXTURE000a", "tool_id": "lead-scorer", "list_name": "Fixture batch A",
             "status": "completed", "created_at": iso(now - timedelta(hours=5)),
             "row_count": 5, "credits_used": 70, "credits_held": 0,
             "spent_micro": 68000, "held_micro": 0},
            {"id": "run_FIXTURE000b", "tool_id": "lead-scorer", "list_name": "Fixture batch B",
             "status": "review", "created_at": iso(now - timedelta(days=3)),
             "row_count": 10, "credits_used": 140, "credits_held": 120,
             "spent_micro": 136000, "held_micro": 118000},
            {"id": "run_FIXTURE000c", "tool_id": "lead-scorer", "list_name": "Fixture batch C",
             "status": "completed", "created_at": iso(now - timedelta(days=41)),
             "row_count": 3, "credits_used": 42, "credits_held": 0,
             "spent_micro": 41000, "held_micro": 0},
        ]
        STATE["_seeded_runs"] = True


def usage_payload():
    seed()
    u = STATE["users"][0]
    return {
        "user": {"id": u["id"], "email": u["email"], "is_admin": bool(STATE["admin"])},
        "usage": {
            "day": day(),
            "credits_available": u["credits_available"],
            "credits_held": u["credits_held"],
            "credits_used": u["credits_used"],
            "spent_micro": u["spent_micro"],
            "held_micro": 118000 if u["credits_held"] else 0,
            "rows": u["rows"],
            "daily_credit_cap": u["daily_credit_cap"],
            "daily_row_cap": u["daily_row_cap"],
            "disabled": bool(u["disabled"]),
        },
        "providers": {"treg": True, "jev": True},
        "runs": list(STATE.get("runs_seed", [])),
    }


def admin_payload():
    seed()
    return {"day": day(), "global": STATE["global"], "users": STATE["users"]}


def quote_math(body):
    rows = body.get("rows") or []
    if not isinstance(rows, list) or len(rows) < 1 or len(rows) > 5:
        raise ValueError("fixture: quote accepts 1 to 5 rows")
    enrichment = 6000 * len(rows) if body.get("enrich") else 0
    email = 10000 * len(rows) if body.get("verify_email") else 0
    jev = 10000 if (body.get("icp") or body.get("custom")) else 0
    micro = enrichment + email + jev
    warnings = []
    if not body.get("enrich"):
        warnings.append("enrichment off, fit is judged from uploaded columns only")
    if body.get("custom"):
        warnings.append("custom rubrics ride the same Jev batch, no extra charge per rubric")
    return {
        "row_count": len(rows),
        "max_cost_micro": micro,
        "max_credits": int(math.ceil(micro / 1000)),
        "breakdown": {
            "enrichment_micro": enrichment,
            "email_micro": email,
            "jev_micro": jev,
        },
        "warnings": warnings,
    }


def result_for(row, custom, verify, enrich, idx):
    status = EMAIL_STATES[idx % len(EMAIL_STATES)] if verify else "not_checked"
    fit = FITS[idx % len(FITS)]
    custom_out = {}
    for c in custom or []:
        crit = c.get("criteria") or ["one", "two"]
        pick = idx % len(crit)
        if c.get("type") == "category":
            custom_out[c["id"]] = {"label": crit[pick]}
        else:
            custom_out[c["id"]] = {"label": crit[pick], "index": pick}
    stamp = iso(datetime.now(timezone.utc))
    return {
        "input": row,
        "email_status": status,
        "email_reason": EMAIL_REASONS[status],
        "email_checked_at": stamp if status != "not_checked" else None,
        "email_source": "fixture:verify-endpoint" if status != "not_checked" else None,
        "icp_fit": fit,
        "custom": custom_out,
        "enrichment_status": "found" if enrich else "not_checked",
        "evidence": {
            "title": row.get("title", ""),
            "company": row.get("company", ""),
            "source": "fixture:enrich-endpoint" if enrich else None,
            "checked_at": stamp if enrich else None,
        },
        "notes": ["Fixture result. Not a live provider call."],
    }


def handle_toolkit(body, auth_ok):
    action = body.get("action")
    with LOCK:
        rec = {
            "action": action,
            "rows": len(body.get("rows") or []),
            "request_id": body.get("request_id"),
            "t": time.time(),
        }
        if action in ("admin_update",):
            rec["payload"] = {k: v for k, v in body.items() if k != "rows"}
        STATE["calls"].append(rec)
    if not auth_ok:
        return 401, {"error": "fixture: missing or invalid session token"}
    if action == "usage":
        return 200, usage_payload()
    if action == "quote":
        try:
            q = quote_math(body)
        except ValueError as e:
            return 400, {"error": str(e)}
        return 200, q
    if action == "run":
        return run_action(body)
    if action == "run_detail":
        rid = body.get("id")
        with LOCK:
            stored = STATE["runs"].get("stored_detail:" + str(rid))
        if stored:
            return 200, stored
        now = datetime.now(timezone.utc)
        out = {
            "id": rid,
            "status": "completed",
            "results": [
                result_for(
                    {"name": "Fixture Detail Row " + str(i + 1),
                     "title": "Head of Fixture",
                     "company": "Fixture Works",
                     "email": "detail" + str(i + 1) + "@example.com"},
                    [], True, True, i,
                )
                for i in range(3)
            ],
            "credits_used": 42, "credits_held": 0,
            "spent_micro": 41000, "held_micro": 0,
            "ledger": [
                {"provider": "treg", "endpoint": "enrich+verify", "status": "settled",
                 "cost_micro": 31000, "reserved_micro": 31000},
                {"provider": "jev", "endpoint": "score", "status": "settled",
                 "cost_micro": 10000, "reserved_micro": 10000},
            ],
        }
        with LOCK:
            STATE["runs"]["stored_detail:" + str(rid)] = out
        return 200, out
    if action == "admin_usage":
        if not STATE["admin"]:
            return 403, {"error": "fixture: not an admin"}
        return 200, admin_payload()
    if action == "admin_update":
        if not STATE["admin"]:
            return 403, {"error": "fixture: not an admin"}
        return admin_update(body)
    if action == "intake":
        return intake_reply(body)
    if str(action).startswith("files_"):
        with LOCK:
            return files_action(action, body)
    if action in ("admin_settings_get", "admin_settings_set", "admin_ai_log", "admin_ai_log_export"):
        if not STATE["admin"]:
            return 403, {"error": "forbidden"}
        if action == "admin_settings_set":
            for k in ("intake_model", "research_model"):
                if k in body:
                    if body[k] not in [m["id"] for m in FIXTURE_MODELS]:
                        return 400, {"error": "unknown_model", "field": k, "message": "%s is not on OpenRouter." % body[k]}
                    STATE["models"][k] = body[k]
        if action.startswith("admin_settings"):
            out = {"settings": dict(STATE["models"])}
            if action == "admin_settings_get":
                out["models"] = FIXTURE_MODELS
            return 200, out
        rows = list(reversed(STATE["ai_log"]))
        return 200, {"page": 1, "page_size": 50, "has_more": False, "rows": rows[:50]}
    return 400, {"error": "fixture: unknown action " + str(action)}


def run_action(body):
    rows = body.get("rows") or []
    rid = body.get("request_id")
    if body.get("tool_id") != "lead-scorer":
        return 400, {"error": "fixture: tool_id must be lead-scorer"}
    if not rid or not isinstance(rid, str):
        return 400, {"error": "fixture: request_id required"}
    if len(rows) < 1 or len(rows) > 5:
        return 400, {"error": "fixture: run accepts 1 to 5 rows"}
    if not isinstance(body.get("max_credits"), int) or body["max_credits"] < 0:
        return 400, {"error": "fixture: max_credits must be a nonnegative integer"}
    if not isinstance(body.get("list_name"), str) or len(body.get("list_name") or "") > 200:
        return 400, {"error": "fixture: list_name missing or too long"}
    icp = body.get("icp") or ""
    if len(icp) > 2000:
        return 400, {"error": "fixture: icp over 2000 characters"}
    payload_key = json.dumps(
        [rows, icp, bool(body.get("enrich")), bool(body.get("verify_email")),
         body.get("custom") or [], body.get("max_credits")],
        sort_keys=True,
    )
    import hashlib
    payload_hash = hashlib.sha256(payload_key.encode()).hexdigest()

    with LOCK:
        prior = STATE["runs"].get(rid)
        if prior is not None:
            if prior["_payload_hash"] == payload_hash:
                out = {k: v for k, v in prior.items() if k != "_payload_hash"}
                return 200, out
            return 409, {"error": "fixture: request id reused with a different payload"}

    delay = STATE["run_delay_ms"]
    if delay:
        time.sleep(delay / 1000.0)

    idx0 = STATE["n"]
    with LOCK:
        STATE["n"] += len(rows)
    results = [
        result_for(rows[i], body.get("custom"), bool(body.get("verify_email")),
                   bool(body.get("enrich")), idx0 + i)
        for i in range(len(rows))
    ]
    q = quote_math(body)
    micro = q["max_cost_micro"]
    ledger = []
    if q["breakdown"]["enrichment_micro"] or q["breakdown"]["email_micro"]:
        part = q["breakdown"]["enrichment_micro"] + q["breakdown"]["email_micro"]
        ledger.append({"provider": "treg", "endpoint": "enrich+verify",
                       "status": "settled", "cost_micro": part, "reserved_micro": part})
    if q["breakdown"]["jev_micro"]:
        ledger.append({"provider": "jev", "endpoint": "score", "status": "settled",
                       "cost_micro": q["breakdown"]["jev_micro"],
                       "reserved_micro": q["breakdown"]["jev_micro"]})
    out = {
        "id": "run_" + uuid.uuid4().hex[:12],
        "status": "completed",
        "results": results,
        "credits_used": int(math.ceil(micro / 1000)),
        "credits_held": 0,
        "spent_micro": micro,
        "held_micro": 0,
        "ledger": ledger,
    }
    with LOCK:
        STATE["runs"][rid] = dict(out, _payload_hash=payload_hash)
    return 200, out


def int_field(body, key):
    v = body.get(key)
    if not isinstance(v, int) or isinstance(v, bool) or v < 0 or v > 10**9:
        raise ValueError("fixture: " + key + " must be an integer from 0 to 1000000000")
    return v


def admin_update(body):
    seed()
    try:
        if "user_id" in body:
            uid = body["user_id"]
            cap = int_field(body, "daily_credit_cap")
            rows_cap = int_field(body, "daily_row_cap")
            disabled = body.get("disabled")
            if not isinstance(disabled, bool):
                raise ValueError("fixture: disabled must be true or false")
            for u in STATE["users"]:
                if u["id"] == uid:
                    u["daily_credit_cap"] = cap
                    u["daily_row_cap"] = rows_cap
                    u["disabled"] = 1 if disabled else 0
                    return 200, admin_payload()
            return 404, {"error": "fixture: no such user"}
        g = STATE["global"]
        g["daily_cap_micro"] = int_field(body, "global_daily_cap_micro")
        g["welcome_credits"] = int_field(body, "welcome_credits")
        g["trial_pool_credits"] = int_field(body, "trial_pool_credits")
        g["default_daily_credit_cap"] = int_field(body, "default_daily_credit_cap")
        g["default_daily_row_cap"] = int_field(body, "default_daily_row_cap")
        return 200, admin_payload()
    except ValueError as e:
        return 400, {"error": str(e)}


FIXTURE_CLERK = r"""
// FIXTURE Clerk browser SDK stand-in. Tests only, never production code.
// Implements the exact surface toolkit-session.js consumes: load, addListener,
// session.getToken, openSignIn, signOut, mountUserButton, mountPricingTable.
(function () {
  var SIGNED_OUT_KEY = 'fixture_signed_out';
  var listeners = [];
  var signedIn = sessionStorage.getItem(SIGNED_OUT_KEY) !== '1';

  function user() {
    return signedIn ? {
      id: 'user_FIXTURE0001',
      primaryEmailAddress: { emailAddress: 'fixture.operator@example.com' },
      fullName: 'Fixture Operator'
    } : null;
  }
  function session() {
    return signedIn ? {
      id: 'sess_FIXTURE',
      getToken: function () { return Promise.resolve('FIXTURE_SESSION_TOKEN'); }
    } : null;
  }
  function snap() { return { session: session(), user: user() }; }
  function emit() {
    listeners.slice().forEach(function (fn) {
      try { fn(snap()); } catch (e) {}
    });
  }
  window.Clerk = {
    __fixture: true,
    session: session(),
    user: user(),
    loaded: false,
    load: function () {
      this.loaded = true;
      this.session = session();
      this.user = user();
      return Promise.resolve();
    },
    addListener: function (fn) {
      listeners.push(fn);
      fn(snap());
      return function () {
        listeners = listeners.filter(function (x) { return x !== fn; });
      };
    },
    openSignIn: function () {
      signedIn = true;
      sessionStorage.removeItem(SIGNED_OUT_KEY);
      this.session = session();
      this.user = user();
      emit();
      return Promise.resolve();
    },
    mountSignIn: function (node, options) {
      node.dataset.fixture = 'signin';
      node.dataset.routing = options.routing;
      node.dataset.appearance = JSON.stringify((options.appearance || {}).variables || {});
      node.replaceChildren();
      var note = document.createElement('p');
      note.textContent = 'Fixture identity controls. Not a live Clerk form.';
      node.appendChild(note);
      ['Google', 'Email'].forEach(function (provider) {
        var button = document.createElement('button');
        button.textContent = 'Continue with ' + provider + ' (fixture)';
        button.onclick = function () { window.Clerk.openSignIn(); };
        node.appendChild(button);
      });
    },
    signOut: function () {
      signedIn = false;
      sessionStorage.setItem(SIGNED_OUT_KEY, '1');
      this.session = null;
      this.user = null;
      emit();
      return Promise.resolve();
    },
    mountUserButton: function (node) {
      node.dataset.fixture = 'user';
      node.innerHTML = '';
      var av = document.createElement('div');
      av.textContent = signedIn ? 'FO' : '';
      av.setAttribute('aria-label', signedIn ? 'Fixture Operator account menu' : 'Signed out');
      av.style.cssText = 'width:40px;height:40px;border-radius:50%;background:#F4A62A;color:#0E1A33;' +
        'font:700 14px Inter,sans-serif;display:flex;align-items:center;justify-content:center;' +
        'border:1px solid #303C53;cursor:pointer';
      node.appendChild(av);
    },
    mountPricingTable: function (node) {
      node.dataset.fixture = 'pricing';
      node.innerHTML = '';
      var plans = [
        { name: 'Fixture Trial', price: '$0', note: 'welcome credits, no card' },
        { name: 'Fixture Operator', price: '$29/mo', note: 'monthly allowance to the shared balance' }
      ];
      plans.forEach(function (p) {
        var card = document.createElement('div');
        card.style.cssText = 'border:1px solid #303C53;border-radius:6px;padding:14px;margin:0 10px 10px 0;' +
          'display:inline-block;min-width:200px;background:#15213A;color:#F4EBD9';
        var h = document.createElement('div');
        h.textContent = p.name;
        h.style.cssText = 'font:700 15px Inter,sans-serif';
        var price = document.createElement('div');
        price.textContent = p.price;
        price.style.cssText = 'font:800 22px Inter,sans-serif;color:#F4A62A;margin:6px 0';
        var note = document.createElement('div');
        note.textContent = p.note;
        note.style.cssText = 'font:400 12px JetBrains Mono,monospace;color:#A9ABA6;margin-bottom:10px';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Choose ' + p.name;
        btn.style.cssText = 'min-height:44px;padding:8px 16px;border-radius:6px;border:0;' +
          'background:#F4A62A;color:#0E1A33;font:700 14px Inter,sans-serif;cursor:pointer';
        card.appendChild(h);
        card.appendChild(price);
        card.appendChild(note);
        card.appendChild(btn);
        node.appendChild(card);
      });
    }
  };
})();
"""


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        pass

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        try:
            return json.loads(raw.decode())
        except Exception:
            return {}

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/toolkit/config":
            host = self.headers.get("Host") or "127.0.0.1"
            seed()
            return self._send(200, {
                "configured": bool(STATE["configured"]),
                "clerk_publishable_key": PK,
                "clerk_script_url": "http://%s/fixture/clerk.js" % host,
                "billing_enabled": bool(STATE["billing"]),
                "credits_per_usd": 1000,
                "providers": {"treg": True, "jev": True},
            })
        if path == "/fixture/clerk.js":
            return self._send(200, FIXTURE_CLERK.encode(), "application/javascript")
        if path == "/fixture/calls":
            return self._send(200, {"calls": STATE["calls"]})
        if path == "/api/now-playing":
            return self._send(200, {"spotify": {"state": "off", "track": None, "artist": None, "url": None, "art": None, "at": None},
                                    "game": {"state": "favorites", "title": None, "at": None},
                                    "favorites": ["Split Fiction", "Overwatch 2", "Marvel's Wolverine"]})
        if path.startswith("/api/toolkit/files/"):
            if (self.headers.get("Authorization") or "") != "Bearer " + FIXTURE_TOKEN:
                return self._send(401, {"error": "fixture: missing or invalid session token"})
            e = STATE["files"].get(path.rsplit("/", 1)[-1])
            if not e or e["kind"] != "file":
                return self._send(404, {"error": "not_found"})
            return self._send(200, e["bytes"], "application/octet-stream")
        return self._static(path)

    def do_POST(self):
        path = urlparse(self.path).path
        body = self._read_json()
        if path == "/fixture/reset":
            with LOCK:
                STATE["calls"] = []
                STATE["runs"] = {}
                STATE["n"] = 0
                STATE["run_delay_ms"] = 0
                STATE["files"] = {}
                STATE["ai_log"] = []
            return self._send(200, {"ok": True})
        if path == "/fixture/delay":
            STATE["run_delay_ms"] = int(body.get("ms") or 0)
            return self._send(200, {"ok": True, "ms": STATE["run_delay_ms"]})
        if path == "/fixture/config":
            STATE["configured"] = 1 if int(body.get("configured", 1)) else 0
            return self._send(200, {"ok": True})
        if path == "/api/toolkit":
            auth = self.headers.get("Authorization") or ""
            auth_ok = auth == "Bearer " + FIXTURE_TOKEN
            code, out = handle_toolkit(body, auth_ok)
            return self._send(code, out)
        self._send(404, {"error": "fixture: no such route"})

    def _static(self, path):
        if path == "/":
            path = "/index.html"
        rel = path.lstrip("/")
        candidate = ROOT / rel
        if not candidate.exists() and not Path(rel).suffix:
            for alt in (rel + ".html", rel + "/index.html"):
                if (ROOT / alt).exists():
                    candidate = ROOT / alt
                    break
        try:
            resolved = candidate.resolve()
        except Exception:
            return self._send(404, {"error": "not found"}, "text/plain")
        if not str(resolved).startswith(str(ROOT)) or not resolved.is_file():
            return self._send(404, b"not found", "text/plain")
        ctype = "text/plain"
        suffix = resolved.suffix.lower()
        if suffix in (".html", ".htm"):
            ctype = "text/html; charset=utf-8"
        elif suffix == ".css":
            ctype = "text/css"
        elif suffix in (".js", ".mjs"):
            ctype = "application/javascript"
        elif suffix == ".json" or suffix == ".webmanifest":
            ctype = "application/json"
        elif suffix == ".svg":
            ctype = "image/svg+xml"
        elif suffix == ".png":
            ctype = "image/png"
        elif suffix == ".ico":
            ctype = "image/x-icon"
        elif suffix == ".woff2":
            ctype = "font/woff2"
        elif suffix == ".csv":
            ctype = "text/csv"
        elif suffix == ".xlsx":
            ctype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        return self._send(200, resolved.read_bytes(), ctype)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    args = ap.parse_args()
    seed()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print("FIXTURE server on http://127.0.0.1:%d (root %s)" % (args.port, ROOT), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
