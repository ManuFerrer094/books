# Usuarios y biblioteca personal

## Configuración en Supabase

1. Ejecuta `src/books/database/migrations/002_user_library.sql` en el SQL Editor.
   Requiere las tablas originales y la migración 001. Puede ejecutarse de nuevo.
   Crea `user_books`, sus políticas RLS y los permisos del catálogo compartido.
   Conserva los libros, autores y relaciones existentes.
2. En el `.env` del backend añade `VITE_SUPABASE_PUBLISHABLE_KEY` con la clave **publishable**
   (`sb_publishable_...`) o **anon** del proyecto, desde Settings → API Keys.
   No uses la clave secret/service_role en esta variable: el código la rechaza.
3. El catálogo utiliza `SUPABASE_SERVICE_ROLE_KEY`. Debe ser una clave de servidor
   secret/service_role para que las importaciones funcionen con los permisos nuevos.
4. Activa email/password en Supabase Auth. Si está activa la confirmación de email,
   el enlace recibido abre la web con sesión iniciada. Configura Site URL y las
   URLs de redirección con la URL del frontend, no la del backend (puerto 3000).
   Consulta la [configuración de confirmación por correo](../../DEPLOYMENT.md#confirmación-de-registro-por-correo).
5. Arranca con `npm.cmd run start:dev` y abre `http://localhost:3000/docs`.

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=clave_secret_del_backend_ya_existente
VITE_SUPABASE_PUBLISHABLE_KEY=clave_publishable_o_anon
```

Las claves de servidor y las contraseñas no deben compartirse ni enviarse al frontend.
La clave publishable/anon sí es pública; las políticas RLS protegen los datos.
No se añaden proveedores de pago ni dependencias de autenticación externas a Supabase.

## Opciones de cuenta

La interfaz solicita la recuperación mediante `resetPasswordForEmail`, con destino `/recuperar-contrasena`. Autoriza esta ruta en las Redirect URLs de Supabase y conserva `{{ .ConfirmationURL }}` en **Reset Password**. El cambio de contraseña usa `updateUser`; desde Mi cuenta incluye `current_password`, mientras que el enlace de recuperación permite elegir una contraseña sin conocer la olvidada. La biblioteca solo se muestra tras completar la recuperación. Consulta [DEPLOYMENT.md](../../DEPLOYMENT.md#recuperación-de-contraseña-y-cuenta).

`GET /me/account/export` devuelve un JSON de los datos del lector verificado con `Cache-Control: no-store`. `DELETE /me/account` recibe `{ "password": "contraseña actual", "confirmation": "ELIMINAR" }`, verifica las credenciales y borra las fotos de ambos buckets privados antes de eliminar al usuario de Auth. Requiere el cliente de servidor ya configurado; no recibe `user_id` ni utiliza el rol administrador del usuario. Cada lector puede eliminar solo su propia cuenta. Las relaciones personales se eliminan en cascada y el catálogo compartido permanece.

## Catálogo y lista de deseos

Aplica la [migración 007](../books/database/migrations/007_wishlist_catalog.sql) después de 001–006. `GET /catalog?query=&page=1&page_size=24` devuelve `{ books, total, page, page_size }`, con búsqueda por título, autor o ISBN. Requiere sesión y usa el token del lector mediante `browse_catalog`, con `SECURITY INVOKER`. Devuelve solo fichas compartidas; nunca consulta bibliotecas, propietarios ni campos privados. La búsqueda ignora mayúsculas y los acentos habituales en español. La paginación evita truncar el catálogo por el límite de filas de Supabase.

`GET /me/wishlist` lista todos los deseos propios. `POST /me/wishlist` recibe `{ "book_id": 7 }` y guarda idempotentemente el deseo, conservando su fecha original. `DELETE /me/wishlist/7` lo quita (204 incluso si ya no existe). La identidad procede del token; no se acepta `user_id` en el body. RLS permite leer, insertar y borrar solo deseos propios. Estas operaciones no modifican `user_books` ni implican poseer el libro.

La [prueba SQL](../../test/database/wishlist-catalog.sql) verifica aislamiento entre dos lectores, permisos y búsqueda/paginación en una base de pruebas; revierte los datos al terminar.

## Préstamos, anotaciones y valoración

Aplica la [migración 006](../books/database/migrations/006_book_personal_details.sql) después de 001–005 y antes de desplegar. Los datos se guardan por propietario en `user_books`; las políticas RLS existentes protegen destinatarios, notas y estrellas. Restaurar los metadatos del catálogo conserva estos datos.

En la ficha, marca **Libro prestado** y, si quieres, indica **Prestado a** (hasta 200 caracteres). El préstamo es independiente de Por leer/Leyendo/Leído. El estante **Prestados** filtra los libros prestados. Para registrar la devolución, desmarca el préstamo y guarda: se borra el destinatario, manteniendo la lectura, las notas y las estrellas.

**Mis anotaciones** admite hasta 10.000 caracteres. La valoración permite estrellas enteras de **0 a 5**; **Sin valorar** se guarda como `null`, distinto de 0. **Guardar datos personales** guarda los cambios; **Descartar cambios** recupera los valores guardados. Si falla la conexión, se conserva el borrador para reintentar.

`PATCH /me/books/:bookId` acepta uno o más campos: `status`, `is_lent`, `lent_to`, `notes`, `rating`. Los campos omitidos se conservan; `notes`, `lent_to` y `rating` aceptan `null` para borrarlos. Ejemplo: `{ "is_lent": true, "lent_to": "Ana", "notes": "Mi frase favorita", "rating": 4 }`. `is_lent: false` limpia el destinatario. La identidad se obtiene del token, nunca del body.

## Estantería y fotos de los lomos

Antes de desplegar la nueva interfaz y API, ejecuta una vez `src/books/database/migrations/003_bookshelf.sql`, después de 001 y 002, como administrador en el SQL Editor de Supabase. Conserva las relaciones existentes y añade campos opcionales de apariencia a `user_books`, la tabla `user_bookshelf` y la función transaccional `save_bookshelf_order`. La migración también crea el bucket privado `book-spines`, limita las subidas a JPEG de hasta 5 MB y permite leer, subir y borrar únicamente archivos en la carpeta del propietario. El navegador convierte las fotos PNG/WebP a JPEG antes de subirlas. No crees un bucket público ni añadas permisos de sobrescritura.

- `GET /me/bookshelf` devuelve `{ "book_ids": [3, 1, 2], "revision": 0 }`. Reconcilia libros añadidos y retirados sin modificar la base de datos; por defecto ordena por incorporación ascendente y luego por identificador.
- `PUT /me/bookshelf` recibe esa misma estructura con el orden deseado y la última revisión. Debe contener exactamente los libros actuales, sin duplicados. La transacción bloquea la fila del propietario y aumenta la revisión. Una revisión o pertenencia desactualizada devuelve `409`: vuelve a consultar biblioteca y orden antes de guardar de nuevo.
- `PATCH /me/books/1/spine` acepta `color`, `width` (28–64), `height` (160–240) e `image_path`. Los campos omitidos conservan su valor y `null` restaura el valor automático. Los colores tienen formato `#RRGGBB`. La foto debe existir en `book-spines` bajo `<user_id>/<book_id>/<uuid>.jpg`; el servidor verifica la pertenencia y existencia.
- `LibraryBook` incluye `spine: { color, width, height, image_path }`, con valores nulos cuando no existen ajustes. El catálogo `books` y el estado de lectura son independientes del lomo y del orden.

Las fotos se leen mediante URLs firmadas de una hora, renovadas a los 50 minutos mientras están visibles. Se guarda la ruta del objeto, nunca la URL temporal. Una foto inaccesible muestra el lomo recreado. Reemplazar/quitar la foto o retirar el libro intenta borrar el archivo anterior después de guardar la relación; si Storage falla, el cambio queda guardado y el backend registra el fallo de limpieza sin datos personales. El frontend elimina las subidas cuya asociación falla; si se pierde la respuesta, comprueba primero la relación para no borrar una foto que ya está guardada.

`test/database/bookshelf.sql` comprueba la migración con dos usuarios, conflictos de revisión, dimensiones, RLS del orden y de las fotos. Ejecuta `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f test/database/bookshelf.sql` en una base de pruebas con las migraciones aplicadas; las inserciones se revierten al terminar.

## Edición de los datos personales del libro

Antes de desplegar, aplica `src/books/database/migrations/004_personal_book_metadata.sql`
después de las migraciones 001–003. Añade `user_books.metadata` y la función
`update_personal_book_metadata`, sin modificar las fichas ni los autores del catálogo.
Puede ejecutarse de nuevo y no requiere nuevas variables de entorno.

Desde la ficha del frontend, **Editar mi libro** permite cambiar título, autores,
editorial, fecha de publicación, páginas, idioma e ISBN.
Dentro del editor se encuentran **Portada**, para subir o hacer una foto con recorte,
giro y enderezado, y **Personalizar lomo**, que comparte el mismo editor de fotos.
Los datos personalizados se muestran también en las búsquedas y la estantería.
**Restaurar datos del catálogo**, con confirmación, retira todos los cambios de la
ficha y mantiene el estado de lectura y la personalización del lomo.

- `PATCH /me/books/:bookId/metadata` recibe los campos que se quieren cambiar.
  Los omitidos conservan su valor; `null` vacía un campo opcional y `authors: []`
  elimina los autores de la ficha personal. El título no puede quedar vacío.
  El campo `cover_url` se mantiene en la API para compatibilidad con fichas existentes;
  el frontend edita las portadas mediante fotos.
- `DELETE /me/books/:bookId/metadata` restaura los datos del catálogo y devuelve
  la entrada actualizada, sin retirar el libro de la biblioteca.
- Las respuestas de biblioteca incluyen `customized` y `book` con los datos
  efectivos. Los autores personales tienen `name` y no necesitan un ID del catálogo.
  Un ISBN personal puede coincidir con otro: no modifica la identidad del libro.

La función combina los campos en una única actualización para conservar cambios
simultáneos en campos distintos. Utiliza el token del usuario, `auth.uid()` y RLS:
solo edita una relación propia ya existente. Un libro ajeno o que no se haya añadido
devuelve 404. También se validan los campos en PostgreSQL para impedir que una
escritura directa guarde IDs, propietarios o datos ajenos a la ficha. El catálogo
y las fichas de otros usuarios conservan sus datos.

`test/database/personal-book-metadata.sql` comprueba cambios, restauración,
validación y aislamiento con dos usuarios; revierte los datos al terminar.
Ejecuta `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f test/database/personal-book-metadata.sql`
en una base de pruebas con las migraciones aplicadas.

## Probar desde Swagger

### Fotos privadas de portada

Aplica `src/books/database/migrations/005_cover_photos.sql` después de 001–004,
antes de desplegar esta versión. Añade `user_books.cover_image_path` y el bucket
privado `book-covers` con las mismas restricciones que las fotos de los lomos:
JPEG de hasta 5 MB, subida solo para un libro de la biblioteca propia, lectura y
borrado solo del propietario. El navegador acepta JPEG, PNG y WebP y exporta
únicamente el recorte confirmado como JPEG.

`PATCH /me/books/:bookId/cover` acepta `{ "image_path": "<user_id>/<book_id>/<uuid>.jpg" }`.
La API verifica propietario, libro y existencia del archivo. `image_path: null`
recupera la portada anterior a la foto. `book.cover_image_path` guarda la ruta
privada, que tiene prioridad sobre `book.cover_url` al mostrar la portada. Las
URLs firmadas duran una hora y se renuevan a los 50 minutos. Una imagen inaccesible
muestra la portada de texto.

Cambiar o quitar la foto y retirar el libro limpia el archivo anterior después
de guardar. Si se pierde una respuesta, el navegador consulta primero la ficha
para no borrar una foto que ya esté guardada. La restauración de los datos del
catálogo elimina también la foto de portada y conserva el lomo y estado de lectura.

`test/database/cover-photos.sql` comprueba las restricciones, permisos de Storage
y aislamiento entre dos usuarios en PostgreSQL, revirtiendo sus datos al terminar.

### Registrar y entrar

`POST /auth/register`:

```json
{
  "email": "tu-email@example.com",
  "password": "UnaClaveLarga123!"
}
```

Devuelve `user` y `session`. Si hace falta confirmar el correo, `session` será `null`.
Tras la confirmación usa `POST /auth/login` con el mismo body. Copia
`session.access_token` y pégalo en **Authorize** en Swagger; Swagger añadirá `Bearer`.

`GET /auth/me` devuelve el ID y email del usuario validado.
`POST /auth/refresh` recibe `{ "refresh_token": "..." }` y devuelve nuevos tokens.
`POST /auth/logout` requiere el access token y revoca la sesión actual, no las demás.
Los access tokens ya emitidos pueden permanecer válidos hasta su caducidad según
Supabase; el cliente debe descartarlos al cerrar sesión.
Las respuestas con tokens llevan `Cache-Control: no-store`.

### Añadir un libro por ISBN

`POST /me/books/isbn`:

```json
{
  "isbn": "9788484454892",
  "status": "pending"
}
```

Obtiene o importa el libro usando la integración existente y lo añade a **tu** biblioteca.
Devuelve la relación con `book_id`, `status`, `added_at`, `updated_at` y la ficha `book`
con sus autores. Si ya estaba, devuelve la relación existente sin cambiar estado o fechas.

También puedes añadir un libro ya guardado con `POST /me/books`:

```json
{ "book_id": 1, "status": "reading" }
```

Los POST devuelven 200 tanto al añadir como al reutilizar una relación.
El estado es opcional al añadir y por defecto vale `pending`.
Nunca envíes `user_id`: se obtiene del token y se rechaza si aparece en el body.

### Consultar, actualizar y quitar

- `GET /me/books`: lista tu biblioteca con las fichas y sus autores.
- `GET /me/books/1`: consulta tu relación con ese libro.
- `PATCH /me/books/1` con `{ "status": "read" }`: cambia tu estado de lectura.
  Los estados válidos son `pending`, `reading` y `read`.
- `DELETE /me/books/1`: quita solo tu relación y devuelve 204. Conserva el catálogo,
  autores y las bibliotecas de otras personas.

Si el libro no está en tu biblioteca, consultar, actualizar o quitar devuelve 404,
incluso si el libro está en la biblioteca de otra persona.

Prueba con dos cuentas: ambas pueden tener el mismo `book_id`, con estados independientes.
Repetir el alta no duplica la ficha ni la relación.

## Catálogo compartido y permisos

Todas las rutas `/books` ahora requieren un usuario autenticado. Listar, consultar,
crear manualmente e importar por ISBN están disponibles para usuarios normales.
`GET /books/isbn/:isbn` conserva su comportamiento de importación al catálogo;
para añadir además a tu biblioteca utiliza `POST /me/books/isbn`.

`PATCH /books/:id` y `DELETE /books/:id` requieren `app_metadata.role = "admin"`.
No se usa `user_metadata`, porque el usuario puede modificarlo. Registrar un usuario
no le otorga permisos de administrador. Para tu cuenta de desarrollo, un administrador
del proyecto puede asignar el rol desde SQL Editor:

```sql
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE id = 'UUID_DE_LA_CUENTA';
```

Incluso un administrador recibe 409 al borrar del catálogo un libro que aún está en
alguna biblioteca: la FK usa `ON DELETE RESTRICT`. El borrado personal no usa ese endpoint.

La migración revoca la escritura directa y las funciones de modificación del catálogo
a `anon` y `authenticated`. Nest ejecuta esas operaciones con la clave de servidor,
tras aplicar sus guards. La lectura del catálogo se permite a usuarios autenticados.
RLS permite a cada usuario leer, insertar, actualizar y borrar únicamente sus relaciones.

## Cómo está construido

`AuthGuard` valida el token mediante `supabase.auth.getUser(token)` en el servidor.
No confía en un JWT decodificado ni en IDs enviados por el cliente. Adjunta el usuario
validado a la petición. `AdminGuard` verifica sus metadatos administrados por el servidor.

Cada operación de Auth o biblioteca crea un cliente independiente con persistencia y
renovación automática desactivadas. El cliente de biblioteca usa la clave pública y
el token de esa petición, para aplicar RLS. También filtra por el `user_id` validado.
El cliente compartido del catálogo no se usa para login y no retiene sesiones de usuarios.

La importación de libro/autores sigue siendo una transacción. La relación personal se
añade después mediante upsert con clave compuesta `(user_id, book_id)` y
`ignoreDuplicates: true`. Si falla este último paso, la ficha compartida importada
permanece en el catálogo y se puede reintentar el alta personal.

## Verificación

`npm.cmd test -- --runInBand`, `npm.cmd run build`, `npm.cmd run lint` y
`npm.cmd run test:e2e -- --runInBand` comprueban el backend sin crear cuentas reales.
`test/database/user-library.sql` comprueba dos usuarios, RLS, permisos, duplicados y
borrado de relaciones en PostgreSQL; revierte todos sus datos al terminar.
No se han aplicado cambios a tu Supabase desde este trabajo.

Referencias oficiales:

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/database/postgres/row-level-security

La URL y la clave pública usan los mismos nombres `VITE_` en frontend y backend. No se admiten los antiguos nombres `SUPABASE_URL`, `SUPABASE_AUTH_KEY` ni `SUPABASE_KEY`. La clave privada se mantiene exclusivamente en `SUPABASE_SERVICE_ROLE_KEY`, sin prefijo `VITE_`. En local, ambos servicios leen `.env` en la raíz.
