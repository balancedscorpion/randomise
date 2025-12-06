import { motion } from 'motion/react'
import './ResultCard.css'

const VARIANT_LABELS = ['Control', 'Treatment A', 'Treatment B', 'Treatment C', 'Treatment D', 'Treatment E']

function ResultCard({ result }) {
  if (!result) return null

  return (
    <motion.div
      className="result-card glass-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="result-main">
        <motion.div
          className="result-variant"
          style={{ '--variant-color': `var(--variant-${result.variant % 6})` }}
          initial={{ scale: 0.8, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.4, delay: 0.2, type: 'spring' }}
        >
          <span className="variant-number">{result.variant}</span>
          <span className="variant-glow" />
        </motion.div>

        <div className="result-info">
          <h3>
            Variant {result.variant}
            <span className="variant-label">
              {VARIANT_LABELS[result.variant] || `Treatment ${String.fromCharCode(64 + result.variant)}`}
            </span>
          </h3>
          <p>
            User <code>{result.userid}</code> is assigned to this variant
          </p>
        </div>
      </div>

      <div className="result-details">
        <div className="detail-item">
          <span className="detail-label">Seed</span>
          <code className="detail-value">{result.seed}</code>
        </div>
        <div className="detail-item">
          <span className="detail-label">Algorithm</span>
          <code className="detail-value">{result.algorithm.toUpperCase()}</code>
        </div>
        <div className="detail-item">
          <span className="detail-label">Distribution</span>
          <code className="detail-value">{result.distribution.toUpperCase()}</code>
        </div>
        <div className="detail-item">
          <span className="detail-label">Hash Value</span>
          <code className="detail-value">{result.hash_value.toLocaleString()}</code>
        </div>
        <div className="detail-item">
          <span className="detail-label">Table Index</span>
          <code className="detail-value">{result.table_index.toLocaleString()} / {result.table_size.toLocaleString()}</code>
        </div>
        <div className="detail-item">
          <span className="detail-label">Weights</span>
          <code className="detail-value">{result.weights.map(w => `${(w * 100).toFixed(0)}%`).join(' / ')}</code>
        </div>
      </div>

      <motion.div 
        className="result-guarantee"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <span className="guarantee-icon">✓</span>
        <span>
          This assignment is <strong>deterministic</strong> — the same user ID and seed will always produce this result
        </span>
      </motion.div>
    </motion.div>
  )
}

export default ResultCard
