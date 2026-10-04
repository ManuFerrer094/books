# Consulta e importaci?n por ISBN

Arranca con `npm.cmd run start:dev` y abre `http://localhost:3000/docs`.
No requiere migraciones nuevas; utiliza las funciones de guardado at?mico ya instaladas.

## Endpoint

`GET /books/isbn/9788484454892`

1. Valida el d?gito de control, quita espacios y guiones y obtiene el ISBN-13 can?nico.
2. Busca en Supabase por ISBN-13, su equivalente ISBN-10 y el texto original recortado.
3. Si existe, devuelve la ficha guardada sin consultar ni sobrescribir datos externos.
4. Si falta, consulta Open Library; despu?s Google Books (si hay clave), Inventaire e Internet Archive hasta encontrar una ficha verificada.
5. Normaliza los campos y guarda libro, autores y relaciones mediante una ?nica RPC transaccional.
6. Devuelve la ficha guardada con ID, timestamps e IDs de autores.

**Este GET escribe en la base de datos cuando el libro no existe.** No tiene body.
El esquema de las tablas no cambia. Se guardan los campos representables en ese esquema.

La respuesta devuelve `{ "source": "PROVEEDOR", "book": { ... } }` al importar el libro.
Los valores son `openlibrary`, `googlebooks`, `inventaire` e `internetarchive`. Las siguientes consultas devuelven `source: "database"`.
Si otra petici?n inserta el mismo ISBN mientras se consulta el proveedor, se recupera
esa ficha y se devuelve con `source: "database"`. El ISBN ?nico y la transacci?n
impiden que ese conflicto deje libros, autores o relaciones adicionales.

Si hay dos registros antiguos con ISBN-10 e ISBN-13 equivalentes, se devuelve el de
menor ID. Un ISBN antiguo guardado con otro formato de guiones no se encontrar?
por su variante compacta; no se modifican los datos previos.

## Normalizaci?n

- Se reutilizan autores por nombre exacto recortado y se conserva el primer editor.
- Se obtienen los idiomas de `/isbn/{isbn}.json`. Los c?digos habituales se convierten
  a dos letras (`spa` ? `es`, `eng` ? `en`); otros se conservan con tres letras.
  Si hay varios idiomas, se conserva el primero porque el esquema tiene un solo campo.
- Las fechas completas ISO o con nombres de mes en ingl?s/espa?ol se convierten
  a `YYYY-MM-DD`. Por ejemplo, `September 15, 2012` ? `2012-09-15`.
- Un a?o aislado, una fecha parcial, una fecha num?rica ambigua o una fecha imposible
  se devuelve y guarda como `null`. No se inventa un d?a o un mes.
- Se prioriza la fecha de la edici?n; si no puede normalizarse se prueba la de Books API.
- El proveedor puede no disponer de fecha, idioma u otros campos: esos valores siguen
  siendo `null`. Cada consulta HTTP tiene un m?ximo de cinco segundos.
- Si la edici?n devuelve 404 se importa la ficha b?sica sin idioma. Si falla por
  red, timeout, HTTP 429/500 o JSON inv?lido, se prueban los proveedores siguientes.

## Respuestas

- `200`: ficha guardada, existente o reci?n importada.
- `400`: ISBN inv?lido, por ejemplo `9780140328722`; no se consulta ni se guarda.
- `404`: todos los proveedores activos han respondido sin una ficha verificable; no se guarda.
- `409`: conflicto de guardado que no corresponde a un ISBN encontrado al reconsultar.
- `500`: fallo de Supabase o del guardado; no se devuelve una ficha sin guardar.
- `503`: no hay ficha y alg?n proveedor no pudo consultarse. `unavailableProviders` identifica los servicios fallidos; no se guarda.

## Organizaci?n

- `isbn.ts`: validaci?n y equivalencias.
- `IsbnLookupService`: consulta local, importaci?n y resoluci?n de conflictos.
- `BooksService`: lectura y guardado transaccional mediante RPC.
- `BookProvidersService`: orden de consulta y recuperaci?n tras fallos.
- `OpenLibraryService`: integraci?n original, conservada sin cambios.
- `GoogleBooksService`, `InventaireService`, `InternetArchiveService`: consultas y adaptaci?n de cada fuente.
- `book-metadata.ts`: normalizaci?n de fechas e idiomas.

Las pruebas simulan las respuestas externas y comprueban el guardado, los errores y
la recuperaci?n tras un conflicto concurrente.
Documentaci?n del proveedor: https://openlibrary.org/dev/docs/api/books

## Proveedores gratuitos

Orden: cat?logo local ? Open Library ? Google Books ? Inventaire ? Internet Archive.
Se detiene en la primera ficha v?lida: no mezcla ediciones ni datos de distintos cat?logos.
Si un servicio devuelve 429, falla, supera cinco segundos o devuelve JSON inv?lido,
se prueba el siguiente. Un fallo no bloquea un resultado posterior.
Los nuevos servicios verifican un ISBN coincidente, incluido su equivalente ISBN-10,
antes de aceptar una ficha. No se elige el primer t?tulo parecido.
La b?squeda puede tardar m?s cuando varias fuentes fallan; cada petici?n HTTP tiene
un timeout de cinco segundos. Las fuentes con relaciones pueden necesitar varias peticiones.

Inventaire e Internet Archive funcionan sin cuenta ni clave. Inventaire se consulta
con `autocreate=false`: no se crean entidades all?. Sus autores y editoriales se
resuelven mediante entidades relacionadas; el idioma procede de la edici?n.
Los servicios p?blicos gratuitos tienen l?mites y cobertura incompleta: no se garantiza
que encuentren todos los ISBN, especialmente ediciones recientes.

Google Books est? implementado pero se omite si falta `GOOGLE_BOOKS_API_KEY`.
La documentaci?n exige identificar la aplicaci?n con una clave; las comprobaciones
sin clave devolvieron HTTP 429. Para activar este respaldo, crea una clave de Books API
para tu proyecto y a?ade en el `.env` del backend:

```dotenv
GOOGLE_BOOKS_API_KEY=tu_clave
```

Reinicia el backend despu?s. La clave no se incluye en respuestas o mensajes de error.
No se configura facturaci?n, se contratan planes, se solicitan aumentos de cuota ni
se incorporan proveedores de pago. Si se agota la cuota, se contin?a con las otras fuentes.

Las fichas existentes no se sobrescriben. El guardado sigue usando la transacci?n
existente: no hace falta SQL nuevo.

Referencias oficiales:

- https://developers.google.com/books/docs/v1/using
- https://api.inventaire.io/
- https://data.inventaire.io/
- https://archive.org/services/docs/api/

## Autenticaci?n

Las rutas `/books` requieren ahora Bearer access token. Para importar y a?adir a tu biblioteca en una operaci?n usa `POST /me/books/isbn`. Configuraci?n: [usuarios y biblioteca](../auth/README.md).
