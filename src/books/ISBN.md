# Consulta e importación por ISBN

Arranca con `npm.cmd run start:dev` y abre `http://localhost:3000/docs`.
No requiere migraciones nuevas; utiliza las funciones de guardado atómico ya instaladas.

## Endpoint

`GET /books/isbn/9788484454892`

1. Valida el dígito de control, quita espacios y guiones y obtiene el ISBN-13 canónico.
2. Busca en Supabase por ISBN-13, su equivalente ISBN-10 y el texto original recortado.
3. Si existe, devuelve la ficha guardada sin consultar ni sobrescribir datos externos.
4. Si falta, consulta Open Library; después Google Books (si hay clave), Inventaire e Internet Archive hasta encontrar una ficha verificada.
5. Normaliza los campos y guarda libro, autores y relaciones mediante una única RPC transaccional.
6. Devuelve la ficha guardada con ID, timestamps e IDs de autores.

**Este GET escribe en la base de datos cuando el libro no existe.** No tiene body.
El esquema de las tablas no cambia. Se guardan los campos representables en ese esquema.

La respuesta devuelve `{ "source": "PROVEEDOR", "book": { ... } }` al importar el libro.
Los valores son `openlibrary`, `googlebooks`, `inventaire` e `internetarchive`. Las siguientes consultas devuelven `source: "database"`.
Si otra petición inserta el mismo ISBN mientras se consulta el proveedor, se recupera
esa ficha y se devuelve con `source: "database"`. El ISBN único y la transacción
impiden que ese conflicto deje libros, autores o relaciones adicionales.

Si hay dos registros antiguos con ISBN-10 e ISBN-13 equivalentes, se devuelve el de
menor ID. Un ISBN antiguo guardado con otro formato de guiones no se encontrará
por su variante compacta; no se modifican los datos previos.

## Normalización

- Se reutilizan autores por nombre exacto recortado y se conserva el primer editor.
- Se obtienen los idiomas de `/isbn/{isbn}.json`. Los códigos habituales se convierten
  a dos letras (`spa` → `es`, `eng` → `en`); otros se conservan con tres letras.
  Si hay varios idiomas, se conserva el primero porque el esquema tiene un solo campo.
- Las fechas completas ISO o con nombres de mes en inglés/español se convierten
  a `YYYY-MM-DD`. Por ejemplo, `September 15, 2012` → `2012-09-15`.
- Un año aislado, una fecha parcial, una fecha numérica ambigua o una fecha imposible
  se devuelve y guarda como `null`. No se inventa un día o un mes.
- Se prioriza la fecha de la edición; si no puede normalizarse se prueba la de Books API.
- El proveedor puede no disponer de fecha, idioma u otros campos: esos valores siguen
  siendo `null`. Cada consulta HTTP tiene un máximo de cinco segundos.
- Si la edición devuelve 404 se importa la ficha básica sin idioma. Si falla por
  red, timeout, HTTP 429/500 o JSON inválido, se prueban los proveedores siguientes.

## Respuestas

- `200`: ficha guardada, existente o recién importada.
- `400`: ISBN inválido, por ejemplo `9780140328722`; no se consulta ni se guarda.
- `404`: todos los proveedores activos han respondido sin una ficha verificable; no se guarda.
- `409`: conflicto de guardado que no corresponde a un ISBN encontrado al reconsultar.
- `500`: fallo de Supabase o del guardado; no se devuelve una ficha sin guardar.
- `503`: no hay ficha y algún proveedor no pudo consultarse. `unavailableProviders` identifica los servicios fallidos; no se guarda.

## Organización

- `isbn.ts`: validación y equivalencias.
- `IsbnLookupService`: consulta local, importación y resolución de conflictos.
- `BooksService`: lectura y guardado transaccional mediante RPC.
- `BookProvidersService`: orden de consulta y recuperación tras fallos.
- `OpenLibraryService`: integración original, conservada sin cambios.
- `GoogleBooksService`, `InventaireService`, `InternetArchiveService`: consultas y adaptación de cada fuente.
- `book-metadata.ts`: normalización de fechas e idiomas.

Las pruebas simulan las respuestas externas y comprueban el guardado, los errores y
la recuperación tras un conflicto concurrente.
Documentación del proveedor: https://openlibrary.org/dev/docs/api/books

## Proveedores gratuitos

Orden: catálogo local → Open Library → Google Books → Inventaire → Internet Archive.
Se detiene en la primera ficha válida: no mezcla ediciones ni datos de distintos catálogos.
Si un servicio devuelve 429, falla, supera cinco segundos o devuelve JSON inválido,
se prueba el siguiente. Un fallo no bloquea un resultado posterior.
Los nuevos servicios verifican un ISBN coincidente, incluido su equivalente ISBN-10,
antes de aceptar una ficha. No se elige el primer título parecido.
La búsqueda puede tardar más cuando varias fuentes fallan; cada petición HTTP tiene
un timeout de cinco segundos. Las fuentes con relaciones pueden necesitar varias peticiones.

Inventaire e Internet Archive funcionan sin cuenta ni clave. Inventaire se consulta
con `autocreate=false`: no se crean entidades allí. Sus autores y editoriales se
resuelven mediante entidades relacionadas; el idioma procede de la edición.
Los servicios públicos gratuitos tienen límites y cobertura incompleta: no se garantiza
que encuentren todos los ISBN, especialmente ediciones recientes.

Google Books está implementado pero se omite si falta `GOOGLE_BOOKS_API_KEY`.
La documentación exige identificar la aplicación con una clave; las comprobaciones
sin clave devolvieron HTTP 429. Para activar este respaldo, crea una clave de Books API
para tu proyecto y añade en el `.env` del backend:

```dotenv
GOOGLE_BOOKS_API_KEY=tu_clave
```

Reinicia el backend después. La clave no se incluye en respuestas o mensajes de error.
No se configura facturación ni se contratan planes, se solicitan aumentos de cuota o
se incorporan proveedores de pago. Si se agota la cuota, se continúa con las otras fuentes.

Las fichas existentes no se sobrescriben. El guardado sigue usando la transacción
existente: no hace falta SQL nuevo.

Referencias oficiales:

- https://developers.google.com/books/docs/v1/using
- https://api.inventaire.io/
- https://data.inventaire.io/
- https://archive.org/services/docs/api/

## Autenticación

Las rutas `/books` requieren ahora Bearer access token. Para importar y añadir a tu biblioteca en una operación usa `POST /me/books/isbn`. Configuración: [usuarios y biblioteca](../auth/README.md).
