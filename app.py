from flask import Flask, jsonify, render_template
import sqlite3
from datetime import datetime, timedelta
import subprocess
import os

# Start staggered_ttfb.py in background
subprocess.Popen(["python", os.path.join(os.path.dirname(__file__), "staggered_ttfb..py")])

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

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/<period>")
def get_data(period):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    today = datetime.now().date()

    if period == "daily":
        today_str = today.strftime("%Y-%m-%d")
        query = """
            SELECT strftime('%H', timestamp) AS label, AVG(ttfb)
            FROM measurements
            WHERE website = ? AND date(timestamp) = ?
            GROUP BY label ORDER BY label
        """
        params = lambda site: (site, today_str)

    elif period == "weekly":
        week_ago = today - timedelta(days=6)
        query = """
            SELECT date(timestamp) AS label, AVG(ttfb)
            FROM measurements
            WHERE website = ? AND date(timestamp) BETWEEN ? AND ?
            GROUP BY label ORDER BY label
        """
        params = lambda site: (site, week_ago, today)

    elif period == "monthly":
        month_ago = today - timedelta(days=30)
        query = """
            SELECT date(timestamp) AS label, AVG(ttfb)
            FROM measurements
            WHERE website = ? AND date(timestamp) BETWEEN ? AND ?
            GROUP BY label ORDER BY label
        """
        params = lambda site: (site, month_ago, today)

    else:
        return jsonify({"error": "Invalid period"}), 400

    result = {}
    for site in websites:
        cursor.execute(query, params(site))
        rows = cursor.fetchall()
        result[site] = [{"label": label, "avg_ttfb": avg} for label, avg in rows]

    conn.close()
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)
