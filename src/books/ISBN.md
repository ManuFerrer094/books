# Consulta e importaci?n por ISBN

Arranca con `npm.cmd run start:dev` y abre `http://localhost:3000/docs`.
No requiere migraciones nuevas; utiliza las funciones de guardado at?mico ya instaladas.

## Endpoint

`GET /books/isbn/9788484454892`

1. Valida el d?gito de control, quita espacios y guiones y obtiene el ISBN-13 can?nico.
2. Busca en Supabase por ISBN-13, su equivalente ISBN-10 y el texto original recortado.
3. Si existe, devuelve la ficha guardada sin consultar ni sobrescribir datos externos.
4. Si falta, consulta la Books API de Open Library y los datos de la edici?n.
5. Normaliza los campos y guarda libro, autores y relaciones mediante una ?nica RPC transaccional.
6. Devuelve la ficha guardada con ID, timestamps e IDs de autores.

**Este GET escribe en la base de datos cuando el libro no existe.** No tiene body.
El esquema de las tablas no cambia. Se guardan los campos representables en ese esquema.

La respuesta mantiene `{ "source": "openlibrary", "book": { ... } }` cuando esta petici?n
importa el libro. Las siguientes consultas devuelven `source: "database"`.
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
  red, timeout, HTTP 429/500 o JSON inv?lido, se devuelve 503 y no se guarda la ficha.

## Respuestas

- `200`: ficha guardada, existente o reci?n importada.
- `400`: ISBN inv?lido, por ejemplo `9780140328722`; no se consulta ni se guarda.
- `404`: ninguna fuente contiene una ficha; no se guarda.
- `409`: conflicto de guardado que no corresponde a un ISBN encontrado al reconsultar.
- `500`: fallo de Supabase o del guardado; no se devuelve una ficha sin guardar.
- `503`: proveedor no disponible o respuesta inv?lida; no se guarda.

## Organizaci?n

- `isbn.ts`: validaci?n y equivalencias.
- `IsbnLookupService`: consulta local, importaci?n y resoluci?n de conflictos.
- `BooksService`: lectura y guardado transaccional mediante RPC.
- `OpenLibraryService`: consultas externas y adaptaci?n de metadatos.
- `book-metadata.ts`: normalizaci?n de fechas e idiomas.

Las pruebas simulan las respuestas externas y comprueban el guardado, los errores y
la recuperaci?n tras un conflicto concurrente.
Documentaci?n del proveedor: https://openlibrary.org/dev/docs/api/books
