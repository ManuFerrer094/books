# Entre páginas

Interfaz React + TypeScript para la biblioteca personal del proyecto. Vite sirve el frontend; Nest conserva las operaciones de catálogo y biblioteca. Supabase gestiona el registro, el inicio de sesión y la renovación de sesión.

## Arrancar en local

Desde la raíz, inicia el backend:

```sh
npm run start:dev
```

En otra terminal:

```sh
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173**. En PowerShell, si la política de ejecución bloquea `npm`, usa `npm.cmd`.

El archivo `.env.local` contiene la configuración local pública y queda fuera de Git. Para otro entorno, copia `.env.example` a `.env.local` y rellena:

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-clave-publica
VITE_API_URL=/api
API_PROXY_TARGET=http://localhost:3000
```

La clave pública es la **publishable** o la **anon public** del mismo proyecto que utiliza el backend (`SUPABASE_AUTH_KEY`). No uses la clave **service_role**, **secret** ni `SUPABASE_KEY`: las variables `VITE_` se incluyen en el código del navegador.

En Supabase → Authentication → URL Configuration, añade `http://localhost:5173` a las URLs de redirección permitidas. Si está activada la confirmación por correo, confirma el enlace recibido antes de entrar. La [guía del backend](../src/auth/README.md) explica las tablas, migraciones y permisos necesarios.

## Qué puedes hacer

- Crear una cuenta, entrar y cerrar la sesión.
- Añadir libros por ISBN: Nest busca en su base de datos o consulta sus proveedores e incorpora el libro a tu biblioteca.
- Escanear el código EAN-13 del ISBN con la cámara, revisar el número y confirmar el alta.
- Añadir título, autores y editorial a mano si el libro no aparece en los catálogos. El ISBN es opcional en este modo.
- Organizar tu biblioteca en **Por leer**, **Leyendo** y **Leídos**.
- Buscar por título, autor o ISBN; ordenar por fecha de incorporación, título o autor.
- Consultar la ficha y quitar un libro de tu biblioteca mediante confirmación.

Los cambios se guardan en la API, no solo en el navegador. Añadir el mismo libro vuelve a mostrar su relación existente sin duplicarla ni modificar su estado de lectura. Quitar un libro elimina únicamente su relación con tu biblioteca.

## Cámara gratuita

Se utiliza [ZXing Browser](https://github.com/zxing-js/browser), con licencia MIT. La lectura ocurre en el dispositivo: no enviamos fotos ni vídeo a un servidor. La cámara se detiene al detectar un ISBN, volver al formulario o cerrar la ventana. Solo se aceptan códigos de libros con un ISBN válido (prefijos 978/979).

La cámara requiere permiso y un contexto seguro: **localhost** en tu ordenador o **HTTPS**. Abrir `http://192.168…:5173` en el móvil permite usar el formulario, pero normalmente no la cámara; para probar el escáner en el móvil necesitas servir la web con HTTPS. Si la cámara falla, siempre puedes escribir el ISBN.

## Verificación y producción

```sh
npm test
npm run build
```

Las pruebas de navegador usan respuestas simuladas para no modificar cuentas ni libros reales. Se ejecutan en escritorio y móvil con Playwright:

```sh
npx playwright install chromium
npm run test:e2e
```

`dist/` contiene el frontend compilado. Configura la URL de Supabase y la clave pública antes de compilar y añade el dominio real a las redirecciones de Supabase.

El repositorio incluye una [configuración de Vercel Services](../DEPLOYMENT.md): frontend en `/` y Nest en `/api`, con llamadas desde el navegador al mismo dominio. En Vercel y con `vercel dev`, Nest recibe y acepta el prefijo `/api` y Vite no utiliza su proxy local. No se necesitan bindings para la aplicación estática.

Fuera de Vercel, el proxy local de Vite reenvía `/api/*` al backend independiente quitando el prefijo `/api`. Si publicas la API en otro origen y cambias `VITE_API_URL`, tendrás que permitir ese origen mediante CORS en Nest. `npm run preview` solo sirve para revisar los archivos compilados, sin proxy a la API.

Las fuentes gratuitas DM Sans y Lora se sirven desde `public/fonts/`, junto con sus licencias. Los datos de libros y las portadas dependen de la disponibilidad de los catálogos; las portadas ausentes tienen una cubierta de texto.
