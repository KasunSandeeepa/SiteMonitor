import httpx
import time
from datetime import datetime
import sqlite3
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

DB_FILE = "sitemonitor.db"

websites = [
    "https://www.google.com",
    "https://www.youtube.com",
    "https://www.facebook.com",
    "https://www.instagram.com",
    "https://chat.openai.com",
    "https://www.x.com",
    "https://www.reddit.com",
    "https://www.whatsapp.com",
    "https://www.bing.com",
    "https://www.wikipedia.org"
]

interval_minutes = 10  # repeat every 10 minutes

# Ensure table exists
conn = sqlite3.connect(DB_FILE)
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website TEXT,
    timestamp DATETIME,
    ttfb REAL,
    loading_delay REAL
)
""")
conn.commit()
conn.close()

# Insert small seed data for testing charts immediately
conn = sqlite3.connect(DB_FILE)
cursor = conn.cursor()
for site in websites:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO measurements (website, timestamp, ttfb, loading_delay)
        VALUES (?, ?, ?, ?)
    """, (site, now, 0.5, 1.0))
conn.commit()
conn.close()

# Setup Selenium
chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
driver = webdriver.Chrome(options=chrome_options)

while True:
    for i, website in enumerate(websites):
        try:
            # TTFB measurement
            with httpx.Client(timeout=30.0) as client:
                start_time = time.time()
                response = client.get(website)
                ttfb = response.elapsed.total_seconds()

            # Full page load
            start_load = time.time()
            driver.get(website)
            driver.execute_script("return document.readyState")
            loading_delay = time.time() - start_load

            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"{now} - {website} | TTFB: {ttfb:.3f}s | Load: {loading_delay:.3f}s")

            # Save to DB
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO measurements (website, timestamp, ttfb, loading_delay)
                VALUES (?, ?, ?, ?)
            """, (website, now, ttfb, loading_delay))
            conn.commit()
            conn.close()

        except Exception as e:
            print(f"Error with {website}: {e}")

        # Wait 1 minute between sites
        if i != len(websites) - 1:
            time.sleep(60)

    # Wait until next round
    time.sleep(interval_minutes * 60 - 60 * (len(websites) - 1))
