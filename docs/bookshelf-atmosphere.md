# Luz y sonido de la biblioteca

El botón **Luz y sonido**, disponible tanto en Ver como en Diseñar, abre diez
ambientes completos y cuatro herramientas: Ambientes, Luz, Sonido y Lectura.
Elegir un ambiente cambia la iluminación, el día/noche y la mezcla; conserva
todos los muebles, baldas, libros, pilas y decoraciones.

## Luz

Paletas y color personalizado, luminosidad ambiental, rayos de ventana con
dirección ajustable, polvo, resplandor de lámparas y velas, sombras de borde y
lluvia, nieve, hojas o estrellas tras la estantería. Las luces de cada balda y
guirnaldas siguen utilizando su propio color e intensidad. El nuevo resplandor
se sitúa en las fuentes de luz decorativas, se recorta al mueble y proyecta
luz sobre libros y objetos. La escena conserva sus coordenadas lógicas.

Las animaciones son CSS, no ejecutan un bucle de JavaScript ni interceptan
gestos. Se pueden desactivar; `prefers-reduced-motion` también las desactiva.
La exportación PNG utiliza los mismos gradientes y formas SVG en una escena
estática, sin el panel de control.

## Sonido

Catorce capas: lluvia, chimenea, viento, pájaros, páginas, pasos, reloj, café,
fuente, mar, truenos, noche, vinilo y ensoñación. Cada una tiene volumen,
silencio con recuperación del nivel y escucha aislada. También se ajustan
el volumen general y la amplitud estéreo. El aislamiento es temporal y no
sobrescribe la mezcla guardada.

Se combinan seis grabaciones gratuitas con síntesis original Web Audio. Las
grabaciones se cargan desde la propia aplicación, solo cuando se activa el
sonido y para las capas necesarias. La mezcla comienza con síntesis y pasa
suavemente a la grabación; si falla una descarga o decodificación, conserva
la síntesis, informa y permite reintentar al pausar y activar. No hay streaming
de terceros, nuevas dependencias de ejecución, API de pago ni suscripciones.
Los sonidos interiores reciben una respuesta de sala estéreo original, con
reflexiones tempranas y una cola breve; se reduce al estrechar la imagen estéreo.

El paquete de grabaciones ocupa aproximadamente 1,6 MB. Sus fuentes, autores,
licencias, modificaciones y SHA-256 están en
`frontend/public/assets/library-sounds/sources.json`. Los créditos son visibles
desde el mezclador; cinco obras son CC0 y el sonido de páginas es CC BY 4.0,
con la atribución solicitada por Nicole Marie T.
Al sacar un libro para mirar su portada se añade un pequeño sonido de papel,
solo si la reproducción y la capa Páginas ya están activadas.

Para regenerarlas, con Python 3 y ffmpeg instalado y disponible en PATH:

```powershell
python scripts/prepare-bookshelf-sounds.py
```

Los originales se conservan en `.tmp/sound-source`, excluido de Git. Los niveles
se normalizan y las transiciones usan rampas para evitar clics. La salida pasa
por un compresor y la mezcla reduce automáticamente la ganancia al sumar capas.
Las texturas sintetizadas varían despacio y los detalles aparecen espaciados;
el café representa un murmullo sin conversaciones identificables.

El navegador crea AudioContext únicamente tras **Activar sonido**. Abrir la
estantería, cambiar un ambiente, recargar y restaurar un diseño nunca reproducen
sonido por sí solos. Pausar atenúa y suspende el contexto. Salir de la vista o
cambiar de cuenta detiene y cierra el audio y aborta las cargas pendientes.

## Lectura y guardado

Temporizador de 1 a 180 minutos, con duraciones rápidas y dos finales: apagado
gradual durante diez segundos o un aviso breve, si el audio ya está activado.
Usa una hora límite real para incluir el tiempo con la pestaña suspendida.
Se puede cancelar y cerrar el panel sin cancelar la sesión. La reproducción,
el aislamiento y el temporizador pertenecen a la sesión; no se guardan.

Los ajustes persistentes viven en `design.atmosphere`, versión 1, un campo
opcional de la escena existente. Usan la misma revisión, escritura transaccional,
historial, borrador local, reintento y resolución de conflictos. Se conservan
al reordenar desde clientes antiguos, al añadir o retirar libros y al exportar
la cuenta. Los diseños anteriores mantienen su apariencia hasta activar el
nuevo ambiente. No se añaden tablas ni se cambian las políticas por propietario.

La migración **009_bookshelf_atmosphere.sql** valida niveles, capas, dirección,
colores, versión y tipos tanto en RPC como en escrituras directas. No transforma
las composiciones existentes. Para publicar, aplicar 009 y después desplegar
API y frontend; un cliente nuevo sigue siendo compatible con el esquema 008,
que ya almacena el JSON opcional, pero 009 añade su validación en PostgreSQL.

## Comprobaciones

Vitest comprueba escenas y validación, conservación en geometría y límites de
mezcla y temporizador. Nest comprueba conservación en escrituras antiguas y
exportación privada. SQL comprueba transacciones, rollback, propietarios y
rechazo de ajustes malformados. Playwright comprueba escritorio y móvil:
composición, guardado, historial, errores, conflictos, audio real y silencio,
temporizadores, bibliotecas vacías y de 500 libros, movimiento reducido y PNG.
