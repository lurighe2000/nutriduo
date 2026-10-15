# Mascotas: estado de trabajo

Este trabajo vive en `codex/mascotas-3d`, separado de los cambios de Claude.
La app publicada no integra todavía estos modelos. `mascots.html` es una
entrada de desarrollo; no está incluida como página en el build de producción.
La rama incorporó la principal 1.16 (`72a5f0b`) con el merge `a64714c`.
Revisar nuevamente la principal antes de cualquier futura integración para
preservar avances posteriores de Claude; no desplegar esta rama encima.

## Qué existe

- Stitch: modelo descargado por el canal oficial de Sketchfab, con esqueleto
  facial y corporal; diez clips propios exportados desde Blender. Faltan revisar
  contactos y deformaciones en todos los clips y medir los celulares reales.
- Angel: escultura obtenida únicamente desde la imagen elegida por Luca, con
  la demo oficial gratuita de Hunyuan3D-2.1. El original tiene 415.870 triángulos;
  la vista de volumen tiene 116.442 y pesa 2.097.864 bytes. **No tiene esqueleto,
  expresiones, color ni animaciones.** La oreja caída y la cara necesitan trabajo.
- La anterior Angel recoloreada desde Stitch fue retirada del visor. Una prueba
  de proyección de color sobre la escultura también fue descartada: estiraba
  labios, brazos y costados. No usar esos experimentos como activos finales.
- Hay un nuevo estudio manual independiente, creado con `author_angel_study.py`:
  cuerpo continuo, materiales rosados, V blanca corta, orejas redondeadas,
  antenas detrás del cuerpo, flor, esqueleto y ensayos de ocho movimientos.
  **Es un estudio de anatomía y rig, no un modelo aprobado.** La cara, las
  manos, los hombros y las rodillas aún no cumplen el parecido y la deformación
  buscados. No está exportado al visor ni incorporado a la app.
- Visor con frente, tres cuartos, perfil y espalda; pausa, movimiento reducido,
  suspensión fuera de pantalla y liberación de recursos WebGL.

## Referencia y archivos fuente locales

Única imagen que decide la apariencia de Angel:
`C:/Users/lucar/Downloads/e9d7c2032d1d829d746280cefeae2df4.jpg`.
El análisis detallado está en `angel-reference.md`.

Los archivos de trabajo pesados quedan fuera del sitio público:

- Original generado: `C:/Users/lucar/.codex/tools/mascot-3d/angel-from-reference.glb`.
- Estudio editable: `C:/Users/lucar/.codex/tools/mascot-3d/sources/angel-reference-study.blend`.
- Stitch editable: `C:/Users/lucar/.codex/tools/mascot-3d/sources/stitch.blend`.
- Ensayos descartados: `C:/Users/lucar/.codex/tools/mascot-3d/reference-work/`.
- Nuevo estudio manual editable:
  `C:/Users/lucar/.codex/tools/mascot-3d/manual-angel/angel-authored-study.blend`.
- Revisión de servicios y revocación: `generation-review.md`.

Origen, hash y límites de cada archivo público: `public/mascots/credits.json`.

## Reconstrucción con textura y costo

Luca inició sesión y autorizó una clave temporal de permisos mínimos para usar
los demos gratuitos. No se activaron planes, facturación ni servicios pagos.
Hunyuan3D-2 siguió fallando con `NameError`. TRELLIS.2 generó un panel plano;
TRELLIS clásico entregó un GLB con textura, pero su vista de perfil y espalda
mostró un relieve doble con un fondo rectangular. Ambos resultados se
descartaron: no sirven para un personaje articulado. No repetir tareas idénticas
ni presentar estos archivos como modelos válidos por tener extensión GLB.

La clave `NutriDuo-modelos3D-temporal` quedó **revocada** el 15/10/2026 a las
06:54 UTC por el endpoint oficial de revocación. La autenticación posterior
devolvió HTTP 401 y la página de claves mostró `Invalidated`. Se eliminó su
archivo temporal local. No reutilizarla ni crear otra sin nueva autorización.
El siguiente trabajo es local en Blender, sin dependencia de una API de IA.

## Reproducir la vista de volumen

Blender oficial instalado en
`C:/Users/lucar/.codex/tools/blender/blender-4.5.9-windows-x64/blender.exe`.
Ejecutar con `--background --factory-startup --disable-autoexec
--python-exit-code 1 --python scripts/mascots/prepare_sculpt.py -- INPUT.glb
OUTPUT.glb SOURCE.blend`. Conservar el original y comprobar el código de salida.

`build.py` exporta únicamente Stitch; el código del viejo ensayo Angel no debe
reactivarse. Para el visor: `npm run dev -- --port 5175 --strictPort`, luego
`http://localhost:5175/mascots.html`.

Para reproducir el estudio manual, usar Blender con `--background
--factory-startup --disable-autoexec --python-exit-code 1 --python
scripts/mascots/author_angel_study.py -- OUTPUT_DIRECTORY`, eligiendo una carpeta
fuera del repositorio. Genera un `.blend` editable y vistas frontal, lateral y
posterior. No exporta ni reemplaza los activos públicos. Los huesos y los
ensayos de clips no prueban por sí solos que una animación sea aceptable.

Prueba específica: `npx playwright test --config scripts/mascots/playwright.config.ts`.
Las pruebas del visor no prueban parecido, calidad de movimientos ni rendimiento
real en Samsung/iPhone. No publicar los modelos como terminados antes de esa revisión.

Verificado antes del merge de 1.16: TypeScript, ESLint de los archivos nuevos, formato,
51 pruebas unitarias, build de producción y prueba Playwright específica del
visor (360/393/412/430/1280 px, claro/oscuro, pausa, movimiento reducido, ángulos
y ausencia de animaciones ficticias en la escultura). No se ejecutó la suite
e2e completa de la app: todavía no hubo integración ni publicación.

En la sesión posterior se ejecutó el nuevo estudio completo con Blender 4.5.9,
salida 0, y se inspeccionaron sus tres vistas. Se detectaron los problemas
indicados arriba; la revisión visual no está aprobada para publicar.
