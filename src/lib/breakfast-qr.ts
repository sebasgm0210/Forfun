import qrcode from "qrcode-generator"

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

export function breakfastQrSvg(value: string) {
  const qr = qrcode(0, "M")
  qr.addData(value)
  qr.make()
  return qr.createSvgTag({ cellSize: 4 })
}

export function breakfastQrSvgDataUrl(value: string) {
  try {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(breakfastQrSvg(value))}`
  } catch {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(unavailableQrSvg())}`
  }
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
