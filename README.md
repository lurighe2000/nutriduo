# NutriDuo

Nutrición, entrenamiento y progreso para Luca y Ari. Aplicación mobile-first, instalable, local-first y sin API paga. Los perfiles son independientes y cada uno crea su PIN al ingresar por primera vez. Cuenta y respaldo agrega recuperación después de reinstalar, con usuario/contraseña y copias cifradas en Cloudflare.

## Arranque

Requiere Node.js 22.13+ y npm.

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

- Cuenta independiente `luca` / `ari`, respaldo automático cifrado de todo el historial y fotos, recuperación en una instalación limpia y archivo de recuperación por si se olvida la contraseña. La activación inicial requiere el código privado del análisis; iniciar sesión después no lo necesita. Sin cuenta activada, los datos siguen siendo únicamente locales.

- Dos perfiles, temas azul/dorado y rosa, modo oscuro, PIN con PBKDF2/SHA-256 (600.000 iteraciones), salt y bloqueo tras cinco fallos.
- Menú de cuenta desde la inicial o foto: edición de nombre y foto local, acceso a configuración y recordatorios, y cambio explícito de perfil. La foto se conserva en el backup JSON. Encabezado con accesos al Inicio y a la vista principal de cada sección; transiciones breves que respetan la preferencia de movimiento reducido.
- Objetivos iniciales confirmados, dashboard, energía, macros, fibra, hidratación y cierre explícito de días completos.
- Comidas con componentes editables y varias fotos comprimidas del plato, productos, etiquetas y preparación. Se agregan de a una o en selección múltiple, se pueden ampliar y quitar individualmente y se conservan en edición, repetición y backups. Recientes, favoritos, repetir y duplicar ayer. Biblioteca personal sin valores inventados.
- Recetas e ingredientes con cálculo por porción y uso en comidas.
- Peso diario, promedios de 7 días, gráficos de 30/90 días e histórico, medidas personalizadas y comparación de fotos.
- Rutina inicial de tres sesiones editables, carga/repeticiones/RIR, historial, sugerencias de progresión y registro manual de pasos/pádel.
- Coach basado en reglas, check-in y ajustes pequeños que requieren confirmación; calendario, resumen e hitos de constancia.
- Barcode mediante cámara ZXing y entrada manual. Open Food Facts API v2, caché por perfil, timeout y corrección.
- Prompt de análisis para ChatGPT con JSON Schema completo, importación Zod, reparación sintáctica y revisión antes de guardar.
- XLSX con tablas de alimentos, balanza y salidas, CSV de comidas y JSON completo por perfil con fotos. Restauración validada, confirmada y transaccional.
- Menú semanal de 28 comidas, ingredientes y preparación, porciones ajustadas localmente a los objetivos, reemplazo de platos y compras por perfil. Las fichas USDA genéricas son orientativas; marcas, fibra y micronutrientes requieren revisión. El menú no cuenta como consumo hasta confirmar una comida.
- Rutina opcional de dos días en casa y propuesta progresiva de salidas diarias. Registro manual de caminata/trote con distancia, duración y métricas disponibles, sin aumentar calorías objetivo automáticamente.
- Datos de Femmto con unidades separadas y lectura local de PDF mediante PDF.js. Se revisan perfil, fecha de medición y valores antes de guardar. No se conserva ni transmite el PDF; la devolución compara estimaciones de informes separados por siete días, sin diagnosticar ni ajustar calorías automáticamente.
- Configuraciones de objetivos importables para el perfil activo, con revisión antes de confirmar. Las configuraciones personales se distribuyen en archivos privados, nunca como datos predeterminados del repositorio.
- Notificaciones Web Push opcionales por dispositivo: comidas, movimiento, fuerza, pesaje e informe del domingo. Requieren permiso desde un botón y, en iPhone, una app agregada a Inicio. Cloudflare KV guarda únicamente suscripciones y preferencias, sin registros de salud. Ver la configuración en [worker/README.md](worker/README.md).
- Manifest, iconos, shell offline y fuentes locales; sin analytics. El análisis de IA sólo se solicita desde su formulario.

## Arquitectura y datos

Ver [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_MODEL.md](DATA_MODEL.md) y [NUTRITION_ENGINE.md](NUTRITION_ENGINE.md). React + TypeScript + Vite; IndexedDB/Dexie, Zod, Lucide, ZXing y ExcelJS. CSS con tokens, SVG para gráficas y navegación de estados para cinco vistas. Las bibliotecas grandes de escáner y Excel se importan bajo demanda. No se necesita router de servidor.

El repositorio de datos está siempre acotado por `profileId`. Las escrituras y eliminaciones rechazan IDs pertenecientes al otro perfil. Los elementos de comidas, ingredientes y series se guardan como agregados para conservar instantáneas históricas. La base tiene esquema versionado; futuras migraciones deben ser aditivas y preservar registros.

## Privacidad y límites del PIN

El PIN evita acceso accidental; no cifra IndexedDB. Quien controle el navegador o dispositivo puede inspeccionar los datos. Los PIN nunca se exportan. La sesión sólo vive en memoria y se bloquea al recargar o tras cinco minutos en segundo plano. Las fotos se redimensionan a un máximo de 1440 px y generan miniaturas de 320 px. No se almacena ni se borra el original de la galería. No se suben fotos por defecto.

## Backups

Más → Tus datos van con vos → Backup completo JSON. Incluye el perfil desbloqueado, todas sus tablas y fotos. Para respaldar ambos perfiles, exportá uno desde cada perfil. El archivo es privado y no está cifrado. Restaurar exige abrir el mismo perfil, validar la estructura y confirmar reemplazo. Conserva el PIN actual y deja intacto el otro perfil. Los IDs ajenos, fechas imposibles y perfiles mezclados abortan toda la transacción. Límite de importación: 100 MB.

## PWA y offline

El service worker de Workbox precachea el shell, vistas, fuentes WOFF2 e iconos. Se activa en build de producción, no durante desarrollo. Tras la primera carga, comidas, fotos, entrenamiento y progreso funcionan offline. OFF necesita red para un producto no almacenado. Una actualización disponible muestra **Actualizar ahora / Después**. La persona guarda sus borradores antes de aceptar la recarga; IndexedDB y el PIN se conservan. Se comprueban novedades al abrir la app, al volver a ella con conexión y cada hora mientras está visible. Las versiones anteriores sin aviso pueden requerir cerrar todas las ventanas/pestañas de NutriDuo y volver a abrir para activar la actualización pendiente, sin borrar los datos del sitio.

El logo Conexión azul/rosa se usa dentro de la app, en el manifiesto y en el ícono de inicio de iOS. Las notificaciones usan un PNG independiente de 96 px con silueta blanca y fondo transparente, nunca el recuadro del ícono completo. Fuentes y exportación reproducible: [assets/brand](assets/brand/README.md). La versión 1.7 permite identificar esta actualización en el pie de la app.

## Respaldo en la nube (1.8)

Desde Más → Cuenta y respaldo, cada usuario crea una contraseña de al menos 12 caracteres. La app deriva dos claves independientes con PBKDF2-SHA256 (600.000 iteraciones): una autentica los pedidos y la otra cifra en el cliente con AES-256-GCM, IV aleatorio y contexto ligado al perfil. La contraseña y la clave de cifrado no llegan al servidor. El archivo de recuperación contiene las claves de acceso y debe conservarse en privado. Las credenciales locales no están cifradas por el PIN; siguen sujetas a la seguridad del dispositivo, como el resto de IndexedDB.

El servidor guarda ciphertext en un Durable Object SQLite por perfil, incluido en Workers Free. Guarda la copia actual y la anterior. Los bloques son de 64 KiB y los cambios de cabecera se confirman atómicamente, sólo después de recibir todos los bloques; la versión esperada impide que un dispositivo atrasado pise una copia más reciente. Se comprueban checksum, autenticación AES y schemas antes de restaurar. La restauración local es una transacción de todas las tablas del perfil, conserva al otro usuario y descarga un backup previo cuando reemplaza un perfil configurado. No mezcla cambios de varios dispositivos automáticamente: ante conflicto muestra recuperación explícita.

Se observan commits de IndexedDB (altas, cambios, bajas y restauraciones), se agrupan cambios cercanos y se reintenta con conexión o al volver a abrir. Un cambio durante una subida queda pendiente para el siguiente pase. El estado diferencia guardado local, pendiente, offline, error y copia al día; sólo la última permite recuperar el último registro al reinstalar. No es posible subir cambios que el sistema elimine antes de que tengan conexión o que se hayan borrado antes de activar la cuenta. No se cobra ni se habilita un plan pago: el límite actual de una copia es 100 MB sin comprimir; si se supera, se muestra error y se conservan los registros locales. La app debe estar abierta para completar el respaldo.

Al reinstalar: pantalla inicial → Ya tengo cuenta · Recuperar mis registros → usuario y contraseña (o archivo de recuperación) → revisar copia → Recuperar mis registros. No hace falta completar el perfil otra vez. Se recuperan datos y PIN; los permisos y la suscripción de notificaciones deben habilitarse de nuevo en el dispositivo.

`worker/wrangler.jsonc` declara `BACKUP_VAULTS` y la migración SQLite `backup-v1`. Publicar con `npx wrangler deploy --config worker/wrangler.jsonc --minify`. No se usan los namespaces KV de recordatorios para datos de salud. Las pruebas E2E ejecutan una base SQLite real local mediante `worker/wrangler.test.jsonc`, con un almacenamiento nuevo por ejecución y credenciales ficticias. Nunca usan las cuentas de producción.

El menú del hogar se guarda en otro objeto de la misma clase, accesible sólo tras autenticar la cuenta de quien consulta. Se comparten exclusivamente nombres, objetivos nutricionales, exclusiones, recetas y porciones; los historiales personales permanecen en sus copias cifradas. Ambas cuentas deben estar activadas. Preparar menú para ambos fija los mismos 28 platos y ajusta sus ingredientes a cada objetivo, con las exclusiones combinadas. Una sustitución modifica el plato para ambos y recalcula una sola lista de compras de siete días, sumando las dos porciones. La descarga TXT es idéntica en los dos perfiles. La vista consulta la nube al abrir, al volver con conexión y cada 30 segundos mientras está visible; sin conexión muestra la última copia. La coordinación de versiones evita que una publicación de preferencias de un dispositivo viejo reemplace otra más nueva. No se promete cubrir todos los nutrientes: se conservan los avisos sobre aproximación, fibra y datos faltantes del generador.

Android: menú Chrome → Instalar aplicación. iPhone: Safari → Compartir → Agregar a pantalla de inicio. HTTPS es necesario para cámara, Web Crypto, service worker e instalación; localhost es una excepción de desarrollo. Un enlace HTTP de la red local no equivale a HTTPS. El navegador puede desalojar almacenamiento local: la app solicita persistencia y los backups siguen siendo importantes.

Cada origen y dispositivo tiene su propia base: los datos de localhost no aparecen en la versión publicada sin recuperar una copia. Con Cuenta y respaldo se suben automáticamente los cambios y se puede recuperar el historial; el menú y las compras se coordinan entre las dos cuentas. No hay mezcla automática de historiales editados simultáneamente en distintos dispositivos.

## Productos e IA

[Open Food Facts](https://world.openfoodfacts.org/) es colaborativo, bajo [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). API: `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`. Consultamos sólo campos necesarios; rechazamos fichas sin energía o macros principales. La fibra ausente se representa como 0 en el cálculo, no como un valor verificado; comparar siempre con la etiqueta. Azúcares, sal y sodio se exportan cuando están disponibles. No incluimos un catálogo nutricional ficticio.

Para IA: sacar/elegir foto → copiar prompt → analizar externamente → pegar JSON → validar → revisar gramos y componentes → confirmar. Los valores recibidos representan el total del componente, se convierten a base 100. Compartir foto usa Web Share cuando está disponible, o descarga la imagen. La app no reconoce comidas ni estima grasa corporal por sí sola.

La pestaña **Analizar comida** permite analizar foto + descripción, cantidades, cocción y marcas mediante Groq Free y un Worker de Cloudflare. Requiere conectar el servicio personal según [worker/README.md](worker/README.md). El build de GitHub Pages incluye su dirección pública; sólo se ingresa el código privado de conexión. Una consulta nunca guarda la comida. La IA puede pedir aclaraciones o proponer componentes; la persona los revisa y confirma. Cuota agotada, falta de red y errores conservan el formulario para carga manual.

Las fichas USDA seleccionadas aportan sodio, vitaminas y minerales disponibles, con unidades y procedencia por componente. El servicio incluye 2162 fichas oficiales de Foundation Foods (abril 2026) y FNDDS (octubre 2024), sin otra cuenta ni cuota de API. Una clave USDA propia es opcional para ampliar las búsquedas. Las etiquetas de OFF aportan sodio cuando existe. Los totales adicionales se muestran en el editor y Comidas, indicando cobertura parcial. No se inventan datos ausentes, y los registros guardados conservan una copia de esos valores para correcciones de gramos, recetas, backups y exportaciones. No hay objetivos ni diagnóstico por micronutrientes.

## Adaptador local

`src/services/sync.ts` conserva `SyncAdapter` y `LocalSyncAdapter` para el modo local. El respaldo actual usa el protocolo cifrado de `cloudBackup.ts` y el almacenamiento privado del Worker; no depende de Supabase ni incluye claves de administración en Vite.

## Publicación

La publicación principal es GitHub Pages desde [lurighe2000/nutriduo](https://github.com/lurighe2000/nutriduo). El workflow `.github/workflows/pages.yml` valida tipos, lint, lógica y recorridos antes de publicar. Cada push a `main` actualiza la URL. GitHub Pages usa `VITE_BASE_PATH=/nutriduo/`; Vite, manifest, iconos y service worker respetan esa subruta. En Settings → Pages, la fuente debe ser GitHub Actions.

El build sigue siendo portable: Cloudflare Pages, Vercel o Netlify pueden publicar `dist` con `npm run build` y `VITE_BASE_PATH=/`. El archivo `.openai/hosting.json` conserva una identidad previa de Sites, pero GitHub Pages es el proveedor activo elegido. Un repositorio público contiene el código de la app, no la base local ni tus fotos. El enlace de la app debe abrirse por HTTPS.

La apariencia tiene botones **Claro / Oscuro** en el encabezado y se recuerda por perfil. Ambos temas cubren formularios, diálogos, progreso y entrenamiento.

El botón **Volver** y Atrás del navegador recorren las secciones, pestañas y fechas anteriores. Los formularios y confirmaciones tienen sus propios pasos y se cierran antes de retroceder de sección. Desde Inicio se vuelve a elegir perfil. El historial sólo guarda identificadores de navegación: no almacena PINs, fotos ni credenciales de sesión, y Adelante no permite reabrir un perfil bloqueado.

## Verificación y alcance

Tests de navegador en Chromium de escritorio y viewport móvil: onboarding/PIN, comida, edición, peso, separación de perfiles, producto con respuesta controlada, IA, receta, entrenamiento, backup, XLSX y recarga offline. Los tests usan una base aislada de navegador, no los datos del usuario.

Falta validación física de esta actualización en Galaxy S23 Ultra e iPhone. Las pruebas no sustituyen la comprobación de instalación, cámara, notificaciones y descarga de archivos en cada teléfono. No se afirma que un mock de OFF verifique disponibilidad de su servicio. La disponibilidad de los servicios gratuitos y sus cuotas puede impedir temporalmente un análisis, respaldo o aviso; la interfaz conserva los datos locales y muestra los errores. El menú usa cantidades orientativas del catálogo USDA y no conoce la despensa. El coach no calcula gasto metabólico real ni composición corporal.

La interfaz soporta español argentino y unidades métricas. Fotos comparadas sin retoques ni zoom sincronizado. El backup por perfil es una decisión deliberada para no exponer el perfil bloqueado. CSV exporta comidas; XLSX y JSON cubren todas las entidades. Con bibliotecas de larga duración e historiales fotográficos extensos, se recomienda auditar cuotas y rendimiento antes de importar cientos de fotos.
