"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const websites = [
  "https://www.google.com",
  "https://www.youtube.com",
  "https://www.facebook.com",
  "https://www.instagram.com",
  "https://chat.openai.com",
  "https://www.x.com",
  "https://www.reddit.com",
  "https://www.whatsapp.com",
  "https://www.bing.com",
  "https://www.wikipedia.org",
]

type TimeFrame = "daily" | "weekly" | "monthly"
type ChartData = {
  time: string
  ttfb: number | null
  loading_delay: number | null
}

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
)

export default function PerformanceDashboard() {
  const [selectedTimeframes, setSelectedTimeframes] = useState<Record<string, TimeFrame>>(
    Object.fromEntries(websites.map((site) => [site, "daily" as TimeFrame])),
  )
  const [chartData, setChartData] = useState<Record<string, ChartData[]>>({})
  const [loading, setLoading] = useState(true)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const generateTimeLabels = (timeframe: TimeFrame): string[] => {
    const now = new Date()
    const labels: string[] = []

    if (timeframe === "daily") {
      for (let i = 0; i < 24; i++) {
        labels.push(`${i.toString().padStart(2, "0")}:00`)
      }
    } else if (timeframe === "weekly") {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())

      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      for (let i = 0; i < 7; i++) {
        labels.push(dayNames[i])
      }
    } else if (timeframe === "monthly") {
      const year = now.getFullYear()
      const month = now.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()

      for (let i = 1; i <= daysInMonth; i++) {
        labels.push(i.toString())
      }
    }

    return labels
  }

  const processDataForTimeframe = (rawData: any[], timeframe: TimeFrame): ChartData[] => {
    const labels = generateTimeLabels(timeframe)
    const dataMap = new Map<string, { ttfb: number[]; loading_delay: number[] }>()

    labels.forEach((label) => {
      dataMap.set(label, { ttfb: [], loading_delay: [] })
    })

    rawData.forEach((item) => {
      const date = new Date(item.timestamp)
      let key: string

      if (timeframe === "daily") {
        const today = new Date()
        if (date.toDateString() === today.toDateString()) {
          key = `${date.getHours().toString().padStart(2, "0")}:00`
        } else {
          return
        }
      } else if (timeframe === "weekly") {
        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        endOfWeek.setHours(23, 59, 59, 999)

        if (date >= startOfWeek && date <= endOfWeek) {
          const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          key = dayNames[date.getDay()]
        } else {
          return
        }
      } else if (timeframe === "monthly") {
        const now = new Date()
        if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
          key = date.getDate().toString()
        } else {
          return
        }
      } else {
        return
      }

      if (dataMap.has(key)) {
        dataMap.get(key)!.ttfb.push(item.ttfb)
        dataMap.get(key)!.loading_delay.push(item.loading_delay)
      }
    })

    return labels.map((label) => {
      const data = dataMap.get(label)!
      return {
        time: label,
        ttfb: data.ttfb.length > 0 ? data.ttfb.reduce((a, b) => a + b, 0) / data.ttfb.length : null,
        loading_delay:
          data.loading_delay.length > 0
            ? data.loading_delay.reduce((a, b) => a + b, 0) / data.loading_delay.length
            : null,
      }
    })
  }

  const fetchDataForWebsite = useCallback(async (website: string, timeframe: TimeFrame) => {
    try {
      console.log(`[v0] Frontend: Fetching data for ${website} with timeframe ${timeframe}`)
      const url = `/api/data/${encodeURIComponent(website)}`
      console.log(`[v0] Frontend: Request URL: ${url}`)

      const response = await fetch(url)
      console.log(`[v0] Frontend: Response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[v0] Frontend: HTTP error! status: ${response.status}`)
        console.error(`[v0] Frontend: Error response body:`, errorText)

        try {
          const errorJson = JSON.parse(errorText)
          console.error(`[v0] Frontend: Parsed error details:`, errorJson)
        } catch (parseError) {
          console.error(`[v0] Frontend: Could not parse error response as JSON`)
        }

        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const rawData = await response.json()
      console.log(`[v0] Frontend: Fetched ${rawData.length} records for ${website}`)

      const processedData = processDataForTimeframe(rawData, timeframe)

      setChartData((prev) => ({
        ...prev,
        [`${website}-${timeframe}`]: processedData,
      }))
    } catch (error) {
      console.error(`[v0] Frontend: Error fetching data for ${website}:`, error)
      console.error(`[v0] Frontend: Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : "No stack trace",
      })

      const labels = generateTimeLabels(timeframe)
      const emptyData = labels.map((label) => ({
        time: label,
        ttfb: null,
        loading_delay: null,
      }))

      setChartData((prev) => ({
        ...prev,
        [`${website}-${timeframe}`]: emptyData,
      }))
    }
  }, [])

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true)

    for (const website of websites) {
      const timeframe = selectedTimeframes[website]
      await fetchDataForWebsite(website, timeframe)
    }

    setLastUpdate(new Date())
    setRefreshing(false)
  }, [selectedTimeframes, fetchDataForWebsite])

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true)

      for (const website of websites) {
        const timeframe = selectedTimeframes[website]
        await fetchDataForWebsite(website, timeframe)
      }

      setLastUpdate(new Date())
      setLoading(false)
    }

    loadAllData()
  }, [selectedTimeframes, fetchDataForWebsite])

  useEffect(() => {
    if (!isAutoRefresh) return

    const interval = setInterval(async () => {
      console.log("[v0] Auto-refreshing data...")

      for (const website of websites) {
        const timeframe = selectedTimeframes[website]
        await fetchDataForWebsite(website, timeframe)
      }

      setLastUpdate(new Date())
    }, 60000)

    return () => clearInterval(interval)
  }, [isAutoRefresh, selectedTimeframes, fetchDataForWebsite])

  const handleTimeframeChange = (website: string, timeframe: TimeFrame) => {
    setSelectedTimeframes((prev) => ({
      ...prev,
      [website]: timeframe,
    }))
  }

  const getWebsiteName = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "")
    } catch {
      return url
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-800">🌐 Website Performance Monitor</h1>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Last updated: {mounted ? lastUpdate.toLocaleTimeString() : "--:--:--"}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-transparent"
            >
              <RefreshIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant={isAutoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            >
              Auto-refresh: {isAutoRefresh ? "ON" : "OFF"}
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          {websites.map((website, index) => {
            const timeframe = selectedTimeframes[website]
            const data = chartData[`${website}-${timeframe}`] || []

            return (
              <Card key={website} className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-semibold">{getWebsiteName(website)}</CardTitle>
                      <CardDescription>{website}</CardDescription>
                    </div>
                    <Select
                      value={timeframe}
                      onValueChange={(value: TimeFrame) => handleTimeframeChange(website, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily (hourly avg)</SelectItem>
                        <SelectItem value="weekly">Weekly (daily avg)</SelectItem>
                        <SelectItem value="monthly">Monthly (daily avg)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-center">Time to First Byte (TTFB)</h3>
                      <ChartContainer
                        config={{
                          ttfb: {
                            label: "TTFB (seconds)",
                            color: "hsl(var(--chart-1))",
                          },
                        }}
                        className="h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="time"
                              tick={{ fontSize: 12 }}
                              angle={timeframe === "monthly" ? -45 : 0}
                              textAnchor={timeframe === "monthly" ? "end" : "middle"}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line
                              type="monotone"
                              dataKey="ttfb"
                              stroke="var(--color-ttfb)"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-center">Page Loading Delay</h3>
                      <ChartContainer
                        config={{
                          loading_delay: {
                            label: "Loading Delay (seconds)",
                            color: "hsl(var(--chart-2))",
                          },
                        }}
                        className="h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="time"
                              tick={{ fontSize: 12 }}
                              angle={timeframe === "monthly" ? -45 : 0}
                              textAnchor={timeframe === "monthly" ? "end" : "middle"}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line
                              type="monotone"
                              dataKey="loading_delay"
                              stroke="var(--color-loading_delay)"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading performance data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
