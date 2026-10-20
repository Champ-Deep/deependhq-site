#!/usr/bin/env python3
"""Browser flows for lead-scorer.html and account.html.

Every network response comes from tests/fixture_server.py: fixture config,
fixture API payloads and a fixture Clerk script on the same origin. No
production data, no live keys, no provider calls.

    python3 tests/fixture_server.py --port 8791 &
    python3 tests/browser_flows.py

Writes screenshots to $VERIFY_DIR (default
/Users/deep/.hermes/cache/scratch/lead-scorer-verify) and exits non zero on
the first failed assertion.
"""

import os
import subprocess
import sys
import time
import urllib.request
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("FIXTURE_PORT", "8791"))
BASE = "http://127.0.0.1:%d" % PORT
OUT = Path(os.environ.get("VERIFY_DIR", "/Users/deep/.hermes/cache/scratch/lead-scorer-verify"))
CSV = ROOT / "tests" / "fixtures" / "leads.csv"

console_errors = []
server = None


def fixture(path, payload=None):
    data = json.dumps(payload if payload is not None else {}).encode()
    req = urllib.request.Request(BASE + path, data=data,
                                 headers={"Content-Type": "application/json"},
                                 method="POST" if payload is not None or path.endswith(
                                     ("reset", "delay", "config")) else "GET")
    if path.endswith("/calls"):
        req = urllib.request.Request(BASE + path, method="GET")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())


def calls():
    return fixture("/fixture/calls")["calls"]


def start_server():
    proc = subprocess.Popen(
        [sys.executable, str(ROOT / "tests" / "fixture_server.py"), "--port", str(PORT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
    )
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE + "/fixture/calls", timeout=1).read()
            return proc
        except Exception:
            time.sleep(0.25)
    proc.terminate()
    raise SystemExit("fixture server did not come up on port %d" % PORT)


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok  " + msg)


def shot(page, name):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    page.screenshot(path=str(path), full_page=False)
    print("  shot " + str(path))
    return path


def fill_brief(page):
    page.fill("#sell", "Fixture data infrastructure for logistics teams.")
    page.fill("#want", "VP Operations and CTOs at mid sized logistics companies.")


def attach(page):
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append("pageerror: %s" % e))


def main():
    global server
    OUT.mkdir(parents=True, exist_ok=True)
    server = start_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1440, "height": 960},
                                      device_scale_factor=2)
            page = ctx.new_page()
            attach(page)

            flow_signed_out(page)
            flow_sign_in_and_quote(page)
            flow_run_and_export(page)
            flow_filter(page)
            flow_cancel(page)
            flow_history_and_usage(page)
            flow_account(page)
            flow_setup_needed(page)
            flow_mobile(page)

            if console_errors:
                raise AssertionError("console errors: %s" % console_errors[:5])
            print("\nALL FLOWS PASSED. screenshots in " + str(OUT))
            browser.close()
    finally:
        if server:
            server.terminate()


def flow_signed_out(page):
    print("flow: signed out upload and mapping")
    page.goto(BASE + "/lead-scorer")
    page.wait_for_selector("#stage-drop")
    page.evaluate("sessionStorage.setItem('fixture_signed_out','1')")
    page.reload()
    page.wait_for_selector("#signin", state="visible")
    check(page.is_hidden("#wallet"), "wallet hidden while signed out")
    page.set_input_files("#file", str(CSV))
    page.wait_for_selector("#mapgrid select")
    check(page.locator("#mapgrid select").count() == 6, "six mapping selects render")
    check(page.input_value("#map-name") == "Full Name", "name column auto mapped")
    check(page.inner_text("#frows") == "12", "12 rows loaded from the CSV fixture")
    check(page.locator("#preview tbody tr").count() == 5, "preview shows 5 mapped rows")
    check(page.is_disabled("#run-btn"), "run disabled before any quote")
    page.click("#quote-btn")
    check("Sign in" in page.inner_text("#approve-err"), "quote asks for sign in")
    shot(page, "lead-signed-out-1440.png")


def flow_sign_in_and_quote(page):
    print("flow: sign in and quote")
    page.click("#signin")
    page.wait_for_function(
        "() => document.getElementById('wallet-credits').textContent.trim() === '4,800'",
        timeout=8000)
    check(page.is_visible("#wallet"), "wallet visible after sign in")
    page.fill("#listname", "Fixture flow list")
    fill_brief(page)
    page.click("#quote-btn")
    page.wait_for_function(
        "() => document.querySelector('#quote-docket').textContent.includes('Maximum authorized')",
        timeout=15000)
    q = [c for c in calls() if c["action"] == "quote"]
    check(len(q) == 3, "one quote per batch of five, got %d" % len(q))
    check(all(x["rows"] <= 5 for x in q), "every quote is at most 5 rows")
    docket = page.inner_text("#quote-docket")
    check("12 in 3 batches" in docket, "docket counts rows and batches")
    check("$0.2220" in docket, "docket total is the summed ceiling, got docket total line")
    check("222 credits" in docket, "docket converts the ceiling to credits")
    check("Run 12 rows" in page.inner_text("#run-btn"), "run button carries row count")
    shot(page, "lead-quote-1440.png")


def flow_run_and_export(page):
    print("flow: sequential batched run, results, export")
    fixture("/fixture/reset", {})
    page.reload()
    page.wait_for_selector("#stage-drop")
    page.set_input_files("#file", str(CSV))
    page.wait_for_selector("#mapgrid select")
    fill_brief(page)
    page.click("#quote-btn")
    page.wait_for_function(
        "() => document.getElementById('run-btn').textContent.includes('Run 12 rows')",
        timeout=15000)
    page.click("#run-btn")
    page.wait_for_function(
        "() => document.querySelectorAll('#results-table tbody tr').length === 12",
        timeout=20000)
    runs = [c for c in calls() if c["action"] == "run"]
    check(len(runs) == 3, "three run calls for 12 rows, got %d" % len(runs))
    check([r["rows"] for r in runs] == [5, 5, 2], "sequential batches of five, five, two")
    ids = [r["request_id"] for r in runs]
    check(len(set(ids)) == 3, "fresh request id per batch")
    check(page.inner_text("#c-spent") == "$0.2220", "actual spend tile sums settled microdollars")
    check(page.inner_text("#c-max") == "$0.2220", "max authorized tile shows the quoted ceiling")
    check(page.is_visible("#ledger"), "provider ledger visible")
    check("Done" in page.inner_text("#run-status"), "run status reports done")
    check(page.is_disabled("#run-btn"), "run disabled after the session, re-quote required")
    shot(page, "lead-results-1440.png")

    with page.expect_download() as dl:
        page.click("#export-csv")
    text = Path(dl.value.path()).read_text()
    head = text.splitlines()[0]
    check("email_status" in head and "icp_fit" in head, "export header carries result columns")
    check("'=HYPERLINK(" in text, "formula cell exported with the safety prefix")
    check("Fixtures" in text, "export keeps uploaded columns")


def flow_filter(page):
    print("flow: results filter")
    page.fill("#filter-q", "Fixture Lead Ten")
    page.wait_for_function(
        "() => document.querySelectorAll('#results-table tbody tr').length === 1")
    check(True, "search narrows to one row")
    page.fill("#filter-q", "")
    page.select_option("#filter-email", "undeliverable")
    n = page.locator("#results-table tbody tr").count()
    check(1 <= n < 12, "email filter narrows the set, got %d" % n)
    page.select_option("#filter-email", "")
    page.wait_for_function(
        "() => document.querySelectorAll('#results-table tbody tr').length === 12")


def flow_cancel(page):
    print("flow: cancel between batches")
    fixture("/fixture/reset", {})
    page.evaluate("sessionStorage.removeItem('fixture_signed_out')")
    page.reload()
    page.wait_for_selector("#stage-drop")
    page.set_input_files("#file", str(CSV))
    page.wait_for_selector("#mapgrid select")
    fill_brief(page)
    page.click("#quote-btn")
    page.wait_for_function(
        "() => document.getElementById('run-btn').textContent.includes('Run 12 rows')",
        timeout=15000)
    fixture("/fixture/delay", {"ms": 600})
    page.click("#run-btn")
    page.wait_for_selector("#cancel-btn", state="visible")
    page.click("#cancel-btn")
    page.wait_for_function(
        "() => document.getElementById('run-status').textContent.includes('Stopped between batches')",
        timeout=10000)
    runs = [c for c in calls() if c["action"] == "run"]
    check(len(runs) == 1, "stop takes effect between batches, only one run sent, got %d" % len(runs))
    check(page.locator("#results-table tbody tr").count() == 5,
          "the completed batch still renders its five rows")
    check(page.is_disabled("#run-btn"), "run locked until a fresh quote")
    check("Stop after this batch" in page.inner_text("#cancel-btn") or
          page.is_hidden("#cancel-btn"), "cancel control retired after the stop")
    fixture("/fixture/delay", {"ms": 0})
    shot(page, "lead-cancel-1440.png")


def flow_history_and_usage(page):
    print("flow: history and usage tabs")
    page.click("#tab-history")
    page.wait_for_selector(".hrow")
    check(page.locator(".hrow").count() == 3, "history lists the three fixture runs")
    shot(page, "lead-history-1440.png")
    page.locator(".hrow button", has_text="Open").first.click()
    page.wait_for_function(
        "() => document.getElementById('results-h').textContent.includes('run ')")
    page.wait_for_function(
        "() => document.querySelectorAll('#results-table tbody tr').length === 3")
    check(True, "run_detail opens in the call sheet")
    page.click("#tab-usage")
    page.wait_for_function(
        "() => document.getElementById('u-available').textContent.trim() === '4,800'")
    check(page.locator("#u-providers .chip").count() == 2, "provider chips render")
    check(page.is_visible("#u-credit-meter"), "credit cap meter renders")
    shot(page, "lead-usage-1440.png")


def flow_account(page):
    print("flow: account balance, native mounts, admin caps")
    page.goto(BASE + "/account")
    page.wait_for_function(
        "() => document.getElementById('b-available').textContent.trim() === '4,800'",
        timeout=8000)
    check(page.locator("[data-fixture=pricing]").count() == 1, "PricingTable mounted")
    check(page.is_visible("[data-fixture=pricing]"), "PricingTable visible")
    check(page.locator("[data-fixture=user]").count() == 1, "UserButton mounted")
    check(page.is_visible("#admin"), "admin panel visible for the fixture admin")
    check(page.locator("#users-table tbody tr").count() == 3, "admin lists three fixture users")

    row = page.locator("#users-table tbody tr").first
    cap = row.locator("input[type=number]").first
    cap.fill("777")
    row.locator("button", has_text="Save").click()
    page.wait_for_function(
        "() => document.getElementById('admin-status').textContent.includes('read the values back')",
        timeout=8000)
    check(page.locator("#users-table tbody tr").first.locator(
        "input[type=number]").first.input_value() == "777", "user cap read back after save")
    admin_calls = [c for c in calls() if c["action"] == "admin_update"]
    check(admin_calls and admin_calls[-1]["payload"].get("daily_credit_cap") == 777,
          "admin_update carried the new user cap")

    page.fill("#g-welcome", "123")
    page.click("#g-save")
    page.wait_for_function(
        "() => document.getElementById('admin-status').textContent.includes('Global limits saved')",
        timeout=8000)
    admin_calls = [c for c in calls() if c["action"] == "admin_update"]
    check(admin_calls[-1]["payload"].get("welcome_credits") == 123,
          "admin_update carried the global welcome credits")
    shot(page, "account-1440.png")
    page.set_viewport_size({"width": 390, "height": 844})
    shot(page, "account-390.png")
    page.set_viewport_size({"width": 1440, "height": 960})


def flow_setup_needed(page):
    print("flow: setup needed state")
    fixture("/fixture/config", {"configured": 0})
    page.goto(BASE + "/lead-scorer")
    page.wait_for_selector("#setup-banner", state="visible")
    check(page.is_hidden("#signin"), "sign in hidden when backend is not configured")
    shot(page, "lead-setup-1440.png")
    fixture("/fixture/config", {"configured": 1})


def flow_mobile(page):
    print("flow: 390px workspace")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(BASE + "/lead-scorer")
    page.wait_for_selector("#stage-drop")
    page.set_input_files("#file", str(CSV))
    page.wait_for_selector("#mapgrid select")
    shot(page, "lead-mobile-390.png")
    page.set_viewport_size({"width": 1440, "height": 960})


if __name__ == "__main__":
    main()
