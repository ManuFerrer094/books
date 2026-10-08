# Carpintería y objetos vivos

En **Estantería → Diseñar → Muebles** se elige entre cinco carpinterías: biblioteca de autor, arcadas, gabinete dorado, taller industrial y baldas flotantes. Son acabados de la misma geometría frontal; cambiar entre ellos conserva identificadores, dimensiones y colocación.

Cada balda ofrece línea LED, focos de galería, bombillas de cristal, constelación, arco de neón o ninguna luminaria. La guirnalda adicional sigue disponible, igual que color e intensidad. Se puede copiar la iluminación a las baldas del mismo mueble. El interruptor físico, operable con clic, Enter o Espacio, controla todas las baldas y objetos luminosos de ese mueble. El botón superior controla todos los muebles. Apagar conserva los niveles y los estados individuales; la iluminación ambiental de la habitación sigue siendo independiente.

Los 27 recursos locales se agrupan en cuatro colecciones además del catálogo completo. En Ver, lámparas, faroles, velas, cristales, luna y estrella alternan su iluminación; los marcos recorren cuatro ilustraciones propias; las plantas se mecen; la taza emite vapor; el reloj mueve su segundero; las figuras muestran un destello. En Diseñar, el clic conserva selección y arrastre y la acción del objeto se ofrece en su inspector. Los objetos restantes abren el inspector al tocarlos en Ver.

## Persistencia

El diseño v1 añade campos opcionales: `bookcase.style`, `bookcase.lights_on`, `shelf.light.type`, `shelf.light.enabled`, `decor.active` y `decor.artwork` (0–3, solo marcos). Una escena antigua funciona sin transformaciones: carpintería clásica, línea LED e interruptores encendidos. Los objetos luminosos se consideran activos al omitir su estado; el resto permanece quieto. Las seis composiciones nuevas eligen carpintería y luminarias acordes.

Cada interacción usa el historial y guardado existentes: revisión única, borrador local ante errores y resolución explícita de conflictos. Ordenar libros, retirar libros o exportar la cuenta conserva estos campos. `010_bookshelf_craft.sql` valida también las escrituras directas y transaccionales en PostgreSQL; aplicar después de 009 antes de publicar los clientes actualizados. No añade tablas, servicios ni permisos de lectura.

## Renderizado y comprobación

Si se aplicó 010 sin el validador de 009, los PUT que incluyen un ambiente fallan con `42883` al ejecutar el trigger. `011_bookshelf_atmosphere_repair.sql` restaura el validador de ambiente, conserva el de decoración y recarga el esquema de PostgREST. Se puede ejecutar de nuevo y no cambia diseños ni revisiones. En esta situación se aplica únicamente 011 desde SQL Editor; no se reejecutan 009/010. El backend identifica las funciones ausentes y el cliente avisa de que el servidor necesita actualizarse, conservando el borrador. La comprobación SQL reproduce la instalación incompleta, el fallo y su reparación, incluidos los dos validadores y las reejecuciones.

Todos los acabados e interacciones usan SVG/CSS propios, sobre los recursos gratuitos existentes. `decorationBounds` reproduce `xMidYMax meet` para ajustar luces, ilustraciones y efectos a la silueta renderizada; las tazas y relojes no se estiran. El PNG usa la misma escena, sin interruptores ni controles. Los efectos se exportan en una pose estática y respetan movimiento reducido en el navegador; el control de movimiento del ambiente también los detiene. El sonido mantiene la reproducción explícita del usuario.

Pruebas: Vitest comprueba estados independientes, compatibilidad y rechazo de campos inválidos. SQL verifica round trip, rollback de revisión, escritura antigua de orden, conflictos y permisos. Playwright cubre las cinco carpinterías y seis luminarias en escritorio/móvil, clics/teclado, estados individuales, deshacer, recarga, colecciones, PNG, movimiento reducido y recuperación de guardado. Las pruebas existentes de estudio, fotografías y ambientes verifican las regresiones.
