import { useState, useCallback, useEffect } from 'react'
import './App.css'
import InputBar from './components/InputBar'
import PipelineVisualizer from './components/PipelineVisualizer'
import BucketVisualization from './components/BucketVisualization'
import ResultCard from './components/ResultCard'
import BulkSimulator from './components/BulkSimulator'

// Parse URL params on load
function getInitialConfig() {
  const params = new URLSearchParams(window.location.search)
  
  const defaultConfig = {
    userid: 'user123',
    seed: 'homepage-experiment',
    weights: [0.5, 0.5],
    algorithm: 'xxhash',
    distribution: 'mad',
  }

  if (params.has('userid')) defaultConfig.userid = params.get('userid')
  if (params.has('seed')) defaultConfig.seed = params.get('seed')
  if (params.has('algorithm')) defaultConfig.algorithm = params.get('algorithm')
  if (params.has('distribution')) defaultConfig.distribution = params.get('distribution')
  if (params.has('weights')) {
    try {
      const weights = params.get('weights').split(',').map(Number)
      if (weights.every(w => !isNaN(w) && w >= 0)) {
        defaultConfig.weights = weights
      }
    } catch (e) {
      // Keep default weights
    }
  }

  return defaultConfig
}

function App() {
  const [config, setConfig] = useState(getInitialConfig)

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [shareMessage, setShareMessage] = useState('')

  const copyShareUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
    setShareMessage('Link copied!')
    setTimeout(() => setShareMessage(''), 2000)
  }, [])

  const runRandomisation = useCallback(async (configOverride = null) => {
    const activeConfig = configOverride || config
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/randomise/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userid: activeConfig.userid,
          seed: activeConfig.seed,
          weights: activeConfig.weights,
          algorithm: activeConfig.algorithm,
          distribution: activeConfig.distribution,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to randomise')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [config])

  const handleConfigChange = useCallback((newConfig) => {
    setConfig(newConfig)
  }, [])

  // Update URL when config changes
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('userid', config.userid)
    params.set('seed', config.seed)
    params.set('algorithm', config.algorithm)
    params.set('distribution', config.distribution)
    params.set('weights', config.weights.join(','))

    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', newUrl)
  }, [config])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-top">
            <h1>Randomisation Visualizer</h1>
            <button className="share-btn" onClick={copyShareUrl}>
              {shareMessage || '🔗 Share Config'}
            </button>
          </div>
          <p className="subtitle">
            Explore how deterministic A/B testing assignment works step by step
          </p>
        </div>
      </header>

      <InputBar
        config={config}
        onChange={handleConfigChange}
        onRandomise={runRandomisation}
        loading={loading}
      />

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <section className="section-pipeline">
          <PipelineVisualizer
            config={config}
            result={result}
            loading={loading}
          />
        </section>

        {result && (
          <section className="section-results">
            <div className="results-grid">
              <div className="results-distribution">
                <BucketVisualization
                  weights={config.weights}
                  boundaries={result.boundaries}
                  tableSize={result.table_size}
                  tableIndex={result.table_index}
                  variant={result.variant}
                />
              </div>
              <div className="results-summary">
                <ResultCard result={result} />
              </div>
            </div>
          </section>
        )}

        <section className="section-simulator">
          <BulkSimulator config={config} />
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Built with deterministic hashing for consistent user experiences
        </p>
      </footer>
    </div>
  )
}

export default App
