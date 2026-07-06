# Fotos de desayunos de cortesia

Los 8 desayunos de cortesia son un catalogo fijo y no se van a agregar mas, asi que sus
fotos se guardan aqui como archivos estaticos del frontend en vez de subirse al backend.

Guarda cada imagen en formato **.jpg**, con exactamente este nombre de archivo (coincide
con el nombre del platillo tal como esta en el catalogo hoy):

| Platillo | Archivo esperado |
| --- | --- |
| Chapin | `chapin.jpg` |
| Crostini de Hongos | `crostini-de-hongos.jpg` |
| Waffle o Panqueque | `waffle-o-panqueque.jpg` |
| Bowl de frutas | `bowl-de-frutas.jpg` |
| Cazuela de frijol | `cazuela-de-frijol.jpg` |
| Cazuela de salsa roja | `cazuela-de-salsa-roja.jpg` |
| Platano frito | `platano-frito.jpg` |
| Huevos Montados | `huevos-montados.jpg` |

Si falta el archivo de un platillo, la pantalla simplemente muestra el marcador
"Foto pendiente" para ese platillo - no rompe nada.

Si en el futuro cambia el nombre de un platillo, el archivo de imagen se debe renombrar
igual (el nombre de archivo se calcula a partir del nombre del platillo, ver
`src/lib/breakfast-images.ts`).
