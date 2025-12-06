import { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { d2xy } from '../utils/hilbert'
import './HilbertVisualization.css'

const VARIANT_COLORS = [
  '#059669', // green
  '#7C3AED', // purple
  '#D97706', // amber
  '#DC2626', // red
  '#0891B2', // cyan
  '#DB2777', // pink
]

function HilbertVisualization({ results, weights, timing }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 })
  const [hoveredPoint, setHoveredPoint] = useState(null)

  // Calculate curve order based on result count
  const curveOrder = Math.max(4, Math.ceil(Math.log2(Math.sqrt(results.length))))
  const curveSize = Math.pow(2, curveOrder)
  const cellSize = Math.min(dimensions.width, dimensions.height) / curveSize

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const size = Math.min(rect.width, 500)
        setDimensions({ width: size, height: size })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Draw the Hilbert curve visualization
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || results.length === 0) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    
    // Set canvas size with DPR
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = '#F8FAFC'
    ctx.fillRect(0, 0, dimensions.width, dimensions.height)

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= curveSize; i++) {
      const pos = i * cellSize
      ctx.beginPath()
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, dimensions.height)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, pos)
      ctx.lineTo(dimensions.width, pos)
      ctx.stroke()
    }

    // Draw Hilbert curve path (very subtle)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let d = 0; d < curveSize * curveSize; d++) {
      const { x, y } = d2xy(curveSize, d)
      const px = x * cellSize + cellSize / 2
      const py = y * cellSize + cellSize / 2
      if (d === 0) {
        ctx.moveTo(px, py)
      } else {
        ctx.lineTo(px, py)
      }
    }
    ctx.stroke()

    // Map results to Hilbert curve positions and draw
    const curveLength = curveSize * curveSize
    
    results.forEach((result, i) => {
      // Map the table index to curve position
      const d = Math.floor((result.tableIndex / 10000) * curveLength)
      const { x, y } = d2xy(curveSize, Math.min(d, curveLength - 1))
      
      const px = x * cellSize + cellSize / 2
      const py = y * cellSize + cellSize / 2
      const radius = Math.max(2, cellSize / 3)
      
      const color = VARIANT_COLORS[result.variant % VARIANT_COLORS.length]
      
      // Draw point with glow
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.globalAlpha = 0.8
      ctx.fill()
      
      // Add subtle glow
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius * 2)
      gradient.addColorStop(0, color)
      gradient.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(px, py, radius * 2, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.globalAlpha = 0.3
      ctx.fill()
      
      ctx.globalAlpha = 1
    })

  }, [results, dimensions, curveSize, cellSize])

  // Handle mouse move for hover effect
  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const gridX = Math.floor(x / cellSize)
    const gridY = Math.floor(y / cellSize)
    
    // Find point at this position
    const curveLength = curveSize * curveSize
    const found = results.find((result) => {
      const d = Math.floor((result.tableIndex / 10000) * curveLength)
      const pos = d2xy(curveSize, Math.min(d, curveLength - 1))
      return pos.x === gridX && pos.y === gridY
    })
    
    setHoveredPoint(found || null)
  }, [results, cellSize, curveSize])

  return (
    <div className="hilbert-visualization">
      <div className="hilbert-header">
        <h4>Hilbert Curve Distribution</h4>
        <p>Space-filling curve visualization - uniform distribution shows evenly mixed colors</p>
      </div>

      <div className="hilbert-content">
        <div 
          ref={containerRef} 
          className="hilbert-canvas-container"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <canvas 
            ref={canvasRef}
            style={{ width: dimensions.width, height: dimensions.height }}
          />
          
          {hoveredPoint && (
            <motion.div 
              className="hover-info"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span>Index: {hoveredPoint.tableIndex}</span>
              <span>Variant: {hoveredPoint.variant}</span>
            </motion.div>
          )}
        </div>

        <div className="hilbert-stats">
          <div className="stat-item">
            <span className="stat-value">{results.length.toLocaleString()}</span>
            <span className="stat-label">Users Simulated</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-value">{timing.avgTime.toFixed(3)}ms</span>
            <span className="stat-label">Avg Time/User</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-value">{timing.totalTime.toFixed(0)}ms</span>
            <span className="stat-label">Total Time</span>
          </div>
        </div>

        <div className="hilbert-legend">
          {weights.map((weight, idx) => (
            <div key={idx} className="legend-item">
              <span 
                className="legend-color"
                style={{ background: VARIANT_COLORS[idx % VARIANT_COLORS.length] }}
              />
              <span className="legend-label">
                V{idx}: {(weight * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HilbertVisualization

