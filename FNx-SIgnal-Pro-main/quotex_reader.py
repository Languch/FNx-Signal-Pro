import os
import re
import time
import socket
import shutil
import subprocess
import threading
from flask import Flask, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    WebDriverException,
)

# =========================================================================
# ⚙️ QUOTEX URL & DOM SELECTORS
# =========================================================================
QUOTEX_URL = "https://qxbroker.com/en/demo-trade"
DEBUG_PORT = 9222
PROFILE_DIR = os.path.join(os.getcwd(), "quotex_chrome_profile")

ASSET_SELECTORS = [
    ".tab.active .label",
    ".pair-number-wrap .pair",
    ".asset-select__button-name",
    "[class*='tab'][class*='active'] [class*='label']",
    "[class*='asset-name']",
]

PRICE_SELECTORS = [
    ".trading-chart__price",
    ".chart-item__price",
    ".price-line__value",
    "[class*='current-price']",
    "[class*='price-value']",
    "text.price-label",
]

live_state = {
    "asset": "WAITING...",
    "price": 0.0,
    "status": "connecting",
    "timestamp": int(time.time() * 1000),
}
state_lock = threading.Lock()

app = Flask(__name__)
CORS(app)


@app.route("/api/live-price", methods=["GET"])
def get_live_price():
    with state_lock:
        return jsonify(live_state)


def extract_numeric_price(text: str):
    if not text:
        return None
    cleaned = text.replace(",", "").strip()
    match = re.search(r"[-+]?\d*\.\d+|\d+", cleaned)
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def is_port_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except OSError:
        return False


def find_chrome_executable():
    possible_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        shutil.which("chrome"),
        shutil.which("google-chrome"),
    ]
    for path in possible_paths:
        if path and os.path.exists(path):
            return path
    return None


def launch_real_chrome():
    if is_port_open(DEBUG_PORT):
        print("[CHROME] ইতিমধ্যেই রিয়েল Chrome (Port 9222) চালু আছে, সংযুক্ত হচ্ছে...")
        return True

    chrome_exe = find_chrome_executable()
    if not chrome_exe:
        print("[ERROR] Google Chrome খুঁজে পাওয়া যায়নি!")
        return False

    os.makedirs(PROFILE_DIR, exist_ok=True)
    print("[CHROME] ১০০% রিয়েল Google Chrome চালু হচ্ছে (No Cloudflare Loop)...")

    subprocess.Popen([
        chrome_exe,
        f"--remote-debugging-port={DEBUG_PORT}",
        f"--user-data-dir={PROFILE_DIR}",
        "--no-first-run",
        "--no-default-browser-check",
        QUOTEX_URL,
    ])

    # Wait until port 9222 is ready
    for _ in range(15):
        if is_port_open(DEBUG_PORT):
            return True
        time.sleep(1)

    return False


def scrape_quotex_loop():
    global live_state

    if not launch_real_chrome():
        with state_lock:
            live_state["status"] = "browser_error"
        return

    driver = None
    try:
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", f"127.0.0.1:{DEBUG_PORT}")
        driver = webdriver.Chrome(options=chrome_options)
        print("[SELENIUM] রিয়েল Chrome এর সাথে সংযোগ সফল হয়েছে! Quotex-এ লগইন করে চার্ট ওপেন করুন।")
    except Exception as e:
        print(f"[SELENIUM ERROR] Chrome-এ যুক্ত হতে সমস্যা হয়েছে: {e}")
        with state_lock:
            live_state["status"] = "browser_error"
        return

    while True:
        try:
            # Always inspect the active/latest open tab
            if len(driver.window_handles) > 0:
                driver.switch_to.window(driver.window_handles[-1])

            found_asset = None
            found_price = None

            # 1. Active Asset Name Read
            for selector in ASSET_SELECTORS:
                try:
                    el = driver.find_element(By.CSS_SELECTOR, selector)
                    txt = el.text.strip()
                    if txt and len(txt) >= 3:
                        found_asset = txt
                        break
                except (NoSuchElementException, StaleElementReferenceException):
                    continue

            # 2. Live Price DOM Element Read
            for selector in PRICE_SELECTORS:
                try:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    for el in elements:
                        parsed = extract_numeric_price(el.text)
                        if parsed is not None and parsed > 0:
                            found_price = parsed
                            break
                    if found_price is not None:
                        break
                except (NoSuchElementException, StaleElementReferenceException):
                    continue

            with state_lock:
                if found_price is not None:
                    live_state["asset"] = found_asset if found_asset else live_state["asset"]
                    live_state["price"] = found_price
                    live_state["status"] = "live"
                    live_state["timestamp"] = int(time.time() * 1000)
                else:
                    live_state["status"] = "waiting_for_chart"
                    live_state["timestamp"] = int(time.time() * 1000)

        except WebDriverException:
            with state_lock:
                live_state["status"] = "disconnected"
            print("[SELENIUM] Browser বন্ধ হয়ে গেছে।")
            break
        except Exception as e:
            with state_lock:
                live_state["status"] = "error"
            print(f"[SELENIUM] Loop warning: {e}")

        time.sleep(0.5)


if __name__ == "__main__":
    scraper_thread = threading.Thread(target=scrape_quotex_loop, daemon=True)
    scraper_thread.start()
    print("[FLASK] API চালু হয়েছে: http://localhost:5000/api/live-price")
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)