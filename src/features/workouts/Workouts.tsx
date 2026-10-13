import { useState } from "react";
import { Dumbbell, Plus, Trash2, Check, Timer } from "lucide-react";
import { useApp } from "../../app/context";
import { useHistoryChoice } from "../../app/navigation";
import { meta } from "../../db";
import { type ExerciseSet, type Records, planSchema } from "../../schemas";
import { progression } from "../../services/workouts";
import {
  Button,
  Field,
  NumberField,
  SectionTitle,
  Modal,
  Empty,
} from "../../components/ui";
import { niceDate } from "../../utils/date";
export default function Workouts() {
  const { profile: p, data, date, repo, run, notify } = useApp();
  const plan = data.plans[0];
  const [selected, setSelected] = useHistoryChoice<number>("workouts.day", 0);
  const [logging, setLogging] = useState(false),
    [sets, setSets] = useState<ExerciseSet[]>([]),
    [editPlan, setEditPlan] = useState<Records["plans"]>(),
    [notes, setNotes] = useState(""),
    [activity, setActivity] = useState(false),
    [steps, setSteps] = useState(
      data.activity.find((a) => a.date === date)?.steps ?? 0,
    ),
    [padel, setPadel] = useState(false);
  const day = plan?.days[selected];
  const previous = data.sessions
    .filter((s) => s.dayId === day?.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  function start() {
    if (!day) return;
    setSets(
      day.exercises.flatMap((ex) =>
        Array.from({ length: ex.sets }, (_, idx) => {
          const old = previous?.sets.filter((s) => s.exerciseId === ex.id)[idx];
          return {
            exerciseId: ex.id,
            exerciseName: ex.name,
            kg: old?.kg ?? 0,
            reps: old?.reps ?? ex.minReps,
            rir: 2,
            notes: "",
          };
        }),
      ),
    );
    setLogging(true);
    setNotes("");
  }
  function updateSet(i: number, key: "kg" | "reps" | "rir", n: number) {
    setSets((v) => v.map((s, j) => (i === j ? { ...s, [key]: n } : s)));
  }
  return (
    <>
      <SectionTitle eyebrow="FUERZA PARA TU DÍA A DÍA" title="Entrenamiento">
        <Button onClick={start}>
          <Dumbbell size={18} />
          Empezar sesión
        </Button>
      </SectionTitle>
      <p className="page-subtitle">
        Técnica primero. La constancia hace el resto.
      </p>
      <div className="workout-intro">
        <div>
          <span className="eyebrow">TU PLAN</span>
          <h2>{plan?.name ?? "Tu rutina"}</h2>
          <p>
            {p.gymDays} días disponibles · dejá recuperación entre sesiones de
            fuerza.
          </p>
        </div>
        <div className="actions">
          <Button secondary onClick={() => setEditPlan(plan)}>
            Editar rutina
          </Button>
          <Button secondary onClick={() => setActivity(true)}>
            Pasos y pádel
          </Button>
        </div>
      </div>
      <p className="muted small">
        Empezá con cargas cómodas y 2–3 repeticiones en reserva. Una entrada en
        calor gradual y orientación sobre técnica pueden ayudarte. Detenete si
        aparece dolor.
      </p>
      <div className="tabs">
        {plan?.days.map((d, i) => (
          <button
            key={d.id}
            className={selected === i ? "active" : ""}
            onClick={() => setSelected(i)}
          >
            {d.name}
          </button>
        ))}
      </div>
      <div className="exercise-list">
        {day?.exercises.map((ex, i) => {
          const last = previous?.sets.filter((s) => s.exerciseId === ex.id);
          return (
            <article className="card exercise-row" key={ex.id}>
              <span className="exercise-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{ex.name}</h3>
                <p>
                  {ex.sets} series × {ex.minReps}–{ex.maxReps} repeticiones
                </p>
                {last && (
                  <small>
                    Última vez:{" "}
                    {last.map((s) => `${s.kg} kg × ${s.reps}`).join(" · ")}
                  </small>
                )}
                {progression(ex, data.sessions) && (
                  <p className="notice small">
                    Completaste el rango superior en dos sesiones con margen. Si
                    la técnica fue buena, podés probar un aumento pequeño de
                    carga.
                  </p>
                )}
              </div>
              <span className="exercise-rest">
                <Timer size={15} />
                90–180 s
              </span>
            </article>
          );
        })}
      </div>
      <section className="card">
        <h2>Tu historial de fuerza</h2>
        {!data.sessions.length ? (
          <Empty
            title="La primera sesión es un gran comienzo"
            detail="Registrá cargas y repeticiones para ver cuánto avanzaste."
          />
        ) : (
          data.sessions
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 20)
            .map((s) => (
              <details className="session-history" key={s.id}>
                <summary>
                  {niceDate(s.date)} · {s.name} · {s.sets.length} series
                </summary>
                {s.sets.map((set, i) => (
                  <p key={i}>
                    {set.exerciseName}: {set.kg} kg × {set.reps} · RIR{" "}
                    {set.rir ?? "—"}
                  </p>
                ))}
                {s.notes && <p>{s.notes}</p>}
              </details>
            ))
        )}
      </section>
      {logging && day && (
        <Modal title={day.name} onClose={() => setLogging(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await repo.save("sessions", {
                  ...meta(p.id),
                  date,
                  dayId: day.id,
                  name: day.name,
                  sets,
                  notes,
                });
                setLogging(false);
              }, "Sesión guardada. Un paso más.");
            }}
          >
            <p className="muted small">
              RIR = repeticiones que sentís que podrías haber hecho al terminar
              la serie. Las cargas iniciales son sugeridas desde tu última
              sesión; verificá lo que hiciste hoy.
            </p>
            {sets.map((s, i) => (
              <div className="set-row" key={i}>
                <strong>
                  {s.exerciseName}
                  <small>
                    Serie{" "}
                    {
                      sets
                        .slice(0, i + 1)
                        .filter((x) => x.exerciseId === s.exerciseId).length
                    }
                  </small>
                </strong>
                <NumberField
                  label="kg"
                  value={s.kg}
                  max={1000}
                  onChange={(n) => updateSet(i, "kg", n)}
                />
                <NumberField
                  label="Reps"
                  value={s.reps}
                  min={1}
                  max={200}
                  step={1}
                  onChange={(n) => updateSet(i, "reps", n)}
                />
                <NumberField
                  label="RIR"
                  value={s.rir ?? 2}
                  max={10}
                  onChange={(n) => updateSet(i, "rir", n)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Quitar serie"
                  onClick={() =>
                    setSets((v) => v.filter((_, idx) => idx !== i))
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <div className="actions">
              {day.exercises.map((ex) => (
                <Button
                  key={ex.id}
                  secondary
                  onClick={() =>
                    setSets((v) => [
                      ...v,
                      {
                        exerciseId: ex.id,
                        exerciseName: ex.name,
                        kg: 0,
                        reps: ex.minReps,
                        rir: 2,
                        notes: "",
                      },
                    ])
                  }
                >
                  <Plus size={13} />
                  {ex.name}
                </Button>
              ))}
            </div>
            <label className="field">
              <span>Notas de la sesión</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={!sets.length}>
              <Check size={17} />
              Finalizar y guardar
            </Button>
          </form>
        </Modal>
      )}
      {editPlan && (
        <Modal
          title="Tu rutina, a tu medida"
          onClose={() => setEditPlan(undefined)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await repo.save("plans", planSchema.parse(editPlan));
                setEditPlan(undefined);
                setSelected(0);
              }, "Rutina actualizada");
            }}
          >
            <Field
              label="Nombre del plan"
              value={editPlan.name}
              required
              onChange={(e) =>
                setEditPlan({ ...editPlan, name: e.target.value })
              }
            />
            {editPlan.days.map((d, di) => (
              <section className="plan-day" key={d.id}>
                <h3>{d.name}</h3>
                {d.exercises.map((ex, ei) => (
                  <div className="plan-exercise" key={ex.id}>
                    <Field
                      label="Ejercicio"
                      value={ex.name}
                      required
                      onChange={(e) =>
                        setEditPlan({
                          ...editPlan,
                          days: editPlan.days.map((dd, j) =>
                            j === di
                              ? {
                                  ...dd,
                                  exercises: dd.exercises.map((ee, k) =>
                                    k === ei
                                      ? { ...ee, name: e.target.value }
                                      : ee,
                                  ),
                                }
                              : dd,
                          ),
                        })
                      }
                    />
                    {(["sets", "minReps", "maxReps"] as const).map((key, i) => (
                      <NumberField
                        key={key}
                        label={["Series", "Reps mín.", "Reps máx."][i]}
                        min={1}
                        max={key === "sets" ? 10 : 100}
                        step={1}
                        value={ex[key]}
                        onChange={(n) =>
                          setEditPlan({
                            ...editPlan,
                            days: editPlan.days.map((dd, j) =>
                              j === di
                                ? {
                                    ...dd,
                                    exercises: dd.exercises.map((ee, k) =>
                                      k === ei ? { ...ee, [key]: n } : ee,
                                    ),
                                  }
                                : dd,
                            ),
                          })
                        }
                      />
                    ))}
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Quitar ejercicio"
                      onClick={() =>
                        setEditPlan({
                          ...editPlan,
                          days: editPlan.days.map((dd, j) =>
                            j === di
                              ? {
                                  ...dd,
                                  exercises: dd.exercises.filter(
                                    (_, k) => k !== ei,
                                  ),
                                }
                              : dd,
                          ),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <Button
                  secondary
                  onClick={() =>
                    setEditPlan({
                      ...editPlan,
                      days: editPlan.days.map((dd, j) =>
                        j === di
                          ? {
                              ...dd,
                              exercises: [
                                ...dd.exercises,
                                {
                                  id: crypto.randomUUID(),
                                  name: "Nuevo ejercicio",
                                  sets: 3,
                                  minReps: 8,
                                  maxReps: 12,
                                },
                              ],
                            }
                          : dd,
                      ),
                    })
                  }
                >
                  <Plus size={15} />
                  Agregar ejercicio
                </Button>
              </section>
            ))}
            <Button type="submit">Guardar rutina</Button>
          </form>
        </Modal>
      )}
      {activity && (
        <Modal title="Tu movimiento de hoy" onClose={() => setActivity(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const old = data.activity.find((a) => a.date === date);
                await repo.save("activity", {
                  ...(old ?? meta(p.id)),
                  date,
                  steps,
                  padel,
                });
                setActivity(false);
                notify("Actividad guardada");
              });
            }}
          >
            <NumberField
              label="Pasos"
              value={steps}
              max={100000}
              step={1}
              onChange={setSteps}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={padel}
                onChange={(e) => setPadel(e.target.checked)}
              />
              Jugué al pádel
            </label>
            <p className="muted small">
              Registro manual. No sumamos automáticamente calorías de ejercicio
              a tu objetivo.
            </p>
            <Button type="submit">Guardar actividad</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
