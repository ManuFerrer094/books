# Decoración de la estantería

Los 27 identificadores del editor se mantienen: las composiciones guardadas,
plantillas, colocación, ocupación, historial y sincronización siguen usando el
mismo modelo. Los nombres de tres plantas se ajustan al ejemplar representado.

El catálogo utiliza 16 modelos de Poly Haven bajo CC0 y modelados complementarios
originales. Se descargan los modelos y texturas originales, **no las imágenes de
previsualización del sitio**. Blender genera nuestros propios renders frontales
con iluminación consistente y fondo transparente. Las piezas adicionales
(sujetalibros, separadores, figuras, cristal y bonsái) se modelan en el script.

El navegador recibe solamente WebP y máscaras, sin motor 3D, paquetes nuevos,
peticiones a Poly Haven, credenciales o servicios de pago. El catálogo usa
miniaturas de 192 píxeles; la escena y la exportación utilizan hasta 1024 píxeles.
Las máscaras permiten cambiar el color del material conservando texturas y
superficies secundarias. Los colores predeterminados antiguos pasan a representar
el material original. El botón «Recuperar material original» restablece su aspecto.

Los créditos visibles están en `/assets/decorations/credits.html`. `sources.json`
registra autores, originales, licencias, enlaces, MD5 de los modelos descargados
y SHA-256 de los renders publicados. Los originales son CC0 y los renders y
modelados propios conservan la licencia MIT del proyecto, incluida en el paquete.

## Regeneración

Desde la raíz del repositorio, con Node, Blender 4.5 LTS y Python/Pillow:

```powershell
node --use-system-ca scripts/prepare-bookshelf-models.mjs
blender --background --factory-startup --disable-autoexec --python scripts/render-bookshelf-decor.py
python scripts/package-bookshelf-decor.py
```

Para renderizar de nuevo solamente algunas piezas, añadir `-- vase fern` al
comando de Blender. La descarga comprueba las huellas publicadas por Poly Haven,
reutiliza los archivos correctos y restringe las URLs al servidor de recursos
oficial. Los originales, Blender portátil y los renders intermedios están en
`.tmp/decor-source`, excluido de Git; solo se publica el paquete optimizado.
El empaquetador genera además una hoja de contacto para la revisión visual.

Si falta un recurso, se muestra el dibujo de respaldo. La exportación avisa y
utiliza ese mismo respaldo. Las imágenes y máscaras se incrustan en el PNG junto
con las fotos privadas existentes, descargando cada URL una sola vez por exportación.
