export function roomQrCode(roomNumber: string) {
  return `CL-BF-${roomNumber.replace(/\s+/g, "").toUpperCase()}`
}

export function roomNumberFromQrCode(qrCode: string | undefined) {
  const value = decodeURIComponent(qrCode ?? "").trim()
  return value.replace(/^CL-BF-/i, "")
}

export function breakfastQrUrl(qrCode: string) {
  const path = `/desayunos/qr/${encodeURIComponent(qrCode)}`
  if (typeof window === "undefined") return path
  return `${window.location.origin}${path}`
}

const QR_VERSION = 5
const QR_SIZE = QR_VERSION * 4 + 17
const QR_DATA_CODEWORDS = 108
const QR_ECC_CODEWORDS = 26
const QR_MAX_BYTES = QR_DATA_CODEWORDS - 2
const QR_FORMAT_MASK = 0x5412
const QR_FORMAT_POLYNOMIAL = 0x537
const QR_GF_POLYNOMIAL = 0x11d

const qrGfExp = new Array<number>(512).fill(0)
const qrGfLog = new Array<number>(256).fill(0)
let qrGfReady = false

export function breakfastQrSvgDataUrl(value: string) {
  try {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(breakfastQrSvg(value))}`
  } catch {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(unavailableQrSvg())}`
  }
}

export function breakfastQrSvg(value: string) {
  const modules = qrModules(value)
  const quietZone = 4
  const viewSize = QR_SIZE + quietZone * 2
  const cells: string[] = []

  modules.forEach((row, y) => {
    row.forEach((enabled, x) => {
      if (enabled) cells.push(`M${x + quietZone},${y + quietZone}h1v1h-1z`)
    })
  })

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges">`,
    `<rect width="${viewSize}" height="${viewSize}" fill="#fff"/>`,
    `<path d="${cells.join("")}" fill="#111"/>`,
    "</svg>",
  ].join("")
}

function qrModules(value: string) {
  const data = qrDataCodewords(value)
  const codewords = [...data, ...reedSolomonRemainder(data, QR_ECC_CODEWORDS)]
  const modules = Array.from({ length: QR_SIZE }, () => Array<boolean>(QR_SIZE).fill(false))
  const reserved = Array.from({ length: QR_SIZE }, () => Array<boolean>(QR_SIZE).fill(false))

  drawFinder(modules, reserved, 3, 3)
  drawFinder(modules, reserved, QR_SIZE - 4, 3)
  drawFinder(modules, reserved, 3, QR_SIZE - 4)
  drawAlignment(modules, reserved, 30, 30)
  drawTiming(modules, reserved)
  drawFormat(modules, reserved, 0)
  setFunctionModule(modules, reserved, QR_SIZE - 8, 8, true)
  drawCodewords(modules, reserved, codewords)
  drawFormat(modules, reserved, formatBits(1, 0))

  return modules
}

function qrDataCodewords(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value))
  if (bytes.length > QR_MAX_BYTES) {
    throw new Error("El valor del QR es demasiado largo para generarlo localmente.")
  }

  const bits: number[] = []
  appendBits(bits, 0b0100, 4)
  appendBits(bits, bytes.length, 8)
  bytes.forEach((byte) => appendBits(bits, byte, 8))

  const capacityBits = QR_DATA_CODEWORDS * 8
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)

  const data: number[] = []
  for (let index = 0; index < bits.length; index += 8) {
    data.push(bits.slice(index, index + 8).reduce((sum, bit) => (sum << 1) | bit, 0))
  }

  for (let pad = 0xec; data.length < QR_DATA_CODEWORDS; pad = pad === 0xec ? 0x11 : 0xec) {
    data.push(pad)
  }

  return data
}

function appendBits(target: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    target.push((value >>> index) & 1)
  }
}

function drawFinder(
  modules: boolean[][],
  reserved: boolean[][],
  centerRow: number,
  centerCol: number,
) {
  for (let rowOffset = -4; rowOffset <= 4; rowOffset += 1) {
    for (let colOffset = -4; colOffset <= 4; colOffset += 1) {
      const row = centerRow + rowOffset
      const col = centerCol + colOffset
      if (!isInQr(row, col)) continue

      const distance = Math.max(Math.abs(rowOffset), Math.abs(colOffset))
      setFunctionModule(modules, reserved, row, col, distance !== 2 && distance !== 4)
    }
  }
}

function drawAlignment(
  modules: boolean[][],
  reserved: boolean[][],
  centerRow: number,
  centerCol: number,
) {
  for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
    for (let colOffset = -2; colOffset <= 2; colOffset += 1) {
      const distance = Math.max(Math.abs(rowOffset), Math.abs(colOffset))
      setFunctionModule(
        modules,
        reserved,
        centerRow + rowOffset,
        centerCol + colOffset,
        distance === 0 || distance === 2,
      )
    }
  }
}

function drawTiming(modules: boolean[][], reserved: boolean[][]) {
  for (let index = 8; index < QR_SIZE - 8; index += 1) {
    const enabled = index % 2 === 0
    setFunctionModule(modules, reserved, 6, index, enabled)
    setFunctionModule(modules, reserved, index, 6, enabled)
  }
}

function drawFormat(modules: boolean[][], reserved: boolean[][], bits: number) {
  for (let index = 0; index <= 5; index += 1) {
    setFunctionModule(modules, reserved, 8, index, bit(bits, index))
  }
  setFunctionModule(modules, reserved, 8, 7, bit(bits, 6))
  setFunctionModule(modules, reserved, 8, 8, bit(bits, 7))
  setFunctionModule(modules, reserved, 7, 8, bit(bits, 8))
  for (let index = 9; index < 15; index += 1) {
    setFunctionModule(modules, reserved, 14 - index, 8, bit(bits, index))
  }
  for (let index = 0; index < 8; index += 1) {
    setFunctionModule(modules, reserved, QR_SIZE - 1 - index, 8, bit(bits, index))
  }
  for (let index = 8; index < 15; index += 1) {
    setFunctionModule(modules, reserved, 8, QR_SIZE - 15 + index, bit(bits, index))
  }
  setFunctionModule(modules, reserved, QR_SIZE - 8, 8, true)
}

function drawCodewords(modules: boolean[][], reserved: boolean[][], codewords: number[]) {
  const bits = codewords.flatMap((codeword) =>
    Array.from({ length: 8 }, (_, index) => (codeword >>> (7 - index)) & 1),
  )
  let bitIndex = 0
  let upward = true

  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1

    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      const row = upward ? QR_SIZE - 1 - vertical : vertical
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset
        if (reserved[row][col]) continue

        const masked = maskPattern(row, col) ? 1 : 0
        modules[row][col] = Boolean((bits[bitIndex] ?? 0) ^ masked)
        bitIndex += 1
      }
    }

    upward = !upward
  }
}

function setFunctionModule(
  modules: boolean[][],
  reserved: boolean[][],
  row: number,
  col: number,
  enabled: boolean,
) {
  if (!isInQr(row, col)) return
  modules[row][col] = enabled
  reserved[row][col] = true
}

function isInQr(row: number, col: number) {
  return row >= 0 && row < QR_SIZE && col >= 0 && col < QR_SIZE
}

function maskPattern(row: number, col: number) {
  return (row + col) % 2 === 0
}

function formatBits(errorCorrectionLevel: number, mask: number) {
  let value = (errorCorrectionLevel << 3) | mask
  let remainder = value << 10
  for (let index = 14; index >= 10; index -= 1) {
    if (((remainder >>> index) & 1) !== 0) {
      remainder ^= QR_FORMAT_POLYNOMIAL << (index - 10)
    }
  }

  return ((value << 10) | remainder) ^ QR_FORMAT_MASK
}

function bit(value: number, index: number) {
  return ((value >>> index) & 1) !== 0
}

function reedSolomonRemainder(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree)
  const result = new Array<number>(degree).fill(0)

  data.forEach((dataByte) => {
    const factor = dataByte ^ result.shift()!
    result.push(0)
    generator.slice(1).forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor)
    })
  })

  return result
}

function reedSolomonGenerator(degree: number) {
  ensureGfTables()
  let result = [1]

  for (let index = 0; index < degree; index += 1) {
    const next = new Array<number>(result.length + 1).fill(0)
    result.forEach((coefficient, coefficientIndex) => {
      next[coefficientIndex] ^= coefficient
      next[coefficientIndex + 1] ^= gfMultiply(coefficient, qrGfExp[index])
    })
    result = next
  }

  return result
}

function gfMultiply(left: number, right: number) {
  if (left === 0 || right === 0) return 0
  ensureGfTables()
  return qrGfExp[qrGfLog[left] + qrGfLog[right]]
}

function ensureGfTables() {
  if (qrGfReady) return

  let value = 1
  for (let index = 0; index < 255; index += 1) {
    qrGfExp[index] = value
    qrGfLog[value] = index
    value <<= 1
    if ((value & 0x100) !== 0) value ^= QR_GF_POLYNOMIAL
  }
  for (let index = 255; index < qrGfExp.length; index += 1) {
    qrGfExp[index] = qrGfExp[index - 255]
  }

  qrGfReady = true
}

function unavailableQrSvg() {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">`,
    `<rect width="45" height="45" fill="#fff"/>`,
    `<rect x="4" y="4" width="37" height="37" fill="none" stroke="#111" stroke-width="1"/>`,
    `<text x="22.5" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="5" fill="#111">QR</text>`,
    `<text x="22.5" y="27" text-anchor="middle" font-family="Arial, sans-serif" font-size="4" fill="#111">no disponible</text>`,
    `</svg>`,
  ].join("")
}
