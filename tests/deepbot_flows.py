#!/usr/bin/env python3
"""Deepbot front door (card t_f1082446) against tests/fixture_server.py.

FIXTURE data only: a fixture Clerk, a fixture user, a scripted fixture model (no provider call) and fixture
ChampHarbinger and ChampBeam adapters (no network). Starts its own fixture server, proves the acceptance list,
then shoots every state at 375, 768 and 1280 in dark and light.

    /opt/anaconda3/bin/python3 tests/deepbot_flows.py

Screenshots go to qa/screenshots/deepbot/ (gitignored, local only), with contrast.json beside them.
Exits non zero on the first failed check.
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
PORT = int(os.environ.get("FIXTURE_PORT", "3111"))
BASE = "http://127.0.0.1:%d" % PORT
APP = BASE + "/toolkit-app.html"
OUT = ROOT / "qa" / "screenshots" / "deepbot"
OUT.mkdir(parents=True, exist_ok=True)
AUDIT = pathlib.Path.home() / "champ-skills/design/skills/visual-verify/scripts/audit.py"
WAIT_SIGNED = "document.querySelector('#session-status')?.dataset.state === 'ok'"
audit = None
if AUDIT.exists():
    spec = importlib.util.spec_from_file_location("audit", AUDIT)
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)


def post(path, payload=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload or {}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())


def calls(action=None):
    with urllib.request.urlopen(BASE + "/fixture/calls", timeout=10) as r:
        return [c.get("payload") or {} for c in json.loads(r.read().decode())["calls"] if action is None or c["action"] == action]


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok  " + msg)


def overlap(a, b):
    return a and b and a["x"] < b["x"] + b["width"] and b["x"] < a["x"] + a["width"] and a["y"] < b["y"] + b["height"] and b["y"] < a["y"] + a["height"]


def probe(page, name):
    """The visual-verify machine pass, the dash count, and an element rect walk for overflow."""
    if audit:
        # shortcut: the desktop icons' left/top transition predates this card (toolkit-desktop.css .desk-icon); reported, not fixed here
        fails = [f for f in page.evaluate(audit.PROBE) if f["severity"] == "FAIL" and not (f["rule"] == "layout-animation" and "desk-icon" in f["where"])]
        check(not fails, f"{name}: audit.py has no FAIL ({fails[:3]})")
    check(page.evaluate("!/[\\u2013\\u2014]/.test(document.body.innerText)"), f"{name}: no em or en dash in visible text")
    over = page.evaluate("""() => [...document.querySelectorAll('.window-body *, .tg-panel *, .tp-caption *')].filter(e => {
      if (e.closest('pre,.table-scroll,[hidden],.tg-body') || !e.getClientRects().length || !e.checkVisibility()) return false;
      const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.tagName + '.' + e.className)""")
    check(not over, f"{name}: nothing runs past the viewport {over[:5]}")
    check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"{name}: no horizontal scroll")


def shot(page, name, el=None):
    path = OUT / f"{name}.png"
    (page.locator(el) if el else page).screenshot(path=str(path))
    print("  shot " + str(path))


def boot(page, scheme="dark"):
    page.goto(APP)
    page.wait_for_function(WAIT_SIGNED, timeout=15000)
    if scheme == "light":
        page.evaluate("document.documentElement.dataset.scheme = 'light'")


def open_panel(page):
    page.locator(".tg-launcher").click()
    page.locator(".tg-card[data-kind=catalog] .tg-chip").first.wait_for()
    page.wait_for_timeout(250)  # the 100 ms open zoom (95 to 100 percent) has settled before anything is measured


def say(page, text):
    n = page.locator(".tg-bot").count()
    page.fill("#tg-q", text)
    page.keyboard.press("Enter")
    page.wait_for_function(f"document.querySelectorAll('.tg-bot').length > {n} && !document.querySelector('.tg-send').disabled")


def last_steps(page):
    return page.locator(".tg-card[data-kind=steps]").last


def ring_on(page, selector):
    page.wait_for_timeout(500)  # the ring glides over 400 ms
    return overlap(page.locator(".tp-ring").bounding_box(), page.locator(selector).bounding_box())


def flows(page):
    post("/fixture/reset")
    boot(page)
    # ---- 2. "What can I do here": chips from the catalog, zero model calls ----
    open_panel(page)
    chips = page.locator(".tg-card[data-kind=catalog] .tg-chip").all_inner_texts()
    check(chips[:4] == ["Data Workbench", "Files", "Account", "Approvals"] and "Connect ChampHarbinger" in chips, f"empty thread renders the catalog as chips {chips}")
    check(post("/fixture/conn")["model_calls"] == 0 and [c.get("message") for c in calls("deepbot")] == ["what can you do"], "the catalog came from one free deepbot call and zero model calls")
    page.locator(".tg-card[data-kind=catalog] .tg-chip", has_text="Files").click()
    check(page.locator(".tg-card[data-kind=steps]").count() == 1 and post("/fixture/conn")["model_calls"] == 0, "an app chip answers from the catalog with a steps card, still zero model calls")

    # ---- 1a. a point step lands its ring on the target (Show me) ----
    say(page, "Show me the stages")
    page.screenshot(path=str(OUT / "flow-01-steps-card-1280.png"))
    last_steps(page).locator("[data-mode=show]").click()
    check(page.locator(".tg-panel").is_hidden(), "Show me tucks the panel away so the page is visible")
    check(ring_on(page, '#app-launcher [data-launch="workbench"]'), "Show me step 1 rings the Data Workbench dock icon")
    page.locator('#app-launcher [data-launch="workbench"]').click()  # the user does the step; the pointer moves on
    page.wait_for_function("document.querySelector('.tp-step')?.textContent === 'Step 2 of 3'")
    check(ring_on(page, '[data-guide="workbench.stage.file"]'), "Show me step 2: the ring box overlaps the File stage button box")
    shot(page, "flow-02-show-me-1280")
    page.locator(".tp-next").click()
    page.locator(".tp-next").click()
    page.wait_for_function("!document.querySelector('.tg-panel').hidden")
    check(last_steps(page).locator(".tg-fine").inner_text() == "Done.", "the steps card says Done after the last Next")

    # ---- 1b. an unregistered click is refused and the DOM is unchanged ----
    say(page, "Click the hidden button")
    before = page.evaluate("document.querySelector('#windows').outerHTML + document.querySelector('#app-launcher').outerHTML")
    last_steps(page).locator("[data-mode=do]").click()
    page.wait_for_function("document.querySelector('.tp-caption')?.dataset.refused === 'true'", timeout=5000)
    check(page.locator(".tp-text").inner_text() == "I can't reach that." and page.locator(".tp-caption").get_attribute("role") == "alert", "an unregistered click is refused out loud: I can't reach that.")
    shot(page, "flow-03-refused-1280")
    check(page.evaluate("document.querySelector('#windows').outerHTML + document.querySelector('#app-launcher').outerHTML") == before, "the windows and the dock are byte for byte unchanged after the refusal")
    page.locator(".tp-acts button").click()

    # ---- 1c. a quote card never calls run ----
    say(page, "Get me a quote")
    q = page.locator(".tg-card[data-kind=quote]").last
    check("5 credits" in q.inner_text() and q.locator("button").count() == 0, "the quote card shows the cost and carries no button at all")
    q.click()
    check(not calls("run"), "no run call was made from the quote card")

    # ---- 1d. a staged card's Approve calls staged_decide once; the dock badge counts it ----
    say(page, "Plan a campaign for me")
    card = page.locator(".tg-card[data-kind=staged]").last
    sid = card.get_attribute("data-staged")
    page.wait_for_function("document.querySelector('#app-launcher [data-launch=approvals] .badge')?.textContent === '1'")
    check(page.locator('#app-launcher [data-launch="approvals"]').get_attribute("aria-label") == "Approvals, 1 waiting", "the Approvals dock icon shows a count of 1")
    check(card.locator('a[href="#approvals/%s"]' % sid).count() == 1, "the staged card links to its row in Approvals")
    golds = page.locator(".tg-panel .btn-gold").all_inner_texts()
    check(golds == ["Approve"], f"Approve is the only Lamp-filled button in the panel {golds}")
    shot(page, "flow-04-staged-1280")
    card.get_by_role("button", name=re.compile("^Approve")).dblclick()
    card.locator(".tg-fine", has_text="Approved.").wait_for()
    check([c for c in calls("staged_decide") if c.get("id") == sid] == [{"action": "staged_decide", "id": sid, "decision": "approve"}], "a double click on Approve posted staged_decide exactly once")
    page.wait_for_function("document.querySelector('#app-launcher [data-launch=approvals] .badge')?.hidden === true")
    check(True, "the badge clears once it is approved")

    # ---- ask card ----
    say(page, "Which column?")
    page.locator(".tg-card[data-kind=ask] .tg-chip", has_text="Title").click()
    page.wait_for_function("[...document.querySelectorAll('.tg-user')].some(n => n.textContent === 'Title')")
    check(True, "an ask card's option is sent as the next message")

    # ---- threads ----
    page.locator(".tg-tool", has_text="Threads").click()
    page.locator(".tg-thread").first.wait_for()
    check(page.locator(".tg-thread").count() == 1 and "Show me the stages" in page.locator(".tg-thread-title").first.inner_text(), "the thread list shows the one thread with its title")
    page.locator(".tg-thread").first.click()
    page.wait_for_function("document.querySelectorAll('.tg-user').length >= 5")
    check(page.locator(".tg-card[data-kind=staged]").count() == 1 and page.locator(".tg-card[data-kind=steps]").count() == 2, "reopening the thread replays its turns as cards")


def harbinger_conversation(page):
    """3. Connect my Harbinger as a conversation."""
    post("/fixture/reset")
    boot(page)
    open_panel(page)
    say(page, "Connect my Harbinger")
    shot(page, "connect-01-reply-1280")
    last_steps(page).locator("[data-mode=show]").click()
    check(ring_on(page, '#app-launcher [data-launch="account"]'), "step 1 rings the Account dock icon")
    page.locator('#app-launcher [data-launch="account"]').click()
    page.wait_for_function("document.querySelector('.tp-step')?.textContent === 'Step 2 of 3'")
    key = '[data-guide="account.connections.harbinger.key"]'
    page.locator(key).wait_for()
    check(ring_on(page, key), "step 2 rings the ChampHarbinger key field in Account")
    shot(page, "connect-02-point-key-1280")
    page.locator(key).fill("hb_live_fixture00001234")  # the user pastes
    page.locator(".tp-next").click()
    save = '[data-guide="account.connections.harbinger.save"]'
    check(ring_on(page, save), "step 3 rings Save key")
    shot(page, "connect-03-point-save-1280")
    page.locator(save).click()
    row = page.locator('.conn-row[data-provider="harbinger"]')
    row.locator('.conn-chip[data-state="connected"]').wait_for()
    check("hb_live_****1234" in row.inner_text() and "hb_live_fixture00001234" not in page.content(), "state flips to Connected and only the masked hint is on the page")
    check(calls("connection_save") == [{"provider": "harbinger"}], "one connection_save, the key kept out of the call log")
    shot(page, "connect-04-connected-1280")
    page.locator(".tg-close").click()
    row.locator('[data-guide="account.connections.harbinger.open"]').click()
    w = page.locator('.window[data-app="conn-harbinger"]')
    w.locator('.conn-chip[data-state="connected"]').wait_for()
    check(w.locator(".conn-pull").count() == 3 and "Fixture Q4 CFOs" in w.inner_text(), "the ChampHarbinger mini window lists its three pulls")
    shot(page, "connect-05-mini-window-1280", '.window[data-app="conn-harbinger"]')


def mini_states(page, tag):
    """4. The mini window in every state."""
    post("/fixture/reset")
    out = {}
    for state, cfg in (("no-key", {"connected": 0}), ("invalid", {"connected": 1, "mode": "invalid"}), ("invite", {"connected": 1, "mode": "invite"}),
                       ("down", {"connected": 1, "mode": "down"}), ("connected", {"connected": 1, "mode": "ok"})):
        post("/fixture/conn", dict(cfg, provider="harbinger"))
        page.evaluate("dispatchEvent(new Event('dh:connections'))")
        w = page.locator('.window[data-app="conn-harbinger"]')
        want = {"no-key": "not_connected", "invalid": "invalid", "invite": "invite", "down": "down", "connected": "connected"}[state]
        page.wait_for_function(f"document.querySelector('.window[data-app=\"conn-harbinger\"]')?.dataset.state === '{want}'")
        out[state] = w.locator(".conn-chip").inner_text()
        if state == "invite":
            w.get_by_role("button", name="Request an invite").click()
            w.get_by_text("Request sent to Deep.").wait_for()
        if state == "connected":
            w.locator('[data-guide="harbinger.act.plan_campaign.goal"]').fill("300 CFO meetings this quarter")
            w.get_by_role("button", name="Stage it").first.click()
            w.locator(".conn-staged").wait_for()
        probe(page, f"mini-{state}-{tag}")
        shot(page, f"mini-{state}-{tag}", '.window[data-app="conn-harbinger"]' if not tag.startswith("375") else None)
    return out


def contrast_table(page):
    """Computed text and background of every new text style, composited up the ancestor chain."""
    return page.evaluate("""() => {
      const cv = document.createElement('canvas').getContext('2d');
      const rgba = c => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
      const bg = e => { const layers = []; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] >= 1) break; } let o = [255, 255, 255]; for (const c of layers.reverse()) o = o.map((v, i) => v * (1 - c[3]) + c[i] * c[3]); return o; };
      const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
      const sel = ['.tg-eyebrow', '.tg-title', '.tg-status', '.tg-bot .tg-text', '.tg-user .tg-text', '.tg-meta', '.tg-card-head', '.tg-card-title', '.tg-fine', '.tg-chip', '.tg-tool', '.tg-step-op', '.tg-step-say', '.tg-kv dt', '.tg-kv dd', '.tg-label', '.tg-count', '.tg-send', '.tg-panel .btn-gold', '.tg-panel .btn-outline', '.tg-panel .btn-text', '.tp-step', '.tp-text', '.tp-acts .btn', '.conn-name', '.conn-chip', '.conn-meta', '.conn-win .plain', '.conn-pull h4', '.ci-name', '.ci-side', '.conn-kv dt', '.conn-kv dd', '.connections .plain', '.field-label', '.conn-win .notice'];
      const rows = [];
      for (const s of sel) for (const e of [...document.querySelectorAll(s)].filter(e => e.checkVisibility() && e.textContent.trim()).slice(0, 3)) {
        const fg = rgba(getComputedStyle(e).color), b = bg(e), f = fg.slice(0, 3).map((v, i) => v * fg[3] + b[i] * (1 - fg[3]));
        const [l1, l2] = [lum(f), lum(b)].sort((x, y) => y - x);
        rows.push({sel: s + (e.dataset.state ? '[' + e.dataset.state + ']' : ''), text: e.textContent.trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize), ratio: Math.round((l1 + .05) / (l2 + .05) * 100) / 100});
      }
      return rows;
    }""")


def gallery(browser, width, scheme):
    tag = f"{width}-{scheme}"
    ctx = browser.new_context(viewport={"width": width, "height": 812 if width < 700 else 1024 if width < 1000 else 800}, device_scale_factor=2,
                              is_mobile=width < 700, has_touch=width < 700, color_scheme=scheme)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # The provider error states answer 400 on purpose; Chrome logs those as failed resources. Any other error counts.
    page.on("console", lambda m: m.type == "error" and not m.text.startswith("Failed to load resource") and errors.append(m.text))
    post("/fixture/reset")
    boot(page, scheme)
    open_panel(page)
    probe(page, f"empty-{tag}")
    shot(page, f"empty-thread-{tag}")
    table = contrast_table(page)
    say(page, "Show me the stages")
    last_steps(page).locator("[data-mode=show]").click()
    page.locator('#app-launcher [data-launch="workbench"]').click()
    page.wait_for_function("document.querySelector('.tp-step')?.textContent === 'Step 2 of 3'")
    page.wait_for_timeout(500)
    table += contrast_table(page)
    shot(page, f"steps-show-me-{tag}")
    page.keyboard.press("Escape")
    page.wait_for_function("!document.querySelector('.tg-panel').hidden || innerWidth <= 768")
    if page.locator(".tg-panel").is_hidden():
        page.locator(".tg-launcher").click()
    say(page, "Connect my Harbinger")
    last_steps(page).locator("[data-mode=do]").click()
    page.wait_for_function("document.querySelector('.tp-step')?.textContent === 'Step 2 of 3'", timeout=8000)
    page.wait_for_timeout(250)
    shot(page, f"steps-do-it-mid-run-{tag}")
    page.wait_for_function("!document.querySelector('.tg-panel').hidden || document.querySelector('.tp-caption').hidden", timeout=8000)
    if page.locator(".tg-panel").is_hidden():
        page.locator(".tg-launcher").click()
    say(page, "Plan a campaign")
    page.locator(".tg-card[data-kind=staged]").last.scroll_into_view_if_needed()
    probe(page, f"staged-{tag}")
    table += contrast_table(page)
    shot(page, f"staged-card-{tag}", ".tg-panel")
    if width < 700:  # the sheet: full snap, then the keyboard (the real visualViewport resize path, height faked)
        page.locator(".tg-handle").click()
        check(page.locator(".tg-panel").get_attribute("data-snap") == "full", f"{tag}: the handle snaps the sheet to full height")
        page.locator("#tg-q").focus()
        page.evaluate("Object.defineProperty(visualViewport, 'height', {configurable: true, get: () => innerHeight - 300}); visualViewport.dispatchEvent(new Event('resize'))")
        page.wait_for_timeout(200)
        box, form = page.locator(".tg-panel").bounding_box(), page.locator(".tg-form").bounding_box()
        check(abs(812 - (box["y"] + box["height"]) - 300) <= 1 and form["y"] + form["height"] <= 812 - 300, f"{tag}: with a 300 px keyboard the sheet and the composer sit above it")
        shot(page, f"mobile-sheet-keyboard-{tag}")
        targets = page.evaluate("[...document.querySelectorAll('.tg-panel button, .tg-panel a, .tg-panel textarea')].filter(e => e.checkVisibility()).map(e => { const r = e.getBoundingClientRect(); return [e.className || e.tagName, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 44)")
        check(not targets, f"{tag}: every control in the sheet is 44 px or more {targets[:4]}")
        page.evaluate("Object.defineProperty(visualViewport, 'height', {configurable: true, get: () => innerHeight}); visualViewport.dispatchEvent(new Event('resize'))")
        page.locator(".tg-close").click()
    else:
        page.locator(".tg-close").click()
    if not page.locator('.window[data-app="account"]').count():  # Do it already opened Account on the way
        page.locator('#app-launcher [data-launch="account"]').click()
    page.locator('[data-guide="account.connections.harbinger.open"]').click()
    states = mini_states(page, tag)
    table += contrast_table(page)
    check(states == {"no-key": "No key", "invalid": "Invalid key", "invite": "Invite only", "down": "Provider down", "connected": "Connected"}, f"{tag}: the mini window chip reads each state {states}")
    check(not errors, f"{tag}: no console errors {errors[:3]}")
    ctx.close()
    return [dict(r, capture=tag) for r in table]


def main():
    srv = subprocess.Popen([sys.executable, str(ROOT / "tests" / "fixture_server.py"), "--port", str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(BASE + "/api/toolkit/config", timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            print("flows at 1280")
            flows(page)
            harbinger_conversation(page)
            check(not errors, f"flows: no page errors {errors[:3]}")
            ctx.close()
            table = []
            for scheme in ("dark", "light"):
                for width in (375, 768, 1280):
                    print(f"gallery {width} {scheme}")
                    table += gallery(browser, width, scheme)
            browser.close()
        (OUT / "contrast.json").write_text(json.dumps(table, indent=1))
        worst = sorted(table, key=lambda r: r["ratio"])[:5]
        print("  contrast: %d pairs measured, lowest %s" % (len(table), [(r["sel"], r["ratio"], r["capture"]) for r in worst]))
        check(all(r["ratio"] >= 4.5 for r in table), "every measured text pair is 4.5:1 or better")
        print("deepbot_flows: all checks passed")
    finally:
        srv.terminate()


if __name__ == "__main__":
    main()
