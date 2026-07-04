const fs = require("fs");

function patchFile(file, replacements) {
  let text = fs.readFileSync(file, "utf8");

  for (const item of replacements) {
    if (text.includes(item.toCheck || item.to)) {
      console.log("YA aplicado: " + item.label);
      continue;
    }

    if (!text.includes(item.from)) {
      console.warn("NO encontrado: " + item.label);
      continue;
    }

    text = text.replace(item.from, item.to);
    console.log("OK: " + item.label);
  }

  fs.writeFileSync(file, text, "utf8");
}

patchFile("src/pages/RecepcionReservacionesPage.tsx", [
  {
    label: "props guardar pagos card",
    toCheck: "hasUnsavedPaymentChanges,",
    from: `  onPrintPaymentReceipt,
  onIssueInvoice,
  onAbonosChange,
}: {
  reservation: Reservation;
  credit?: GuestCreditInfo;
  onStartCheckIn: () => void;
  onOpenCheckout: () => void;
  onCancelReservation: () => void;
  onPrintPaymentReceipt: (payment: PaymentRecord) => void;
  onIssueInvoice: () => void;
  onAbonosChange: (payments: PaymentRecord[]) => void;
}) {`,
    to: `  onPrintPaymentReceipt,
  onIssueInvoice,
  onAbonosChange,
  hasUnsavedPaymentChanges,
  onSavePayments,
}: {
  reservation: Reservation;
  credit?: GuestCreditInfo;
  onStartCheckIn: () => void;
  onOpenCheckout: () => void;
  onCancelReservation: () => void;
  onPrintPaymentReceipt: (payment: PaymentRecord) => void;
  onIssueInvoice: () => void;
  onAbonosChange: (payments: PaymentRecord[]) => void;
  hasUnsavedPaymentChanges?: boolean;
  onSavePayments: () => void;
}) {`
  },
  {
    label: "boton guardar pagos",
    toCheck: "Pagos pendientes de guardar",
    from: `        <PaymentBreakdownCard
          title={
            reservation.status === "Ocupada"
              ? "Pagos de la reserva y estadía"
              : "Pagos de la reserva"
          }
          description={
            reservation.status === "Ocupada"
              ? "Puedes registrar pagos adicionales mientras la habitación esté ocupada."
              : "Agrega pagos antes de enviar la reserva a check-in. Luego podrás facturarlos desde esta misma reserva."
          }
          total={reservation.total}
          payments={reservation.payments}
          onChange={onAbonosChange}
          isPaymentReadOnly={(payment) => paymentBackendId(payment) !== null}
          isPaymentRemovable={(payment) =>
            paymentBackendId(payment) === null ||
            reservationPaymentInvoicedAmount(payment) <= 0.01
          }
          stage="reserva"
          allowCredit={
            Boolean(creditInfo) ||
            reservation.payments.some((payment) => payment.method === "credito")
          }
          creditInfo={creditInfo}
          addLabel="Agregar pago"
          paidLabel="Pagos registrados"
          emptyLabel="Sin pagos registrados todavía."
          referencePlaceholder="Noche 1, boleta, voucher..."
          onPrintPayment={onPrintPaymentReceipt}
          showInvoiceStatus
          headerLayout="inline"
          className="mt-4"
        />`,
    to: `        <>
          <PaymentBreakdownCard
            title={
              reservation.status === "Ocupada"
                ? "Pagos de la reserva y estadía"
                : "Pagos de la reserva"
            }
            description={
              reservation.status === "Ocupada"
                ? "Puedes registrar pagos adicionales mientras la habitación esté ocupada."
                : "Agrega pagos antes de enviar la reserva a check-in. Luego podrás facturarlos desde esta misma reserva."
            }
            total={reservation.total}
            payments={reservation.payments}
            onChange={onAbonosChange}
            isPaymentReadOnly={(payment) => paymentBackendId(payment) !== null}
            isPaymentRemovable={(payment) =>
              paymentBackendId(payment) === null ||
              reservationPaymentInvoicedAmount(payment) <= 0.01
            }
            stage="reserva"
            allowCredit={
              Boolean(creditInfo) ||
              reservation.payments.some((payment) => payment.method === "credito")
            }
            creditInfo={creditInfo}
            addLabel="Agregar pago"
            paidLabel="Pagos registrados"
            emptyLabel="Sin pagos registrados todavía."
            referencePlaceholder="Noche 1, boleta, voucher..."
            onPrintPayment={onPrintPaymentReceipt}
            showInvoiceStatus
            headerLayout="inline"
            className="mt-4"
          />

          {hasUnsavedPaymentChanges ? (
            <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Pagos pendientes de guardar</p>
                <p className="text-xs text-amber-900/80">
                  Los cambios no se enviarán al backend hasta presionar Guardar pagos.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0 rounded-full"
                onClick={onSavePayments}
              >
                Guardar pagos
              </Button>
            </div>
          ) : null}
        </>`
  },
  {
    label: "no limpiar drafts pagos no ocupada",
    from: `    const paymentLockedReservationIds = new Set(
      incomingReservations
        .filter((reservation) => reservation.status !== "Ocupada")
        .map((reservation) => reservation.id),
    );

    paymentLockedReservationIds.forEach((id) => {
      dirtyReservationPaymentIdsRef.current.delete(id);
    });
    setDirtyReservationPaymentIds((current) => {
      const next = new Set(current);
      paymentLockedReservationIds.forEach((id) => next.delete(id));
      return next;
    });

`,
    to: ``
  },
  {
    label: "preservar pagos locales",
    from: `      return incomingReservations.map((incoming) => {
        if (incoming.status !== "Ocupada") return incoming;
        if (!dirtyReservationPaymentIdsRef.current.has(incoming.id))
          return incoming;`,
    to: `      return incomingReservations.map((incoming) => {
        if (!dirtyReservationPaymentIdsRef.current.has(incoming.id)) {
          return incoming;
        }`
  },
  {
    label: "quitar autosave pagos reservaciones",
    toCheck: "No usar autosave aquí",
    from: `  useEffect(() => {
    if (dirtyReservationPaymentIds.size === 0) return;

    const ids = Array.from(dirtyReservationPaymentIds).filter((id) => {
      const reservation = reservations.find((item) => item.id === id);
      if (!reservation) return false;

      const hasDeletedSavedPayments =
        (deletedReservationPaymentIdsRef.current[id]?.length ?? 0) > 0;
      const hasNewPaymentsWithAmount = reservation.payments.some(
        (payment) =>
          payment.stage === "reserva" &&
          Number(payment.amount || 0) > 0 &&
          paymentBackendId(payment) === null,
      );

      return hasDeletedSavedPayments || hasNewPaymentsWithAmount;
    });

    if (ids.length === 0) return;

    const timer = window.setTimeout(() => {
      ids.forEach((id) => {
        void saveReservationPayments(id, { silent: true });
      });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [dirtyReservationPaymentIds, reservations]);`,
    to: `  // En Reservaciones los pagos se guardan manualmente con el botón "Guardar pagos".
  // No usar autosave aquí: al escribir montos como 300, un debounce podía guardar solo "3".`
  },
  {
    label: "facturar no guarda pagos sucios",
    from: `    if (dirtyReservationPaymentIdsRef.current.has(reservation.id)) {
      const savedReservation = await saveReservationPayments(reservation.id, {
        silent: true,
      });
      if (!savedReservation) return;
      targetReservation = savedReservation;
    }`,
    to: `    if (dirtyReservationPaymentIdsRef.current.has(reservation.id)) {
      toast.warning("Guarda los pagos antes de facturar.", {
        description:
          "Hay cambios pendientes en los pagos de esta reserva. Presiona Guardar pagos y luego vuelve a facturar.",
      });
      return;
    }`
  },
  {
    label: "pasar props guardar pagos",
    toCheck: "hasUnsavedPaymentChanges={dirtyReservationPaymentIds.has(",
    from: `                    onAbonosChange={(payments) =>
                      updateReservationPayments(reservation.id, payments)
                    }
                  />`,
    to: `                    onAbonosChange={(payments) =>
                      updateReservationPayments(reservation.id, payments)
                    }
                    hasUnsavedPaymentChanges={dirtyReservationPaymentIds.has(
                      reservation.id,
                    )}
                    onSavePayments={() => {
                      void saveReservationPayments(reservation.id);
                    }}
                  />`
  },
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
    label: "INGUAT visual single",
    toCheck: "INGUAT no es necesario para completar el check-in; márcalo solo si recepción lo revisó.",
    from: `            checked={stay.checklist.inguat || inguatCanBeSkipped}
            title={
              inguatCanBeSkipped && !stay.checklist.inguat
                ? "Libro INGUAT no requerido"
                : "Libro INGUAT revisado"
            }
            description={
              inguatCanBeSkipped && !stay.checklist.inguat
                ? "No hay pagos facturados FEL para esta llegada. Para este caso, el check-in puede completarse sin revisar INGUAT."
                : "Confirmar que los datos del huésped están listos para el registro."
            }`,
    to: `            checked={stay.checklist.inguat}
            title="Libro INGUAT revisado"
            description={
              inguatCanBeSkipped
                ? "No hay pagos facturados FEL para esta llegada. INGUAT no es necesario para completar el check-in; márcalo solo si recepción lo revisó."
                : "Hay pagos facturados FEL para esta llegada. Por eso, revisar y marcar Libro INGUAT es obligatorio para completar el check-in."
            }`
  },
  {
    label: "INGUAT visual grupo",
    toCheck: "INGUAT no es necesario para completar el check-in conjunto; márcalo solo si recepción lo revisó.",
    from: `                      checked={groupChecklistChecked("inguat") || groupInguatCanBeSkipped}
                      title={
                        groupInguatCanBeSkipped && !groupChecklistChecked("inguat")
                          ? "Libro INGUAT no requerido"
                          : "Libro INGUAT revisado"
                      }
                      description={
                        groupInguatCanBeSkipped && !groupChecklistChecked("inguat")
                          ? "No hay pagos facturados FEL para estas llegadas. El check-in conjunto puede completarse sin revisar INGUAT."
                          : "Confirmar una sola vez los datos de llegada del cliente para todas sus habitaciones."
                      }`,
    to: `                      checked={groupChecklistChecked("inguat")}
                      title="Libro INGUAT revisado"
                      description={
                        groupInguatCanBeSkipped
                          ? "No hay pagos facturados FEL para estas llegadas. INGUAT no es necesario para completar el check-in conjunto; márcalo solo si recepción lo revisó."
                          : "Hay pagos facturados FEL para estas llegadas. Por eso, revisar y marcar Libro INGUAT es obligatorio para completar el check-in conjunto."
                      }`
  }
]);
