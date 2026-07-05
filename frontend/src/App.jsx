import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, LineChart, Line, AreaChart, Area
} from "recharts"
import "./App.css"

const SUGGESTIONS = [
  "Population of India from 2000 to 2020",
  "Compare life expectancy: India vs China vs USA",
  "Top 10 countries by child mortality in 2019",
  "Health expenditure per capita in Brazil over time",
  "Maternal mortality ratio in African countries 2018",
]

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="label">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="value" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

function formatNumber(val) {
  if (typeof val !== 'number') return val
  if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(2) + 'B'
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + 'M'
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(1) + 'K'
  return val.toFixed(2)
}

const CHART_COLORS = ['#6366f1', '#22d3ee', '#34d399', '#fb7185', '#fbbf24', '#a78bfa', '#f472b6', '#38bdf8']

// Columns that should never be comma-formatted
const RAW_NUMBER_COLS = new Set(['year', 'year_value'])

function buildChartData(results) {
  if (!results.length) return { data: [], lines: [], labelKey: 'year', type: 'bar' }

  const keys = Object.keys(results[0])
  const groupKey = keys.find(k => k === 'country_name')
  const numericKey = keys.find(k => typeof results[0][k] === 'number' && k !== 'year')
  const hasYear = keys.includes('year')

  // Multi-country comparison → group by year, one line per country
  if (groupKey && hasYear && numericKey) {
    const grouped = {}
    results.forEach(row => {
      const yr = row.year
      if (!grouped[yr]) grouped[yr] = { year: yr }
      grouped[yr][row[groupKey]] = row[numericKey]
    })
    const countries = [...new Set(results.map(r => r[groupKey]))]
    return {
      data: Object.values(grouped).sort((a, b) => a.year - b.year),
      lines: countries,
      labelKey: 'year',
      type: 'line'
    }
  }

  // Single-country time series → area chart
  if (hasYear && numericKey) {
    const sorted = [...results].sort((a, b) => a.year - b.year)
    return { data: sorted, lines: [numericKey], labelKey: 'year', type: 'area' }
  }

  // Categorical data → bar chart
  const labelKey = keys.find(k => typeof results[0][k] === 'string') || keys[0]
  const valKey = keys.find(k => typeof results[0][k] === 'number') || keys[1]
  return { data: results, lines: [valKey], labelKey, type: 'bar' }
}

export default function App() {
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [sql, setSql] = useState("")
  const [results, setResults] = useState([])
  const [error, setError] = useState("")
  const [showSql, setShowSql] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleQuery = async (q) => {
    const queryText = q || question
    if (!queryText.trim()) return

    setLoading(true)
    setError("")
    setResults([])
    setSql("")
    setShowSql(false)

    try {
      const res = await fetch("https://civiclens-backend-817820730147.us-central1.run.app/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: queryText })
      })
      const data = await res.json()
      setLoading(false)
      setSql(data.sql)
      if (data.error) setError(data.error)
      else setResults(data.results)
    } catch (err) {
      setLoading(false)
      setError("Failed to connect to the API. Make sure the backend is running on port 8000.")
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const keys = results.length > 0 ? Object.keys(results[0]) : []
  const chartInfo = buildChartData(results)

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-badge">
          <span>⚡</span> Powered by Gemini AI + BigQuery
        </div>
        <h1>CivicLens</h1>
        <p>Explore global health & population data with natural language</p>
      </header>

      {/* Search */}
      <div className="search-container">
        <div className="search-wrapper">
          <input
            className="search-input"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleQuery()}
            placeholder="Ask a question about global health data..."
            id="search-input"
          />
          <button
            className="search-btn"
            onClick={() => handleQuery()}
            disabled={loading || !question.trim()}
            id="search-button"
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }}></span>
                Analyzing...
              </>
            ) : (
              <>✦ Ask CivicLens</>
            )}
          </button>
        </div>
      </div>

      {/* Quick Suggestions */}
      {!results.length && !loading && !error && (
        <div className="suggestions">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              className="suggestion-chip"
              onClick={() => {
                setQuestion(s)
                handleQuery(s)
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Generating SQL & querying BigQuery...</div>
          <div className="loading-subtext">This typically takes 3-5 seconds</div>
        </div>
      )}

      {/* SQL Card */}
      {sql && !loading && (
        <div className="sql-card">
          <div className="sql-card-header" onClick={() => setShowSql(!showSql)} style={{ cursor: 'pointer' }}>
            <span>
              <span className="sql-dot"></span>
              Generated SQL {showSql ? '▾' : '▸'}
            </span>
            <button className="copy-btn" onClick={(e) => { e.stopPropagation(); handleCopy() }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          {showSql && (
            <pre className="sql-code">{sql}</pre>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-card">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <div className="results-title">
              📊 Results
              <span className="results-count">{results.length} rows</span>
            </div>
          </div>

          {/* Chart */}
          {chartInfo.data.length > 0 && chartInfo.lines.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-title">📈 Visualization</div>
              <ResponsiveContainer width="100%" height={360}>
                {chartInfo.type === 'line' ? (
                  <LineChart data={chartInfo.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey={chartInfo.labelKey}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                      tickFormatter={formatNumber}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                    {chartInfo.lines.map((line, i) => (
                      <Line
                        key={line}
                        type="monotone"
                        dataKey={line}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    ))}
                  </LineChart>
                ) : chartInfo.type === 'area' ? (
                  <AreaChart data={chartInfo.data}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey={chartInfo.labelKey}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                      tickFormatter={formatNumber}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey={chartInfo.lines[0]}
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={chartInfo.data.slice(0, 30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey={chartInfo.labelKey}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                      tickFormatter={formatNumber}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey={chartInfo.lines[0]}
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={60}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="table-card">
            <div className="table-card-header">
              <span>🗂 Data Table</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {keys.map(k => (
                      <th key={k}>{k.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i}>
                      {keys.map(k => (
                        <td key={k}>
                          {RAW_NUMBER_COLS.has(k)
                            ? row[k]
                            : typeof row[k] === 'number'
                              ? row[k].toLocaleString()
                              : row[k] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!results.length && !loading && !error && !sql && (
        <div className="empty-state">
          <div className="empty-state-icon">🌍</div>
          <h3>Ready to explore</h3>
          <p>Ask a question or click a suggestion above to query World Bank health & population data</p>
        </div>
      )}
    </div>
  )
}
