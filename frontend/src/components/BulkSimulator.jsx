import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import HilbertVisualization from './HilbertVisualization'
import './BulkSimulator.css'

const PRESET_SIZES = [100, 1000, 10000, 100000]
const MAX_SAMPLE_SIZE = 10000000 // 10 million

function BulkSimulator({ config }) {
  const [results, setResults] = useState(null)
  const [rawResults, setRawResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [sampleSize, setSampleSize] = useState(1000)
  const [inputValue, setInputValue] = useState('1000')
  const [error, setError] = useState(null)
  const [timing, setTiming] = useState({ avgTime: 0, totalTime: 0 })
  const [viewMode, setViewMode] = useState('chart') // 'chart' or 'hilbert'
  const [progress, setProgress] = useState(0)

  const handleInputChange = (value) => {
    setInputValue(value)
    const num = parseInt(value.replace(/,/g, ''), 10)
    if (!isNaN(num) && num > 0 && num <= MAX_SAMPLE_SIZE) {
      setSampleSize(num)
    }
  }

  const handlePresetClick = (size) => {
    setSampleSize(size)
    setInputValue(size.toLocaleString())
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
    return num.toString()
  }

  const runSimulation = useCallback(async () => {
    if (sampleSize <= 0 || sampleSize > MAX_SAMPLE_SIZE) {
      setError(`Sample size must be between 1 and ${MAX_SAMPLE_SIZE.toLocaleString()}`)
      return
    }

    setLoading(true)
    setError(null)
    setProgress(0)
    
    const startTime = performance.now()
    const allResults = []

    try {
      // Generate random user IDs and collect results
      const counts = new Array(config.weights.length).fill(0)
      const batchSize = Math.min(100, sampleSize) // Larger batches for big simulations
      const batches = Math.ceil(sampleSize / batchSize)

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = []
        const start = batch * batchSize
        const end = Math.min(start + batchSize, sampleSize)

        for (let i = start; i < end; i++) {
          const userId = `simulated-user-${i}-${Date.now()}`
          batchPromises.push(
            fetch('/randomise/details', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userid: userId,
                seed: config.seed,
                weights: config.weights,
                algorithm: config.algorithm,
                distribution: config.distribution,
              }),
            }).then((res) => res.json())
          )
        }

        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach((r) => {
          if (r.variant !== undefined) {
            counts[r.variant]++
            // Only store detailed results for Hilbert viz if sample size is reasonable
            if (sampleSize <= 5000) {
              allResults.push({
                variant: r.variant,
                tableIndex: r.table_index,
                hashValue: r.hash_value,
              })
            }
          }
        })

        // Update progress
        setProgress(Math.round(((batch + 1) / batches) * 100))
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTime = totalTime / sampleSize

      setTiming({ avgTime, totalTime })
      setRawResults(allResults)

      // Calculate statistics
      const total = counts.reduce((a, b) => a + b, 0)
      const distributions = counts.map((count, index) => ({
        variant: index,
        count,
        actual: count / total,
        expected: config.weights[index],
        deviation: Math.abs(count / total - config.weights[index]),
      }))

      setResults({
        distributions,
        total,
        timestamp: new Date().toLocaleTimeString(),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }, [config, sampleSize])

  const maxActual = results
    ? Math.max(...results.distributions.map((d) => d.actual))
    : 0

  const isValidSize = sampleSize > 0 && sampleSize <= MAX_SAMPLE_SIZE

  return (
    <div className="bulk-simulator glass-card">
      <div className="simulator-header">
        <div className="header-text">
          <h3>Distribution Simulator</h3>
          <p>Test the uniformity of assignments across many users</p>
        </div>

        <div className="simulator-controls">
          <div className="sample-size-control">
            <div className="size-presets">
              {PRESET_SIZES.map((size) => (
                <button
                  key={size}
                  className={`size-btn ${sampleSize === size ? 'active' : ''}`}
                  onClick={() => handlePresetClick(size)}
                  disabled={loading}
                >
                  {formatNumber(size)}
                </button>
              ))}
            </div>
            <div className="size-input-wrapper">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Custom size"
                className={`size-input ${!isValidSize ? 'invalid' : ''}`}
                disabled={loading}
              />
              <span className="size-hint">Max: 10M</span>
            </div>
          </div>

          <motion.button
            className="simulate-btn"
            onClick={runSimulation}
            disabled={loading || !isValidSize}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <span className="loading-spinner" />
                {progress > 0 ? `${progress}%` : 'Starting...'}
              </>
            ) : (
              <>
                <span className="btn-icon">▶</span>
                Simulate {formatNumber(sampleSize)}
              </>
            )}
          </motion.button>
        </div>
      </div>

      {error && (
        <div className="simulator-error">
          <span>⚠ {error}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {results && (
          <motion.div
            className="simulator-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* View mode toggle - only show Hilbert if we have detailed results */}
            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === 'chart' ? 'active' : ''}`}
                onClick={() => setViewMode('chart')}
              >
                <span className="view-icon">📊</span>
                Bar Chart
              </button>
              <button
                className={`view-btn ${viewMode === 'hilbert' ? 'active' : ''}`}
                onClick={() => setViewMode('hilbert')}
                disabled={rawResults.length === 0}
                title={rawResults.length === 0 ? 'Hilbert view available for samples ≤5,000' : ''}
              >
                <span className="view-icon">🌀</span>
                Hilbert Curve
              </button>
            </div>

            {viewMode === 'chart' ? (
              <>
                <div className="results-header">
                  <span className="results-title">
                    Results from {results.total.toLocaleString()} assignments
                  </span>
                  <div className="timing-info">
                    <span className="timing-value">{timing.avgTime.toFixed(3)}ms</span>
                    <span className="timing-label">per user</span>
                  </div>
                </div>

                <div className="distribution-chart">
                  {results.distributions.map((dist, index) => (
                    <div key={index} className="chart-row">
                      <div className="chart-label">
                        <span
                          className="variant-indicator"
                          style={{ background: `var(--variant-${index % 6})` }}
                        />
                        <span className="variant-name">V{dist.variant}</span>
                      </div>

                      <div className="chart-bars">
                        {/* Expected bar (background) */}
                        <div
                          className="bar expected-bar"
                          style={{ width: `${(dist.expected / maxActual) * 100}%` }}
                        />
                        {/* Actual bar */}
                        <motion.div
                          className="bar actual-bar"
                          style={{
                            '--bar-color': `var(--variant-${index % 6})`,
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(dist.actual / maxActual) * 100}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                        />
                      </div>

                      <div className="chart-values">
                        <span className="actual-value">
                          {(dist.actual * 100).toFixed(2)}%
                        </span>
                        <span className="expected-value">
                          / {(dist.expected * 100).toFixed(1)}%
                        </span>
                        <span
                          className={`deviation-value ${
                            dist.deviation < 0.005
                              ? 'good'
                              : dist.deviation < 0.02
                              ? 'ok'
                              : 'warn'
                          }`}
                        >
                          {dist.deviation < 0.005 ? '✓' : `±${(dist.deviation * 100).toFixed(2)}%`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="results-footer">
                  <span className="footer-note">
                    Total time: <strong>{timing.totalTime.toFixed(0)}ms</strong> ({(timing.totalTime / 1000).toFixed(2)}s) for {results.total.toLocaleString()} users
                  </span>
                </div>
              </>
            ) : (
              <HilbertVisualization 
                results={rawResults}
                weights={config.weights}
                timing={timing}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!results && !loading && (
        <div className="simulator-empty">
          <div className="empty-icon">⚡</div>
          <p>Run the simulation to see how the algorithm distributes users across variants</p>
        </div>
      )}
    </div>
  )
}

export default BulkSimulator
