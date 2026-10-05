# Desplegar en Vercel Services

## Versión de Node.js

El backend fija Node.js `24.x` en `package.json`. NestJS 12 publica módulos ESM y la compilación actual genera CommonJS (`require()`); Node.js 24 admite cargar estas dependencias desde CommonJS. Un runtime sin ese soporte falla al arrancar con `ERR_REQUIRE_ESM`.

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
| `SUPABASE_URL`                  | URL del proyecto Supabase para Nest                                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Clave secret/service_role del catálogo, solo servidor. También se admite el nombre anterior `SUPABASE_KEY` |
| `SUPABASE_AUTH_KEY`             | Clave publishable/anon del mismo proyecto; Nest la utiliza para validar sesiones y acceder a la biblioteca |
| `VITE_SUPABASE_URL`             | URL de Supabase para el navegador                                                                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública publishable/anon para el navegador                                                           |
| `VITE_API_URL`                  | Opcional; el valor por defecto es `/api`. Mantén ese valor para este despliegue                            |
| `GOOGLE_BOOKS_API_KEY`          | Opcional; habilita Google Books como proveedor adicional                                                   |

Las variables `VITE_` se incorporan al JavaScript durante la compilación. No pongas claves de servidor en ellas. El archivo `.env` y `frontend/.env.local` son locales y no sustituyen la configuración del proyecto en Vercel. No configures `VERCEL` manualmente: lo proporciona Vercel. `API_PROXY_TARGET` es únicamente para el desarrollo independiente con Vite.

Configura el dominio final en Supabase → Authentication → URL Configuration (Site URL y Redirect URLs). Para probar altas desde previews, autoriza también las URLs de preview correspondientes. Aplica previamente las [migraciones y permisos de Supabase](src/auth/README.md).

## Prueba conjunta de los servicios

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

```sh
npm run build
npm test -- --runInBand
npm --prefix frontend run build
npm --prefix frontend test
```

Para publicar, importa el repositorio en Vercel con Root Directory `.` y las variables anteriores. Los comandos de instalación y compilación se declaran por servicio. Confirma previamente los nombres `app`/`frontend`, las rutas públicas y la decisión de no añadir un proxy interno.

Referencias oficiales: [Services](https://vercel.com/docs/services), [routing](https://vercel.com/docs/services/routing), [bindings](https://vercel.com/docs/services/bindings), [NestJS](https://vercel.com/docs/frameworks/backend/nestjs).
