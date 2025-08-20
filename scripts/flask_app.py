from flask import Flask, jsonify, render_template
import sqlite3
import subprocess
import os

app = Flask(__name__)
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

# Ensure DB & table exist
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

# Start staggered_ttfb.py in background
script_path = os.path.join(os.path.dirname(__file__), "staggered_ttfb..py")
subprocess.Popen(["python", script_path])

# Home page
@app.route("/")
def home():
    return render_template("index.html", websites=websites)

# API route for latest 50 measurements per site
@app.route("/api/data/<path:site>")
def data(site):
    # site now includes full URL (slashes and colon)
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT timestamp, ttfb, loading_delay
        FROM measurements
        WHERE website = ?
        ORDER BY timestamp DESC
        LIMIT 50
    """, (site,))
    rows = cursor.fetchall()
    conn.close()
    rows.reverse()  # oldest first
    return jsonify([
        {"time": t, "ttfb": ttfb, "loading_delay": load}
        for t, ttfb, load in rows
    ])

if __name__ == "__main__":
    app.run(debug=True)
