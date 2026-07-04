const fs = require("fs");

function patchFile(file, replacements) {
  let text = fs.readFileSync(file, "utf8");

  for (const item of replacements) {
    const from = item.from;
    const to = item.to;
    const label = item.label;

    if (!text.includes(from)) {
      console.warn("NO encontrado: " + label + " en " + file);
      continue;
    }

    text = text.replace(from, to);
    console.log("OK: " + label + " en " + file);
  }

  fs.writeFileSync(file, text, "utf8");
}

patchFile("src/pages/RecepcionReservacionesPage.tsx", [
  {
    label: "NIT automatico reservaciones",
    from: `  useEffect(() => {
    if (!invoiceForm || invoiceForm.useCustomerTaxInfo) return;
    const taxId = normalizeNitForLookup(invoiceForm.taxId);

    if (!taxId || taxId === "CF") {
      setInvoiceNitLookupStatus("idle");
      if (invoiceForm.name !== "CONSUMIDOR FINAL") {
        updateInvoiceForm({ name: "CONSUMIDOR FINAL" });
      }
      return;
    }

    if (taxId.length < 7) {
      setInvoiceNitLookupStatus("idle");
      return;
    }

    setInvoiceNitLookupStatus("loading");
    const timeout = window.setTimeout(() => {
      void lookupInvoiceNitInfo({ silent: true, taxIdOverride: taxId });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [invoiceForm?.taxId, invoiceForm?.useCustomerTaxInfo]);`,
    to: `  useEffect(() => {
    if (!invoiceForm) return;
    const taxId = normalizeNitForLookup(invoiceForm.taxId);

    if (!taxId || taxId === "CF") {
      setInvoiceNitLookupStatus("idle");
      if (invoiceForm.name !== "CONSUMIDOR FINAL") {
        updateInvoiceForm({ name: "CONSUMIDOR FINAL" });
      }
      return;
    }

    if (taxId.length < 7) {
      setInvoiceNitLookupStatus("idle");
      return;
    }

    setInvoiceNitLookupStatus("loading");
    const timeout = window.setTimeout(() => {
      void lookupInvoiceNitInfo({ silent: true, taxIdOverride: taxId });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [invoiceForm?.taxId]);`
  },
  {
    label: "Bolson opcional reservaciones",
    from: `    if (remainingResult.status === "fulfilled") {
      setInvoiceRemaining(invoiceRemainingSummary(remainingResult.value));
    } else {
      setInvoiceRemaining(null);
      toast.error("No se pudo consultar el saldo de documentos fiscales.", {
        description: getApiErrorMessage(remainingResult.reason),
      });
    }`,
    to: `    if (remainingResult.status === "fulfilled") {
      setInvoiceRemaining(invoiceRemainingSummary(remainingResult.value));
    } else {
      setInvoiceRemaining(null);
      console.warn("No se pudo consultar el saldo de documentos fiscales.", remainingResult.reason);
    }`
  }
]);

patchFile("src/pages/RecepcionCheckinPage.tsx", [
  {
    label: "NIT automatico check-in",
    from: `  useEffect(() => {
    if (!invoiceForm || invoiceForm.useCustomerTaxInfo) return;
    const taxId = normalizeNitForLookup(invoiceForm.taxId);
    if (!taxId || taxId === "CF") {
      if (invoiceForm.name !== "CONSUMIDOR FINAL") {
        updateStayInvoiceForm({ name: "CONSUMIDOR FINAL" });
      }
      return;
    }

    if (taxId.length < 7) {
      setInvoiceNitLookupStatus("idle");
      return;
    }

    setInvoiceNitLookupStatus("loading");
    const timeout = window.setTimeout(() => {
      void lookupStayInvoiceNitInfo({ silent: true, taxIdOverride: taxId });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [invoiceForm?.taxId, invoiceForm?.useCustomerTaxInfo]);`,
    to: `  useEffect(() => {
    if (!invoiceForm) return;
    const taxId = normalizeNitForLookup(invoiceForm.taxId);
    if (!taxId || taxId === "CF") {
      if (invoiceForm.name !== "CONSUMIDOR FINAL") {
        updateStayInvoiceForm({ name: "CONSUMIDOR FINAL" });
      }
      return;
    }

    if (taxId.length < 7) {
      setInvoiceNitLookupStatus("idle");
      return;
    }

    setInvoiceNitLookupStatus("loading");
    const timeout = window.setTimeout(() => {
      void lookupStayInvoiceNitInfo({ silent: true, taxIdOverride: taxId });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [invoiceForm?.taxId]);`
  },
  {
    label: "Bolson opcional check-in",
    from: `    if (remainingResult.status === "fulfilled") {
      setInvoiceRemaining(invoiceRemainingSummary(remainingResult.value));
    } else {
      setInvoiceRemaining(null);
      toast.error("No se pudo consultar el bolson de facturas.", {
        description: getApiErrorMessage(remainingResult.reason),
      });
    }`,
    to: `    if (remainingResult.status === "fulfilled") {
      setInvoiceRemaining(invoiceRemainingSummary(remainingResult.value));
    } else {
      setInvoiceRemaining(null);
      console.warn("No se pudo consultar el bolson de facturas.", remainingResult.reason);
    }`
  }
]);
