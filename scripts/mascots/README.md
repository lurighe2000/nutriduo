# Mascotas de NutriDuo

Stitch acompaña a Luca y Angel a Ari en Inicio. El visor de gestos está en
`mascots.html` y se incluye en la publicación de producción.

## Diseño elegido

Luca seleccionó explícitamente el 15/10/2026 la escultura gris obtenida de su
imagen de Angel (captura `1001232848.jpg`). `build_angel.py` conserva esa forma:
reduce la malla para celular, aplica rosa, vientre claro, V blanca y flor, y agrega
esqueleto, ojos y gestos. No usa el ensayo de Angel recoloreado desde Stitch ni
el estudio paramétrico independiente de `author_angel_study.py`.

Referencia de apariencia única: `e9d7c2032d1d829d746280cefeae2df4.jpg`.
Origen, licencias, hashes y métricas: `public/mascots/credits.json`.
Las animaciones son propias; no son capturas de movimiento ni archivos de la
película, y no se afirma una reproducción cinematográfica exacta.

## Comportamiento

- Una escena WebGL y sólo el GLB del perfil activo, con carga diferida de Three.js.
- Respiración, parpadeo, saludos, miradas, manos, señal, baile y celebración.
  Stitch también tiene una entrada y salida completas de la postura invertida.
- Reacciones a comidas, proteína, agua, cierre del día y entrenamiento o salida
  guardados. Sin registros no se interpreta un fracaso; descansar no se penaliza.
- El botón de atención abre comidas, entrenamiento o progreso, o enfoca el agua.
- La pausa se guarda en el perfil con un campo opcional compatible con respaldos
  anteriores. Se respeta movimiento reducido y se suspende fuera de pantalla.
- Se liberan escenas, texturas y recursos GPU al cambiar de vista. Ante un error
  WebGL se mantiene una alternativa utilizable. La primera descarga necesita red;
  el service worker guarda cada modelo solicitado para próximos usos sin red.
- Los gestos cotidianos (mirar, rascarse, nariz y saludo) están disponibles sin
  cargar comidas. Cada 8 segundos visibles se intenta una acción; el gesto en
  curso termina antes del siguiente. Baile y postura invertida acompañan los
  estados de progreso, sin exigir superar objetivos. En apoyo se usan gestos suaves.
- Stitch usa un reposo cíclico de 12 segundos con pecho, brazos, cabeza, orejas
  y cola; sus clips se hornean a 30 Hz. Entradas y salidas tienen velocidad y
  aceleración nulas, con mezclas suaves de 550 ms. La postura invertida conserva
  su salida completa antes de responder al próximo toque.

## Fuentes reproducibles

Blender oficial 4.5.9 LTS:
`C:/Users/lucar/.codex/tools/blender/blender-4.5.9-windows-x64/blender.exe`.
Usar `--background --factory-startup --disable-autoexec --python-exit-code 1`.

- Stitch: `--python scripts/mascots/build.py -- SOURCE.glb OUTPUT SOURCES`.
  Origen descargado por el canal habilitado de Sketchfab, con crédito en JSON.
- Angel: `--python scripts/mascots/build_angel.py -- public/mascots/angel-sculpt.glb OUTPUT`.
  Genera un `.blend` editable, render y GLB; conservar OUTPUT fuera del sitio.
- Revisión de clips exportados: `--python scripts/mascots/review_clips.py -- CHARACTER.glb OUTPUT`.
  Renderiza cada clip y registra límites. Los límites de una muestra no acreditan
  contactos de todos los fotogramas; el visor permite revisar las transiciones.

Proyectos editables locales:
`C:/Users/lucar/.codex/tools/mascot-3d/fluid-stitch/sources/stitch.blend` y
`C:/Users/lucar/.codex/tools/mascot-3d/approved-angel/angel.blend`.
El original aprobado se conserva como `angel-sculpt.glb`; el original de alta
resolución permanece en `C:/Users/lucar/.codex/tools/mascot-3d/angel-from-reference.glb`.

## Verificación

TypeScript, ESLint, formato, pruebas unitarias y build. La suite de la app incluye
ambos perfiles, 360/393/412/430 px, claro/oscuro, pausa persistente, reducción de
movimiento, acceso a registrar comida y reapertura del modelo sin conexión.
El visor tiene una prueba separada con ángulos, pausa y cambio de personaje.
Se revisaron renders de los clips y reproducción real en Chromium.

La emulación de pantallas no equivale a medir FPS en el Samsung y el iPhone
físicos. El parecido queda basado en la escultura elegida y su única foto;
las superficies ocultas son inferidas.

## Costo y credenciales

La reproducción es local y no llama a IA. No se activaron servicios pagos.
La clave temporal de Hugging Face se revocó y se eliminó de la PC: HTTP 401 al
comprobarla y estado `Invalidated` en la cuenta. No hay claves en el repositorio.
Los ensayos externos descartados se documentan en `generation-review.md`.
