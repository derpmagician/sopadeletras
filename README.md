# Cuadrícula

Editor web independiente para crear crucigramas y sopas de letras. Para usarlo no necesita servidor, conexión a Internet ni instalar paquetes: la biblioteca de PDF se incluye localmente.

## Uso

Abre [index.html](./index.html) en un navegador moderno. Elige el formato, introduce el título y las palabras y pulsa **Generar pasatiempo**. Para un crucigrama escribe una palabra y su pista por línea, separadas por `|`. Para una sopa de letras basta una palabra por línea.

Los espacios y símbolos de las respuestas se omiten al generar la cuadrícula: `arroz con leche` se convierte en `ARROZCONLECHE`. Las tildes se eliminan y la Ñ se conserva; las pistas no se modifican. Después de normalizar, cada respuesta debe tener entre 2 y 24 letras del alfabeto español; en las sopas también se admiten números. La barra `|` separa la respuesta de la pista. Se admiten hasta 40 respuestas y se detectan duplicados después de normalizarlas. Si una respuesta no cabe o no se puede cruzar, se muestra un aviso: cambia las palabras, aumenta el tamaño en una sopa de letras o vuelve a generar.

Con **Importar archivo** puedes cargar una lista `.txt` en UTF-8 de hasta 1 MB; con **Pegar lista** puedes pegar texto del portapapeles. En ambos casos elige si deseas añadir o reemplazar la lista. Se usa una respuesta por línea y, para crucigramas, `respuesta | pista`. Se conservan las entradas para revisarlas antes de generar.

Para importar varias sopas, selecciona **Importar varias sopas** y separa las listas con encabezados Markdown, por ejemplo `## 1. COMPUTACIÓN CUÁNTICA`. Las palabras pueden llevar numeración inicial (`1. QUBIT`), que se quita al importar; los números dentro de las respuestas se conservan. Se admiten hasta 100 sopas, con 40 respuestas como máximo por sopa. Esta opción reemplaza el editor y cualquier colección anterior.

El selector **Sopa de la colección** permite editar cada una sin perder los cambios de las otras. Comparten el tamaño, las direcciones, el diseño y los ajustes de página. En **Exportar**, **Descargar PDF de todas las sopas** genera un PDF independiente por título; el navegador puede pedir permiso para varias descargas. Si una sopa no es válida o no caben todas sus palabras, se indica cuál corregir y no se comienza a descargar. Si falla la creación de un PDF después de iniciar las descargas, se indica cuántas se iniciaron.

El editor numera las líneas de entrada, incluidas las vacías. Selecciona las direcciones permitidas para cada tipo: horizontal, vertical y ambas diagonales, cada una también en sentido inverso. En los crucigramas las pistas indican la dirección y la flecha de lectura; por defecto se usan horizontal y vertical convencionales. La sopa de letras permite las ocho direcciones por defecto. Si no se pueden cruzar todas las palabras, prueba más direcciones o cambia la lista.

En **Contenido**, configura por separado el ancho en columnas y el alto en filas, entre 2 y 50. En crucigramas, activa **Fijar dimensiones del crucigrama** para usar esos límites; de lo contrario la cuadrícula se recorta automáticamente. Las palabras deben caber en al menos una de las direcciones seleccionadas. En **Diseño**, el tamaño de las casillas puede ser automático o elegirse en píxeles. La vista, la impresión, el PDF, el PNG y la web interactiva pueden reducirlo para que la cuadrícula quepa en el espacio disponible.

En la solución de la sopa de letras, un contorno con flecha rodea cada palabra e indica su sentido, incluso si comparte letras con otras. La lista también muestra una flecha por palabra. Estos indicadores aparecen en la vista de solución y en el PDF cuando se incluye la solución.

Las opciones del editor se organizan en las pestañas **Contenido** y **Diseño**. Puedes añadir un título secundario independiente de la descripción y alinear cada título por separado. En **Diseño** puedes cambiar la fuente, el tamaño, la negrita, la cursiva, el subrayado y el color del texto de la hoja. Selecciona un elemento y activa **Personalizar este elemento** para darle un formato propio; los demás usan el formato general. Se aplica a elementos completos, no a fragmentos seleccionados. Los cambios se ven inmediatamente y se aplican también a la solución y al PDF. El tamaño de los títulos es proporcional al elegido y el de las letras de la cuadrícula se limita para que quepan en sus casillas.

En **Fondo y borde de la cuadrícula** puedes elegir sin fondo, un color sólido o una imagen PNG, JPEG o WebP de hasta 2 MB. La imagen se ajusta para cubrir la cuadrícula y puede recortarse; el borde se configura por separado. Elige colores de texto legibles sobre el fondo. **Restablecer diseño** recupera los formatos, alineaciones, fondo y borde originales.

**Guardar proyecto** descarga un archivo JSON que puedes recuperar con **Abrir proyecto**. Se guardan los datos de entrada, las dimensiones y el tamaño de las casillas, la colección de sopas si existe, las direcciones seleccionadas de ambos formatos, el diseño, incluida la imagen de fondo, y las opciones de página; no se guarda la distribución aleatoria y al abrirlo se genera una nueva. El proyecto puede ocupar hasta 3 MB. Los proyectos anteriores siguen siendo compatibles y utilizan las opciones predeterminadas cuando no incluyen los nuevos ajustes. Los datos no se envían a ningún servidor. Los proyectos `.cwz` de Crossword Forge no son compatibles; se han inspeccionado ejemplos incluidos con ese programa, pero su formato completo no está identificado.

## Exportación y página

En **Exportar** elige la orientación A4 y los márgenes de cada lado (5–40 mm). La opción de solución afecta a PDF, PNG y texto. **Exportar PDF** descarga directamente un documento con texto seleccionable; si se incluye la solución aparece después del pasatiempo. El PDF utiliza la fuente Roboto y una composición adaptada a la página, que puede diferir de la vista previa. Se informa si el texto contiene caracteres que Roboto no admite, por ejemplo ciertos emojis; puedes sustituirlos o usar la exportación de texto o web.

Las descargas de proyecto, PDF, PNG, texto y web usan el título como nombre de archivo, con su extensión correspondiente. Se adaptan los caracteres incompatibles con nombres de archivo y se usa «Pasatiempo» si no queda un título válido.

Para facilitar la edición posterior, cada línea de los títulos se exporta como una secuencia continua de texto sin ajustes de interletraje ni ligaduras. La forma de agrupar el texto al abrir el PDF depende del editor utilizado.

También puedes descargar una **imagen PNG** con las páginas apiladas, un archivo de **texto** o una **web interactiva** autónoma. La web permite escribir en crucigramas o seleccionar el inicio y el final de una palabra en sopas, comprobar el progreso y mostrar la solución; contiene las respuestas para poder realizar la comprobación. La opción de solución no elimina esas respuestas del HTML. La imagen y el PDF pueden variar ligeramente respecto a la vista previa. Si modificas los datos, vuelve a generar antes de exportar.

**Imprimir desde el navegador** sigue disponible en la pestaña **Exportar**. Comprueba los márgenes, el tamaño A4 y la orientación en el diálogo de impresión, pues algunas impresoras pueden imponer sus propias opciones. Para conservar fondos de color o imagen, activa **Gráficos de fondo** si el navegador lo solicita.

La biblioteca local [pdfmake](./vendor/pdfmake/LICENSE) y la fuente [Roboto](./vendor/pdfmake/ROBOTO-OFL.txt) se redistribuyen con sus respectivas licencias. Para actualizar los archivos incluidos durante el desarrollo, ejecuta `npm ci` y `npm run vendor`.

## Pruebas

Con Node.js instalado, ejecuta `npm test`.

Las funciones pendientes identificadas frente al programa original están en [OPCIONES-PENDIENTES.md](./OPCIONES-PENDIENTES.md).
