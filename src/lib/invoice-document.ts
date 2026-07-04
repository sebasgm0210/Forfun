import { api, type ApiId } from "@/lib/api";

type ApiRecord = Record<string, unknown>;

type PrintableInvoiceItem = {
  itemType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
};

type PrintableInvoice = {
  id: string;
  status: string;
  sourceModule: string;
  sourceId: string;
  customerNit: string;
  customerName: string;
  customerAddress: string;
  customerEmail: string;
  authorizationNumber: string;
  series: string;
  dteNumber: string;
  issuedAt: string;
  subtotal: number;
  tax: number;
  total: number;
  items: PrintableInvoiceItem[];
};

const ISSUER = {
  legalName: "CORPORACIÓN EL GRAN JAGUAR, SOCIEDAD ANÓNIMA",
  nit: "117364797",
  tradeName: "CASA LUNA BOUTIQUE HOTEL",
  address: "4 CALLE 14A-27, zona 1, Quetzaltenango, Quetzaltenango",
};

const CERTIFIER = {
  nit: "77454820",
  name: "DIGIFACT SERVICIOS, SOCIEDAD ANÓNIMA",
};

function record(value: unknown): ApiRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApiRecord)
    : {};
}

function nestedInvoiceRecord(value: unknown) {
  const root = record(value);
  const data = record(root.data);
  return Object.keys(data).length > 0 ? data : root;
}

function stringValue(source: ApiRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function numberValue(source: ApiRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = source[key];
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return fallback;
}

function arrayValue(source: ApiRecord, keys: string[]) {
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key] as unknown[];
  }
  return [];
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value: number) {
  return `Q. ${new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)}`;
}

function dateLabel(value: string) {
  if (!value) return new Date().toLocaleString("es-GT");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "reservation") return "Reservación";
  if (normalized === "checkin") return "Check-in";
  if (normalized === "checkout") return "Check-out";
  if (normalized === "minibar") return "Minibar";
  if (normalized === "event") return "Evento";
  return value || "Recepción";
}

function invoiceItem(value: unknown): PrintableInvoiceItem {
  const item = record(value);
  const quantity = numberValue(item, ["quantity", "qty"], 1);
  const unitPrice = numberValue(item, [
    "unit_price_with_tax",
    "unitPriceWithTax",
    "unit_price",
    "unitPrice",
  ]);
  const total = numberValue(
    item,
    ["line_total_with_tax", "lineTotalWithTax", "total_amount", "totalAmount"],
    quantity * unitPrice,
  );
  const subtotal = numberValue(
    item,
    ["line_subtotal_without_tax", "lineSubtotalWithoutTax", "subtotal_amount"],
    total / 1.12,
  );
  const tax = numberValue(
    item,
    ["line_tax", "lineTax", "tax_amount", "taxAmount"],
    Math.max(0, total - subtotal),
  );

  return {
    itemType: stringValue(item, ["item_type", "itemType"], "SERVICIO"),
    description: stringValue(item, ["description"], "Servicio facturado"),
    quantity,
    unitPrice,
    subtotal,
    tax,
    total,
    notes: stringValue(item, ["notes"]),
  };
}

function printableInvoice(value: unknown): PrintableInvoice {
  const invoice = nestedInvoiceRecord(value);
  const items = arrayValue(invoice, ["items", "invoice_items", "invoiceItems"]).map(
    invoiceItem,
  );
  const totalFromItems = items.reduce((sum, item) => sum + item.total, 0);
  const subtotalFromItems = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxFromItems = items.reduce((sum, item) => sum + item.tax, 0);

  return {
    id: stringValue(invoice, ["id_invoice", "idInvoice", "invoice_id", "id"]),
    status: stringValue(invoice, ["fel_status", "felStatus", "status"], "CERTIFIED"),
    sourceModule: stringValue(invoice, ["source_module", "sourceModule"]),
    sourceId: stringValue(invoice, ["source_id", "sourceId"]),
    customerNit: stringValue(invoice, ["client_nit", "clientNit", "tax_id", "taxId"], "CF"),
    customerName: stringValue(
      invoice,
      ["client_name", "clientName", "customer_name", "customerName", "name"],
      "CONSUMIDOR FINAL",
    ),
    customerAddress: stringValue(
      invoice,
      ["client_address", "clientAddress", "address"],
      "CIUDAD",
    ),
    customerEmail: stringValue(invoice, ["client_email", "clientEmail", "email"]),
    authorizationNumber: stringValue(invoice, [
      "digifact_auth_number",
      "digifactAuthNumber",
      "authorization_number",
      "authorizationNumber",
      "uuid",
    ]),
    series: stringValue(invoice, ["digifact_serie", "digifactSerie", "serie", "series"]),
    dteNumber: stringValue(invoice, [
      "digifact_numero",
      "digifactNumero",
      "invoice_number",
      "invoiceNumber",
      "number",
    ]),
    issuedAt: stringValue(invoice, ["issued_at", "issuedAt", "createdAt", "created_at"]),
    subtotal: numberValue(
      invoice,
      ["subtotal_amount", "subtotalAmount", "subtotal"],
      subtotalFromItems,
    ),
    tax: numberValue(invoice, ["total_tax", "totalTax", "tax"], taxFromItems),
    total: numberValue(
      invoice,
      ["total_amount", "totalAmount", "grand_total", "grandTotal", "total"],
      totalFromItems,
    ),
    items,
  };
}

function hasPrintableDetails(value: unknown) {
  const invoice = nestedInvoiceRecord(value);
  return Boolean(
    stringValue(invoice, ["digifact_auth_number", "authorizationNumber", "uuid"]) &&
      arrayValue(invoice, ["items", "invoice_items", "invoiceItems"]).length > 0,
  );
}

function invoiceDocumentTitle(invoice: PrintableInvoice) {
  const invoiceNumber = [invoice.series, invoice.dteNumber].filter(Boolean).join("-");
  const id = invoiceNumber || invoice.dteNumber || invoice.id || invoice.authorizationNumber || "sin-numero";
  return `Factura-${id}-Casa-Luna-Hotel`.replace(/[^\w.-]+/g, "-");
}

function invoiceHtml(invoice: PrintableInvoice) {
  const invoiceNumber = [invoice.series, invoice.dteNumber].filter(Boolean).join("-");
  const source = [
    sourceLabel(invoice.sourceModule),
    invoice.sourceId ? `#${invoice.sourceId}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const items = invoice.items.length
    ? invoice.items
    : [
        {
          itemType: "SERVICIO",
          description: "Servicio facturado",
          quantity: 1,
          unitPrice: invoice.total,
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          total: invoice.total,
          notes: "",
        },
      ];

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(invoiceDocumentTitle(invoice))}</title>
        <style>
          @page { size: Letter portrait; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body {
            color: #3f3429;
            background: #fff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 7.2px;
            line-height: 1.22;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-page {
            width: 8.5in;
            min-height: 11in;
            margin: 0 auto;
            background: #fff;
          }
          .half-sheet {
            position: relative;
            width: 8.5in;
            height: 5.5in;
            padding: 0.22in 0.28in 0.18in;
            overflow: hidden;
          }
          .half-sheet::after {
            content: "";
            position: absolute;
            left: 0.28in;
            right: 0.28in;
            bottom: 0;
            border-bottom: 1px dashed rgba(111, 81, 52, .35);
          }
          .invoice {
            width: 100%;
            height: 100%;
            border: 1px solid #d8c7ac;
            border-radius: 11px;
            overflow: hidden;
            background: #fffdf8;
            display: flex;
            flex-direction: column;
          }
          .header {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 2.45in;
            gap: 8px;
            align-items: start;
            padding: 7px 9px;
            background: linear-gradient(180deg, #fbf5ea 0%, #fffdf8 100%);
            border-bottom: 2px solid #b79263;
            flex: 0 0 auto;
          }
          .brand { display: flex; gap: 8px; align-items: center; min-width: 0; }
          .logo {
            width: 39px;
            height: 39px;
            object-fit: contain;
            border: 1px solid #e0cfb6;
            border-radius: 8px;
            background: white;
            padding: 3px;
            flex: 0 0 auto;
          }
          .eyebrow {
            color: #8c7357;
            font-size: 5.8px;
            font-weight: 800;
            letter-spacing: .2em;
            text-transform: uppercase;
          }
          .hotel {
            margin-top: 1px;
            color: #5d4631;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 15px;
            font-weight: 700;
          }
          .document {
            margin-top: 1px;
            color: #7b6854;
            font-size: 6.6px;
          }
          .meta {
            border: 1px solid #d8c7ac;
            border-radius: 8px;
            background: rgba(255,255,255,.92);
            padding: 5px 7px;
          }
          .meta-title {
            margin-bottom: 3px;
            color: #6c4e2f;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 10px;
            font-weight: 700;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 7px;
            margin-top: 1px;
          }
          .label { color: #8a7660; white-space: nowrap; }
          .value { text-align: right; font-weight: 700; word-break: break-word; }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            padding: 6px 8px 0;
            flex: 0 0 auto;
          }
          .card {
            border: 1px solid #e3d6c2;
            border-radius: 8px;
            background: #fcf7ef;
            padding: 5px 7px;
            min-width: 0;
          }
          .card-title {
            margin-bottom: 3px;
            color: #7a5c3d;
            font-size: 6px;
            font-weight: 800;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          .info-line {
            display: grid;
            grid-template-columns: 62px minmax(0, 1fr);
            gap: 4px;
            margin-top: 1px;
          }
          .info-label { color: #8b755f; }
          .info-value { color: #4d3b2b; font-weight: 700; overflow-wrap: anywhere; }
          .section { padding: 6px 8px 0; flex: 1 1 auto; min-height: 0; }
          .section-title {
            margin: 0 0 4px;
            color: #6a4c2e;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 9px;
          }
          .table-box {
            border: 1px solid #eadfce;
            border-radius: 8px;
            overflow: hidden;
            background: #fffdfa;
          }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th {
            padding: 4px 3px;
            background: #6e5134;
            color: #fffaf4;
            font-size: 5.5px;
            letter-spacing: .025em;
            text-align: left;
            text-transform: uppercase;
          }
          th:nth-child(1), td:nth-child(1) { width: 18px; }
          th:nth-child(2), td:nth-child(2) { width: 48px; }
          th:nth-child(3), td:nth-child(3) { width: 34px; }
          th:nth-child(5), td:nth-child(5),
          th:nth-child(6), td:nth-child(6),
          th:nth-child(7), td:nth-child(7) { width: 72px; }
          td {
            padding: 4px 3px;
            border-bottom: 1px solid #eee5d8;
            vertical-align: top;
            overflow-wrap: anywhere;
          }
          tbody tr:last-child td { border-bottom: 0; }
          .number { text-align: right; white-space: nowrap; }
          .item-note { margin-top: 1px; color: #8b755f; font-size: 6px; }
          .bottom {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 1.55in;
            gap: 7px;
            padding: 6px 8px 7px;
            flex: 0 0 auto;
          }
          .certification {
            border: 1px solid #eadfce;
            border-radius: 8px;
            background: #fcf8f2;
            padding: 5px 7px;
            min-width: 0;
          }
          .certification strong { color: #6a4c2e; }
          .authorization {
            margin-top: 3px;
            color: #5d4631;
            font-size: 6.1px;
            word-break: break-all;
          }
          .footer-note {
            margin-top: 3px;
            color: #8b755f;
            font-size: 5.8px;
          }
          .totals {
            border: 1px solid #d9c6a8;
            border-radius: 8px;
            overflow: hidden;
            background: white;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            gap: 7px;
            padding: 4px 6px;
            border-bottom: 1px solid #eee2d2;
          }
          .total-row:last-child { border-bottom: 0; }
          .grand-total {
            background: linear-gradient(90deg, #7a5938 0%, #9b7751 100%);
            color: #fffaf4;
            font-size: 8px;
            font-weight: 800;
          }
          @media screen {
            body { background: #e5e7eb; }
            .print-page { box-shadow: 0 10px 30px rgba(15, 23, 42, .2); }
          }
        </style>
      </head>
      <body>
        <div class="print-page">
          <section class="half-sheet">
            <main class="invoice">
          <header class="header">
            <div class="brand">
              <img class="logo" src="${escapeHtml(`${window.location.origin}/casa-luna-logo.jpg`)}" alt="Casa Luna" />
              <div>
                <div class="eyebrow">Boutique Hotel</div>
                <div class="hotel">Casa Luna</div>
                <div class="document">Documento Tributario Electrónico FEL</div>
              </div>
            </div>
            <div class="meta">
              <div class="meta-title">Factura ${escapeHtml(invoiceNumber || `#${invoice.id}`)}</div>
              <div class="row"><span class="label">Serie</span><span class="value">${escapeHtml(invoice.series || "N/D")}</span></div>
              <div class="row"><span class="label">Número DTE</span><span class="value">${escapeHtml(invoice.dteNumber || "N/D")}</span></div>
              <div class="row"><span class="label">Emisión</span><span class="value">${escapeHtml(dateLabel(invoice.issuedAt))}</span></div>
              <div class="row"><span class="label">Moneda</span><span class="value">GTQ</span></div>
              <div class="row"><span class="label">Estado</span><span class="value">${escapeHtml(invoice.status)}</span></div>
            </div>
          </header>

          <section class="info-grid">
            <div class="card">
              <div class="card-title">Datos del emisor</div>
              <div class="info-line"><span class="info-label">Razón social</span><span class="info-value">${escapeHtml(ISSUER.legalName)}</span></div>
              <div class="info-line"><span class="info-label">NIT emisor</span><span class="info-value">${escapeHtml(ISSUER.nit)}</span></div>
              <div class="info-line"><span class="info-label">Comercial</span><span class="info-value">${escapeHtml(ISSUER.tradeName)}</span></div>
              <div class="info-line"><span class="info-label">Dirección</span><span class="info-value">${escapeHtml(ISSUER.address)}</span></div>
            </div>
            <div class="card">
              <div class="card-title">Datos del receptor</div>
              <div class="info-line"><span class="info-label">NIT</span><span class="info-value">${escapeHtml(invoice.customerNit)}</span></div>
              <div class="info-line"><span class="info-label">Nombre</span><span class="info-value">${escapeHtml(invoice.customerName)}</span></div>
              <div class="info-line"><span class="info-label">Dirección</span><span class="info-value">${escapeHtml(invoice.customerAddress)}</span></div>
              <div class="info-line"><span class="info-label">Correo</span><span class="info-value">${escapeHtml(invoice.customerEmail || "No registrado")}</span></div>
              <div class="info-line"><span class="info-label">Origen</span><span class="info-value">${escapeHtml(source)}</span></div>
            </div>
          </section>

          <section class="section">
            <h2 class="section-title">Detalle de la factura</h2>
            <div class="table-box">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>B/S</th>
                    <th>Cant.</th>
                    <th>Descripción</th>
                    <th class="number">Precio</th>
                    <th class="number">IVA</th>
                    <th class="number">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${items
                    .map(
                      (item, index) => `
                        <tr>
                          <td>${index + 1}</td>
                          <td>${escapeHtml(item.itemType)}</td>
                          <td class="number">${escapeHtml(item.quantity)}</td>
                          <td>
                            ${escapeHtml(item.description)}
                            ${item.notes ? `<div class="item-note">${escapeHtml(item.notes)}</div>` : ""}
                          </td>
                          <td class="number">${escapeHtml(money(item.unitPrice))}</td>
                          <td class="number">${escapeHtml(money(item.tax))}</td>
                          <td class="number"><strong>${escapeHtml(money(item.total))}</strong></td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </section>

          <section class="bottom">
            <div class="certification">
              <strong>Número de autorización</strong>
              <div class="authorization">${escapeHtml(invoice.authorizationNumber || "Número de autorización no disponible")}</div>
              <div class="footer-note">
                <strong>Certificador:</strong> NIT ${escapeHtml(CERTIFIER.nit)} · ${escapeHtml(CERTIFIER.name)}
              </div>
            </div>
            <div class="totals">
              <div class="total-row"><span>Subtotal</span><strong>${escapeHtml(money(invoice.subtotal))}</strong></div>
              <div class="total-row"><span>IVA</span><strong>${escapeHtml(money(invoice.tax))}</strong></div>
              <div class="total-row grand-total"><span>Total</span><strong>${escapeHtml(money(invoice.total))}</strong></div>
            </div>
          </section>
            </main>
          </section>
        </div>
      </body>
    </html>
  `;
}

function printHtmlDocument(html: string, documentTitle?: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  return new Promise<void>((resolve, reject) => {
    const printWindow = iframe.contentWindow;
    const printDocument = iframe.contentDocument;

    if (!printWindow || !printDocument) {
      iframe.remove();
      reject(new Error("No se pudo preparar el documento de impresión."));
      return;
    }

    const previousTitle = document.title;
    let finished = false;
    const restoreTitle = () => {
      if (documentTitle) {
        document.title = previousTitle;
      }
    };
    const cleanup = () => {
      if (finished) return;
      finished = true;
      restoreTitle();
      window.setTimeout(() => iframe.remove(), 500);
      resolve();
    };

    printWindow.addEventListener("afterprint", cleanup, { once: true });
    printDocument.open();
    printDocument.write(html);
    printDocument.close();

    const requestPrint = () => {
      try {
        if (documentTitle) {
          document.title = documentTitle;
        }
        printWindow.focus();
        printWindow.print();
        window.setTimeout(cleanup, 30_000);
      } catch (error) {
        restoreTitle();
        iframe.remove();
        reject(error instanceof Error ? error : new Error("No se pudo imprimir la factura."));
      }
    };

    const logo = printDocument.querySelector("img");
    if (logo && !logo.complete) {
      logo.addEventListener("load", () => window.setTimeout(requestPrint, 80), {
        once: true,
      });
      logo.addEventListener("error", () => window.setTimeout(requestPrint, 80), {
        once: true,
      });
    } else {
      window.setTimeout(requestPrint, 80);
    }
  });
}

export async function printOfficialInvoice(
  invoiceId: ApiId | undefined,
  initialResponse?: unknown,
) {
  let response = initialResponse;

  if (
    (!response || !hasPrintableDetails(response)) &&
    invoiceId !== undefined &&
    invoiceId !== null &&
    invoiceId !== ""
  ) {
    response = await api.invoices.getById<unknown>(invoiceId);
  }

  const invoice = printableInvoice(response);
  if (!invoice.id && !invoice.authorizationNumber && invoice.total <= 0) {
    throw new Error("La factura no devolvió información suficiente para imprimir.");
  }

  await printHtmlDocument(invoiceHtml(invoice), invoiceDocumentTitle(invoice));
}
