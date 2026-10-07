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

El archivo `.env` de la raíz contiene la configuración compartida y queda fuera de Git. Backend y Vite lo leen desde esa ubicación. Configura estas variables allí:

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-clave-publica
SUPABASE_SERVICE_ROLE_KEY=tu-clave-privada-solo-servidor
VITE_API_URL=/api
API_PROXY_TARGET=http://localhost:3000
```

La clave pública es la **publishable** o la **anon public** del mismo proyecto que utiliza el backend (`VITE_SUPABASE_PUBLISHABLE_KEY`). No uses la clave **service_role**, **secret** ni `SUPABASE_SERVICE_ROLE_KEY`: las variables `VITE_` se incluyen en el código del navegador.

En Supabase → Authentication → URL Configuration, añade `http://localhost:5173` a las URLs de redirección permitidas. Si está activada la confirmación por correo, confirma el enlace recibido antes de entrar. La [guía del backend](../src/auth/README.md) explica las tablas, migraciones y permisos necesarios.

## Qué puedes hacer

- Crear una cuenta, entrar y cerrar la sesión.
- Recuperar una contraseña olvidada mediante correo y elegir una nueva al abrir el enlace.
- Abrir **Mi cuenta** (icono de ajustes en la cabecera) para cambiar la contraseña actual, exportar datos como JSON o eliminar la cuenta con contraseña y confirmación. La eliminación retira tus datos y fotos personales, conservando las fichas compartidas del catálogo.
- Añadir libros por ISBN: Nest busca en su base de datos o consulta sus proveedores e incorpora el libro a tu biblioteca.
- Escanear el código EAN-13 del ISBN con la cámara, revisar el número y confirmar el alta.
- Añadir título, autores y editorial a mano si el libro no aparece en los catálogos. El ISBN es opcional en este modo.
- Organizar tu biblioteca en **Por leer**, **Leyendo** y **Leídos**.
- Buscar por título, autor o ISBN; ordenar por fecha de incorporación, título, autor o valoración personal (ascendente o descendente). Los libros sin valorar aparecen al final; 0 estrellas cuenta como valoración.
- Consultar las estrellas en la esquina opuesta al estado de cada portada. **Valorar** abre la ficha y enfoca las estrellas; pulsar una nota existente permite cambiarla.
- **Explorar catálogo** permite ver y buscar todos los libros compartidos de la plataforma, por páginas, sin mostrar propietarios ni información personal.
- **Guardar deseo** añade una ficha a tu **Lista de deseos**, el último estante de **Mis estantes**. Puedes consultar su detalle y quitar el deseo; estas acciones no añaden ni retiran libros de tu biblioteca.
- Consultar la ficha y quitar un libro de tu biblioteca mediante confirmación.
- Abrir en **Estantería** y cambiar a **Portadas** cuando prefieras; la elección se recuerda por cuenta.
- Pulsar **Diseñar** para elegir entre seis ambientes, crear muebles y baldas, decorar con 27 objetos y configurar material, pared, luces y guirnaldas. El diseño conserva sus posiciones entre móvil y ordenador; puedes ampliarlo o recorrerlo.
- Arrastrar libros y objetos con ratón o pantalla táctil, o seleccionarlos y usar las flechas del inspector/teclado. Insertar un libro en una fila ocupada previsualiza su nuevo lugar conservando la decoración. Los libros admiten lomos verticales, inclinación, portadas y pilas horizontales.
- Seleccionar libros en **Libros** y previsualizar su organización por título, autor, color o estado. Deshacer y rehacer permiten recuperar composiciones anteriores. Los filtros resaltan coincidencias sin moverlas.
- Usar **Capturar varios lomos** para fotografiar una fila, girar/enderezar, marcar recortes y asignarlos a libros. Se revisan todos antes de guardar y se reintentan solo los pendientes.
- Descargar PNG de hasta 4096 píxeles del conjunto o de un mueble, en formato original, cuadrado o vertical. La imagen incluye las fotos privadas y se prepara localmente.
- Abrir la ficha y pulsar **Personalizar lomo** para ajustar color, grosor y altura, elegir una imagen o pulsar **Hacer foto** para usar la cámara del móvil. Se admiten JPEG, PNG y WebP de hasta 5 MB.
- Al elegir o hacer una foto se abre automáticamente el recorte: verás la fotografía completa y el resultado del lomo a la vez. Arrastra el marco, sus esquinas o sus bordes para quitar la mano y el fondo; la vista previa cambia al instante. Puedes girar 90°, enderezar la imagen y abrir los ajustes precisos para ampliar o desplazar la selección. Los controles también admiten las teclas de dirección (Shift para pasos mayores).
- Pulsa **Usar este recorte** y después **Guardar lomo**. **Volver a recortar** conserva la foto original y la selección mientras editas; no necesitas transformar la foto fuera de la app. **Restaurar aspecto automático** elimina tus ajustes y la foto al guardar.

El estudio requiere las migraciones 001–008. La [migración 003](../src/books/database/migrations/003_bookshelf.sql) crea los campos personales y el bucket privado de lomos; la [migración 008](../src/books/database/migrations/008_bookshelf_studio.sql) añade el diseño y su guardado transaccional. No requiere nuevas variables de aplicación. Convierte las bibliotecas anteriores a baldas de anchura lógica fija, conservando orden, revisiones y fotos. Los libros nuevos aparecen en **Por colocar**; eliminar baldas o muebles libera sus libros sin retirarlos de la biblioteca. La incorporación o retirada de libros actualiza la revisión y conserva la decoración.

El guardado automático conserva un borrador por cuenta en la sesión del navegador si falla la conexión. Puedes reintentar sin perderlo. Si otra sesión ha guardado una versión distinta, se muestran ambas para elegir. Deshacer/rehacer pertenece a la sesión de edición; el diseño confirmado se guarda en Supabase.

Los cambios se guardan en la API, no solo en el navegador. Añadir el mismo libro vuelve a mostrar su relación existente sin duplicarla ni modificar su estado de lectura. Quitar un libro elimina únicamente su relación con tu biblioteca.

Para catálogo y deseos, aplica la [migración 007](../src/books/database/migrations/007_wishlist_catalog.sql) después de 001–006 y antes de desplegar. Las estrellas utilizan el campo privado de la migración 006. El catálogo consulta solo metadatos compartidos; los deseos se guardan por usuario en `user_wishlist` con RLS. No hay variables nuevas. Consulta [DEPLOYMENT.md](../DEPLOYMENT.md) para aplicar y verificar las migraciones.

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

Para ejecutar Playwright sobre la compilación de producción, compila primero y usa `PLAYWRIGHT_PREVIEW=1 npm run test:e2e`. Las pruebas simulan la API y el servidor de preview se abre en el puerto 5174; así no interfieren las recargas del servidor de desarrollo.

Las fuentes gratuitas DM Sans y Lora se sirven desde `public/fonts/`, junto con sus licencias. Los datos de libros y las portadas dependen de la disponibilidad de los catálogos; las portadas ausentes tienen una cubierta de texto.

La URL y la clave pública usan los mismos nombres `VITE_` en frontend y backend. No se admiten los antiguos nombres `SUPABASE_URL`, `SUPABASE_AUTH_KEY` ni `SUPABASE_KEY`. La clave privada se mantiene exclusivamente en `SUPABASE_SERVICE_ROLE_KEY`, sin prefijo `VITE_`. En local, ambos servicios leen `.env` en la raíz.

## Edición de mis libros

Abre un libro de tu biblioteca y pulsa **Editar mi libro**. Puedes corregir el
título, añadir o quitar autores y editar editorial, fecha de publicación, páginas,
idioma e ISBN. Dentro del editor, **Portada** permite elegir una foto o usar la
cámara, recortar, girar y enderezar la imagen antes de guardarla. **Personalizar
lomo** utiliza el mismo editor de fotos con sus ajustes de color y dimensiones.
Puedes cambiar de sección sin perder el borrador. Guardar solo
cambia tu ficha personal. Cancelar descarta el borrador y, si falla el guardado,
puedes reintentarlo sin perder lo escrito.

La opción **Restaurar datos del catálogo** pide confirmación y recupera la ficha
original sin cambiar el estado de lectura ni el lomo. Requiere la migración
`004_personal_book_metadata.sql` y `005_cover_photos.sql` antes de desplegar frontend y API; consulta
[`src/auth/README.md`](../src/auth/README.md).
