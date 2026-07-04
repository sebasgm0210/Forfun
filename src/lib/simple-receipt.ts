type ReceiptDetail = {
  label: string
  value: string
}

type SimpleReceipt = {
  title?: string
  code?: string
  customer: string
  concept: string
  amount: number
  method?: string
  reference?: string
  date?: string
  receivedBy?: string
  details?: ReceiptDetail[]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function receiptMoney(value: number) {
  const amount = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))

  return `${value < 0 ? "-" : ""}Q. ${amount}`
}

function receiptDate(value?: string) {
  if (value) return value

  return new Date().toLocaleString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function printSimpleReceipt(receipt: SimpleReceipt) {
  const win = window.open("", "_blank", "width=960,height=620")
  if (!win) return

  const details = receipt.details ?? []
  const code = receipt.code?.trim()
  const method = receipt.method?.trim()
  const reference = receipt.reference?.trim()
  const receivedBy = receipt.receivedBy?.trim()
  const logoUrl = `${window.location.origin}/casa-luna-logo.jpg`

  const detailsHtml = details
    .map(
      (detail) =>
        `<div class="info-line"><span class="info-label">${escapeHtml(detail.label)}</span><span class="info-value">${escapeHtml(detail.value)}</span></div>`,
    )
    .join("")

  const codeHtml = code
    ? `<div class="row"><span class="label">Código</span><span class="value">${escapeHtml(code)}</span></div>`
    : ""
  const methodHtml = method
    ? `<div class="row"><span class="label">Método</span><span class="value">${escapeHtml(method)}</span></div>`
    : ""
  const referenceHtml = reference
    ? `<div class="row"><span class="label">Referencia</span><span class="value">${escapeHtml(reference)}</span></div>`
    : ""
  const receivedByHtml = receivedBy
    ? `<div class="row"><span class="label">Recibió</span><span class="value">${escapeHtml(receivedBy)}</span></div>`
    : ""

  win.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(receipt.title ?? "Recibo sin factura")}</title>
        <style>
          @page { size: letter portrait; margin: 0; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #3f3429;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-size: 8.4px;
            line-height: 1.28;
          }
          .page {
            width: 215.9mm;
            min-height: 279.4mm;
            margin: 0 auto;
            background: #fff;
          }
          .half-sheet {
            width: 215.9mm;
            height: 139.7mm;
            padding: 6mm 7mm 4mm;
            overflow: hidden;
          }
          .receipt {
            width: 100%;
            height: 126mm;
            border: 1px solid #d8c7ac;
            border-radius: 13px;
            overflow: hidden;
            background: #fffdf8;
          }
          .header {
            display: grid;
            grid-template-columns: 1fr 42%;
            gap: 10px;
            align-items: start;
            padding: 9px 10px;
            background: linear-gradient(180deg, #fbf5ea 0%, #fffdf8 100%);
            border-bottom: 2px solid #b79263;
          }
          .brand { display: flex; gap: 9px; align-items: center; min-width: 0; }
          .logo {
            width: 48px;
            height: 48px;
            object-fit: contain;
            border: 1px solid #e0cfb6;
            border-radius: 10px;
            background: white;
            padding: 3px;
            flex: 0 0 auto;
          }
          .eyebrow {
            color: #8c7357;
            font-size: 6.5px;
            font-weight: 800;
            letter-spacing: .22em;
            text-transform: uppercase;
          }
          .hotel {
            margin-top: 1px;
            color: #5d4631;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 18px;
            font-weight: 700;
          }
          .document {
            margin-top: 2px;
            color: #7b6854;
            font-size: 7.5px;
          }
          .tag {
            margin-top: 6px;
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            background: #fff1d6;
            color: #8a5a1f;
            border: 1px solid #f2cc83;
            padding: 4px 8px;
            font-size: 7.2px;
            font-weight: 800;
            letter-spacing: .06em;
            text-transform: uppercase;
          }
          .meta {
            border: 1px solid #d8c7ac;
            border-radius: 10px;
            background: rgba(255,255,255,.92);
            padding: 7px 8px;
            min-width: 0;
          }
          .meta-title {
            margin-bottom: 5px;
            color: #6c4e2f;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 12px;
            font-weight: 700;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin-top: 2px;
          }
          .label { color: #8a7660; white-space: nowrap; }
          .value { text-align: right; font-weight: 700; word-break: break-word; }
          .body {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 170px;
            gap: 8px;
            padding: 8px 10px 10px;
          }
          .left-col, .right-col { min-width: 0; }
          .card {
            border: 1px solid #e3d6c2;
            border-radius: 9px;
            background: #fcf7ef;
            padding: 7px 8px;
          }
          .card + .card { margin-top: 7px; }
          .card-title {
            margin-bottom: 4px;
            color: #7a5c3d;
            font-size: 7px;
            font-weight: 800;
            letter-spacing: .09em;
            text-transform: uppercase;
          }
          .info-line {
            display: grid;
            grid-template-columns: 67px 1fr;
            gap: 5px;
            margin-top: 2px;
          }
          .info-label { color: #8b755f; }
          .info-value { color: #4d3b2b; font-weight: 700; word-break: break-word; }
          .amount-box {
            border: 1px solid #d9c6a8;
            border-radius: 9px;
            overflow: hidden;
            background: white;
          }
          .amount-head {
            padding: 6px 7px;
            background: #f8efe1;
            color: #7a5c3d;
            font-size: 7px;
            font-weight: 800;
            letter-spacing: .09em;
            text-transform: uppercase;
          }
          .amount-value {
            padding: 11px 8px;
            text-align: center;
            color: #5d4631;
            font-size: 22px;
            font-weight: 900;
          }
          .note {
            margin-top: 7px;
            border: 1px dashed #d9c6a8;
            border-radius: 9px;
            background: #fff8ea;
            color: #8a5a1f;
            padding: 7px;
            font-size: 7.3px;
            line-height: 1.42;
          }
          .signature {
            margin-top: 10px;
            padding-top: 16px;
            border-top: 1px solid #cdb89d;
            color: #8b755f;
            text-align: center;
            font-size: 7.3px;
          }
          .cut-line {
            height: 0;
            margin: 0 7mm;
            border-top: 1px dashed #b8b8b8;
          }
          @media screen {
            body { background: #f3f4f6; }
            .page {
              box-shadow: 0 20px 60px rgba(15, 23, 42, .16);
            }
          }
          @media (max-width: 760px) {
            .page {
              width: 100%;
              min-height: auto;
            }
            .half-sheet {
              width: 100%;
              height: auto;
              min-height: 0;
              padding: 12px;
            }
            .receipt {
              height: auto;
              min-height: 0;
            }
            .header { grid-template-columns: 1fr; }
            .body { grid-template-columns: 1fr; }
            .info-line { grid-template-columns: 86px 1fr; }
          }
          @media print {
            .page {
              width: 215.9mm;
              min-height: 279.4mm;
              margin: 0;
              box-shadow: none;
            }
            .half-sheet {
              width: 215.9mm;
              height: 139.7mm;
              page-break-inside: avoid;
            }
            .receipt { height: 126mm; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="half-sheet">
            <article class="receipt">
              <header class="header">
                <div class="brand">
                  <img class="logo" src="${escapeHtml(logoUrl)}" alt="Casa Luna" />
                  <div>
                    <div class="eyebrow">Boutique Hotel</div>
                    <div class="hotel">Casa Luna</div>
                    <div class="document">Comprobante interno de recepción</div>
                    <div class="tag">Recibo sin factura</div>
                  </div>
                </div>
                <div class="meta">
                  <div class="meta-title">${escapeHtml(receipt.title ?? "Recibo sin factura")}</div>
                  ${codeHtml}
                  <div class="row"><span class="label">Fecha</span><span class="value">${escapeHtml(receiptDate(receipt.date))}</span></div>
                  ${methodHtml}
                  ${referenceHtml}
                  ${receivedByHtml}
                </div>
              </header>

              <section class="body">
                <div class="left-col">
                  <div class="card">
                    <div class="card-title">Datos del receptor</div>
                    <div class="info-line"><span class="info-label">Cliente</span><span class="info-value">${escapeHtml(receipt.customer)}</span></div>
                    <div class="info-line"><span class="info-label">Concepto</span><span class="info-value">${escapeHtml(receipt.concept)}</span></div>
                    ${detailsHtml}
                  </div>

                  <div class="card">
                    <div class="card-title">Observación</div>
                    <div class="info-value" style="font-weight: 500; color:#6a573f;">
                      Este recibo sirve como comprobante interno de pago recibido y no sustituye factura ni documento fiscal FEL.
                    </div>
                    <div class="signature">Firma / sello de recepción</div>
                  </div>
                </div>

                <div class="right-col">
                  <div class="amount-box">
                    <div class="amount-head">Monto recibido</div>
                    <div class="amount-value">${receiptMoney(receipt.amount)}</div>
                  </div>

                  <div class="note">
                    Conserve este recibo como soporte del pago recibido. Si necesita documento fiscal, solicite su factura FEL en recepción.
                  </div>
                </div>
              </section>
            </article>
          </section>
          <div class="cut-line"></div>
        </main>
        <script>window.onload = () => { window.focus(); window.print(); }</script>
      </body>
    </html>
  `)

  win.document.close()
}
