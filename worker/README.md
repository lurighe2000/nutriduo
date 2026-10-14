# Servicio gratuito de NutriDuo

La web sigue en GitHub Pages. Este Worker sólo recibe la foto y descripción que la persona decide analizar. No recibe PIN, perfil, peso, objetivos ni historial. No almacena fotos, prompts ni respuestas y tiene logs desactivados. Groq procesa el análisis; USDA recibe únicamente el término de búsqueda de un alimento.

## Activación

1. Cuenta **Groq Free**, sin añadir método de pago ni cambiar a Developer. Crear una API key llamada `NutriDuo`. Activar Zero Data Retention en los controles de datos de Groq si se quiere evitar la retención excepcional por errores/abuso.
2. Cuenta **Cloudflare Workers Free**. El servicio no usa Workers AI ni servicios pagos. Publicar con `npx wrangler deploy --config worker/wrangler.jsonc`. La cuenta configurada es la indicada por el usuario; el proyecto usa un único Worker `nutriduo-ai`. Si se usa OAuth de Wrangler, el usuario debe aprobar el acceso en su navegador.
3. Guardar `GROQ_API_KEY` como **Secret** en Cloudflare, nunca en Vite, GitHub, el navegador de NutriDuo ni el chat. Puede usarse el panel de Cloudflare o `npx wrangler secret put GROQ_API_KEY --config worker/wrangler.jsonc`, que pide el valor por stdin.
4. Generar un código aleatorio de al menos 32 caracteres y guardarlo como Secret `NUTRIDUO_ACCESS_TOKEN`. Este código sólo autoriza consultas al servicio personal; no es la clave de Groq ni el PIN de un perfil. Compartirlo únicamente con Luca y Ari.
5. Opcional para fichas y micronutrientes genéricos: obtener una clave gratuita propia de [FoodData Central](https://fdc.nal.usda.gov/api-key-signup/) y guardarla como Secret `USDA_API_KEY`. No se utiliza DEMO_KEY en producción. Sin esta clave, la IA funciona para estimaciones de macros y las etiquetas de Open Food Facts pueden aportar sodio, pero la búsqueda USDA queda desactivada.
6. NutriDuo → Más → Análisis de comidas → ingresar URL HTTPS del Worker y código de conexión. La URL se recuerda; el código queda en memoria, salvo que la persona elija **Recordar conexión en este dispositivo**. No se exportan credenciales en backups.

Los comandos de configuración solicitan secretos interactivamente. No ponerlos como argumentos, valores VITE_, archivos versionados ni mensajes. Las pruebas usan credenciales ficticias; no necesitan una cuenta.

## Límites y funcionamiento

- Modelo fijo `qwen/qwen3.8-27b`, salida JSON y hasta 2048 tokens de respuesta. El cliente no puede elegir modelos o instrucciones del sistema.
- 3 solicitudes por minuto y ruta en cada ubicación de Cloudflare. Este límite local protege de ráfagas; no es una cuota global. También se aplican las cuotas de Groq de la organización y el límite del plan Workers Free.
- No hay reintentos automáticos, proveedores alternativos pagos, ni cambios de plan. Un HTTP 429 mantiene el formulario para volver a intentar o cargar manualmente. El costo depende de conservar ambas cuentas en sus planes gratuitos; la app no puede comprobar ni modificar el plan de facturación de terceros.
- Solicitudes autorizadas con código y origen permitido. CORS no sustituye la autenticación. Rutas `/health`, `/analyze` y `/nutrition/search`; cuerpos limitados y validados, sin URLs de fotos remotas.
- JSON mal formado, macros imposibles para el esquema o respuestas truncadas se rechazan. Nada se guarda automáticamente. Las incertidumbres se presentan como preguntas antes de confirmar.
- La IA sólo estima macros. No inventa vitaminas ni minerales. La persona elige una ficha USDA que coincida con alimento y cocción; esa ficha reemplaza valores por 100 g y agrega micronutrientes presentes. Una referencia de base no verifica la identidad ni el peso del plato fotografiado.
- Micronutrientes ausentes quedan ausentes; 0 se conserva sólo si aparece en la fuente. Los totales parciales indican cuántos componentes aportan datos. Fibra ausente conserva una marca de falta de dato aunque el motor legado la excluye del total numérico.

## Verificación

`npm test`, `npm run lint`, `npm run build`, `npm run test:e2e` y `npx wrangler deploy --config worker/wrangler.jsonc --dry-run`. Los tests de servidor y navegador simulan respuestas del proveedor y verifican autorización, límites, aclaraciones, selección de fichas y revisión. La disponibilidad y precisión del modelo necesitan una prueba real después de activar las credenciales.
