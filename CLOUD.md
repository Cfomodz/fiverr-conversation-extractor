## Cloud Testing Guide

### Prerequisites
- `python3` and `pip` available in the VM.
- Google Chrome installed (`google-chrome`).

### Install Selenium + Driver Manager
Run these once in the VM:
- `python3 -m pip install --upgrade pip`
- `python3 -m pip install selenium webdriver-manager`

### Offline Validation (No Browser)
- `python3 scripts/validate_extension.py`

### Selenium Smoke Test (Extension Loads)
This verifies the unpacked extension loads in Chrome and is listed in the extensions page.

- `python3 scripts/selenium_smoke_test.py`

Optional environment variables:
- `HEADLESS=0` to run with a visible browser (default is headless).
- `EXTENSION_PATH=/workspace` to override the extension path.
- `CHROME_BINARY=/usr/local/bin/google-chrome` if Chrome is in a custom location.

### Notes
- UI-level tests that require Fiverr data still need valid Fiverr credentials and a test account.
- Headless mode may not render extension UI; use `HEADLESS=0` for UI inspection.
