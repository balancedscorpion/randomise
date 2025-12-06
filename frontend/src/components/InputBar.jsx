import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
import Tooltip from './Tooltip'
import './InputBar.css'

const ALGORITHMS = [
  { value: 'xxhash', label: 'xxHash32', description: 'Very fast hashing' },
  { value: 'xxh3', label: 'xxHash3', description: 'Fastest option' },
  { value: 'murmur32', label: 'MurmurHash3', description: 'Fast non-cryptographic' },
  { value: 'md5', label: 'MD5', description: 'Built-in, compatible' },
  { value: 'sha256', label: 'SHA-256', description: 'Cryptographic hash' },
]

const DISTRIBUTIONS = [
  { value: 'mad', label: 'MAD', description: 'Multiply-Add-Divide' },
  { value: 'modulus', label: 'Modulus', description: 'Simple modulo' },
]

const PRESET_WEIGHTS = [
  { label: '50/50', weights: [0.5, 0.5] },
  { label: '90/10', weights: [0.9, 0.1] },
  { label: '33/33/34', weights: [0.33, 0.33, 0.34] },
  { label: '25×4', weights: [0.25, 0.25, 0.25, 0.25] },
]

function InputBar({ config, onChange, onRandomise, loading }) {
  const [showWeightEditor, setShowWeightEditor] = useState(false)

  const handleChange = useCallback((field, value) => {
    onChange({ ...config, [field]: value })
  }, [config, onChange])

  const handleWeightPreset = useCallback((weights) => {
    onChange({ ...config, weights: [...weights] })
  }, [config, onChange])

  const handleWeightChange = useCallback((index, value) => {
    const newWeights = [...config.weights]
    newWeights[index] = parseFloat(value) || 0
    onChange({ ...config, weights: newWeights })
  }, [config, onChange])

  const addVariant = useCallback(() => {
    const currentWeights = config.weights
    const numVariants = currentWeights.length + 1
    
    // Calculate new weights proportionally
    // Each existing weight gets reduced by (original / numVariants)
    // New variant gets equal share
    const newWeight = 1 / numVariants
    const scaleFactor = (numVariants - 1) / numVariants
    
    const newWeights = currentWeights.map(w => {
      // Scale down proportionally and round to 4 decimal places
      return Math.round(w * scaleFactor * 10000) / 10000
    })
    
    // Add the new variant
    newWeights.push(Math.round(newWeight * 10000) / 10000)
    
    // Fix rounding to ensure sum is exactly 1
    const sum = newWeights.reduce((a, b) => a + b, 0)
    const diff = 1 - sum
    newWeights[newWeights.length - 1] = Math.round((newWeights[newWeights.length - 1] + diff) * 10000) / 10000
    
    onChange({ ...config, weights: newWeights })
  }, [config, onChange])

  const removeVariant = useCallback((index) => {
    if (config.weights.length <= 2) return
    
    const removedWeight = config.weights[index]
    const newWeights = config.weights.filter((_, i) => i !== index)
    
    // Redistribute the removed weight proportionally among remaining variants
    const remainingSum = newWeights.reduce((a, b) => a + b, 0)
    
    if (remainingSum > 0) {
      const normalized = newWeights.map(w => {
        // Each variant gets its proportional share of the removed weight
        const proportion = w / remainingSum
        return Math.round((w + removedWeight * proportion) * 10000) / 10000
      })
      
      // Fix rounding to ensure sum is exactly 1
      const sum = normalized.reduce((a, b) => a + b, 0)
      const diff = 1 - sum
      normalized[normalized.length - 1] = Math.round((normalized[normalized.length - 1] + diff) * 10000) / 10000
      
      onChange({ ...config, weights: normalized })
    }
  }, [config, onChange])

  const weightsSum = config.weights.reduce((a, b) => a + b, 0)
  const isValidWeights = weightsSum >= 0.99 && weightsSum <= 1.01
  const isValid = isValidWeights && config.userid && config.seed

  const currentWeightsLabel = config.weights.map(w => `${Math.round(w * 100)}`).join('/')

  return (
    <div className="input-bar">
      <div className="input-bar-content">
        {/* Primary Inputs Row */}
        <div className="input-row primary-row">
          <div className="input-field-group">
            <Tooltip content="Unique identifier for the user being assigned to a variant. Same user + seed always produces the same result.">
              <label className="field-label">
                <span className="label-icon" style={{ background: 'var(--color-userid-bg)', color: 'var(--color-userid)' }}>ID</span>
                User ID
              </label>
            </Tooltip>
            <input
              type="text"
              value={config.userid}
              onChange={(e) => handleChange('userid', e.target.value)}
              placeholder="user123"
              className="input-field userid-field"
            />
          </div>

          <div className="input-field-group">
            <Tooltip content="Experiment seed ensures different experiments produce independent assignments. Change the seed for each new test.">
              <label className="field-label">
                <span className="label-icon" style={{ background: 'var(--color-seed-bg)', color: 'var(--color-seed)' }}>S</span>
                Seed
              </label>
            </Tooltip>
            <input
              type="text"
              value={config.seed}
              onChange={(e) => handleChange('seed', e.target.value)}
              placeholder="experiment-name"
              className="input-field seed-field"
            />
          </div>

          <div className="input-field-group weights-group">
            <Tooltip content="Distribution of traffic across variants. Must sum to 100%.">
              <label className="field-label">Weights</label>
            </Tooltip>
            <div className="weight-selector">
              <button 
                className="weight-display"
                onClick={() => setShowWeightEditor(!showWeightEditor)}
              >
                <span className="weight-value">{currentWeightsLabel}</span>
                <span className="weight-arrow">{showWeightEditor ? '▲' : '▼'}</span>
              </button>
              
              {showWeightEditor && (
                <motion.div 
                  className="weight-dropdown"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="weight-presets">
                    <span className="preset-label">Presets</span>
                    <div className="preset-buttons">
                      {PRESET_WEIGHTS.map((preset) => (
                        <button
                          key={preset.label}
                          className={`weight-option ${JSON.stringify(config.weights) === JSON.stringify(preset.weights) ? 'active' : ''}`}
                          onClick={() => handleWeightPreset(preset.weights)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="weight-editor">
                    <span className="editor-label">Custom Weights</span>
                    <div className="weight-rows">
                      {config.weights.map((weight, index) => (
                        <div key={index} className="weight-row">
                          <span 
                            className="variant-badge"
                            style={{ background: `var(--variant-${index % 6})` }}
                          >
                            V{index}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={weight}
                            onChange={(e) => handleWeightChange(index, e.target.value)}
                            className="weight-input"
                          />
                          <span className="weight-percent">{(weight * 100).toFixed(1)}%</span>
                          {config.weights.length > 2 && (
                            <button
                              className="remove-variant-btn"
                              onClick={() => removeVariant(index)}
                              title="Remove variant"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <button className="add-variant-btn" onClick={addVariant}>
                      + Add Variant
                    </button>
                    
                    <div className={`weight-sum ${isValidWeights ? 'valid' : 'invalid'}`}>
                      Sum: {(weightsSum * 100).toFixed(1)}%
                      {!isValidWeights && <span> (must equal 100%)</span>}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Secondary Inputs Row */}
        <div className="input-row secondary-row">
          <div className="input-field-group">
            <Tooltip content="Hash algorithm transforms the input into a deterministic integer. Different algorithms have different speed/distribution tradeoffs.">
              <label className="field-label">
                <span className="label-icon" style={{ background: 'var(--color-algorithm-bg)', color: 'var(--color-algorithm)' }}>#</span>
                Algorithm
              </label>
            </Tooltip>
            <select
              value={config.algorithm}
              onChange={(e) => handleChange('algorithm', e.target.value)}
              className="select-field"
            >
              {ALGORITHMS.map((algo) => (
                <option key={algo.value} value={algo.value}>
                  {algo.label}
                </option>
              ))}
            </select>
          </div>

          <div className="input-field-group">
            <Tooltip content="Distribution method maps the hash to a table index. MAD provides better distribution properties than simple modulus.">
              <label className="field-label">Distribution</label>
            </Tooltip>
            <div className="toggle-buttons">
              {DISTRIBUTIONS.map((dist) => (
                <button
                  key={dist.value}
                  className={`toggle-btn ${config.distribution === dist.value ? 'active' : ''}`}
                  onClick={() => handleChange('distribution', dist.value)}
                >
                  {dist.label}
                </button>
              ))}
            </div>
          </div>

          <motion.button
            className="run-button"
            onClick={() => onRandomise()}
            disabled={loading || !isValid}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <span className="loading-spinner" />
            ) : (
              <>
                <span className="run-icon">▶</span>
                <span>Randomise</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

export default InputBar
