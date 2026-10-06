# Desplegar en Vercel Services

## Versión de Node.js

El backend fija Node.js `24.x` y `type: module` en `package.json`. NestJS 12 publica módulos ESM; TypeScript compila el backend como ESM con imports relativos terminados en `.js`. Vercel desactiva por defecto el soporte de `require()` para ESM, por lo que fijar Node.js 24 sin migrar la compilación no evita `ERR_REQUIRE_ESM`. No hace falta activar ese soporte mediante `NODE_OPTIONS`.

Después de compilar, `npm run test:runtime` prueba el handler compilado con `--no-experimental-require-module`, comprueba la API, Swagger y el rechazo de peticiones sin autenticación. Esta prueba no necesita credenciales reales ni consulta Supabase.

Utiliza también Node.js 24 en desarrollo. En Vercel, comprueba **Settings → Build and Deployment → Node.js Version** y selecciona **24.x**. El campo `engines.node` del backend fija esta versión para los nuevos despliegues. Después de subir el cambio, crea un nuevo despliegue: el cambio no modifica las funciones de despliegues anteriores.

Este repositorio se configura como **un proyecto** con dos servicios definidos en [`vercel.json`](vercel.json). Selecciona la raíz del repositorio como Root Directory al importar el proyecto.

| Servicio   | Raíz       | Framework    | Rutas públicas                                |
| ---------- | ---------- | ------------ | --------------------------------------------- |
| `app`      | `.`        | NestJS       | `/api` y `/api/*`                             |
| `frontend` | `frontend` | Vite + React | `/` y el resto de rutas, incluidos los assets |

La regla de API se evalúa antes que la regla general del frontend. Vercel entrega a Nest la ruta original: `/api/me/books` conserva `/api`. Por eso `src/app.setup.ts` configura ese prefijo cuando Vercel inyecta `VERCEL=1`, tanto en producción como con `vercel dev`.

En Vercel, Swagger está en **`/api/docs`** y su JSON en **`/api/docs-json`**. Swagger incluye el prefijo en sus operaciones. Los endpoints de libros y biblioteca conservan su autenticación. La documentación de Swagger es pública, igual que en el desarrollo actual.

## Comunicación y bindings

El frontend es una aplicación estática. Sus peticiones parten del **navegador** hacia `/api` en el mismo dominio. No hay funciones del frontend que llamen al backend ni llamadas de Nest al frontend. Supabase y los catálogos de libros son proveedores externos, no servicios de este proyecto de Vercel.

Por eso esta configuración **no declara bindings**. Una URL interna inyectada mediante un binding no está disponible durante el build de Vite ni en el navegador; no debe usarse como variable `VITE_`. La API es pública bajo `/api` para que la aplicación pueda utilizarla, y protege los datos personales con tokens y RLS.

Si se decide mantener `app` completamente interno, hará falta una función de proxy en `frontend`. En ese caso el binding se declarará en `frontend`, apuntará a `app`, y la función leerá su URL inyectada en tiempo de ejecución. No basta con quitar la regla pública de `/api` o añadir un binding sin código servidor.

## Variables de entorno en Vercel

Configura estas variables en el proyecto para los entornos Production y Preview que vayas a utilizar:

| Variable                        | Uso                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL` | URL compartida por Nest y el navegador |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secret/service_role del catálogo, solo servidor |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública compartida por Nest y el navegador |
| `VITE_API_URL`                  | Opcional; el valor por defecto es `/api`. Mantén ese valor para este despliegue                            |
| `VITE_SITE_URL`                 | Opcional; URL pública del frontend para confirmar el correo. Sin ella se utiliza el origen del navegador con `/` final |
| `GOOGLE_BOOKS_API_KEY`          | Opcional; habilita Google Books como proveedor adicional                                                   |

Las variables `VITE_` se incorporan al JavaScript durante la compilación. No pongas claves de servidor en ellas. La configuración local compartida está en `.env` de la raíz; Vite también lo carga mediante `envDir`. Estos archivos son locales y no sustituyen la configuración del proyecto en Vercel. No configures `VERCEL` manualmente: lo proporciona Vercel. `API_PROXY_TARGET` es únicamente para el desarrollo independiente con Vite.

Configura el dominio final en Supabase → Authentication → URL Configuration (Site URL y Redirect URLs). Para probar altas desde previews, autoriza también las URLs de preview correspondientes. Aplica previamente las [migraciones y permisos de Supabase](src/auth/README.md).

### Confirmación de registro por correo

En **Authentication → URL Configuration**, configura **Site URL** con la URL pública del **frontend**, terminada en `/`, y añade esa misma URL exacta a **Redirect URLs**. En desarrollo independiente es `http://localhost:5173/`; con `vercel dev` es `http://localhost:3100/`. `http://localhost:3000/` pertenece al backend y no sirve la interfaz.

Para el despliegue actual, usa **`https://books-chi-amber.vercel.app/`** en Site URL y Redirect URLs. Si se utiliza `VITE_SITE_URL`, su valor en Production debe ser esa misma URL.

El registro y el reenvío envían `emailRedirectTo` con `VITE_SITE_URL` o el origen actual del navegador. Supabase debe permitir ese destino; un destino no autorizado puede acabar en el Site URL por defecto. En producción puedes fijar `VITE_SITE_URL=https://tu-dominio/` para que los correos usen un dominio estable. Si se fija en previews, estas también volverán a ese dominio.

En **Authentication → Email Templates → Confirm signup**, conserva el enlace `href="{{ .ConfirmationURL }}"`: confirma el correo en Supabase y vuelve a la app con la sesión. Esta app utiliza el flujo implícito del cliente de Supabase; una plantilla que apunte directamente a `{{ .SiteURL }}` sin verificar el correo, o que genere una ruta personalizada con `token_hash`, requiere otro tratamiento y no debe sustituir ese enlace.

La app espera a que Supabase valide y guarde la sesión antes de mostrar la biblioteca, y retira de la URL los parámetros de autenticación tanto en éxito como en error. Si el enlace caducó o ya se utilizó, muestra un mensaje y permite reenviar la confirmación introduciendo el correo. Cambiar la configuración no corrige los correos enviados anteriormente: solicita uno nuevo después del cambio.

Comprueba el flujo con una cuenta nueva: registrarse, abrir el último correo en un navegador sin sesión previa, comprobar que se abre la biblioteca, que no quedan tokens en la URL y que recargar conserva la sesión. Comprueba también que un enlace caducado muestra el aviso y permite reenviar.

Referencias: [redirecciones de Supabase](https://supabase.com/docs/guides/auth/redirect-urls), [flujo implícito](https://supabase.com/docs/guides/auth/sessions/implicit-flow).

Para esta versión, aplica **una vez y antes de desplegar el backend y frontend** la [migración 003 de estantería](src/books/database/migrations/003_bookshelf.sql), después de 001 y 002. Además del orden y los ajustes personales, crea el bucket privado `book-spines` y sus políticas de acceso. No hacen falta nuevas variables ni almacenar imágenes en Vercel. La migración debe estar aplicada para que los endpoints de biblioteca puedan seleccionar los nuevos campos.

Aplica también, **antes de desplegar esta versión**, la [migración 004 de datos personales](src/books/database/migrations/004_personal_book_metadata.sql), después de 001–003. Habilita la edición de las fichas propias en `user_books`, manteniendo intacto el catálogo compartido. No requiere nuevas variables. La API selecciona el nuevo campo `metadata` al consultar la biblioteca.

## Prueba conjunta de los servicios

Para la edición de portadas mediante fotos, aplica también la [migración 005](src/books/database/migrations/005_cover_photos.sql), después de 001–004 y antes de desplegar frontend y API. Crea el bucket privado `book-covers` y la ruta personal de portada. No requiere nuevas variables de entorno.

Con una CLI actual de Vercel, desde la raíz:

```sh
npx vercel dev --local --listen 3100
```

`--local` permite probar los servicios sin autenticarte en Vercel ni crear un despliegue. La web queda en `http://localhost:3100` y Swagger en `http://localhost:3100/api/docs`. Añade ese origen a las redirecciones de Supabase si vas a probar la confirmación por correo.

Comprueba:

- `GET /` sirve la interfaz React.
- `GET /api` devuelve la respuesta de Nest.
- `GET /api/docs` abre Swagger y sus operaciones utilizan `/api`.
- `GET /api/me/books` sin token devuelve `401`, no HTML del frontend.
- Los assets `/fonts/*`, `/favicon.svg` y el código del frontend se sirven desde `frontend`.
- Iniciar sesión y añadir un libro utiliza `/api/me/books/isbn` en el mismo dominio.

También se mantiene el desarrollo independiente habitual: `npm run start:dev` en la raíz y `npm run dev` dentro de `frontend`. En ese modo Nest conserva `/books`, `/me/books` y `/docs` en el puerto 3000; Vite usa su proxy local para quitar `/api`. Con `vercel dev`, ese proxy se desactiva y el router de servicios gestiona `/api`.

## Compilación y pruebas

### Recuperación de contraseña y cuenta

En Supabase → **Authentication → URL Configuration → Redirect URLs**, añade **`https://books-chi-amber.vercel.app/recuperar-contrasena`**, conservando la URL de registro actual. En desarrollo añade `http://localhost:5173/recuperar-contrasena` (o el origen de `vercel dev`); autoriza también la ruta en las previews utilizadas. `VITE_SITE_URL`, si existe, debe seguir apuntando al frontend. La plantilla **Reset Password** debe enlazar a `{{ .ConfirmationURL }}`. Consulta el [flujo oficial de recuperación](https://supabase.com/docs/guides/auth/passwords).

La página de acceso permite solicitar un enlace sin revelar si la cuenta existe. El enlace válido abre el formulario de nueva contraseña, retira los tokens de la URL y vuelve a la biblioteca al guardar. Los enlaces caducados permiten solicitar otro. Durante la recuperación, una recarga en la misma pestaña conserva el formulario; una visita sin enlace válido permite pedir uno nuevo.

**Mi cuenta**, en la cabecera, permite cambiar la contraseña indicando la actual, descargar los datos propios como JSON y eliminar la cuenta. La exportación recorre las filas por páginas e incluye libros, notas, estrellas, préstamos, deseos y orden. No contiene credenciales ni el contenido de las fotos.

`DELETE /api/me/account` exige sesión, contraseña actual y `confirmation: "ELIMINAR"`. El backend verifica de nuevo las credenciales en un cliente aislado. Enumera los archivos del usuario en `book-spines` y `book-covers`, incluidos restos de subidas, los borra mediante Storage y después elimina al usuario de Auth. Las claves foráneas existentes borran biblioteca, deseos y orden; las fichas y autores compartidos permanecen. No se admite una identidad del body ni se expone la clave administrativa al navegador.

No necesita nuevas migraciones ni variables respecto a 001–007. Storage y Auth no comparten una transacción: si falla la eliminación después de borrar fotos, la cuenta puede conservarse con parte de las fotos ya borradas; la interfaz informa de ello y permite reintentar. La [prueba SQL de eliminación](test/database/account-deletion.sql) verifica el borrado en cascada y la conservación de los datos del segundo lector; ejecútala en una base de pruebas y sus datos se revierten al terminar.

Para el catálogo y la lista de deseos, aplica **antes de desplegar API y frontend** la [migración 007](src/books/database/migrations/007_wishlist_catalog.sql), después de 001–006. Crea `user_wishlist` con acceso privado por usuario y `browse_catalog` con búsqueda y paginación. El catálogo devuelve únicamente fichas y autores compartidos; no une bibliotecas, préstamos, anotaciones, valoraciones ni fotos personales. Guardar o quitar deseos no modifica `user_books`. No requiere nuevas variables.

La [prueba SQL de catálogo y deseos](test/database/wishlist-catalog.sql) comprueba privacidad entre dos lectores, permisos anónimos, duplicados, búsqueda, paginación y eliminación independiente. Ejecútala en una base de pruebas con las migraciones aplicadas: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f test/database/wishlist-catalog.sql`. Sus datos se revierten al terminar.

Para los préstamos, las anotaciones y las estrellas, aplica **antes de desplegar API y frontend** la [migración 006](src/books/database/migrations/006_book_personal_details.sql), después de 001–005. Añade `is_lent`, `lent_to`, `notes` y `rating` a `user_books`, con límites y las políticas RLS existentes. Los libros actuales conservan sus estados de lectura; empiezan sin préstamo, anotaciones ni valoración. No requiere nuevas variables.

La [prueba SQL de datos personales](test/database/book-personal-details.sql) comprueba valores, privacidad entre dos lectores y conservación al restaurar el catálogo. Ejecútala en una base de pruebas con las migraciones aplicadas: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f test/database/book-personal-details.sql`. Sus datos se revierten al terminar.

```sh
npm run build
npm test -- --runInBand
npm --prefix frontend run build
npm --prefix frontend test
```

Para publicar, importa el repositorio en Vercel con Root Directory `.` y las variables anteriores. Los comandos de instalación y compilación se declaran por servicio. Confirma previamente los nombres `app`/`frontend`, las rutas públicas y la decisión de no añadir un proxy interno.

Referencias oficiales: [Services](https://vercel.com/docs/services), [routing](https://vercel.com/docs/services/routing), [bindings](https://vercel.com/docs/services/bindings), [NestJS](https://vercel.com/docs/frameworks/backend/nestjs).

La URL y la clave pública usan los mismos nombres `VITE_` en frontend y backend. No se admiten los antiguos nombres `SUPABASE_URL`, `SUPABASE_AUTH_KEY` ni `SUPABASE_KEY`. La clave privada se mantiene exclusivamente en `SUPABASE_SERVICE_ROLE_KEY`, sin prefijo `VITE_`. En local, ambos servicios leen `.env` en la raíz.
