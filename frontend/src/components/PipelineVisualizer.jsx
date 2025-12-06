import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import './PipelineVisualizer.css'

const ALGORITHM_LABELS = {
  md5: 'MD5',
  sha256: 'SHA-256',
  murmur32: 'MurmurHash3',
  xxhash: 'xxHash32',
  xxh3: 'xxHash3',
}

const DISTRIBUTION_LABELS = {
  mad: 'MAD (Multiply-Add-Divide)',
  modulus: 'Modulus',
}

function PipelineVisualizer({ config, result, loading }) {
  const [activeStep, setActiveStep] = useState(-1)

  // Animate through steps when result changes
  useEffect(() => {
    if (result) {
      setActiveStep(0)
      const timers = [
        setTimeout(() => setActiveStep(1), 300),
        setTimeout(() => setActiveStep(2), 600),
        setTimeout(() => setActiveStep(3), 900),
      ]
      return () => timers.forEach(clearTimeout)
    } else {
      setActiveStep(-1)
    }
  }, [result])

  const steps = [
    {
      id: 'input',
      title: 'Input',
      icon: '📥',
      description: 'Combine user ID with seed',
      value: result ? `"${config.seed}:${config.userid}"` : null,
      detail: 'Creates a unique, deterministic input string',
    },
    {
      id: 'hash',
      title: 'Hash',
      icon: '#',
      description: `Apply ${ALGORITHM_LABELS[config.algorithm] || config.algorithm}`,
      value: result ? result.hash_value.toString() : null,
      detail: 'Produces a deterministic integer from the input',
    },
    {
      id: 'distribute',
      title: 'Distribute',
      icon: '⚖',
      description: DISTRIBUTION_LABELS[config.distribution] || config.distribution,
      value: result ? `${result.table_index} / ${result.table_size}` : null,
      detail: 'Maps hash to table index for even distribution',
    },
    {
      id: 'assign',
      title: 'Assign',
      icon: '🎯',
      description: 'Determine variant from boundaries',
      value: result ? `Variant ${result.variant}` : null,
      detail: 'Selects variant based on weight boundaries',
    },
  ]

  return (
    <div className="pipeline-visualizer">
      <div className="pipeline-header">
        <h3>Randomisation Pipeline</h3>
        <p>Follow the data through each transformation step</p>
      </div>

      <div className="pipeline-stages">
        {steps.map((step, index) => (
          <div key={step.id} className="stage-wrapper">
            <motion.div
              className={`pipeline-stage ${activeStep >= index ? 'active' : ''} ${
                activeStep === index ? 'current' : ''
              }`}
              initial={false}
              animate={{
                scale: activeStep === index ? 1.02 : 1,
                boxShadow:
                  activeStep === index
                    ? '0 8px 25px rgba(0, 102, 255, 0.15)'
                    : '0 2px 8px rgba(0, 0, 0, 0.06)',
              }}
              transition={{ duration: 0.3 }}
            >
              <div className="stage-header">
                <span className="stage-icon">{step.icon}</span>
                <div className="stage-titles">
                  <h4>{step.title}</h4>
                  <span className="stage-desc">{step.description}</span>
                </div>
                <span className={`stage-number ${activeStep >= index ? 'done' : ''}`}>
                  {activeStep >= index ? '✓' : index + 1}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {activeStep >= index && step.value && (
                  <motion.div
                    className="stage-value"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                  >
                    <code>{step.value}</code>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="stage-detail">
                {step.detail}
              </div>
            </motion.div>

            {index < steps.length - 1 && (
              <div className={`connector ${activeStep > index ? 'active' : ''}`}>
                <motion.div
                  className="connector-line"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: activeStep > index ? 1 : 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                />
                <motion.div
                  className="connector-arrow"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: activeStep > index ? 1 : 0 }}
                  transition={{ duration: 0.15, delay: 0.2 }}
                >
                  →
                </motion.div>
              </div>
            )}
          </div>
        ))}
      </div>

      {loading && (
        <div className="pipeline-loading">
          <div className="loading-pulse" />
          <span>Processing...</span>
        </div>
      )}

      {!result && !loading && (
        <div className="pipeline-empty">
          <span>Click "Randomise" to see the pipeline in action</span>
        </div>
      )}
    </div>
  )
}

export default PipelineVisualizer

