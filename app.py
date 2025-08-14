from flask import Flask, jsonify, render_template
import sqlite3
from datetime import datetime, timedelta

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


# Serve index.html
# ------------------------------
@app.route("/")
def home():
    return render_template("index.html")

# ------------------------------
# Daily averages (hourly)
# ------------------------------
@app.route("/api/daily")
def daily():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    today = datetime.now().strftime("%Y-%m-%d")
    result = {}

    for site in websites:
        cursor.execute("""
            SELECT strftime('%H', timestamp) AS hour, AVG(ttfb)
            FROM measurements
            WHERE website = ? AND date(timestamp) = ?
            GROUP BY hour
            ORDER BY hour
        """, (site, today))
        rows = cursor.fetchall()
        result[site] = [{"hour": hour, "avg_ttfb": avg} for hour, avg in rows]

    conn.close()
    return jsonify(result)

# ------------------------------
# Weekly averages (2 per day: AM/PM)
# ------------------------------
@app.route("/api/weekly")
def weekly():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    today = datetime.now().date()
    week_ago = today - timedelta(days=6)
    result = {}

    for site in websites:
        cursor.execute("""
            SELECT date(timestamp) AS day,
                   CASE WHEN strftime('%H', timestamp) < '12' THEN 'AM' ELSE 'PM' END AS period,
                   AVG(ttfb)
            FROM measurements
            WHERE website = ? AND date(timestamp) BETWEEN ? AND ?
            GROUP BY day, period
            ORDER BY day, period
        """, (site, week_ago, today))
        rows = cursor.fetchall()
        site_data = {}
        for day, period, avg in rows:
            if day not in site_data:
                site_data[day] = {}
            site_data[day][period] = avg
        result[site] = site_data

    conn.close()
    return jsonify(result)

# ------------------------------
# Monthly averages (daily)
# ------------------------------
@app.route("/api/monthly")
def monthly():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    month = datetime.now().strftime("%m")
    year = datetime.now().strftime("%Y")
    result = {}

    for site in websites:
        cursor.execute("""
            SELECT date(timestamp) AS day, AVG(ttfb)
            FROM measurements
            WHERE website = ? AND strftime('%m', timestamp) = ? AND strftime('%Y', timestamp) = ?
            GROUP BY day
            ORDER BY day
        """, (site, month, year))
        rows = cursor.fetchall()
        result[site] = [{"day": day, "avg_ttfb": avg} for day, avg in rows]

    conn.close()
    return jsonify(result)

# ------------------------------
# Main
# ------------------------------
if __name__ == "__main__":
    app.run(debug=True)
