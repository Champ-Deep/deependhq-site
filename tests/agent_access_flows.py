#!/usr/bin/env python3
"""Approvals window and Agent access (card t_0281e09b) against tests/fixture_server.py.

FIXTURE data only: a fixture Clerk, a fixture user, five seeded staged items, one seeded key.
Starts its own fixture server, drives the flows at 1440, then shoots both surfaces at 390, 820 and 1440.

    /opt/anaconda3/bin/python3 tests/agent_access_flows.py

Screenshots go to qa/screenshots/agent-access/ (gitignored, local only). Exits non zero on the first failed check.
"""
import importlib.util
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("FIXTURE_PORT", "3107"))
BASE = "http://127.0.0.1:%d" % PORT
APP = BASE + "/toolkit-app.html"
OUT = ROOT / "qa" / "screenshots" / "agent-access"
OUT.mkdir(parents=True, exist_ok=True)
AUDIT = pathlib.Path.home() / "champ-skills/design/skills/visual-verify/scripts/audit.py"
FULL_KEY = re.compile(r"dhk_live_[A-Za-z0-9_-]{43}")
MCP = {"mcpServers": {"deependhq-toolkit": {"url": "https://toolkit.deependhq.com/api/toolkit/mcp", "headers": {"Authorization": "Bearer <your key>"}}}}
CURL = 'curl -H "Authorization: Bearer <your key>" https://toolkit.deependhq.com/api/toolkit/v1/tools'
WAIT_SIGNED = "document.querySelector('#session-status')?.dataset.state === 'ok'"
audit = None
if AUDIT.exists():
    spec = importlib.util.spec_from_file_location("audit", AUDIT)
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)
findings = []


def post(path, payload=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload or {}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())


def api(payload):
    req = urllib.request.Request(BASE + "/api/toolkit", data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer FIXTURE_SESSION_TOKEN"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def calls():
    with urllib.request.urlopen(BASE + "/fixture/calls", timeout=10) as r:
        return json.loads(r.read().decode())["calls"]


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok  " + msg)


def fresh(seed=True, **cfg):
    post("/fixture/reset")
    if seed:
        post("/fixture/seed-agent")
    if cfg:
        post("/fixture/config", cfg)


def probe(page, name):
    """The visual-verify machine pass, the dash count, and an element rect walk for overflow."""
    if audit:
        fails = [f for f in page.evaluate(audit.PROBE) if f["severity"] == "FAIL"]
        findings.append({"capture": name, "fails": fails})
        check(not fails, f"{name}: audit.py has no FAIL ({[f.get('check') or f.get('rule') for f in fails]})")
    check(page.evaluate("!/[\u2013\u2014]/.test(document.body.innerText)"), f"{name}: no em or en dash in visible text")
    over = page.evaluate("""() => [...document.querySelectorAll('.window-body *')].filter(e => {
      if (e.closest('pre,.table-scroll,[hidden]') || !e.getClientRects().length || !e.checkVisibility()) return false;
      const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.tagName + '.' + e.className)""")
    check(not over, f"{name}: nothing in the window runs past the viewport {over[:5]}")


def window_shot(page, app, name):
    path = OUT / f"{name}.png"
    page.locator(f'.window[data-app="{app}"]').screenshot(path=str(path))
    print("  shot " + str(path))


def open_signed_in(page, url=APP):
    page.goto(url)
    page.wait_for_function(WAIT_SIGNED)


def flows(page, ctx, logs, dialogs):
    # ---- Approvals: deep link, rows, badge, spoofing ----
    fresh()
    open_signed_in(page, APP + "#approvals/stg-move-0002")
    w = page.locator('.window[data-app="approvals"]')
    w.locator('.staged[data-target="true"]').wait_for()
    check(w.locator('.staged[data-target="true"]').get_attribute("data-staged") == "stg-move-0002", "#approvals/<id> opens the window and outlines that row")
    check(page.evaluate("document.activeElement.dataset.staged") == "stg-move-0002", "the outlined row has focus")
    ids = w.locator(".staged").evaluate_all("rs => rs.map(r => r.dataset.staged)")
    check(ids == ["stg-run-0001", "stg-move-0002", "stg-conn-0003", "stg-move-0005", "stg-run-0004"], f"rows newest first {ids}")
    badge = page.locator('[data-launch="approvals"] .badge')
    check(badge.is_visible() and badge.inner_text() == "3", "dock badge shows 3 pending (expired and decided not counted)")
    check(page.locator('[data-launch="approvals"]').get_attribute("aria-label") == "Approvals, 3 waiting", "dock entry names the count")
    states = w.locator(".staged .pill").evaluate_all("ps => ps.map(p => [p.dataset.state, p.textContent])")
    check(states == [["pending", "Waiting"], ["pending", "Waiting"], ["pending", "Waiting"], ["rejected", "Rejected"], ["expired", "Expired"]], f"status pills {states}")
    pill_bg = w.locator('.pill[data-state="expired"]').evaluate("p => getComputedStyle(p).backgroundImage")
    check("repeating-linear-gradient" in pill_bg, "expired pill is hatched")
    srcs = w.locator(".source-chip").evaluate_all("s => s.map(x => x.textContent)")
    check(srcs == ["DeepBot", "Claude Desktop", "You", "DeepBot", "A revoked agent key"], f"source chips {srcs}")
    glyph = w.locator(".kind-glyph").evaluate_all("g => g.map(x => x.dataset.kind)")
    check(glyph == ["run", "files_move", "connector_act", "files_move", "run"], f"kind glyphs {glyph}")
    meter = w.locator('[data-staged="stg-run-0001"] .credit-meter')
    check(meter.inner_text().split("\n") == ["up to 5 credits", "of 4,800 available"] or "up to 5 credits" in meter.inner_text() and "of 4,800 available" in meter.inner_text(), f"run meter: {meter.inner_text()!r}")
    check(w.locator('[data-staged="stg-run-0004"] .credit-meter').get_attribute("data-over") == "true", "a run over the balance marks its meter")
    note = w.locator('[data-staged="stg-move-0002"] .agent-note')
    check(note.locator("figcaption").inner_text().lower() == "note from the agent", "note is labelled as the agent's")
    check(note.locator("blockquote").evaluate("b => b.textContent") == "<img src=x onerror=alert(1)> Moving it out of the way.", "note markup renders as literal text")
    check(w.locator("img").count() == 0 and not dialogs, "no img element and no alert from the note")
    check(w.locator('[data-staged="stg-run-0004"] button').count() == 0, "expired item has no buttons")
    check(w.locator('[data-staged="stg-run-0001"]').get_by_role("button", name=re.compile("^Review and run")).count() == 1, "run item gets Review and run")
    check(w.locator('[data-staged="stg-move-0002"]').get_by_role("button", name=re.compile("^Approve")).count() == 1, "move item gets Approve")
    probe(page, "approvals-1440")
    window_shot(page, "approvals", "approvals-list-1440")

    # ---- Reject ----
    row = w.locator('[data-staged="stg-move-0002"]')
    row.get_by_role("button", name=re.compile("^Reject")).click()
    w.locator('[data-staged="stg-move-0002"] .pill[data-state="rejected"]').wait_for()
    check(w.locator('[data-staged="stg-move-0002"] .pill').inner_text() == "Rejected", "Reject sets the pill to Rejected")
    check([c["payload"] for c in calls() if c["action"] == "staged_decide"][-1] == {"action": "staged_decide", "id": "stg-move-0002", "decision": "reject"}, "reject posts staged_decide reject")
    page.wait_for_function("document.querySelector('[data-launch=approvals] .badge').textContent === '2'")
    check(True, "badge drops to 2")

    # ---- Approve with a server error, then success ----
    post("/fixture/config", {"decide_fail": 1})
    conn = w.locator('[data-staged="stg-conn-0003"]')
    seen_disabled = page.evaluate("""() => new Promise(res => { const r = document.querySelector('[data-staged="stg-conn-0003"]');
      const o = new MutationObserver(() => { const b = [...r.querySelectorAll('button')]; if (b.length && b.every(x => x.disabled)) { o.disconnect(); res(true); } });
      o.observe(r, {subtree: true, attributes: true, attributeFilter: ['disabled']}); r.querySelector('.btn-gold').click(); setTimeout(() => res(false), 3000); })""")
    check(seen_disabled, "Approve and Reject disable while in flight")
    conn.locator(".notice.bad").wait_for()
    check(conn.locator(".notice.bad").inner_text() == "ChampHarbinger did not answer. Nothing was sent. Try again later.", "the server message shows on error")
    check(not conn.get_by_role("button", name=re.compile("^Approve")).is_disabled(), "buttons come back after the error")
    window_shot(page, "approvals", "approvals-error-row-1440")
    post("/fixture/config", {"decide_fail": 0})
    conn.get_by_role("button", name=re.compile("^Approve")).click()
    w.locator('[data-staged="stg-conn-0003"] .pill[data-state="approved"]').wait_for()
    check(True, "a connector act approves to Approved")

    # ---- Review and run: Workbench at Quote, no run until Run ----
    before = len(calls())
    w.locator('[data-staged="stg-run-0001"]').get_by_role("button", name=re.compile("^Review and run")).click()
    wb = page.locator('.window[data-app="workbench"]')
    wb.locator('section.stage[data-stage="quote"]:not([hidden]) #wb-run').wait_for()
    rows = wb.locator('[aria-label="Quote by operation"] tbody tr').evaluate_all("rs => rs.map(r => r.innerText.split('\\t')[0])")
    check(rows == ["Normalize job titles"], f"Workbench opens at Quote with the plan rows {rows}")
    check("leads.csv" in wb.locator(".file-info").text_content(), "the staged file is the one loaded (file stage summary)")
    page.wait_for_timeout(600)
    acts = [c["action"] for c in calls()[before:]]
    check("quote" in acts and "run" not in acts and "staged_decide" not in acts, f"a fresh quote, no run and no approval before Run {acts}")
    window_shot(page, "workbench", "workbench-quote-from-approvals-1440")
    page.locator("#wb-run").click()
    page.wait_for_function("document.querySelector('[data-staged=\"stg-run-0001\"] .pill')?.dataset.state === 'approved'", timeout=15000)
    after = calls()[before:]
    runs = [c for c in after if c["action"] == "run"]
    decide = [c["payload"] for c in after if c["action"] == "staged_decide"]
    check(runs and decide == [{"action": "staged_decide", "id": "stg-run-0001", "decision": "approve", "job_id": runs[0]["job_id"]}], "after Run starts, staged_decide approve carries that job_id")
    check(after.index(runs[0]) < [c["action"] for c in after].index("staged_decide"), "the approval is posted after the run request")
    page.wait_for_function("document.querySelector('[data-launch=approvals] .badge').hidden")
    check(page.locator('[data-launch="approvals"]').get_attribute("aria-label") == "Approvals", "badge hidden at 0")
    page.get_by_role("button", name="Close Data Workbench").click()

    # ---- Guide pointer path opens it like any other app ----
    page.get_by_role("button", name="Close Approvals").click()
    page.evaluate("document.querySelector('[data-launch=\"approvals\"]').click()")
    check(page.locator('.window[data-app="approvals"]').is_visible(), "[data-launch=approvals] click (the guide path) opens Approvals")
    page.get_by_role("button", name="Close Approvals").click()

    # ---- Agent access ----
    page.locator('[data-launch="account"]').click()
    a = page.locator('.window[data-app="account"] .agent-access')
    a.locator(".key-row").first.wait_for()
    k = a.locator(".key-row").first
    check(k.locator(".key-label").inner_text() == "Claude Desktop" and k.locator(".key-prefix").inner_text() == "dhk_live_AbCdEfG\u2026", "key row: label and masked prefix")
    check(k.locator(".scope-chip").evaluate_all("c => c.map(x => x.textContent)") == ["files:read", "jobs:read", "jobs:plan", "jobs:stage"], "scope chips")
    check(k.locator(".key-meta").inner_text() == "Created 2 days ago. Last used 5 min ago.", f"ages: {k.locator('.key-meta').inner_text()}")
    checked = a.locator(".scope-pick input").evaluate_all("cs => cs.filter(c => c.checked).map(c => c.value)")
    check(checked == ["files:read", "jobs:read", "jobs:plan", "jobs:stage"], f"default scopes {checked}")
    check(a.locator(".scope-pick").count() == 7, "seven scopes, one plain line each")
    # snippets
    mcp = a.locator("#aa-panel-mcp pre").inner_text()
    check(json.loads(mcp) == MCP, "MCP snippet is the contract JSON with the placeholder")
    a.get_by_role("tab", name="OpenAI tools").click()
    check(a.locator("#aa-panel-openai pre").inner_text() == CURL and a.locator("#aa-panel-mcp").is_hidden(), "curl tab shows the contract command")
    a.get_by_role("button", name="Copy curl command").click()
    check(page.evaluate("navigator.clipboard.readText()") == CURL, "Copy puts the snippet on the clipboard")
    probe(page, "account-1440")
    window_shot(page, "account", "account-agent-access-1440")
    # create, reveal once, close
    a.get_by_label("Name for this key, 1 to 40 characters").fill("Cursor at work")
    a.get_by_role("button", name="Create key").click()
    rev = a.locator(".key-reveal")
    rev.wait_for()
    key = rev.locator(".key-secret").inner_text()
    check(FULL_KEY.fullmatch(key) is not None, "the reveal shows a full dhk_live_ key")
    check("Copy it now. You will not see this key again." in rev.inner_text(), "reveal says it is shown once")
    check(page.evaluate("k => document.documentElement.outerHTML.split(k).length - 1", key) == 1, "the key is in the DOM exactly once, in the reveal")
    rev.get_by_role("button", name="Copy key").click()
    check(page.evaluate("navigator.clipboard.readText()") == key, "Copy key puts the key on the clipboard")
    rev.locator(".key-secret").scroll_into_view_if_needed()
    window_shot(page, "account", "account-key-reveal-1440")
    check(a.locator(".key-row").count() == 2, "the new key is listed")
    rev.get_by_role("button", name="I saved it, close").click()
    check(a.locator(".key-reveal").count() == 0, "close removes the reveal panel")
    leak = page.evaluate("""k => ({html: document.documentElement.outerHTML.includes(k), full: /dhk_live_[A-Za-z0-9_-]{43}/.test(document.documentElement.outerHTML),
      prefixes: (document.documentElement.outerHTML.match(/dhk_live_[A-Za-z0-9_-]*/g) || []),
      local: JSON.stringify(Object.entries(localStorage)), session: JSON.stringify(Object.entries(sessionStorage)), url: location.href})""", key)
    check(not leak["html"] and not leak["full"], "after close no full key anywhere in outerHTML")
    check(all(len(p) == 16 for p in leak["prefixes"]) and len(leak["prefixes"]) == 2, f"the only dhk_live_ text left is the two 16 character display prefixes {leak['prefixes']}")
    check("dhk_live_" not in leak["local"] + leak["session"] + leak["url"], "no dhk_live_ in localStorage, sessionStorage or the URL")
    check(not any("dhk_live_" in m for m in logs), "no dhk_live_ in the console")
    cdp = ctx.new_cdp_session(page)
    cdp.send("HeapProfiler.enable")
    cdp.send("HeapProfiler.collectGarbage")
    chunks = []
    cdp.on("HeapProfiler.addHeapSnapshotChunk", lambda e: chunks.append(e["chunk"]))
    cdp.send("HeapProfiler.takeHeapSnapshot", {"reportProgress": False})
    heap = "".join(chunks)
    check(len(heap) > 100000 and key not in heap and key[16:] not in heap, "after close and GC the key is not in the page's JS heap snapshot")
    # revoke
    target = a.locator(".key-row", has_text="Cursor at work")
    target.get_by_role("button", name="Revoke Cursor at work").click()
    check(target.locator(".confirm p").inner_text() == "Revoke Cursor at work? Agents using it stop at once.", "inline revoke confirm")
    window_shot(page, "account", "account-revoke-confirm-1440")
    target.get_by_role("button", name="Revoke key").click()
    page.wait_for_function("![...document.querySelectorAll('.key-label')].some(n => n.textContent === 'Cursor at work')")
    check(a.locator(".key-row").count() == 1 and any(c["action"] == "api_key_revoke" for c in calls()), "revoke removes the row")
    # the limit
    for i in range(4):
        api({"action": "api_key_create", "label": "Fixture %d" % i, "scopes": ["files:read"]})
    page.get_by_role("button", name="Close Account").click()
    page.locator('[data-launch="account"]').click()
    a.locator(".key-row").nth(4).wait_for()
    check(a.locator(".key-form input").first.is_disabled() and a.get_by_role("button", name="Create key").is_disabled() and "Five keys is the limit. Revoke one to add another." in a.locator(".key-form").inner_text(), "at 5 keys the form is disabled with the limit line")
    a.locator(".key-form").scroll_into_view_if_needed()
    window_shot(page, "account", "account-key-limit-1440")
    page.get_by_role("button", name="Close Account").click()

    # ---- Switched off for a non admin ----
    fresh(admin=0, api_keys_open=0)
    open_signed_in(page)
    page.locator('[data-launch="account"]').click()
    a = page.locator('.window[data-app="account"] .agent-access')
    page.wait_for_function("document.querySelector('.agent-access')?.innerText === 'Agent access is not switched on yet.'")
    check(a.inner_text() == "Agent access is not switched on yet." and a.locator("form, button, input").count() == 0, "switched off: one line and nothing else")
    a.scroll_into_view_if_needed()
    window_shot(page, "account", "account-agent-access-off-1440")
    page.get_by_role("button", name="Close Account").click()

    # ---- Empty, loading and error states ----
    fresh(seed=False)
    open_signed_in(page)
    page.locator('[data-launch="approvals"]').click()
    w = page.locator('.window[data-app="approvals"]')
    w.get_by_text("Nothing waiting. When DeepBot or your agent prepares something, it lands here.", exact=True).wait_for()
    check(page.locator('[data-launch="approvals"] .badge').is_hidden(), "empty: no badge")
    window_shot(page, "approvals", "approvals-empty-1440")
    page.get_by_role("button", name="Close Approvals").click()
    def slow(route):
        body = json.loads(route.request.post_data or "{}")
        if body.get("action") == "staged_list" and body.get("status") == "all":
            time.sleep(1.5)
        route.continue_()
    page.route("**/api/toolkit", slow)
    page.locator('[data-launch="approvals"]').click()
    w.get_by_text("Loading what is waiting for you...").wait_for()
    window_shot(page, "approvals", "approvals-loading-1440")
    w.get_by_text("Nothing waiting.", exact=False).wait_for()
    page.unroute("**/api/toolkit")
    page.get_by_role("button", name="Close Approvals").click()
    page.route("**/api/toolkit", lambda r: r.fulfill(status=500, content_type="application/json", body=json.dumps({"error": "server_error", "message": "The toolkit had a problem. Try again in a minute."}))
               if json.loads(r.request.post_data or "{}").get("status") == "all" else r.continue_())
    page.locator('[data-launch="approvals"]').click()
    w.locator(".notice.bad").wait_for()
    check("Approvals did not load: The toolkit had a problem. Try again in a minute." in w.locator(".notice.bad").inner_text() and w.get_by_role("button", name="Try again").is_visible(), "error state names the problem and offers Try again")
    window_shot(page, "approvals", "approvals-error-1440")
    page.unroute("**/api/toolkit")


def shoot_widths(browser):
    for width, height in ((390, 844), (820, 1180), (1440, 900)):
        ctx = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce", device_scale_factor=2,
                                  is_mobile=width < 700, has_touch=width < 700)
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        fresh()
        open_signed_in(page, APP + "#approvals")
        w = page.locator('.window[data-app="approvals"]')
        w.locator(".staged").first.wait_for()
        probe(page, f"approvals-{width}")
        window_shot(page, "approvals", f"approvals-{width}")
        w.locator('[data-staged="stg-run-0004"]').scroll_into_view_if_needed()
        window_shot(page, "approvals", f"approvals-{width}-end")
        page.get_by_role("button", name="Close Approvals").click()
        page.locator('[data-launch="account"]').click()
        a = page.locator('.window[data-app="account"] .agent-access')
        a.locator(".key-row").first.wait_for()
        a.get_by_label("Name for this key, 1 to 40 characters").fill("Phone check")
        a.get_by_role("button", name="Create key").click()
        a.locator(".key-reveal").wait_for()
        a.locator(".key-reveal").scroll_into_view_if_needed()
        probe(page, f"account-reveal-{width}")
        window_shot(page, "account", f"account-reveal-{width}")
        a.get_by_role("button", name="I saved it, close").click()
        a.locator(".key-list").scroll_into_view_if_needed()
        window_shot(page, "account", f"account-keys-{width}")
        a.locator(".snippet:not([hidden])").scroll_into_view_if_needed()
        probe(page, f"account-{width}")
        window_shot(page, "account", f"account-snippets-{width}")
        check(not errs, f"{width}: console clean {errs}")
        ctx.close()


def main():
    server = subprocess.Popen([sys.executable, str(ROOT / "tests" / "fixture_server.py"), "--port", str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(BASE + "/fixture/calls", timeout=1).read()
                break
            except Exception:
                time.sleep(0.25)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
            ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
            page = ctx.new_page()
            logs, errors, dialogs = [], [], []
            page.on("console", lambda m: (logs.append(m.text), errors.append(m.text) if m.type == "error" else None))
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
            print("flows at 1440")
            flows(page, ctx, logs, dialogs)
            # the decide_fail (502) and error-state (500) probes answer with those statuses on purpose
            bad = [e for e in errors if not re.match(r"Failed to load resource: the server responded with a status of 50[02]", e)]
            check(not bad, f"console has no errors {bad}")
            ctx.close()
            print("responsive 390, 820, 1440")
            shoot_widths(browser)
            browser.close()
        (OUT / "audit.json").write_text(json.dumps(findings, indent=2))
        print("agent access flows: all checks passed")
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
