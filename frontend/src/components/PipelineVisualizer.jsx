import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Tooltip from './Tooltip'
import EditableValue from './EditableValue'
import './PipelineVisualizer.css'

const ALGORITHM_OPTIONS = [
  { value: 'md5', label: 'MD5' },
  { value: 'sha256', label: 'SHA-256' },
  { value: 'murmur32', label: 'MurmurHash3' },
  { value: 'xxhash', label: 'xxHash32' },
  { value: 'xxh3', label: 'xxHash3' },
]

const DISTRIBUTION_OPTIONS = [
  { value: 'mad', label: 'MAD' },
  { value: 'modulus', label: 'Modulus' },
]

// MAD constants for formula display
const MAD_PRIME = 2147483647
const MAD_A = 2654435761
const MAD_B = 1103515245

function PipelineVisualizer({ config, result, loading, onEdit }) {
  const [activeStep, setActiveStep] = useState(-1)
  const [showFormula, setShowFormula] = useState(false)

  // Animate through steps when result changes
  useEffect(() => {
    if (result) {
      setActiveStep(0)
      const timers = [
        setTimeout(() => setActiveStep(1), 400),
        setTimeout(() => setActiveStep(2), 800),
        setTimeout(() => setActiveStep(3), 1200),
      ]
      return () => timers.forEach(clearTimeout)
    } else {
      setActiveStep(-1)
    }
  }, [result])

  const combinedInput = `${config.seed}:${config.userid}`

  return (
    <div className="pipeline-visualizer glass-card">
      <div className="pipeline-header">
        <div className="header-text">
          <h3>Randomisation Pipeline</h3>
          <p>Follow the data through each transformation step</p>
        </div>
        {result && (
          <motion.div 
            className="pipeline-status"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="status-dot" />
            Complete
          </motion.div>
        )}
      </div>

      <div className="pipeline-flow">
        {/* Stage 1: Input */}
        <motion.div 
          className={`pipeline-stage ${activeStep >= 0 ? 'active' : ''} ${activeStep === 0 ? 'current' : ''}`}
          initial={false}
          animate={{ 
            boxShadow: activeStep === 0 ? 'var(--shadow-glow)' : 'none'
          }}
        >
          <div className="stage-header">
            <span className="stage-number">1</span>
            <div className="stage-title">
              <h4>Input</h4>
              <span className="stage-subtitle">Combine seed + user ID</span>
            </div>
          </div>

          <div className="stage-content">
            <div className="input-values">
              <Tooltip content="Experiment seed ensures different experiments produce independent assignments">
                <EditableValue
                  value={config.seed}
                  onChange={(v) => onEdit('seed', v)}
                  color="seed"
                  label="Seed"
                  editable={true}
                />
              </Tooltip>
              
              <span className="operator">:</span>
              
              <Tooltip content="Unique identifier for the user being assigned">
                <EditableValue
                  value={config.userid}
                  onChange={(v) => onEdit('userid', v)}
                  color="userid"
                  label="User ID"
                  editable={true}
                />
              </Tooltip>
            </div>

            <AnimatePresence>
              {activeStep >= 0 && result && (
                <motion.div 
                  className="combined-output"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="output-label">Combined string</span>
                  <code className="output-value">"{combinedInput}"</code>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Connector 1→2 */}
        <div className={`connector ${activeStep >= 1 ? 'active' : ''}`}>
          <motion.div 
            className="connector-line"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: activeStep >= 1 ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
          <motion.div 
            className="connector-data"
            initial={{ opacity: 0 }}
            animate={{ opacity: activeStep >= 1 ? 1 : 0 }}
          >
            <span className="data-flow">→</span>
          </motion.div>
        </div>

        {/* Stage 2: Hash */}
        <motion.div 
          className={`pipeline-stage ${activeStep >= 1 ? 'active' : ''} ${activeStep === 1 ? 'current' : ''}`}
          animate={{ 
            boxShadow: activeStep === 1 ? 'var(--shadow-glow)' : 'none'
          }}
        >
          <div className="stage-header">
            <span className="stage-number">2</span>
            <div className="stage-title">
              <h4>Hash</h4>
              <span className="stage-subtitle">Generate deterministic integer</span>
            </div>
          </div>

          <div className="stage-content">
            <Tooltip content="Hash algorithm transforms the input into a deterministic integer">
              <EditableValue
                value={config.algorithm}
                onChange={(v) => onEdit('algorithm', v)}
                type="select"
                options={ALGORITHM_OPTIONS}
                color="algorithm"
                label="Algorithm"
              />
            </Tooltip>

            <AnimatePresence>
              {activeStep >= 1 && result && (
                <motion.div 
                  className="hash-output"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="output-label">Hash value</span>
                  <code className="output-value hash-value">{result.hash_value.toLocaleString()}</code>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Connector 2→3 with hash value flow */}
        <div className={`connector hash-connector ${activeStep >= 2 ? 'active' : ''}`}>
          <motion.div 
            className="connector-line"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: activeStep >= 2 ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
          <AnimatePresence>
            {activeStep >= 2 && result && (
              <motion.div 
                className="connector-data hash-flow"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <span className="flow-value">{result.hash_value.toLocaleString()}</span>
                <span className="flow-arrow">→</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stage 3: Distribute */}
        <motion.div 
          className={`pipeline-stage ${activeStep >= 2 ? 'active' : ''} ${activeStep === 2 ? 'current' : ''}`}
          animate={{ 
            boxShadow: activeStep === 2 ? 'var(--shadow-glow)' : 'none'
          }}
        >
          <div className="stage-header">
            <span className="stage-number">3</span>
            <div className="stage-title">
              <h4>Distribute</h4>
              <span className="stage-subtitle">Map to table index</span>
            </div>
          </div>

          <div className="stage-content">
            <div className="distribution-config">
              <Tooltip content="Distribution method maps the hash to a table index for even distribution">
                <EditableValue
                  value={config.distribution}
                  onChange={(v) => onEdit('distribution', v)}
                  type="select"
                  options={DISTRIBUTION_OPTIONS}
                  label="Method"
                />
              </Tooltip>
              
              <button 
                className="formula-toggle"
                onClick={() => setShowFormula(!showFormula)}
              >
                {showFormula ? 'Hide' : 'Show'} formula
              </button>
            </div>

            <AnimatePresence>
              {showFormula && config.distribution === 'mad' && (
                <motion.div 
                  className="formula-display"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <code>((a × hash + b) mod prime) mod table_size</code>
                  <div className="formula-values">
                    <span>a = {MAD_A.toLocaleString()}</span>
                    <span>b = {MAD_B.toLocaleString()}</span>
                    <span>prime = {MAD_PRIME.toLocaleString()}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {activeStep >= 2 && result && (
                <motion.div 
                  className="distribute-output"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="output-label">Table index</span>
                  <div className="index-display">
                    <code className="output-value">{result.table_index.toLocaleString()}</code>
                    <span className="index-divider">/</span>
                    <span className="table-size">{result.table_size.toLocaleString()}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Connector 3→4 */}
        <div className={`connector ${activeStep >= 3 ? 'active' : ''}`}>
          <motion.div 
            className="connector-line"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: activeStep >= 3 ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
          <motion.div 
            className="connector-data"
            initial={{ opacity: 0 }}
            animate={{ opacity: activeStep >= 3 ? 1 : 0 }}
          >
            <span className="data-flow">→</span>
          </motion.div>
        </div>

        {/* Stage 4: Assign */}
        <motion.div 
          className={`pipeline-stage ${activeStep >= 3 ? 'active' : ''} ${activeStep === 3 ? 'current' : ''}`}
          animate={{ 
            boxShadow: activeStep === 3 ? 'var(--shadow-glow)' : 'none'
          }}
        >
          <div className="stage-header">
            <span className="stage-number">4</span>
            <div className="stage-title">
              <h4>Assign</h4>
              <span className="stage-subtitle">Determine variant</span>
            </div>
          </div>

          <div className="stage-content">
            <AnimatePresence>
              {result && (
                <motion.div 
                  className="boundaries-display"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="output-label">Boundaries</span>
                  <div className="boundaries-list">
                    {result.boundaries.map((boundary, idx) => (
                      <span 
                        key={idx} 
                        className={`boundary-value ${result.variant === idx ? 'active' : ''}`}
                        style={{ '--variant-color': `var(--variant-${idx % 6})` }}
                      >
                        {idx === 0 ? '0' : result.boundaries[idx - 1]} – {boundary}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {activeStep >= 3 && result && (
                <motion.div 
                  className="variant-output"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', damping: 15 }}
                >
                  <span 
                    className="variant-badge"
                    style={{ '--variant-color': `var(--variant-${result.variant % 6})` }}
                  >
                    Variant {result.variant}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {loading && (
        <div className="pipeline-loading">
          <div className="loading-pulse" />
          <span>Processing...</span>
        </div>
      )}

      {!result && !loading && (
        <div className="pipeline-empty">
          <div className="empty-icon">⚡</div>
          <span>Click "Randomise" to see the pipeline in action</span>
        </div>
      )}
    </div>
  )
}

export default PipelineVisualizer
