# Continuidad · NutriDuo 1.21

Actualizado el 15/10/2026. Luca pidió publicar lo terminado y dejar esta guía para continuar con Claude sin repetir trabajo.

## Estado

La versión 1.20 de Claude (ficha de productos, etiquetas desde foto y código de barras, commit `cb7c555`) está integrada y preservada. La 1.21 agrega cantidades de comida y reemplaza las mascotas grandes por un bulldog francés compacto. El footer muestra `NutriDuo · 1.21`.

La publicación está autorizada. El push a `main` dispara `.github/workflows/pages.yml`: lint, unitarias, build, Playwright completo, build con base `/nutriduo/` y despliegue. **Un push exitoso no confirma el despliegue**: verificar el último run y la URL pública antes de anunciar publicación completa.

- App: https://lurighe2000.github.io/nutriduo/
- Visor de mascota: https://lurighe2000.github.io/nutriduo/mascots.html
- Runs: https://github.com/lurighe2000/nutriduo/actions

## Cantidades

- `src/features/meals/MealQuantity.tsx`: selector centrado existente `ChoicePicker` con gramos, mililitros y unidades. Campos de equivalencia aparecen sólo cuando hacen falta.
- `src/services/mealQuantity.ts`: schema y conversiones. `Item.measurement` y `Food.measurement` son **opcionales**, para conservar backups y registros anteriores.
- `grams` sigue siendo la cantidad canónica, pero expresada en la **base de la ficha**: `measurement.basis` indica `g` o `ml`. Las fórmulas siguen siendo `per100 × grams / 100` para macros y micronutrientes.
- `mode` indica cómo carga la persona (`g`, `ml`, `units`). Para unidades, `unitSize` es cuánto pesa o contiene **una sola unidad**, en la base de la ficha. El número de unidades se deriva de la cantidad canónica; al dividir una receta también se divide correctamente.
- Para convertir g ↔ ml hace falta `gramsPerMl`. No se supone que 1 ml pesa 1 g. No se adivina el peso de huevos o galletitas.
- Una carga manual todavía sin nutrientes puede elegir directamente g o ml como base. Dentro de los valores por 100 también se declara la medida de la ficha.
- La equivalencia se conserva en la comida, receta y alimento nuevo guardado en la biblioteca. Repetir y editar mantienen los datos. La biblioteca tiene su editor de equivalencia; editar una comida no reescribe las etiquetas nutricionales de productos previos.
- `foodMeasurement` descarta preferencias incompatibles si cambia la base de un producto. `NutritionLookup.tsx` exige la equivalencia necesaria antes de aplicar una ficha USDA por 100 g a un alimento por ml.
- `Meals.tsx` muestra unidades y equivalentes; el botón ahora dice **Editar cantidades**. El CSV/Excel distingue gramos y mililitros y agrega la descripción de cantidad.
- No se modificó el contrato de productos compartidos ni se necesita desplegar el Worker por estos cambios. Las equivalencias personales viajan en el respaldo cifrado del perfil; no se agregaron al contrato público de la alacena.

## Mascota elegida por Luca

Descartó Stitch/Angel y las primeras propuestas demasiado simples. Eligió un **bulldog francés negro atigrado con pechito blanco**, basado en las dos fotos que pasó en este chat. Las fotos originales permanecen privadas en `.codex-remote-attachments/`; no se publican.

- `BulldogCharacter.tsx` + `bulldog.css`: SVG propio, orejas grandes, hocico corto, ojos marrones, atigrado oscuro, pecho blanco y collar con el acento del perfil. Misma apariencia natural para Luca y Ari.
- `Companion.tsx` + `companion.css`: ocupa **94 × 110 px**, al costado del mensaje. Ya no hay un escenario de 210 px ocupando toda la tarjeta.
- Gestos: respirar, parpadear, inclinar cabeza, mover orejas, dar patita, cola y festejos pequeños. Animaciones sólo de transform/opacity.
- `useCartoonMotion.ts`: gestos completos en cola, pausa persistente del perfil, pausa con página oculta/fuera de pantalla y movimiento reducido. Mantener la corrección del temporizador que no descuenta la duración del gesto anterior al siguiente.
- `mascotState.ts`: neutral al comenzar; contento con avances; festeja entrenamiento o metas del día cerrado; triste suave al cerrar con objetivos incompletos. Después de las **21:00**, menos de dos comidas registradas muestra tristeza suave y un recordatorio de **cargas pendientes**, sin afirmar que la persona no comió. Fechas históricas quedan neutrales y el descanso no se penaliza.
- Dashboard actualiza el reloj por minuto y al volver a la app. No hay polling por fotograma ni llamadas IA para mover la mascota.
- El visor `mascots.html` permite revisar estados de ánimo, gestos, perfiles, claro/oscuro y pausa. Los antiguos archivos `CartoonCharacter.tsx`/`cartoon.css` siguen en el historial/fuente, pero no son importados por Inicio ni por el visor actual; no volver a conectarlos.
- Dirección y funcionamiento documentados en `DESIGN.md`, `scripts/mascots/README.md` y `public/mascots/credits.json`. No reintroducir 3D ni servicios pagos.

## Verificación realizada antes del push

- TypeScript/build, ESLint, Prettier de archivos cambiados y `git diff --check`: aprobados.
- **86 pruebas unitarias** aprobadas con la versión de productos 1.20 integrada.
- **4 Playwright de flujos móviles** aprobados: ambos perfiles, cantidades persistentes, g/ml/unidades y pausa/reapertura offline de la mascota. Anchos 360/393/412/430, claro/oscuro.
- **3 Playwright de integración** aprobados: producto/corrección/IA/receta, código inexistente y guardado en alacena, y alimento con ficha por 100 ml guardado/reutilizado.
- **2 pruebas del visor** aprobadas: gestos en cola y pausa sin truncarlos, estados de ánimo, temas, perfiles y movimiento reducido.
- Revisión visual fresca independiente: `disposition: ship`, sin correcciones materiales. Se inspeccionaron las fotos, la mascota dentro de Inicio y cantidades en móvil/escritorio, ambos perfiles/temas. Verificación documental independiente aprobada.
- No se afirma haber probado físicamente Samsung/iPhone. El **Playwright completo del commit publicado lo ejecuta GitHub Actions**; comprobar su resultado.

Las capturas locales ignoradas están en `.impeccable/review/final-mobile/` y `.impeccable/review/bulldog-preview/` del worktree de desarrollo. Hay un PNG del bulldog y la primera ficha descartada en `_publicar/mascotas/` del proyecto principal.

## Para retomar

1. Leer `git status`, los últimos commits y `.agents/skills/nutriduo-ship/SKILL.md`. No agregar ni borrar `.codex-remote-attachments/` o `Claude outputs/`.
2. Verificar el run de `main` que contiene la versión 1.21. Si falla, leer el paso exacto; no borrar aserciones ni ampliar cambios sin motivo.
3. Si termina bien, confirmar en el JS servido por la URL pública el footer 1.21 y en el visor el bulldog. La app instalada recibe **Actualizar ahora**; no pedir reinstalar ni limpiar datos.
4. No rehacer las mascotas ni seguir puliendo sin una corrección concreta de Luca: ya se mostró el dibujo y terminó la revisión. No contratar APIs, planes ni generación paga.

El trabajo se desarrolló en el worktree `C:/Users/lucar/.codex/worktrees/mascotas-3d/Nutricionista`, rama `codex/meal-quantities`. Ese nombre de carpeta es histórico: la app actual no usa 3D. Al cerrar se debe dejar la rama principal actualizada conservando todo el trabajo de Claude.
