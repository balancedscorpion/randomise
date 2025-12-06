import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import './EditableValue.css'

function EditableValue({ 
  value, 
  onChange, 
  type = 'text',
  color,
  label,
  tooltip,
  editable = true,
  options = null // For select type
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSubmit = () => {
    if (editValue !== value) {
      onChange(editValue)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const colorStyle = color ? {
    '--value-color': `var(--color-${color})`,
    '--value-bg': `var(--color-${color}-bg)`,
  } : {}

  if (type === 'select' && options) {
    return (
      <div className="editable-value select-value" style={colorStyle}>
        {label && <span className="value-label">{label}</span>}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="value-select"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div 
      className={`editable-value ${isEditing ? 'editing' : ''} ${editable ? 'is-editable' : ''}`}
      style={colorStyle}
    >
      {label && <span className="value-label">{label}</span>}
      
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            className="edit-container"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <input
              ref={inputRef}
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSubmit}
              className="value-input"
            />
            <div className="edit-actions">
              <button className="action-btn confirm" onClick={handleSubmit}>✓</button>
              <button className="action-btn cancel" onClick={handleCancel}>✕</button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            className="value-display"
            onClick={() => editable && setIsEditing(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileHover={editable ? { scale: 1.02 } : {}}
            whileTap={editable ? { scale: 0.98 } : {}}
          >
            <code className="value-text">{value}</code>
            {editable && <span className="edit-hint">✎</span>}
          </motion.button>
        )}
      </AnimatePresence>

      {tooltip && (
        <div className="value-tooltip">{tooltip}</div>
      )}
    </div>
  )
}

export default EditableValue

