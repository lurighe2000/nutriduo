const sections = [
  {
    title: "Tu recorrido de cada día",
    steps: [
      "Elegí Luca o Ari e ingresá tu PIN. Cada perfil tiene sus propios objetivos y registros.",
      "Revisá la fecha de arriba: comidas, agua, peso y entrenamiento se guardan en el día seleccionado.",
      "Registrá lo que comiste y tomaste. Guardá el entrenamiento cuando corresponda y tu peso desde Progreso.",
      "Cuando cargaste todo lo que comiste, marcá en Inicio: Ya registré todo lo que comí hoy.",
      "Consultá Inicio para el balance diario y Progreso → Mi análisis para la evolución. Completá el check-in semanal.",
    ],
  },
  {
    title: "Dónde veo cada resultado",
    steps: [
      "Un plato: Registrar comida → Analizar comida → Revisar componentes.",
      "Calorías y macros del día, objetivos y agua: Inicio.",
      "Detalle de cada comida y nutrientes adicionales del día: Comidas → Hoy. Hoy muestra la fecha seleccionada.",
      "Evolución y posibles ajustes: Progreso → Mi análisis.",
      "Resúmenes de varios días: Más → Calendario e historial.",
      "La IA analiza cada plato. El seguimiento general usa los registros guardados y reglas de la app; no hay un chat de IA que lea todo tu historial.",
    ],
  },
  {
    title: "Registrar una comida con la IA",
    steps: [
      "Tocá + o Registrar comida y elegí Analizar comida. Sacá o elegí una foto del plato.",
      "Describí alimentos, cantidades aproximadas, cocción, aceite, salsas y marcas. Aclarar qué está crudo o cocido ayuda a interpretar la porción.",
      "Tocá Analizar foto y descripción. Si aparecen preguntas, agregá las respuestas a la descripción y volvé a analizar.",
      "La propuesta muestra alimentos, gramos y calorías estimadas. La confianza es la declarada por la IA; no garantiza precisión.",
      "Tocá Revisar componentes y corregí cantidades o valores. Elegí nombre, momento de la comida y hora.",
      "El total se muestra al pie del formulario. La comida se guarda al tocar Confirmar y registrar; después se actualiza el resumen diario.",
    ],
  },
  {
    title: "Conectar el análisis y otras formas de cargar",
    steps: [
      "Más → Análisis de comidas: ingresá el código privado de conexión y tocá Conectar análisis. La dirección del servicio viene cargada en la versión publicada.",
      "Recordar conexión en este dispositivo conserva el acceso para ese perfil. Configurala en cada perfil y celular que vaya a usarla. El código no es tu PIN ni la clave de Groq.",
      "Componentes: cargá alimentos, cantidades y valores de la etiqueta manualmente.",
      "Mis alimentos: reutilizá la biblioteca personal y una porción de tus recetas.",
      "Código de barras: escribí el código o usá la cámara para buscar un producto. Verificá la ficha con su etiqueta; si no aparece, cargala en Componentes.",
      "IA externa: copiá el prompt para analizar fuera de la app, pegá la respuesta JSON y tocá Validar y revisar antes de guardar.",
      "Sin conexión o con la cuota de IA agotada, podés seguir cargando manualmente. Analizar envía únicamente la foto y descripción de esa consulta.",
    ],
  },
  {
    title: "Sodio, vitaminas y minerales",
    steps: [
      "Durante la revisión, cada componente ofrece Buscar una ficha nutricional cuando el servicio está conectado.",
      "Buscá y elegí el alimento y la cocción correspondientes. Las fichas USDA tienen nombres en inglés; la IA suele preparar el término de búsqueda.",
      "Elegir una ficha reemplaza los macros estimados por sus datos y agrega los nutrientes disponibles. La cantidad que indicaste se conserva.",
      "Desplegá Sodio, vitaminas y minerales para ver los valores. Se muestra por componente, por comida y para el día en Comidas → Hoy.",
      "Un total parcial indica cuántos componentes aportan datos. Sin dato no equivale a cero. La app no calcula objetivos ni déficits de vitaminas a partir de esos valores.",
    ],
  },
  {
    title: "Comidas, recetas y alimentos guardados",
    steps: [
      "Hoy: comidas de la fecha seleccionada y sus totales. Podés editar cantidades, repetir o eliminar una comida.",
      "Recientes: últimos registros para consultar y reutilizar. Repetir agrega una nueva comida en la fecha seleccionada; revisá la porción consumida.",
      "Duplicar comidas de ayer copia los registros al día seleccionado después de confirmar.",
      "Recetas: cargá ingredientes y cuántas porciones rinde la preparación. Cargar 1 porción abre el formulario para revisarla y registrarla.",
      "Alimentos: tu biblioteca personal, con valores corregibles y favoritos. Guardar alimentos nuevos para la próxima vez permite reutilizar los componentes de una comida.",
    ],
  },
  {
    title: "Entrenamiento y movimiento",
    steps: [
      "Elegí el día de la rutina y tocá Empezar sesión. Registrá kilos, repeticiones y RIR: repeticiones que sentís que te quedaban por hacer.",
      "Finalizar y guardar incorpora la sesión al historial. La última sesión sirve de referencia para la próxima.",
      "La app puede sugerir revisar la carga cuando completaste el rango superior en dos sesiones con margen. La técnica y cómo te sentís siguen siendo parte de la decisión.",
      "Editar rutina permite cambiar ejercicios, series y rangos de repeticiones.",
      "Pasos y pádel se cargan manualmente. Registrar actividad no aumenta automáticamente tus calorías disponibles.",
    ],
  },
  {
    title: "Progreso y Mi análisis",
    steps: [
      "Peso: último registro, promedio de siete días, cambio semanal y gráficos de 30 días, 90 días o todo el historial.",
      "Medidas: cintura y otras medidas, incluidas medidas personalizadas. Fotos: guardá vistas y compará dos fechas; no se calcula grasa corporal desde imágenes.",
      "Mi análisis reúne la observación general y el cumplimiento de energía, proteína y fuerza.",
      "El seguimiento requiere dos semanas, al menos cuatro pesajes por semana y doce días de alimentación marcados como completos. Al principio puede indicar que faltan datos.",
      "El check-in registra hambre, energía, sueño, rendimiento, dificultad con la alimentación y cumplimiento del entrenamiento.",
      "Si aparece una propuesta de ajuste, podés revisarla o mantener el objetivo. Los objetivos cambian al confirmar, no automáticamente.",
    ],
  },
  {
    title: "Objetivos, agua y apariencia",
    steps: [
      "Más → Tu perfil y objetivos permite editar datos, metas diarias, actividad, alimentos excluidos y preferencias.",
      "Cambiar la actividad no recalcula las metas automáticamente: revisá los valores y tocá Confirmar objetivos y preferencias.",
      "En Inicio podés sumar agua de a 250 o 500 ml. Más → Un vaso a tu medida permite cargar otra cantidad y deshacer registros.",
      "Claro y Oscuro están en el encabezado. Los recordatorios son avisos dentro de la app.",
      "Volver y Atrás del navegador recorren las pantallas anteriores; desde Inicio se vuelve a elegir perfil.",
    ],
  },
  {
    title: "Historial, backups y otro dispositivo",
    steps: [
      "Calendario e historial muestra días, semanas, meses o todo el período. Al elegir un día, Inicio pasa a esa fecha.",
      "Los promedios de alimentación usan días marcados como completos. Un día incompleto no se cuenta como cero.",
      "Tus datos van con vos: Excel incluye las tablas del perfil; CSV incluye comidas; el backup JSON incluye los datos y fotos para restaurarlos.",
      "Exportá un backup desde cada perfil para respaldar a ambos. Restaurar reemplaza los registros del perfil seleccionado después de validar y confirmar.",
      "Los registros se guardan en este dispositivo. Otro celular, la PC o una dirección web distinta tienen su propia base; todavía no hay sincronización automática.",
      "El backup no incluye tu PIN ni el código de conexión de IA. Guardalo en un lugar privado porque contiene tus registros y fotos.",
    ],
  },
  {
    title: "Instalar, usar sin internet y actualizar",
    steps: [
      "Android con Chrome: menú del navegador → Instalar aplicación. iPhone con Safari: Compartir → Agregar a pantalla de inicio. Más → Instalar NutriDuo muestra las instrucciones.",
      "Después de la primera carga, podés consultar y guardar registros sin internet. La IA y la búsqueda de productos nuevos requieren conexión.",
      "Cuando aparece Hay una nueva versión de NutriDuo, guardá lo que estés cargando y tocá Actualizar ahora, o elegí Después.",
      "En versiones antiguas sin aviso, recargá con internet, esperá a que descargue la actualización, cerrá la app y todas sus pestañas y volvé a abrirla.",
      "Actualizar conserva los registros guardados. Borrar los datos del sitio puede eliminarlos: usá backups para conservar tu recorrido.",
    ],
  },
];

export default function UsageGuide() {
  return (
    <div className="usage-guide">
      <p>
        Registrá tu día, revisá los resultados y seguí tu evolución. Abrí el
        tema que necesites.
      </p>
      {sections.map((section, index) => (
        <details key={section.title} open={index === 0}>
          <summary>{section.title}</summary>
          <ol>
            {section.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}
