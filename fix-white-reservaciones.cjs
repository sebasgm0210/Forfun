const fs = require("fs");

const file = "src/pages/RecepcionReservacionesPage.tsx";
let text = fs.readFileSync(file, "utf8");

let changed = 0;

if (!text.includes("hasUnsavedPaymentChanges = false,")) {
  text = text.replace(
`  onIssueInvoice,
  onAbonosChange,
}: {`,
`  onIssueInvoice,
  onAbonosChange,
  hasUnsavedPaymentChanges = false,
  onSavePayments,
}: {`
  );
  changed++;
}

if (!text.includes("hasUnsavedPaymentChanges?: boolean;")) {
  text = text.replace(
`  onIssueInvoice: () => void;
  onAbonosChange: (payments: PaymentRecord[]) => void;
}) {`,
`  onIssueInvoice: () => void;
  onAbonosChange: (payments: PaymentRecord[]) => void;
  hasUnsavedPaymentChanges?: boolean;
  onSavePayments?: () => void;
}) {`
  );
  changed++;
}

fs.writeFileSync(file, text, "utf8");
console.log("Cambios aplicados:", changed);
