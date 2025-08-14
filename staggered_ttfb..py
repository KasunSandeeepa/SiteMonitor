import httpx
import time
from datetime import datetime
import sqlite3

# Create/connect database
conn = sqlite3.connect("sitemonitor.db")
cursor = conn.cursor()

# Create table
cursor.execute("""
CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website TEXT,
    timestamp TEXT,
    ttfb REAL
)
""")
conn.commit()
conn.close()


#ttfb finding script

websites = [
    "https://www.google.com",
    "https://www.youtube.com",
    "https://www.facebook.com",
    "https://www.instagram.com",
    "https://chat.openai.com",  # chatgpt.com redirects, better to use this
    "https://www.x.com",        # formerly twitter.com
    "https://www.reddit.com",
    "https://www.whatsapp.com",
    "https://www.bing.com",
    "https://www.wikipedia.org"
]

interval_minutes = 10  # check each site every 10 minutes

while True:
    for i, website in enumerate(websites):
        with httpx.Client() as client:
            response = client.get(website)
            ttfb = response.elapsed.total_seconds()
        
        now = datetime.now()
        print(f"{now.strftime('%Y-%m-%d %H:%M:%S')} - {website} TTFB: {ttfb:.3f} seconds")
        
        # After measuring TTFB
        conn = sqlite3.connect("sitemonitor.db")
        cursor = conn.cursor()

        cursor.execute("""
        INSERT INTO measurements (website, timestamp, ttfb)
        VALUES (?, ?, ?)
        """, (website, now.strftime('%Y-%m-%d %H:%M:%S'), ttfb))

        conn.commit()
        conn.close()

        
        # Stagger next website by 1 minute
        if i != len(websites) - 1:
            time.sleep(60)  # 1 minute delay between websites

    # Wait remaining time until the next 10-minute cycle
    time.sleep(interval_minutes * 60 - 60 * (len(websites) - 1))
