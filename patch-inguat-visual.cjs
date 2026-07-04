const fs = require("fs");

const file = "src/pages/RecepcionCheckinPage.tsx";
let text = fs.readFileSync(file, "utf8");

const replacements = [
  [
`            checked={stay.checklist.inguat || inguatCanBeSkipped}
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
`            checked={stay.checklist.inguat}
            title="Libro INGUAT revisado"
            description={
              inguatCanBeSkipped
                ? "No hay pagos facturados FEL para esta llegada. INGUAT no es necesario para completar el check-in; márcalo solo si recepción lo revisó."
                : "Hay pagos facturados FEL para esta llegada. Por eso, revisar y marcar Libro INGUAT es obligatorio para completar el check-in."
            }`
  ],
  [
`                      checked={groupChecklistChecked("inguat") || groupInguatCanBeSkipped}
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
`                      checked={groupChecklistChecked("inguat")}
                      title="Libro INGUAT revisado"
                      description={
                        groupInguatCanBeSkipped
                          ? "No hay pagos facturados FEL para estas llegadas. INGUAT no es necesario para completar el check-in conjunto; márcalo solo si recepción lo revisó."
                          : "Hay pagos facturados FEL para estas llegadas. Por eso, revisar y marcar Libro INGUAT es obligatorio para completar el check-in conjunto."
                      }`
  ]
];

let changed = 0;

for (const [from, to] of replacements) {
  if (!text.includes(from)) {
    console.warn("No encontré uno de los bloques exactos. No lo modifiqué.");
    continue;
  }

  text = text.replace(from, to);
  changed += 1;
}

fs.writeFileSync(file, text, "utf8");
console.log(`Bloques modificados: ${changed}`);
