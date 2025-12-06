import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import HilbertVisualization from './HilbertVisualization'
import './BulkSimulator.css'

const PRESET_SIZES = [100, 1000, 10000, 100000]
const MAX_SAMPLE_SIZE = 10000000 // 10 million

// Approximation of chi-squared CDF (upper tail probability / p-value)
function chiSquaredPValue(x, k) {
  if (x <= 0) return 1
  if (k <= 0) return 0
  
  // For large k, use normal approximation
  if (k > 30) {
    const z = Math.pow(x / k, 1/3) - (1 - 2 / (9 * k))
    const s = Math.sqrt(2 / (9 * k))
    const normal = 0.5 * (1 + erf(z / (s * Math.sqrt(2))))
    return 1 - normal
  }
  
  // Gamma function approximation for small k
  const gammaCDF = (x, k) => {
    if (x <= 0) return 0
    const a = k / 2
    const z = x / 2
    
    let sum = 0
    let term = Math.exp(-z) * Math.pow(z, a) / gamma(a + 1)
    sum = term
    
    for (let n = 1; n < 100; n++) {
      term *= z / (a + n)
      sum += term
      if (Math.abs(term) < 1e-10) break
    }
    
    return sum
  }
  
  return 1 - gammaCDF(x, k)
}

// Error function approximation
function erf(x) {
  const t = 1 / (1 + 0.5 * Math.abs(x))
  const tau = t * Math.exp(-x * x - 1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277)))))))))
  
  return x >= 0 ? 1 - tau : tau - 1
}

// Gamma function approximation (Stirling)
function gamma(n) {
  if (n === 1) return 1
  if (n === 0.5) return Math.sqrt(Math.PI)
  if (n < 0.5) {
    return Math.PI / (Math.sin(Math.PI * n) * gamma(1 - n))
  }
  n -= 1
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  
  let x = c[0]
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (n + i)
  }
  
  const t = n + g + 0.5
  return Math.sqrt(2 * Math.PI) * Math.pow(t, n + 0.5) * Math.exp(-t) * x
}

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

      // Calculate chi-squared statistic
      const chiSquared = distributions.reduce((sum, dist) => {
        const expected = total * dist.expected
        if (expected === 0) return sum
        return sum + Math.pow(dist.count - expected, 2) / expected
      }, 0)
      
      // Degrees of freedom = number of variants - 1
      const degreesOfFreedom = distributions.length - 1
      
      // Simplified p-value approximation (for large samples)
      // Using chi-squared distribution approximation
      const pValue = chiSquaredPValue(chiSquared, degreesOfFreedom)

      setResults({
        distributions,
        total,
        timestamp: new Date().toLocaleTimeString(),
        chiSquared,
        degreesOfFreedom,
        pValue,
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
          <h3>🔬 Distribution Simulator</h3>
          <p>Test the uniformity of assignments across many users</p>
          <div className="header-tip">
            Run simulations to verify your randomisation produces the expected distribution
          </div>
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

                {/* Statistical significance */}
                <div className="stats-significance">
                  <div className="stat-box">
                    <span className="stat-label">Chi-Squared (χ²)</span>
                    <span className="stat-value">{results.chiSquared.toFixed(4)}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Degrees of Freedom</span>
                    <span className="stat-value">{results.degreesOfFreedom}</span>
                  </div>
                  <div className={`stat-box ${results.pValue > 0.05 ? 'good' : 'warn'}`}>
                    <span className="stat-label">p-value</span>
                    <span className="stat-value">{results.pValue < 0.001 ? '<0.001' : results.pValue.toFixed(4)}</span>
                  </div>
                  <div className={`stat-box verdict ${results.pValue > 0.05 ? 'good' : 'warn'}`}>
                    <span className="stat-label">Verdict</span>
                    <span className="stat-value">{results.pValue > 0.05 ? '✓ Uniform' : '⚠ Skewed'}</span>
                  </div>
                </div>

                <div className="results-footer">
                  <span className="footer-note">
                    Total time: <strong>{timing.totalTime.toFixed(0)}ms</strong> ({(timing.totalTime / 1000).toFixed(2)}s) for {results.total.toLocaleString()} users
                  </span>
                  <span className="footer-note significance-note">
                    {results.pValue > 0.05 
                      ? 'Distribution matches expected weights (p > 0.05)'
                      : 'Distribution differs from expected weights (p ≤ 0.05)'}
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
