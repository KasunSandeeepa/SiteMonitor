import { type NextRequest, NextResponse } from "next/server"
import sqlite3 from "sqlite3"
import { existsSync, statSync } from "fs"

export async function GET(request: NextRequest, { params }: { params: Promise<{ website: string }> }) {
  try {
    const { website: encodedWebsite } = await params
    const website = decodeURIComponent(encodedWebsite)

    console.log(`[v0] API called for website: ${website}`)
    console.log(`[v0] Request URL: ${request.url}`)

    const dbPath = "C:\\Users\\kasun\\OneDrive\\Desktop\\SITEMONITOR\\sitemonitor.db"

    console.log(`[v0] Using database path: ${dbPath}`)

    try {
      if (!existsSync(dbPath)) {
        console.log(`[v0] Database file does not exist at path: ${dbPath}`)
        return NextResponse.json(
          {
            error: "Database file not found",
            dbPath: dbPath,
            suggestion: "Run your Python script: python staggered_ttfb.py",
          },
          { status: 500 },
        )
      }

      const stats = statSync(dbPath)
      console.log(`[v0] Database file exists - Size: ${stats.size} bytes, Modified: ${stats.mtime}`)

      if (stats.size === 0) {
        console.log(`[v0] Database file is empty (0 bytes)`)
        return NextResponse.json(
          {
            error: "Database file is empty",
            dbPath: dbPath,
            suggestion: "Run your Python script to populate the database: python staggered_ttfb.py",
          },
          { status: 500 },
        )
      }
    } catch (fsError) {
      console.log(`[v0] File system error:`, fsError)
      return NextResponse.json(
        { error: "File system error", details: fsError instanceof Error ? fsError.message : String(fsError) },
        { status: 500 },
      )
    }

    const openDatabase = (): Promise<sqlite3.Database> => {
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
          if (err) {
            console.log(`[v0] Failed to open database:`, err)
            reject(err)
          } else {
            console.log(`[v0] Database opened successfully with sqlite3`)
            resolve(db)
          }
        })
      })
    }

    const runQuery = (db: sqlite3.Database, query: string, params: any[] = []): Promise<any[]> => {
      return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) {
            reject(err)
          } else {
            resolve(rows || [])
          }
        })
      })
    }

    let db: sqlite3.Database | null = null

    try {
      console.log(`[v0] Opening database at: ${dbPath}`)
      db = await openDatabase()

      // Check if measurements table exists
      const tableCheck = await runQuery(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='measurements'")
      if (tableCheck.length === 0) {
        console.log(`[v0] Database found but no measurements table`)
        db.close()
        return NextResponse.json(
          {
            error: "measurements table not found in database",
            dbPath: dbPath,
            suggestion: "Run your Python script to create the table: python staggered_ttfb.py",
          },
          { status: 500 },
        )
      }
      console.log(`[v0] Successfully connected to database with measurements table`)
    } catch (err) {
      console.log(`[v0] Failed to open database:`, err)
      return NextResponse.json(
        {
          error: "Failed to open database",
          dbPath: dbPath,
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      )
    }

    const query = `
      SELECT website, timestamp, ttfb, loading_delay 
      FROM measurements 
      WHERE website LIKE ? 
      ORDER BY timestamp DESC 
      LIMIT 1000
    `

    console.log(`[v0] Executing query for website: ${website}`)
    console.log(`[v0] SQL Query: ${query}`)

    let measurements
    try {
      const searchPattern = `%${website}%`
      measurements = await runQuery(db, query, [searchPattern])

      console.log(`[v0] Query successful - Found ${measurements.length} measurements for pattern: ${searchPattern}`)

      if (measurements.length > 0) {
        console.log(`[v0] Sample measurement:`, measurements[0])
      } else {
        console.log(`[v0] No measurements found for website pattern: ${searchPattern}`)
        // Check what websites are actually in the database
        const allWebsites = await runQuery(db, "SELECT DISTINCT website FROM measurements LIMIT 10")
        console.log(`[v0] Available websites in database:`, allWebsites)
      }
    } catch (queryError) {
      console.error(`[v0] Query execution failed:`, queryError)
      db.close()
      return NextResponse.json(
        {
          error: "Query execution failed",
          details: queryError instanceof Error ? queryError.message : String(queryError),
          website: website,
          query: query,
        },
        { status: 500 },
      )
    }

    // Close database connection
    db.close()

    return NextResponse.json(measurements)
  } catch (error) {
    console.error("[v0] Unexpected API error:", error)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      {
        error: "Failed to fetch data",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
