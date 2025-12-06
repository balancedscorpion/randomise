/**
 * Hilbert curve utilities for converting between 1D and 2D coordinates.
 * 
 * The Hilbert curve is a space-filling curve that preserves locality -
 * points close in 1D space tend to be close in 2D space.
 */

/**
 * Convert a 1D distance along the Hilbert curve to 2D coordinates
 * @param {number} n - Grid size (must be power of 2)
 * @param {number} d - Distance along the curve (0 to n*n-1)
 * @returns {{x: number, y: number}} - 2D coordinates
 */
export function d2xy(n, d) {
  let x = 0
  let y = 0
  let rx, ry, s, t = d

  for (s = 1; s < n; s *= 2) {
    rx = 1 & (t / 2)
    ry = 1 & (t ^ rx)
    
    // Rotate
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x
        y = s - 1 - y
      }
      // Swap x and y
      const temp = x
      x = y
      y = temp
    }

    x += s * rx
    y += s * ry
    t = Math.floor(t / 4)
  }

  return { x, y }
}

/**
 * Convert 2D coordinates to a 1D distance along the Hilbert curve
 * @param {number} n - Grid size (must be power of 2)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} - Distance along the curve
 */
export function xy2d(n, x, y) {
  let d = 0
  let rx, ry, s

  for (s = n / 2; s > 0; s = Math.floor(s / 2)) {
    rx = (x & s) > 0 ? 1 : 0
    ry = (y & s) > 0 ? 1 : 0
    d += s * s * ((3 * rx) ^ ry)

    // Rotate
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x
        y = s - 1 - y
      }
      // Swap x and y
      const temp = x
      x = y
      y = temp
    }
  }

  return d
}

/**
 * Generate all points on a Hilbert curve of given order
 * @param {number} order - Order of the curve (size = 2^order)
 * @returns {Array<{x: number, y: number, d: number}>} - Array of points
 */
export function generateHilbertCurve(order) {
  const n = Math.pow(2, order)
  const points = []
  
  for (let d = 0; d < n * n; d++) {
    const { x, y } = d2xy(n, d)
    points.push({ x, y, d })
  }
  
  return points
}

/**
 * Map a hash value to a position on the Hilbert curve
 * @param {number} hashValue - Hash value to map
 * @param {number} tableSize - Size of the hash table
 * @param {number} curveSize - Size of the Hilbert curve (n x n)
 * @returns {{x: number, y: number}} - Position on the curve
 */
export function hashToHilbert(hashValue, tableSize, curveSize) {
  // Map hash to curve position
  const curveLength = curveSize * curveSize
  const d = Math.floor((hashValue % tableSize) / tableSize * curveLength)
  return d2xy(curveSize, Math.min(d, curveLength - 1))
}

