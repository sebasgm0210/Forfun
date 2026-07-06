// Los 8 desayunos de cortesia son un catalogo fijo (confirmado con el hotel, no se
// agregaran mas), asi que sus fotos viven como archivos estaticos en /public/images/breakfast
// en vez de subirse al backend. El nombre de archivo esperado es el slug del nombre del
// platillo (ver public/images/breakfast/README.md para la lista exacta).
export function breakfastImageSlug(label: string) {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function breakfastImagePath(label: string) {
  const slug = breakfastImageSlug(label)
  return slug ? `/images/breakfast/${slug}.jpg` : undefined
}
