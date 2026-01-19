#!/usr/bin/env python3
import os
import sys
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


ROOT = Path(__file__).resolve().parents[1]
EXTENSION_NAME = "Fiverr Conversation Extractor"


def get_extension_path():
    return Path(os.environ.get("EXTENSION_PATH", ROOT)).resolve()


def is_headless():
    return os.environ.get("HEADLESS", "1") != "0"


def configure_options(extension_path):
    options = webdriver.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument(f"--disable-extensions-except={extension_path}")
    options.add_argument(f"--load-extension={extension_path}")

    if is_headless():
        options.add_argument("--headless=new")

    chrome_binary = os.environ.get("CHROME_BINARY")
    if chrome_binary:
        options.binary_location = chrome_binary

    return options


def fetch_extension_names(driver):
    script = """
        const manager = document.querySelector('extensions-manager');
        if (!manager || !manager.shadowRoot) return [];
        const list = manager.shadowRoot.querySelector('extensions-item-list');
        if (!list || !list.shadowRoot) return [];
        const items = list.shadowRoot.querySelectorAll('extensions-item');
        return Array.from(items).map(item => {
            if (!item.shadowRoot) return '';
            const nameEl = item.shadowRoot.querySelector('#name');
            return nameEl ? nameEl.textContent.trim() : '';
        });
    """
    return driver.execute_script(script)


def main():
    extension_path = get_extension_path()
    manifest_path = extension_path / "manifest.json"
    if not manifest_path.is_file():
        print(f"ERROR: manifest.json not found at {manifest_path}")
        return 1

    options = configure_options(extension_path)
    service = Service(ChromeDriverManager().install())
    driver = None

    try:
        driver = webdriver.Chrome(service=service, options=options)
        driver.get("chrome://extensions/")

        WebDriverWait(driver, 15).until(
            lambda d: d.execute_script("return !!document.querySelector('extensions-manager');")
        )

        names = fetch_extension_names(driver)
        if EXTENSION_NAME not in names:
            print("ERROR: Extension not found on chrome://extensions/.")
            print(f"Found extensions: {names}")
            return 1

        print("Selenium smoke test passed.")
        return 0
    except Exception as exc:
        print(f"ERROR: Selenium smoke test failed: {exc}")
        return 1
    finally:
        if driver is not None:
            driver.quit()


if __name__ == "__main__":
    sys.exit(main())
