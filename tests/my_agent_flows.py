#!/usr/bin/env python3
"""My agent window (card t_2fa771e9) against tests/fixture_server.py.

FIXTURE data only: a fixture Clerk, a fixture user, a fixture MCP tool list (no network call) and a fixture
webhook log. Starts its own fixture server, drives the flows at 1440, then shoots every tab at 390, 820 and 1440.

    /opt/anaconda3/bin/python3 tests/my_agent_flows.py

Screenshots go to qa/screenshots/my-agent/ (gitignored, local only). Exits non zero on the first failed check.
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
PORT = int(os.environ.get("FIXTURE_PORT", "3109"))
BASE = "http://127.0.0.1:%d" % PORT
APP = BASE + "/toolkit-app.html"
OUT = ROOT / "qa" / "screenshots" / "my-agent"
OUT.mkdir(parents=True, exist_ok=True)
AUDIT = pathlib.Path.home() / "champ-skills/design/skills/visual-verify/scripts/audit.py"
SECRET = re.compile(r"whsec_[A-Za-z0-9_-]{43}")
TOKEN = "fixture-token-abcdefghijklmnopqrstu"
URL_NOT_ALLOWED = "That URL is not allowed. It must be a public https address on port 443."
READ_WARNING = "DeepBot will call this tool without asking, and may pass text from your files to it. Use Read only for tools that do not change anything."
CHANGED_TEXT = "Your agent's tools changed. Review them before DeepBot can use them."
WAIT_SIGNED = "document.querySelector('#session-status')?.dataset.state === 'ok'"
DOC_SNIPPET = re.search(r"### Verifying a delivery.*?```js\n(.*?)\n```", (ROOT / "docs/toolkit-v4-api.md").read_text(), re.S).group(1)
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
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())


def calls(action):
    with urllib.request.urlopen(BASE + "/fixture/calls", timeout=10) as r:
        return [c.get("payload") for c in json.loads(r.read().decode())["calls"] if c["action"] == action]


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok  " + msg)


def probe(page, name):
    """The visual-verify machine pass, the dash count, and an element rect walk for overflow."""
    if audit:
        fails = [f for f in page.evaluate(audit.PROBE) if f["severity"] == "FAIL"]
        findings.append({"capture": name, "fails": fails})
        check(not fails, f"{name}: audit.py has no FAIL ({fails[:3]})")
    check(page.evaluate("!/[\\u2013\\u2014]/.test(document.body.innerText)"), f"{name}: no em or en dash in visible text")
    over = page.evaluate("""() => [...document.querySelectorAll('.window-body *')].filter(e => {
      if (e.closest('pre,.table-scroll,[hidden]') || !e.getClientRects().length || !e.checkVisibility()) return false;
      const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.tagName + '.' + e.className)""")
    check(not over, f"{name}: nothing in the window runs past the viewport {over[:5]}")


def shot(page, name):
    path = OUT / f"{name}.png"
    page.locator('.window[data-app="myagent"]').screenshot(path=str(path))
    print("  shot " + str(path))


def open_agent(page):
    page.goto(APP)
    page.wait_for_function(WAIT_SIGNED)
    page.locator('[data-launch="myagent"]').click()
    w = page.locator('.window[data-app="myagent"]')
    w.locator('[role="tablist"]').wait_for()
    return w


def modes(w):
    return w.locator(".agent-tool").evaluate_all("rs => Object.fromEntries(rs.map(r => [r.dataset.tool, r.querySelector('input:checked')?.value]))")


def tool(w, name):
    return w.locator(f'.agent-tool[data-tool="{name}"]')


def pick(w, name, label):
    tool(w, name).locator(".seg-opt", has_text=re.compile("^" + label + "$")).click()


def chip(w):
    c = w.locator(".state-chip")
    return c.get_attribute("data-state"), c.inner_text(), w.locator(".chip-note").inner_text()


def secret_free(page):
    """No full secret anywhere; the only whsec_ text left is the docs comment inside the verify snippet."""
    return page.evaluate("""() => {
      const html = document.documentElement.outerHTML, store = JSON.stringify({...localStorage}) + JSON.stringify({...sessionStorage}) + location.href + document.cookie;
      const clone = document.documentElement.cloneNode(true); clone.querySelectorAll('pre.snippet-code').forEach(p => p.remove());
      return {full: /whsec_[A-Za-z0-9_-]{43}/.test(html), outsideSnippet: clone.outerHTML.includes('whsec_'), storage: store.includes('whsec_')};
    }""")


def flows(page, ctx, dialogs):
    post("/fixture/reset")
    w = open_agent(page)
    state, word, note = chip(w)
    check(state == "off" and word == "Not connected", f"empty state chip is grey Not connected ({state}, {word})")
    check(w.get_by_text("No tools yet. Save your server URL to list them.").is_visible(), "empty tool list says how to start")
    check(w.get_by_role("tab", name="MCP server").get_attribute("aria-selected") == "true", "MCP server tab is open first")
    probe(page, "empty-1440")
    shot(page, "empty-1440")

    # ---- client URL check mirrors the server's message, nothing posted ----
    url, tok = w.get_by_label("Server URL, https only"), w.get_by_label("Bearer token, optional. Saving replaces the saved one.")
    check(tok.get_attribute("type") == "password", "token field is a password field")
    for bad in ("http://agent.example.com/mcp", "https://agent.example.com:8443/mcp", "https://user:pw@agent.example.com/", "https://127.0.0.1/mcp", "https://localhost/mcp", "not a url"):
        url.fill(bad)
        w.get_by_role("button", name="Save and list tools").click()
        state, _, note = chip(w)
        check(state == "error" and note == URL_NOT_ALLOWED, f"client check refuses {bad!r} with the server's message")
    check(not calls("agent_connect"), "no agent_connect was posted for a refused URL")
    shot(page, "url-error-1440")

    # ---- connect ----
    url.fill("https://agent.example.com/mcp")
    tok.fill(TOKEN)
    w.get_by_role("button", name="Save and list tools").click()
    w.locator(".agent-tool").nth(2).wait_for()
    state, word, note = chip(w)
    check(state == "connected" and word == "Connected", "connected chip is green Connected")
    check(note == "Nothing is approved yet. Choose a mode for each tool and save.", "pending connection says nothing is approved")
    check(calls("agent_connect")[-1] == {"action": "agent_connect", "url": "https://agent.example.com/mcp"} and tok.input_value() == "", "agent_connect posted the URL (token kept out of the fixture log) and the token field is cleared")
    check(w.locator("[data-panel=mcp] .key-hint").inner_text() == "Saved token: fixture-****rstu", "token shows only as the server's masked value")
    check(TOKEN not in page.content(), "the token text is nowhere in the DOM after save")
    check(modes(w) == {"search_notes": "off", "create_ticket": "off", "weather_lookup": "off"}, "every tool defaults to Off")
    desc = tool(w, "weather_lookup").locator(".tool-desc")
    text = desc.evaluate("d => d.textContent")
    check(text.startswith("<script>window.__agentPwned=1</script><b>Reads</b> the weather.") and len(text) <= 300, f"a description with <script> renders literally, capped at 300 ({len(text)} chars)")
    check(w.locator(".agent-tools script, .agent-tools b").count() == 0 and page.evaluate("window.__agentPwned") is None and not dialogs, "no script or b element and nothing ran")
    check(tool(w, "search_notes").locator(".tool-hint").count() == 1, "a read only hint is shown as the agent's claim")
    check(tool(w, "weather_lookup").locator(".tool-hint").inner_text() == "Your agent's description may go on. The toolkit shows its first 300 characters.", "a 300 character description says it may be cut")

    # ---- Read warning once per tool, Ask me ----
    pick(w, "search_notes", "Read")
    warn = tool(w, "search_notes").locator(".read-warning")
    check(warn.count() == 1 and warn.inner_text() == READ_WARNING, "choosing Read shows the warning")
    pick(w, "search_notes", "Off")
    pick(w, "search_notes", "Read")
    check(warn.count() == 1, "the Read warning shows once per tool, not again")
    pick(w, "create_ticket", "Ask me")
    check(tool(w, "create_ticket").locator(".read-warning").count() == 0, "Ask me shows no Read warning")
    shot(page, "modes-picked-1440")
    w.get_by_role("button", name="Save tool modes").click()
    w.locator("[data-panel=mcp] .msg .notice").wait_for()
    saved = w.locator("[data-panel=mcp] .msg .notice").inner_text()
    check(saved.startswith("Saved. Read: 1. Ask me: 1. Off: 1.") and "Approvals" in saved, f"save reports the counts and where Ask me calls wait ({saved!r})")
    check(calls("agent_tools_set")[-1]["tools"] == {"search_notes": "read", "create_ticket": "ask", "weather_lookup": "off"}, "agent_tools_set posted the three modes")
    state, _, note = chip(w)
    check(state == "connected" and note == "DeepBot can use the tools you set to Read or Ask me.", "active connection chip")
    probe(page, "saved-1440")
    shot(page, "saved-1440")

    # ---- reload: modes persist ----
    w = open_agent(page)
    w.locator(".agent-tool").nth(2).wait_for()
    check(modes(w) == {"search_notes": "read", "create_ticket": "ask", "weather_lookup": "off"}, "after reload the modes are read back from the server")
    check(w.get_by_label("Server URL, https only").input_value() == "https://agent.example.com/mcp" and w.locator("[data-panel=mcp] .key-hint").inner_text() == "Saved token: fixture-****rstu", "after reload the URL and masked token are shown")

    # ---- the agent changes its tools: a save gets 409, amber chip, every control Off ----
    post("/fixture/agent", {"changed": 1})
    w.get_by_role("button", name="Save tool modes").click()
    w.locator('.state-chip[data-state="changed"]').wait_for()
    state, word, note = chip(w)
    check(word == "Tools changed" and note == CHANGED_TEXT, "a changed list shows the amber chip with the review line")
    check(w.locator(".state-chip").evaluate("c => getComputedStyle(c).color") == "rgb(201, 168, 76)", "the changed chip is amber")
    check(modes(w) == {"search_notes": "off", "create_ticket": "off", "weather_lookup": "off"}, "every control resets to Off until saved")
    check(w.locator("[data-panel=mcp] .msg .notice.warn").inner_text() == CHANGED_TEXT, "the same line shows beside Save tool modes")
    check(tool(w, "create_ticket").locator(".tool-desc").inner_text() == "Opens a ticket and also emails your whole team.", "the new description is shown for review")
    probe(page, "changed-1440")
    shot(page, "changed-1440")
    w = open_agent(page)
    w.locator('.state-chip[data-state="changed"]').wait_for()
    check(modes(w) == {"search_notes": "off", "create_ticket": "off", "weather_lookup": "off"}, "a reload keeps the changed state and every tool Off")
    pick(w, "search_notes", "Read")
    w.get_by_role("button", name="Save tool modes").click()
    w.locator('.state-chip[data-state="connected"]').wait_for()
    check(modes(w)["search_notes"] == "read", "saving again approves the new list")

    # ---- provider timeout ----
    post("/fixture/agent", {"mode": "timeout"})
    w.get_by_role("button", name="Test").click()
    w.locator('.state-chip[data-state="error"]').wait_for()
    check(chip(w)[2] == "Your agent did not answer in time.", "timeout reads: Your agent did not answer in time.")
    check(w.get_by_text("Tools did not load. Press Test to try again.").is_visible(), "the tool list says how to retry")
    shot(page, "timeout-1440")
    post("/fixture/agent", {"mode": "ok"})
    w.get_by_role("button", name="Test").click()
    w.locator('.state-chip[data-state="connected"]').wait_for()
    check(w.locator(".agent-tool").count() == 3, "Test after the timeout recovers the list")

    # ---- webhooks: secret reveal once ----
    w.get_by_role("tab", name="Webhooks").click()
    hooks = w.locator('[data-panel="hooks"]')
    check(hooks.get_by_text("Set a webhook to see deliveries here.").is_visible(), "empty delivery log")
    hooks.get_by_label("Webhook URL, https only").fill("https://agent.example.com/hooks")
    hooks.get_by_label("job.completed").uncheck()
    hooks.get_by_role("button", name="Save webhook").click()
    reveal = hooks.locator(".secret-reveal")
    reveal.wait_for()
    secret = reveal.locator(".secret-value").inner_text()
    check(SECRET.fullmatch(secret) is not None, "the secret is shown once in full")
    check(calls("webhook_set")[-1] == {"action": "webhook_set", "url": "https://agent.example.com/hooks", "events": ["staged.created", "staged.decided"]}, "webhook_set posted the URL and the two checked events")
    check("You will not see this again" in reveal.inner_text(), "the reveal says it will not be shown again")
    reveal.get_by_role("button", name="Copy").click()
    check(page.evaluate("navigator.clipboard.readText()") == secret, "Copy puts the secret on the clipboard")
    probe(page, "reveal-1440")
    shot(page, "reveal-1440")
    reveal.get_by_role("button", name="I saved it, close").click()
    left = secret_free(page)
    check(not left["full"] and not left["outsideSnippet"] and not left["storage"], f"after close no whsec_ in the DOM (outside the docs snippet), storage or URL {left}")
    check(hooks.locator(".key-hint").inner_text().startswith("Signing secret ends in " + secret[-4:]), "the secret is referred to by its last four characters only")
    hooks.get_by_role("button", name="Rotate secret").click()
    reveal.wait_for()
    second = reveal.locator(".secret-value").inner_text()
    check(SECRET.fullmatch(second) and second != secret, "Rotate shows a new secret once")
    reveal.get_by_role("button", name="I saved it, close").click()
    left = secret_free(page)
    check(not left["full"] and not left["outsideSnippet"] and not left["storage"], "after the rotate reveal closes, no whsec_ is left")

    # ---- delivery log and Resend ----
    post("/fixture/agent", {"deliveries": 1})
    hooks.get_by_role("button", name="Refresh log").click()
    hooks.locator(".table-scroll tbody tr").nth(2).wait_for()
    rows = hooks.locator(".table-scroll tbody tr").evaluate_all("rs => rs.map(r => [...r.cells].slice(0, 4).map(c => c.textContent))")
    check([r[0] for r in rows] == ["staged.created", "job.completed", "staged.decided"] and [r[2] for r in rows] == ["142 ms", "611 ms", "5000 ms"], f"log rows: event and ms {rows}")
    check([r[3] for r in rows] == ["3 min ago", "50 min ago", "1 day ago"], f"log ages {[r[3] for r in rows]}")
    chips = hooks.locator(".code-chip").evaluate_all("cs => cs.map(c => [c.textContent, c.dataset.ok, getComputedStyle(c).color])")
    check([c[:2] for c in chips] == [["200", "true"], ["500", "false"], ["timeout", "false"]], f"status chips: 2xx green, else red {chips}")
    check(chips[0][2] == "rgb(48, 224, 96)" and chips[1][2] == chips[2][2] == "rgb(243, 112, 80)", "chip colours are green and red")
    probe(page, "log-1440")
    shot(page, "log-1440")
    target = api({"action": "webhook_deliveries"})["deliveries"][1]["id"]
    hooks.get_by_role("button", name=re.compile("^Resend job.completed")).click()
    hooks.locator(".table-scroll tbody tr").nth(3).wait_for()
    check(calls("webhook_resend")[-1] == {"action": "webhook_resend", "delivery_id": target}, "Resend posts webhook_resend with that delivery id")
    check(hooks.locator(".msg .notice").inner_text() == "Sent job.completed again: 200.", "Resend says what happened")

    # ---- verify snippet ----
    w.get_by_role("tab", name="Verify deliveries").click()
    pre = w.locator("pre.snippet-code")
    check(pre.evaluate("p => p.textContent") == DOC_SNIPPET, "the snippet is the docs section 12 block, verbatim")
    w.get_by_role("button", name="Copy code").click()
    check(page.evaluate("navigator.clipboard.readText()") == DOC_SNIPPET, "Copy code copies the snippet")
    probe(page, "verify-1440")
    shot(page, "verify-1440")

    # ---- loading and error states ----
    page.get_by_role("button", name="Close My agent").click()

    def slow(route):
        if json.loads(route.request.post_data or "{}").get("action") == "agent_status":
            time.sleep(1.5)
        route.continue_()
    page.route("**/api/toolkit", slow)
    page.locator('[data-launch="myagent"]').click()
    w.get_by_text("Loading your agent connection...").wait_for()
    shot(page, "loading-1440")
    w.locator('[role="tablist"]').wait_for()
    page.unroute("**/api/toolkit")
    page.get_by_role("button", name="Close My agent").click()
    page.route("**/api/toolkit", lambda r: r.fulfill(status=500, content_type="application/json", body=json.dumps({"error": "server_error", "message": "The toolkit had a problem. Try again in a minute."}))
               if json.loads(r.request.post_data or "{}").get("action") == "agent_status" else r.continue_())
    page.locator('[data-launch="myagent"]').click()
    w.locator(".notice.bad").wait_for()
    check(w.locator(".notice.bad").inner_text().startswith("My agent did not load: The toolkit had a problem. Try again in a minute."), "error state names the problem")
    shot(page, "error-1440")
    page.unroute("**/api/toolkit")
    w.get_by_role("button", name="Try again").click()
    w.locator('[role="tablist"]').wait_for()
    check(w.locator(".notice.bad").count() == 0, "Try again that succeeds clears the error")


def seed_full():
    post("/fixture/reset")
    c = api({"action": "agent_connect", "url": "https://agent.example.com/mcp", "token": TOKEN})
    api({"action": "agent_tools_set", "connection_id": c["connection_id"], "tools": {"search_notes": "read", "create_ticket": "ask"}})
    api({"action": "webhook_set", "url": "https://agent.example.com/hooks", "events": ["staged.created", "staged.decided", "job.completed"]})
    post("/fixture/agent", {"deliveries": 1})


def shoot_widths(browser):
    for width, height in ((390, 844), (820, 1180), (1440, 900)):
        ctx = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce", device_scale_factor=2,
                                  is_mobile=width < 700, has_touch=width < 700)
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        seed_full()
        w = open_agent(page)
        w.locator(".agent-tool").nth(2).wait_for()
        pick(w, "weather_lookup", "Read")
        probe(page, f"mcp-{width}")
        shot(page, f"mcp-{width}")
        w.locator('.agent-tool[data-tool="weather_lookup"]').scroll_into_view_if_needed()
        shot(page, f"mcp-{width}-tools")
        w.get_by_role("tab", name="Webhooks").click()
        w.locator(".table-scroll").wait_for()
        probe(page, f"hooks-{width}")
        shot(page, f"hooks-{width}")
        w.get_by_role("button", name="Rotate secret").click()
        w.locator(".secret-reveal").wait_for()
        probe(page, f"reveal-{width}")
        shot(page, f"reveal-{width}")
        w.get_by_role("button", name="I saved it, close").click()
        w.locator(".table-scroll").scroll_into_view_if_needed()
        shot(page, f"hooks-{width}-log")
        w.get_by_role("tab", name="Verify deliveries").click()
        probe(page, f"verify-{width}")
        shot(page, f"verify-{width}")
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
            errors, dialogs = [], []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
            print("flows at 1440")
            flows(page, ctx, dialogs)
            # the timeout (502), the 409 tools_changed and the error-state (500) probes answer with those statuses on purpose
            bad = [e for e in errors if not re.match(r"Failed to load resource: the server responded with a status of (409|500|502)", e)]
            check(not bad, f"console has no errors {bad}")
            ctx.close()
            print("responsive 390, 820, 1440")
            shoot_widths(browser)
            browser.close()
        (OUT / "audit.json").write_text(json.dumps(findings, indent=2))
        print("my agent flows: all checks passed")
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
