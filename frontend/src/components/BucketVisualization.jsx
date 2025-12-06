import { useState } from 'react'
import { motion } from 'motion/react'
import './BucketVisualization.css'

const VARIANT_LABELS = ['Control', 'Treatment A', 'Treatment B', 'Treatment C', 'Treatment D', 'Treatment E']

function BucketVisualization({ weights, boundaries, tableSize, tableIndex, variant }) {
  const markerPosition = (tableIndex / tableSize) * 100
  const [hoveredSegment, setHoveredSegment] = useState(null)

  return (
    <div className="bucket-visualization glass-card">
      <div className="bucket-header">
        <h3>Variant Distribution</h3>
        <p>
          Index <code>{tableIndex.toLocaleString()}</code> falls in Variant {variant} 
          ({VARIANT_LABELS[variant] || `Variant ${variant}`})
        </p>
      </div>

      <div className="bucket-container">
        {/* Scale markers */}
        <div className="scale-markers">
          <span>0</span>
          <span>{Math.round(tableSize / 4).toLocaleString()}</span>
          <span>{Math.round(tableSize / 2).toLocaleString()}</span>
          <span>{Math.round((tableSize * 3) / 4).toLocaleString()}</span>
          <span>{tableSize.toLocaleString()}</span>
        </div>

        {/* Bucket bar */}
        <div className="bucket-bar">
          {weights.map((weight, index) => (
            <motion.div
              key={index}
              className={`bucket-segment ${variant === index ? 'active' : ''} ${hoveredSegment === index ? 'hovered' : ''}`}
              style={{
                '--segment-width': `${weight * 100}%`,
                '--segment-color': `var(--variant-${index % 6})`,
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              onMouseEnter={() => setHoveredSegment(index)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              <div className="segment-fill" />
              <span className="segment-label">
                V{index}
                <span className="segment-percent">{(weight * 100).toFixed(0)}%</span>
              </span>
              
              {/* Hover tooltip with range info */}
              {hoveredSegment === index && (
                <div className="segment-tooltip">
                  <strong>{VARIANT_LABELS[index] || `Variant ${index}`}</strong>
                  <span>Range: {index === 0 ? '0' : boundaries[index - 1].toLocaleString()} – {(boundaries[index] - 1).toLocaleString()}</span>
                  <span>Weight: {(weight * 100).toFixed(1)}%</span>
                </div>
              )}
            </motion.div>
          ))}

          {/* Marker */}
          <motion.div
            className="bucket-marker"
            style={{ '--marker-position': `${markerPosition}%` }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5, type: 'spring' }}
          >
            <div className="marker-line" />
            <div className="marker-dot" />
            <div className="marker-label">
              <span className="marker-index">{tableIndex.toLocaleString()}</span>
            </div>
          </motion.div>
        </div>

        {/* Boundaries */}
        <div className="boundaries">
          {boundaries.slice(0, -1).map((boundary, index) => (
            <div
              key={index}
              className="boundary-marker"
              style={{ '--boundary-position': `${(boundary / tableSize) * 100}%` }}
            >
              <span className="boundary-value">{boundary.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="bucket-legend">
        {weights.map((weight, index) => (
          <motion.div
            key={index}
            className={`legend-item ${variant === index ? 'active' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
          >
            <span
              className="legend-color"
              style={{ background: `var(--variant-${index % 6})` }}
            />
            <span className="legend-name">
              V{index}: {VARIANT_LABELS[index] || `Variant ${index}`}
            </span>
            <span className="legend-range">
              {index === 0 ? '0' : boundaries[index - 1].toLocaleString()} – {(boundaries[index] - 1).toLocaleString()}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default BucketVisualization
