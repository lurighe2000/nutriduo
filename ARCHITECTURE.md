# NutriDuo

Aplicación estática React + TypeScript strict + Vite. IndexedDB mediante Dexie es la fuente de verdad. No necesita backend, cuenta, analytics ni API de IA. Se elige CSS con tokens en lugar de Tailwind para evitar otra capa en el diseño personalizado; ExcelJS para exportación XLSX; SVG para gráficos pequeños; ZXing para cámara.

## Límites

- `src/db`: esquema versionado, repositorios acotados por profileId y transacciones.
- `src/nutrition`: fórmulas puras, cálculos por porción y coach explicable.
- `src/schemas`: Zod para registros, IA y backup.
- `src/services`: PIN, imágenes, Open Food Facts, exportación, sync local.
- `src/features`: flujos de producto; `src/components`: controles compartidos.
- `src/app`: selección de perfil, sesión sólo en memoria y navegación.

El PIN es una barrera contra acceso accidental, no cifrado de IndexedDB. PBKDF2-SHA256, salt aleatorio y bloqueo temporal persistente. Cambio de perfil borra la sesión y desmonta la UI. Fotos comprimidas sólo locales. Un backup contiene información privada; exporta sólo el perfil desbloqueado y restaurar requiere confirmación. La sincronización cloud queda deshabilitada: la interfaz permite un adaptador posterior, sin secretos ni conexiones implícitas.

## Roadmap

1. Base, perfiles, PIN y almacenamiento.
2. Motor nutricional, tablero diario y comidas.
3. Recetas, edición, recientes e historial.
4. Peso, medidas y fotos.
5. Rutinas, series y progresión.
6. Coach con confirmación y check-ins.
7. Productos y escáner.
8. Análisis IA externo con revisión.
9. Exportación y restauración transaccional.
10. PWA y shell offline.
11. Pruebas de dominio, aislamiento y flujos completos.
12. Extensión cloud opcional, fuera del flujo local.

No se cargan comidas, pesos ni entrenamientos ficticios en producción. Los valores iniciales de peso son sugerencias para confirmar en onboarding.
