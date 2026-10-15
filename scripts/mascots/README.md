# Mascotas: estado de trabajo

Este trabajo vive en `codex/mascotas-3d`, separado de los cambios de Claude.
La app publicada no integra todavía estos modelos. `mascots.html` es una
entrada de desarrollo; no está incluida como página en el build de producción.
La rama parte de 1.13; la principal ya avanzó a 1.15 (`f48d92e`). Incorporar esos
cambios antes de cualquier futura integración; no desplegar esta rama encima.

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

Origen, hash y límites de cada archivo público: `public/mascots/credits.json`.

## Reconstrucción con textura: bloqueo concreto

La generación completa en Hunyuan3D-2.1 pidió más duración GPU de la permitida
al acceso anónimo. La demo oficial Hunyuan3D-2 falló con `NameError`. TRELLIS.2
oficial permite subir imágenes, pero rechazó la tarea por cupo ZeroGPU y pidió
esperar unas 23 horas o autenticar una cuenta gratuita. No se compró un plan,
no se eludieron cuotas y no se generó un modelo texturado válido.

Quedó abierto en Chrome el acceso de Hugging Face para que Luca inicie sesión.
Continuar desde la interfaz oficial después de su aviso; no extraer cookies ni
pedir claves en el chat. Una generación válida todavía necesita inspección,
retopología/articulaciones y revisión visual; no equivale a personaje terminado.

## Reproducir la vista de volumen

Blender oficial instalado en
`C:/Users/lucar/.codex/tools/blender/blender-4.5.9-windows-x64/blender.exe`.
Ejecutar con `--background --factory-startup --disable-autoexec
--python-exit-code 1 --python scripts/mascots/prepare_sculpt.py -- INPUT.glb
OUTPUT.glb SOURCE.blend`. Conservar el original y comprobar el código de salida.

`build.py` exporta únicamente Stitch; el código del viejo ensayo Angel no debe
reactivarse. Para el visor: `npm run dev -- --port 5175 --strictPort`, luego
`http://localhost:5175/mascots.html`.

Prueba específica: `npx playwright test --config scripts/mascots/playwright.config.ts`.
Las pruebas del visor no prueban parecido, calidad de movimientos ni rendimiento
real en Samsung/iPhone. No publicar los modelos como terminados antes de esa revisión.

Verificado en este punto: TypeScript, ESLint de los archivos nuevos, formato,
51 pruebas unitarias, build de producción y prueba Playwright específica del
visor (360/393/412/430/1280 px, claro/oscuro, pausa, movimiento reducido, ángulos
y ausencia de animaciones ficticias en la escultura). No se ejecutó la suite
e2e completa de la app: todavía no hubo integración ni publicación.
