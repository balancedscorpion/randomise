import { useState, useCallback } from 'react'
import './App.css'
import InputBar from './components/InputBar'
import PipelineVisualizer from './components/PipelineVisualizer'
import BucketVisualization from './components/BucketVisualization'
import ResultCard from './components/ResultCard'
import BulkSimulator from './components/BulkSimulator'

function App() {
  const [config, setConfig] = useState({
    userid: 'user123',
    seed: 'homepage-experiment',
    weights: [0.5, 0.5],
    algorithm: 'xxhash',
    distribution: 'mad',
  })

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

  // Allow pipeline to update config (for inline editing)
  const handlePipelineEdit = useCallback((field, value) => {
    const newConfig = { ...config, [field]: value }
    setConfig(newConfig)
    // Auto-run after edit
    runRandomisation(newConfig)
  }, [config, runRandomisation])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="gradient-text">Randomisation Visualizer</h1>
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

        <PipelineVisualizer
          config={config}
          result={result}
          loading={loading}
          onEdit={handlePipelineEdit}
        />

        {result && (
          <>
            <BucketVisualization
              weights={config.weights}
              boundaries={result.boundaries}
              tableSize={result.table_size}
              tableIndex={result.table_index}
              variant={result.variant}
            />

            <ResultCard result={result} />
          </>
        )}

        <BulkSimulator config={config} />
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
