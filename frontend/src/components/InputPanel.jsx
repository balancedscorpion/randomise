import { useState, useCallback } from 'react'
import './InputPanel.css'

const ALGORITHMS = [
  { value: 'md5', label: 'MD5', description: 'Built-in, compatible' },
  { value: 'sha256', label: 'SHA-256', description: 'Cryptographic' },
  { value: 'murmur32', label: 'MurmurHash3', description: 'Fast, non-crypto' },
  { value: 'xxhash', label: 'xxHash32', description: 'Very fast' },
  { value: 'xxh3', label: 'xxHash3', description: 'Fastest option' },
]

const DISTRIBUTIONS = [
  { value: 'mad', label: 'MAD', description: 'Multiply-Add-Divide' },
  { value: 'modulus', label: 'Modulus', description: 'Simple modulo' },
]

const PRESET_WEIGHTS = [
  { label: '50/50 (A/B)', weights: [0.5, 0.5] },
  { label: '90/10 (Safe rollout)', weights: [0.9, 0.1] },
  { label: '33/33/34 (A/B/C)', weights: [0.33, 0.33, 0.34] },
  { label: '50/30/20', weights: [0.5, 0.3, 0.2] },
  { label: '25/25/25/25', weights: [0.25, 0.25, 0.25, 0.25] },
]

function InputPanel({ config, onChange, onRandomise, loading }) {
  const [customWeights, setCustomWeights] = useState(false)

  const handleChange = useCallback((field, value) => {
    onChange({ ...config, [field]: value })
  }, [config, onChange])

  const handleWeightPreset = useCallback((weights) => {
    setCustomWeights(false)
    onChange({ ...config, weights: [...weights] })
  }, [config, onChange])

  const handleWeightChange = useCallback((index, value) => {
    const newWeights = [...config.weights]
    newWeights[index] = parseFloat(value) || 0
    onChange({ ...config, weights: newWeights })
  }, [config, onChange])

  const addVariant = useCallback(() => {
    const newWeights = [...config.weights, 0]
    // Redistribute evenly
    const evenWeight = 1 / newWeights.length
    const redistributed = newWeights.map(() => Math.round(evenWeight * 100) / 100)
    // Fix rounding
    const sum = redistributed.reduce((a, b) => a + b, 0)
    redistributed[redistributed.length - 1] += Math.round((1 - sum) * 100) / 100
    onChange({ ...config, weights: redistributed })
    setCustomWeights(true)
  }, [config, onChange])

  const removeVariant = useCallback((index) => {
    if (config.weights.length <= 2) return
    const newWeights = config.weights.filter((_, i) => i !== index)
    // Redistribute
    const sum = newWeights.reduce((a, b) => a + b, 0)
    if (sum > 0) {
      const normalized = newWeights.map(w => Math.round((w / sum) * 100) / 100)
      const newSum = normalized.reduce((a, b) => a + b, 0)
      normalized[normalized.length - 1] += Math.round((1 - newSum) * 100) / 100
      onChange({ ...config, weights: normalized })
    }
    setCustomWeights(true)
  }, [config, onChange])

  const weightsSum = config.weights.reduce((a, b) => a + b, 0)
  const isValidWeights = weightsSum >= 0.99 && weightsSum <= 1.01

  return (
    <div className="input-panel">
      <div className="panel-header">
        <h2>Configuration</h2>
        <p>Set up your randomisation parameters</p>
      </div>

      <div className="input-group">
        <label htmlFor="userid">User ID</label>
        <input
          id="userid"
          type="text"
          value={config.userid}
          onChange={(e) => handleChange('userid', e.target.value)}
          placeholder="Enter user identifier"
          className="input-field"
        />
        <span className="input-hint">Unique identifier for the user</span>
      </div>

      <div className="input-group">
        <label htmlFor="seed">Experiment Seed</label>
        <input
          id="seed"
          type="text"
          value={config.seed}
          onChange={(e) => handleChange('seed', e.target.value)}
          placeholder="Enter experiment name"
          className="input-field"
        />
        <span className="input-hint">Different seeds create independent assignments</span>
      </div>

      <div className="input-group">
        <label>Variant Weights</label>
        <div className="weight-presets">
          {PRESET_WEIGHTS.map((preset) => (
            <button
              key={preset.label}
              className={`preset-btn ${
                !customWeights && 
                JSON.stringify(config.weights) === JSON.stringify(preset.weights)
                  ? 'active'
                  : ''
              }`}
              onClick={() => handleWeightPreset(preset.weights)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="weights-editor">
          {config.weights.map((weight, index) => (
            <div key={index} className="weight-row">
              <span 
                className="variant-badge"
                style={{ '--variant-color': `var(--variant-${index % 6})` }}
              >
                V{index}
              </span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={weight}
                onChange={(e) => {
                  handleWeightChange(index, e.target.value)
                  setCustomWeights(true)
                }}
                className="weight-input"
              />
              <span className="weight-percent">{(weight * 100).toFixed(0)}%</span>
              {config.weights.length > 2 && (
                <button
                  className="remove-btn"
                  onClick={() => removeVariant(index)}
                  title="Remove variant"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          
          <button className="add-variant-btn" onClick={addVariant}>
            + Add Variant
          </button>
        </div>

        <div className={`weight-sum ${isValidWeights ? 'valid' : 'invalid'}`}>
          Sum: {(weightsSum * 100).toFixed(1)}%
          {!isValidWeights && <span className="sum-warning"> (must equal 100%)</span>}
        </div>
      </div>

      <div className="input-group">
        <label htmlFor="algorithm">Hash Algorithm</label>
        <select
          id="algorithm"
          value={config.algorithm}
          onChange={(e) => handleChange('algorithm', e.target.value)}
          className="select-field"
        >
          {ALGORITHMS.map((algo) => (
            <option key={algo.value} value={algo.value}>
              {algo.label} — {algo.description}
            </option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label>Distribution Method</label>
        <div className="toggle-group">
          {DISTRIBUTIONS.map((dist) => (
            <button
              key={dist.value}
              className={`toggle-btn ${config.distribution === dist.value ? 'active' : ''}`}
              onClick={() => handleChange('distribution', dist.value)}
            >
              <span className="toggle-label">{dist.label}</span>
              <span className="toggle-desc">{dist.description}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        className="randomise-btn"
        onClick={() => onRandomise()}
        disabled={loading || !isValidWeights || !config.userid || !config.seed}
      >
        {loading ? (
          <span className="loading-spinner" />
        ) : (
          <>
            <span className="btn-icon">→</span>
            Randomise
          </>
        )}
      </button>
    </div>
  )
}

export default InputPanel

