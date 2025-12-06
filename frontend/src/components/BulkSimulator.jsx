import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import './BulkSimulator.css'

const SAMPLE_SIZES = [100, 1000, 10000]

function BulkSimulator({ config }) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sampleSize, setSampleSize] = useState(1000)
  const [error, setError] = useState(null)

  const runSimulation = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Generate random user IDs and collect results
      const counts = new Array(config.weights.length).fill(0)
      const batchSize = 50 // Process in batches for UI responsiveness
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
          }
        })
      }

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
    }
  }, [config, sampleSize])

  const maxActual = results
    ? Math.max(...results.distributions.map((d) => d.actual))
    : 0

  return (
    <div className="bulk-simulator">
      <div className="simulator-header">
        <div className="header-text">
          <h3>Distribution Simulator</h3>
          <p>Test the uniformity of assignments across many users</p>
        </div>

        <div className="simulator-controls">
          <div className="sample-size-selector">
            {SAMPLE_SIZES.map((size) => (
              <button
                key={size}
                className={`size-btn ${sampleSize === size ? 'active' : ''}`}
                onClick={() => setSampleSize(size)}
                disabled={loading}
              >
                {size.toLocaleString()}
              </button>
            ))}
          </div>

          <button
            className="simulate-btn"
            onClick={runSimulation}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner" />
                Running...
              </>
            ) : (
              <>
                <span className="btn-icon">▶</span>
                Simulate {sampleSize.toLocaleString()} Users
              </>
            )}
          </button>
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
            <div className="results-header">
              <span className="results-title">
                Results from {results.total.toLocaleString()} assignments
              </span>
              <span className="results-time">{results.timestamp}</span>
            </div>

            <div className="distribution-chart">
              {results.distributions.map((dist, index) => (
                <div key={index} className="chart-row">
                  <div className="chart-label">
                    <span
                      className="variant-indicator"
                      style={{ background: `var(--variant-${index % 6})` }}
                    />
                    <span className="variant-name">Variant {dist.variant}</span>
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
                      (expected: {(dist.expected * 100).toFixed(0)}%)
                    </span>
                    <span
                      className={`deviation-value ${
                        dist.deviation < 0.01
                          ? 'good'
                          : dist.deviation < 0.03
                          ? 'ok'
                          : 'warn'
                      }`}
                    >
                      {dist.deviation < 0.01 ? '✓' : `±${(dist.deviation * 100).toFixed(2)}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="results-footer">
              <span className="footer-note">
                Actual distribution should closely match expected weights. Small deviations are normal due to randomness.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!results && !loading && (
        <div className="simulator-empty">
          <div className="empty-icon">📊</div>
          <p>Run the simulation to see how the algorithm distributes users across variants</p>
        </div>
      )}
    </div>
  )
}

export default BulkSimulator

