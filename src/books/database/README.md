# Libros y autores

Para una base de datos nueva, ejecuta primero `schema.sql`. Para una base existente
con esas tablas, ejecuta solo `migrations/001_book_authors.sql` desde el editor SQL
de Supabase. La migración puede ejecutarse de nuevo y no modifica los datos actuales.
Debe aplicarse antes de arrancar esta versión de la API.

El cliente de Supabase debe tener permisos sobre las tablas y funciones. Las
funciones usan `SECURITY INVOKER`: respetan los permisos y las políticas RLS del
cliente. No introducen permisos adicionales. La clave del backend permanece en
el servidor.

## Uso

`POST /books`:

```json
{
  "title": "Don Quijote de la Mancha",
  "isbn": "9788420412146",
  "authors": [{ "name": "Miguel de Cervantes" }]
}
```

`GET /books` y `GET /books/:id` incluyen `authors: [{ id, name }]`.
También se devuelve esa estructura al crear y actualizar.

En `PATCH /books/:id`, omitir `authors` conserva sus relaciones; enviar una lista
las reemplaza y enviar `[]` las elimina. Los autores compartidos no se borran.
Los nombres se recortan y se reutilizan mediante la restricción UNIQUE existente.
La comparación distingue mayúsculas y acentos: esta es una regla inicial, no una
identificación fiable de personas homónimas.

La creación y la actualización con autores realizan una única llamada RPC. Cada
llamada se ejecuta en una transacción PostgreSQL: cualquier error revierte libro,
autores y relaciones. Un ISBN repetido devuelve 409; una relación repetida se
deduplica. Crear sin autores sigue permitido.

## Verificación

`npm.cmd test -- --runInBand`, `npm.cmd run build` y `npm.cmd run lint` verifican
la API. `test/database/book-authors.sql` verifica las funciones contra PostgreSQL
con el esquema y la migración aplicados, y revierte sus datos al terminar.
Ejemplo: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f test/database/book-authors.sql`.
