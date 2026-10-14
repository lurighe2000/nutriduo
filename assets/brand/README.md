# Identidad NutriDuo

Identidad elegida: Conexión, dos figuras entrelazadas en cristal azul y rosa.
`logo-source.png` es la adaptación cuadrada para producción, generada con la
herramienta integrada de imágenes de Codex (sin API externa). El fondo ocupa
todo el lienzo; el sistema operativo aplica su máscara al instalar la app.

`notification-mark.svg` es la simplificación vectorial del símbolo para tamaños
pequeños. No contiene fondo. El PNG de 96 px conserva el canal alfa; Android
usa su silueta y decide el color de presentación.

Para regenerar únicamente los tamaños y formatos: `node scripts/build-brand-icons.mjs`.
Los PNG están incluidos en Git, no se genera arte nuevo durante el build.
Se conservan las rutas icon-192.png e icon-512.png con el logo nuevo para
compatibilidad. El manifiesto usa nombres nuevos para facilitar la actualización
de los íconos de instalaciones existentes.

## Prompt de la adaptación final

Use case: precise-object-edit. Production app-icon adaptation of the ATTACHED APPROVED NutriDuo logo. Preserve exactly the identity, interlocking two curved people, two round heads, blue left figure and pink right figure, crystalline glossy 3D material, vivid colors and lighting. Do not redesign the symbol. Change only the presentation from a staged mockup into a flat front-facing square app-icon asset suitable for iOS and Android. Remove the external floor, drop shadow and surrounding empty studio margin. The dark navy/plum tile background must fill the ENTIRE square image right up to all four straight edges and corners, fully opaque, with no rounded clipping in the image itself (the phone applies corner masks). Keep tasteful blue glow on left and rose glow on right within the background; no literal device or extruded outer case, no separate frame. Center the same approved emblem in the square, scale entire emblem so its outermost parts fit within the CENTRAL 68% of width and central 68% of height, all heads and tips inside that safe area. This purposeful padding makes it safe for circular Android icon masks. Perfect straight-on view, balanced composition, sharp beautiful realistic crystal reflections as in reference. Only this square app-icon art, no text, no other objects, no watermark, no grid, no alternatives.
