# Compañeros 2D de NutriDuo

Luca pidió retirar las mascotas 3D y confirmó usar dibujos vectoriales animados.
Inicio y `mascots.html` usan ahora `BulldogCharacter.tsx`: un dibujo original
del bulldog francés de las fotos de Luca, con partes articuladas.

- Negro atigrado, pecho blanco, orejas grandes y hocico corto. Collar con el
  acento de cada perfil. Inicio reserva 94 × 110px al lado del mensaje.
- Respiración, parpadeo, orejas, cola, patita, mirada y pequeños festejos.
  La expresión es neutral, contenta o triste suave según los registros.
- `bulldog.css` anima transformaciones y opacidad; no hay WebGL, Three.js,
  modelos descargados ni un bucle de React por fotograma.
- `useCartoonMotion.ts` coordina las acciones completas y su cola, congela los
  tiempos al pausar u ocultar y respeta movimiento reducido. La pausa del perfil
  sigue siendo compatible con registros y respaldos existentes.
- Las reacciones a objetivos se mantienen en `mascotState.ts`. No cargar datos
  no se interpreta como fracaso; descansar no se penaliza.
- Los dibujos forman parte del JavaScript de la app: funcionan sin red después
  de guardar la app para uso sin conexión y no necesitan descargas adicionales.

Los scripts de Blender de esta carpeta quedan como archivo del trabajo anterior;
no forman parte de la app ni deben volver a publicar modelos 3D. Las fuentes
editables antiguas permanecen fuera del sitio, en la PC de Luca. Se retiraron los
GLB públicos y las dependencias 3D.

Las pruebas cubren ambos perfiles, claro/oscuro, anchos móviles, pausa persistente,
gestos en cola, movimiento reducido y reapertura sin conexión. La prueba del visor
se ejecuta con `npx playwright test --config scripts/mascots/playwright.config.ts`.
