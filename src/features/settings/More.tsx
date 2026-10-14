import { useEffect, useState } from "react";
import {
  Download,
  ShieldCheck,
  Smartphone,
  CalendarDays,
  BookOpen,
  Settings,
  Archive,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../../app/context";
import { useHistoryChoice } from "../../app/navigation";
import { db, meta } from "../../db";
import {
  profileSchema,
  goalSchema,
  type Backup,
  type Profile,
} from "../../schemas";
import { setPin } from "../../services/pin";
import AIConnectionForm from "../meals/AIConnectionForm";
import UsageGuide from "./UsageGuide";
import WeeklyMenu from "../meals/WeeklyMenu";
import { importGoals } from "../../services/goalImport";
import PushSettings from "./PushSettings";
import {
  createBackup,
  parseBackup,
  restoreBackup,
  download,
} from "../../services/backup";
import {
  dailyTotals,
  average,
  weightTrend,
  bmr,
} from "../../nutrition/formulas";
import { SOURCES } from "../../nutrition/constants";
import { rangeDates, niceDate, today, rounded } from "../../utils/date";
import {
  Button,
  Field,
  NumberField,
  Modal,
  SectionTitle,
  Confirm,
} from "../../components/ui";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function More() {
  const {
    profile: p,
    data,
    repo,
    date,
    setDate,
    navigate,
    run,
    notify,
  } = useApp();
  const [period, setPeriod] = useHistoryChoice<string>("more.period", "Semana");
  const [panel, setPanel] = useState(""),
    [draft, setDraft] = useState<Profile>(p),
    [backup, setBackup] = useState<Backup>(),
    [pin, setPinValue] = useState(""),
    [oldPin, setOldPin] = useState(""),
    [install, setInstall] = useState<InstallEvent>(),
    [ml, setMl] = useState(300),
    [busy, setBusy] = useState(false);
  const [goalText, setGoalText] = useState(""),
    [assessmentNote, setAssessmentNote] = useState("");
  useEffect(() => {
    const fn = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", fn);
    return () => window.removeEventListener("beforeinstallprompt", fn);
  }, []);
  const dates =
    period === "Todo"
      ? [
          ...new Set([
            ...data.meals.map((m) => m.date),
            ...data.weights.map((w) => w.date),
            ...data.sessions.map((s) => s.date),
          ]),
        ]
          .filter((d) => d <= date)
          .sort()
      : rangeDates(date, period === "Hoy" ? 1 : period === "Semana" ? 7 : 30);
  const complete = dates.filter((d) =>
    data.settings.some((s) => s.date === d && s.complete),
  );
  const avg = average(complete.map((d) => dailyTotals(data.meals, d).calories));
  const protein = average(
    complete.map((d) => dailyTotals(data.meals, d).protein),
  );
  const trend = weightTrend(data.weights, date);
  async function exportFile(format: "xlsx" | "csv" | "json") {
    setBusy(true);
    await run(async () => {
      if (format === "json") {
        download(
          JSON.stringify(await createBackup(p.id), null, 2),
          `nutriduo-backup-${p.id}-${today()}.json`,
          "application/json",
        );
      } else {
        const { exportData } = await import("../../services/export");
        await exportData(p.id, format);
      }
    }, "Archivo preparado");
    setBusy(false);
  }
  const cards = [
    {
      id: "recordatorios",
      icon: Smartphone,
      title: "Recordatorios",
      text: "Comidas, movimiento y el informe de Femmto del domingo.",
    },
    {
      id: "menu",
      icon: CalendarDays,
      title: "Menú semanal",
      text: "Platos de cada día, porciones y lista de compras.",
    },
    {
      id: "ia",
      icon: BookOpen,
      title: "Análisis de comidas",
      text: "Conexión al servicio gratuito y revisión de nutrientes.",
    },
    {
      id: "manual",
      icon: BookOpen,
      title: "Cómo usar NutriDuo",
      text: "Tu guía para registrar, consultar resultados y seguir tu progreso.",
    },
    {
      id: "perfil",
      icon: Settings,
      title: "Tu perfil y objetivos",
      text: "Calorías, macros, actividad y preferencias.",
    },
    {
      id: "historial",
      icon: CalendarDays,
      title: "Calendario e historial",
      text: "Días, semanas y el recorrido completo.",
    },
    {
      id: "exportar",
      icon: Archive,
      title: "Tus datos van con vos",
      text: "Excel, CSV y backups completos con fotos.",
    },
    {
      id: "instalar",
      icon: Smartphone,
      title: "Instalar NutriDuo",
      text: "Un acceso directo a tu rutina.",
    },
    {
      id: "privacidad",
      icon: ShieldCheck,
      title: "Privacidad y PIN",
      text: "Tu espacio personal, bajo tu control.",
    },
    {
      id: "metodo",
      icon: BookOpen,
      title: "Cómo hacemos las cuentas",
      text: "Método, fuentes y límites.",
    },
  ];
  return (
    <>
      <SectionTitle eyebrow="NUTRIDUO" title="Ajustes" />
      <p className="page-subtitle">
        Ajustá lo que necesites. Llevate tus datos cuando quieras.
      </p>
      <div className="settings-grid">
        {cards.map((c) => (
          <button
            key={c.id}
            className="card settings-card"
            onClick={() => {
              setDraft(p);
              setGoalText("");
              setAssessmentNote("");
              setPanel(c.id);
            }}
          >
            <span className="settings-icon">
              <c.icon size={24} />
            </span>
            <h2>{c.title}</h2>
            <p>{c.text}</p>
            <ArrowRight size={19} />
          </button>
        ))}
      </div>
      <section className="card">
        <h2>Un vaso a tu medida</h2>
        <div className="actions">
          <NumberField
            label="Agua (ml)"
            value={ml}
            min={1}
            max={5000}
            step={1}
            onChange={setMl}
          />
          <Button
            secondary
            onClick={() =>
              void run(
                () => repo.save("hydration", { ...meta(p.id), date, ml }),
                "Agua registrada",
              )
            }
          >
            Sumar agua
          </Button>
        </div>
        {data.hydration
          .filter((w) => w.date === date)
          .map((w) => (
            <div className="history-row" key={w.id}>
              <span>{w.ml} ml</span>
              <button
                className="text-button"
                onClick={() =>
                  void run(
                    () => repo.remove("hydration", w.id),
                    "Registro de agua eliminado",
                  )
                }
              >
                Deshacer
              </button>
            </div>
          ))}
      </section>
      {panel === "ia" && (
        <Modal title="Análisis de comidas" onClose={() => setPanel("")}>
          <AIConnectionForm />
        </Modal>
      )}
      {panel === "manual" && (
        <Modal title="Cómo usar NutriDuo" onClose={() => setPanel("")}>
          <UsageGuide />
        </Modal>
      )}
      {panel === "menu" && (
        <Modal title="Menú semanal" onClose={() => setPanel("")}>
          <WeeklyMenu key={p.id} />
        </Modal>
      )}
      {panel === "recordatorios" && (
        <Modal title="Recordatorios en tu celular" onClose={() => setPanel("")}>
          <PushSettings />
        </Modal>
      )}
      {panel === "perfil" && (
        <Modal title="Tu perfil y objetivos" onClose={() => setPanel("")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const valid = profileSchema.parse(draft);
                const g = goalSchema.parse(draft.targets);
                if (
                  g.calories <
                  Math.max(1400, bmr(valid, valid.initialWeight) * 0.95)
                )
                  throw new Error(
                    "Este objetivo es demasiado bajo para el ajuste orientativo de la app. Revisalo con un profesional.",
                  );
                await db.profiles.put(valid);
                setPanel("");
              }, "Preferencias guardadas");
            }}
          >
            <details>
              <summary>Cargar objetivos preparados para este perfil</summary>
              <p className="muted small">
                Elegí el archivo privado o pegá su contenido. Primero se
                completa este formulario; los objetivos cambian sólo cuando los
                confirmás. Tu fecha de nacimiento, PIN e historial se conservan.
              </p>
              <Field
                label="Archivo de objetivos NutriDuo"
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(async () => {
                      if (file.size > 30000) throw new Error("Máximo 30 KB");
                      const imported = importGoals(await file.text(), p);
                      setDraft(imported.profile);
                      setAssessmentNote(
                        `Edad informada: ${imported.assessmentAge} años. Revisá tu fecha de nacimiento. ${imported.notes ?? ""}`,
                      );
                    }, "Objetivos cargados para revisar");
                }}
              />
              <label className="field">
                <span>Contenido JSON de objetivos</span>
                <textarea
                  rows={4}
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                />
              </label>
              <Button
                secondary
                onClick={() =>
                  void run(async () => {
                    const imported = importGoals(goalText, p);
                    setDraft(imported.profile);
                    setAssessmentNote(
                      `Edad informada: ${imported.assessmentAge} años. Revisá tu fecha de nacimiento. ${imported.notes ?? ""}`,
                    );
                  }, "Objetivos cargados para revisar")
                }
              >
                Revisar objetivos pegados
              </Button>
            </details>
            {assessmentNote && <p className="notice">{assessmentNote}</p>}
            <div className="form-grid">
              <Field
                label="Nombre"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Field
                label="Nacimiento"
                type="date"
                max={today()}
                required
                value={draft.birthDate}
                onChange={(e) =>
                  setDraft({ ...draft, birthDate: e.target.value })
                }
              />
              <NumberField
                label="Altura (cm)"
                min={100}
                max={230}
                value={draft.height}
                onChange={(n) => setDraft({ ...draft, height: n })}
              />
              <NumberField
                label="Peso de referencia (kg)"
                min={25}
                max={350}
                value={draft.initialWeight}
                onChange={(n) => setDraft({ ...draft, initialWeight: n })}
              />
              <NumberField
                label="Días de fuerza por semana"
                min={0}
                max={6}
                step={1}
                value={draft.gymDays}
                onChange={(n) => setDraft({ ...draft, gymDays: n })}
              />
              <label className="field">
                <span>Actividad</span>
                <select
                  value={draft.activity}
                  onChange={(e) =>
                    setDraft({ ...draft, activity: Number(e.target.value) })
                  }
                >
                  <option value={1.2}>Baja</option>
                  <option value={1.375}>Ligera</option>
                  <option value={1.55}>Moderada</option>
                  <option value={1.725}>Alta</option>
                </select>
              </label>
              <label className="field">
                <span>Dirección del objetivo</span>
                <select
                  value={draft.goal}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      goal: e.target.value as Profile["goal"],
                    })
                  }
                >
                  <option value="gain">Ganancia muscular controlada</option>
                  <option value="loss">Reducción de grasa / definición</option>
                </select>
              </label>
            </div>
            <h3>Objetivos diarios</h3>
            <p className="muted small">
              Cambiar actividad no modifica tus metas automáticamente. Revisá y
              confirmá los valores.
            </p>
            <div className="form-grid">
              {(
                [
                  "calories",
                  "protein",
                  "carbs",
                  "fat",
                  "fiber",
                  "water",
                  "steps",
                ] as const
              ).map((k, i) => (
                <NumberField
                  key={k}
                  label={
                    [
                      "Calorías (kcal)",
                      "Proteína (g)",
                      "Carbohidratos (g)",
                      "Grasas (g)",
                      "Fibra (g)",
                      "Agua (ml)",
                      "Pasos",
                    ][i]
                  }
                  value={draft.targets![k]}
                  min={k === "calories" ? 1400 : 0}
                  max={
                    k === "calories"
                      ? 6000
                      : k === "water"
                        ? 10000
                        : k === "steps"
                          ? 50000
                          : 1000
                  }
                  onChange={(n) =>
                    setDraft({
                      ...draft,
                      targets: { ...draft.targets!, [k]: n },
                    })
                  }
                />
              ))}
            </div>
            <Field
              label="Alimentos excluidos (separados por coma)"
              value={draft.excluded.join(", ")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  excluded: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
            />
            <NumberField
              label="Presupuesto semanal de compras de este perfil (ARS)"
              max={10000000}
              required={false}
              value={draft.weeklyBudget ?? 0}
              onChange={(n) =>
                setDraft({
                  ...draft,
                  weeklyBudget: Number.isNaN(n) ? undefined : n,
                })
              }
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.dark}
                onChange={(e) => setDraft({ ...draft, dark: e.target.checked })}
              />
              Usar tema oscuro
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.reminders}
                onChange={(e) =>
                  setDraft({ ...draft, reminders: e.target.checked })
                }
              />
              Mostrar recordatorios dentro de la app
            </label>
            <Button type="submit">Confirmar objetivos y preferencias</Button>
          </form>
        </Modal>
      )}
      {panel === "historial" && (
        <Modal title="Tu recorrido" onClose={() => setPanel("")}>
          <div className="tabs compact">
            {["Hoy", "Semana", "Mes", "Todo"].map((t) => (
              <button
                key={t}
                className={period === t ? "active" : ""}
                onClick={() => setPeriod(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="summary-strip">
            <span>≈ {avg === null ? "—" : rounded(avg)} kcal promedio</span>
            <span>{protein === null ? "—" : rounded(protein)} g proteína</span>
            <span>
              {data.sessions.filter((s) => dates.includes(s.date)).length}{" "}
              entrenos
            </span>
            <span>
              {
                data.activity.filter((a) => dates.includes(a.date) && a.padel)
                  .length
              }{" "}
              pádel
            </span>
          </div>
          <p className="muted small">
            Promedios de {complete.length} días completos de {dates.length}. El
            resto se considera incompleto, no cero. Promedio semanal de peso:{" "}
            {trend.current?.toFixed(2) ?? "—"} kg.
          </p>
          <div className="calendar-list">
            {[...dates].reverse().map((d) => {
              const meals = data.meals.filter((m) => m.date === d).length,
                w = data.weights.find((w) => w.date === d),
                sessions = data.sessions.filter((s) => s.date === d).length,
                photos = data.photos.filter((ph) => ph.date === d).length,
                measures = data.measurements.filter((m) => m.date === d).length;
              return (
                <button
                  className="list-button"
                  key={d}
                  onClick={() => {
                    setDate(d);
                    setPanel("");
                    navigate("inicio");
                  }}
                >
                  <span>
                    {niceDate(d)}
                    <small>
                      {meals} comidas · {sessions} entrenos · {photos} fotos ·{" "}
                      {measures} medidas
                    </small>
                  </span>
                  <strong>{w ? `${w.kg} kg` : "—"}</strong>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
      {panel === "exportar" && (
        <Modal title="Tus datos, siempre tuyos" onClose={() => setPanel("")}>
          <p>
            Exportamos sólo el perfil de {p.name}. Para respaldar a ambos,
            repetí la exportación desde el otro perfil.
          </p>
          <div className="export-buttons">
            <Button
              secondary
              disabled={busy}
              onClick={() => void exportFile("xlsx")}
            >
              <Download size={18} />
              Exportar Excel · todas las tablas
            </Button>
            <Button
              secondary
              disabled={busy}
              onClick={() => void exportFile("csv")}
            >
              <Download size={18} />
              Exportar CSV · comidas
            </Button>
            <Button disabled={busy} onClick={() => void exportFile("json")}>
              <Archive size={18} />
              Backup completo JSON · incluye fotos
            </Button>
          </div>
          <p className="muted small">
            El backup contiene datos personales y fotos, sin cifrar. No incluye
            tu PIN. Guardalo en un lugar privado.
          </p>
          <h3>Restaurar un backup</h3>
          <Field
            label="Elegir archivo JSON"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void run(async () => {
                  if (file.size > 100000000) throw new Error("Máximo 100 MB.");
                  setBackup(parseBackup(await file.text(), p.id));
                });
            }}
          />
          <p className="muted small">
            Primero lo validamos y mostramos un resumen. No cambiamos datos
            hasta que confirmes.
          </p>
        </Modal>
      )}
      {backup && (
        <Confirm
          title="Revisar restauración"
          onClose={() => setBackup(undefined)}
          onConfirm={() =>
            void run(async () => {
              await restoreBackup(backup, p.id);
              setBackup(undefined);
              setPanel("");
            }, "Backup restaurado")
          }
        >
          Perfil {backup.profile.name}: {backup.data.meals.length} comidas,{" "}
          {backup.data.weights.length} pesajes, {backup.data.sessions.length}{" "}
          entrenamientos y {backup.data.photos.length} fotos. Se reemplazarán
          TODOS los registros actuales de este perfil. Tu PIN y los datos del
          otro perfil se conservan. Exportá primero un backup actual si querés
          conservarlo.
        </Confirm>
      )}
      {panel === "instalar" && (
        <Modal title="NutriDuo, siempre a mano" onClose={() => setPanel("")}>
          <p>
            NutriDuo se instala desde el navegador y se abre desde su ícono. Usá
            la{" "}
            <a
              href="https://lurighe2000.github.io/nutriduo/"
              target="_blank"
              rel="noreferrer"
            >
              dirección publicada de NutriDuo
            </a>{" "}
            en tu celular.
          </p>
          {install && (
            <Button
              onClick={() =>
                void run(async () => {
                  await install.prompt();
                  await install.userChoice;
                  setInstall(undefined);
                })
              }
            >
              Instalar NutriDuo
            </Button>
          )}
          <h3>Samsung S23 Ultra · Android con Chrome</h3>
          <p>
            Abrí la dirección en Chrome, tocá el menú ⋮ → Instalar y crear
            acceso directo → Instalar. Según la versión puede aparecer “Agregar
            a la pantalla principal” o “Instalar aplicación”. Confirmá y abrí
            NutriDuo desde el ícono.
          </p>
          <h3>iPhone 17 Pro Max · Safari</h3>
          <p>
            Abrí la dirección en Safari, tocá Compartir → Agregar a pantalla de
            inicio. Si aparece “Abrir como app web”, dejalo activado. Tocá
            Agregar y entrá desde el ícono de NutriDuo.
          </p>
          <p className="muted small">
            Si Safari no muestra Agregar a Inicio, buscá Editar acciones al
            final de Compartir y agregá esa opción.{" "}
            <a
              href="https://support.apple.com/es-lamr/guide/iphone/iphea86e5236/ios"
              target="_blank"
              rel="noreferrer"
            >
              Guía de Apple
            </a>{" "}
            ·{" "}
            <a
              href="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=es"
              target="_blank"
              rel="noreferrer"
            >
              Guía de Chrome
            </a>
            .
          </p>
          <div className="notice">
            Después de la primera carga, las funciones principales pueden usarse
            sin conexión. La búsqueda de productos necesita internet. Los datos
            son propios de este navegador y dispositivo: no se sincronizan entre
            celulares. Si la app instalada no muestra los registros del
            navegador, restaurá un backup de ese perfil. Hacé el backup antes de
            cambiar de navegador o borrar datos.
          </div>
          <Button
            secondary
            onClick={() =>
              void run(async () => {
                const granted = await navigator.storage?.persist?.();
                notify(
                  granted
                    ? "Almacenamiento persistente concedido."
                    : "El navegador administra la conservación. Hacé backups periódicos.",
                );
              })
            }
          >
            Solicitar conservación de datos
          </Button>
        </Modal>
      )}
      {panel === "privacidad" && (
        <Modal title="Privacidad y acceso" onClose={() => setPanel("")}>
          <p>
            Sin publicidad ni analytics. Comidas, peso, balanza y progreso se
            guardan en este dispositivo. Analizar envía las fotos adjuntas y
            descripción de esa consulta a tu servicio de Cloudflare y Groq. La
            búsqueda nutricional consulta USDA a través de tu servicio; los
            códigos de barras consultan Open Food Facts. El menú semanal se
            calcula localmente.
          </p>
          <p>
            El PIN evita entrar por error a otro perfil. No cifra IndexedDB ni
            los backups, y puede ser eludido por alguien con acceso técnico al
            navegador. La sesión se bloquea al recargar o tras 5 minutos en
            segundo plano.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await setPin(p.id, pin, oldPin);
                setPinValue("");
                setOldPin("");
              }, "PIN actualizado");
            }}
          >
            <h3>Cambiar PIN</h3>
            <Field
              label="PIN actual"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value)}
            />
            <Field
              label="Nuevo PIN de 4 dígitos"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              value={pin}
              onChange={(e) => setPinValue(e.target.value)}
            />
            <Button type="submit">Cambiar PIN</Button>
          </form>
          <h3>Sincronización de registros</h3>
          <p>
            Los registros de salud se guardan localmente, sin sincronización
            automática entre dispositivos. Los recordatorios guardan sólo
            suscripciones y preferencias de avisos en Cloudflare.
          </p>
        </Modal>
      )}
      {panel === "metodo" && (
        <Modal title="Cómo hacemos las cuentas" onClose={() => setPanel("")}>
          <h3>Un punto de partida, no una medición</h3>
          <p>
            Estimamos metabolismo con peso, altura, edad y sexo metabólico
            mediante{" "}
            <a href={SOURCES.bmr} target="_blank" rel="noreferrer">
              Mifflin–St Jeor
            </a>
            . Un factor aproximado de actividad produce el gasto diario
            estimado. No usamos somatotipos.
          </p>
          <h3>Objetivos conservadores</h3>
          <p>
            Proponemos +150 kcal para ganar músculo o un déficit inicial del 10%
            para reducir grasa. Son criterios de producto configurables.
            Proteína inicial: 1,6 g/kg, o 1,8 g/kg con fuerza, dentro del rango
            de referencia de{" "}
            <a href={SOURCES.protein} target="_blank" rel="noreferrer">
              ISSN
            </a>
            . Grasa: 0,9 g/kg; carbohidratos completan energía. Fibra:{" "}
            <a href={SOURCES.fiber} target="_blank" rel="noreferrer">
              14 g por 1000 kcal
            </a>
            .
          </p>
          <h3>Tendencias, no juicios diarios</h3>
          <p>
            Comparamos promedios de dos ventanas de 7 días calendario. No
            inventamos pesajes faltantes. Los cambios de energía requieren
            cobertura de datos, adherencia y confirmación. El coach espera al
            menos 14 días entre ajustes.
          </p>
          <h3>Fotos y alimentos</h3>
          <p>
            Una foto no permite conocer gramos ni ingredientes invisibles con
            precisión. La IA externa siempre produce estimaciones para revisar.
            NutriDuo no calcula grasa corporal desde imágenes.
          </p>
          <p>
            Productos:{" "}
            <a
              href="https://world.openfoodfacts.org/"
              target="_blank"
              rel="noreferrer"
            >
              Open Food Facts
            </a>
            , base colaborativa bajo{" "}
            <a
              href="https://opendatacommons.org/licenses/odbl/1-0/"
              target="_blank"
              rel="noreferrer"
            >
              ODbL
            </a>
            . Verificá etiquetas; los nutrientes ausentes pueden no estar
            disponibles.
          </p>
          <p>
            Una herramienta de seguimiento, no un diagnóstico ni una
            prescripción. Si necesitás un plan clínico o aparecen cambios
            rápidos persistentes, consultá a un profesional.
          </p>
        </Modal>
      )}
    </>
  );
}
