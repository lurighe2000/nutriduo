# NutriDuo

Nutrición, entrenamiento y progreso para Luca y Ari. Aplicación mobile-first, instalable, local-first y sin API paga. Los perfiles son independientes y cada uno crea su PIN al ingresar por primera vez.

## Arranque

Requiere Node.js 22.12+ y npm.

```sh
npm ci
npm run dev
```

Abrí la URL que imprime Vite. En el primer ingreso completá peso, altura, nacimiento, actividad y días disponibles para fuerza. La distribución publicada no contiene fechas de nacimiento ni medidas personales predefinidas. Los datos que ingresás quedan en tu navegador.

| Comando                           | Función                                                 |
| --------------------------------- | ------------------------------------------------------- |
| `npm run dev`                     | Desarrollo y vista previa                               |
| `npm run build`                   | TypeScript strict + build estático + PWA                |
| `npm run preview`                 | Servir build final localmente                           |
| `npm run lint`                    | ESLint                                                  |
| `npm run typecheck`               | Chequeo de tipos                                        |
| `npm test`                        | Fórmulas, coach, validación, PIN, aislamiento y backups |
| `npx playwright install chromium` | Instalar navegador de pruebas                           |
| `npm run test:e2e`                | Recorridos sobre build final en puerto 4173             |

## Lo que incluye

- Dos perfiles, temas azul/dorado y rosa, modo oscuro, PIN con PBKDF2/SHA-256 (600.000 iteraciones), salt y bloqueo tras cinco fallos.
- Objetivos iniciales confirmados, dashboard, energía, macros, fibra, hidratación y cierre explícito de días completos.
- Comidas con componentes editables, foto comprimida, recientes, favoritos, repetir y duplicar ayer. Biblioteca personal sin valores inventados.
- Recetas e ingredientes con cálculo por porción y uso en comidas.
- Peso diario, promedios de 7 días, gráficos de 30/90 días e histórico, medidas personalizadas y comparación de fotos.
- Rutina inicial de tres sesiones editables, carga/repeticiones/RIR, historial, sugerencias de progresión y registro manual de pasos/pádel.
- Coach basado en reglas, check-in y ajustes pequeños que requieren confirmación; calendario, resumen e hitos de constancia.
- Barcode mediante cámara ZXing y entrada manual. Open Food Facts API v2, caché por perfil, timeout y corrección.
- Prompt de análisis para ChatGPT con JSON Schema completo, importación Zod, reparación sintáctica y revisión antes de guardar.
- XLSX con 13 hojas, CSV de comidas y JSON completo por perfil con fotos. Restauración validada, confirmada y transaccional.
- Manifest, iconos, shell offline y fuentes locales; sin analytics ni llamadas a IA.

## Arquitectura y datos

Ver [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_MODEL.md](DATA_MODEL.md) y [NUTRITION_ENGINE.md](NUTRITION_ENGINE.md). React + TypeScript + Vite; IndexedDB/Dexie, Zod, Lucide, ZXing y ExcelJS. CSS con tokens, SVG para gráficas y navegación de estados para cinco vistas. Las bibliotecas grandes de escáner y Excel se importan bajo demanda. No se necesita router de servidor.

El repositorio de datos está siempre acotado por `profileId`. Las escrituras y eliminaciones rechazan IDs pertenecientes al otro perfil. Los elementos de comidas, ingredientes y series se guardan como agregados para conservar instantáneas históricas. La base tiene esquema versionado; futuras migraciones deben ser aditivas y preservar registros.

## Privacidad y límites del PIN

El PIN evita acceso accidental; no cifra IndexedDB. Quien controle el navegador o dispositivo puede inspeccionar los datos. Los PIN nunca se exportan. La sesión sólo vive en memoria y se bloquea al recargar o tras cinco minutos en segundo plano. Las fotos se redimensionan a un máximo de 1440 px y generan miniaturas de 320 px. No se almacena ni se borra el original de la galería. No se suben fotos por defecto.

## Backups

Más → Tus datos van con vos → Backup completo JSON. Incluye el perfil desbloqueado, todas sus tablas y fotos. Para respaldar ambos perfiles, exportá uno desde cada perfil. El archivo es privado y no está cifrado. Restaurar exige abrir el mismo perfil, validar la estructura y confirmar reemplazo. Conserva el PIN actual y deja intacto el otro perfil. Los IDs ajenos, fechas imposibles y perfiles mezclados abortan toda la transacción. Límite de importación: 100 MB.

## PWA y offline

El service worker de Workbox precachea el shell, vistas, fuentes WOFF2 e iconos. Se activa en build de producción, no durante desarrollo. Tras la primera carga, comidas, fotos, entrenamiento y progreso funcionan offline. OFF necesita red para un producto no almacenado. Actualizaciones quedan esperando una recarga/cierre de sesiones para no interrumpir una carga de datos.

Android: menú Chrome → Instalar aplicación. iPhone: Safari → Compartir → Agregar a pantalla de inicio. HTTPS es necesario para cámara, Web Crypto, service worker e instalación; localhost es una excepción de desarrollo. Un enlace HTTP de la red local no equivale a HTTPS. El navegador puede desalojar almacenamiento local: la app solicita persistencia y los backups siguen siendo importantes.

Cada origen y dispositivo tiene su propia base: los datos de localhost no aparecen en la versión publicada ni en otro teléfono. No hay sincronización automática.

## Productos e IA

[Open Food Facts](https://world.openfoodfacts.org/) es colaborativo, bajo [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). API: `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`. Consultamos sólo campos necesarios; rechazamos fichas sin energía o macros principales. La fibra ausente se representa como 0 en el cálculo, no como un valor verificado; comparar siempre con la etiqueta. Azúcares, sal y sodio se exportan cuando están disponibles. No incluimos un catálogo nutricional ficticio.

Para IA: sacar/elegir foto → copiar prompt → analizar externamente → pegar JSON → validar → revisar gramos y componentes → confirmar. Los valores recibidos representan el total del componente, se convierten a base 100. Compartir foto usa Web Share cuando está disponible, o descarga la imagen. La app no reconoce comidas ni estima grasa corporal por sí sola.

La pestaña **Analizar comida** prepara el análisis integrado de foto + descripción, cantidades, cocción y marcas mediante Groq Free y un Worker de Cloudflare. Requiere activar el servicio personal según [worker/README.md](worker/README.md); hasta entonces muestra estado pendiente de conexión. Una consulta nunca guarda la comida. La IA puede pedir aclaraciones o proponer componentes; la persona los revisa y confirma. Cuota agotada, falta de red y errores conservan el formulario para carga manual.

Las fichas USDA seleccionadas aportan sodio, vitaminas y minerales disponibles, con unidades y procedencia por componente. Requieren una clave gratuita propia de FoodData Central en el servidor. Las etiquetas de OFF aportan sodio cuando existe. Los totales adicionales se muestran en el editor y Comidas, indicando cobertura parcial. No se inventan datos ausentes, y los registros guardados conservan una copia de esos valores para correcciones de gramos, recetas, backups y exportaciones. No hay objetivos ni diagnóstico por micronutrientes.

## Cloud opcional

`src/services/sync.ts` define `SyncAdapter` y `LocalSyncAdapter`. No hay un cliente Supabase configurado ni una falsa sincronización. Para implementarlo: autenticación por persona, `profile_id` asociado a `auth.uid()`, RLS en cada tabla, almacenamiento privado, consentimiento por foto, cola de cambios y resolución de conflictos. No colocar una service-role key en Vite. Se pospone hasta verificar el uso real de la base local.

## Publicación

La publicación principal es GitHub Pages desde [lurighe2000/nutriduo](https://github.com/lurighe2000/nutriduo). El workflow `.github/workflows/pages.yml` valida tipos, lint, lógica y recorridos antes de publicar. Cada push a `main` actualiza la URL. GitHub Pages usa `VITE_BASE_PATH=/nutriduo/`; Vite, manifest, iconos y service worker respetan esa subruta. En Settings → Pages, la fuente debe ser GitHub Actions.

El build sigue siendo portable: Cloudflare Pages, Vercel o Netlify pueden publicar `dist` con `npm run build` y `VITE_BASE_PATH=/`. El archivo `.openai/hosting.json` conserva una identidad previa de Sites, pero GitHub Pages es el proveedor activo elegido. Un repositorio público contiene el código de la app, no la base local ni tus fotos. El enlace de la app debe abrirse por HTTPS.

La apariencia tiene botones **Claro / Oscuro** en el encabezado y se recuerda por perfil. Ambos temas cubren formularios, diálogos, progreso y entrenamiento.

El botón **Volver** y Atrás del navegador recorren las secciones, pestañas y fechas anteriores. Los formularios y confirmaciones tienen sus propios pasos y se cierran antes de retroceder de sección. Desde Inicio se vuelve a elegir perfil. El historial sólo guarda identificadores de navegación: no almacena PINs, fotos ni credenciales de sesión, y Adelante no permite reabrir un perfil bloqueado.

## Verificación y alcance

Tests de navegador en Chromium de escritorio y viewport móvil: onboarding/PIN, comida, edición, peso, separación de perfiles, producto con respuesta controlada, IA, receta, entrenamiento, backup, XLSX y recarga offline. Los tests usan una base aislada de navegador, no los datos del usuario.

Falta validación física en Galaxy S23 Ultra e iPhone, incluida cámara, instalación y compatibilidad HEIC según navegador. No se afirma que un mock de OFF verifique disponibilidad de su servicio. No hay OCR, sincronización cloud ni notificaciones push. Los recordatorios son internos. Las sugerencias de comidas son ideas cualitativas filtradas por exclusiones, sin inventar gramos/macros ni conocer la despensa. El coach no calcula gasto metabólico real ni composición corporal.

La interfaz soporta español argentino y unidades métricas. Fotos comparadas sin retoques ni zoom sincronizado. El backup por perfil es una decisión deliberada para no exponer el perfil bloqueado. CSV exporta comidas; XLSX y JSON cubren todas las entidades. Con bibliotecas de larga duración e historiales fotográficos extensos, se recomienda auditar cuotas y rendimiento antes de importar cientos de fotos.
