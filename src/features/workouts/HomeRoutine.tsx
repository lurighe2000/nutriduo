import { useState } from "react";
import { useApp } from "../../app/context";
import { db } from "../../db";
import { homePlan } from "../../services/workouts";
import { Button, Modal, Confirm } from "../../components/ui";
export default function HomeRoutine({ onClose }: { onClose: () => void }) {
  const { profile: p, data, repo, run } = useApp();
  const [plan] = useState(() => homePlan(p)),
    [confirm, setConfirm] = useState(false);
  return (
    <Modal title="Rutina en casa y salidas diarias" onClose={onClose}>
      <p>
        Primeras dos semanas: dos sesiones de fuerza separadas por al menos un
        día. Calentá 5 minutos con marcha y movimientos suaves; hacé las
        repeticiones con control, dejando unas 3 en reserva. Descansá 90–180
        segundos entre series.
      </p>
      {plan.days.map((day) => (
        <section className="card" key={day.id}>
          <h3>{day.name}</h3>
          {day.exercises.map((ex) => (
            <p key={ex.id}>
              {ex.name} · {ex.sets} × {ex.minReps}–{ex.maxReps}
            </p>
          ))}
        </section>
      ))}
      <p>
        Empezá con apoyos estables y sin carga, salvo una mochila liviana para
        el remo. En el registro, 0 kg significa sin peso externo. Si completás
        el rango con buena técnica, aumentá primero repeticiones y luego una
        pequeña carga. Detenete ante dolor.
      </p>
      <h3>Salir de casa todos los días</h3>
      <div className="card">
        <p>
          Lunes, miércoles y sábado: caminá 5 minutos, alterná 1 minuto de trote
          suave y 90 segundos de caminata hasta 8 veces, y terminá caminando 5
          minutos. Reducí las repeticiones si todavía resulta exigente.
        </p>
        <p>
          Martes, jueves, viernes y domingo: caminata cómoda de 20–30 minutos.
          Martes y viernes podés sumar fuerza A y B en otro momento.
        </p>
        <p>
          La salida diaria se mantiene; el impacto del trote aumenta de a poco.
          Buscá un ritmo que permita conversar. Si jugás pádel o necesitás
          recuperarte, reemplazá el trote por caminata suave. No uses pesas en
          los tobillos para correr.
        </p>
      </div>
      <p className="muted small">
        La barra del marco de puerta no es necesaria para esta rutina. Sólo
        usala cuando puedas verificar la instalación, la carga admitida y la
        técnica.
      </p>
      <p className="muted small">
        <a
          href="https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/"
          target="_blank"
          rel="noreferrer"
        >
          Referencia de progresión inicial de trote · NHS
        </a>{" "}
        ·{" "}
        <a
          href="https://www.nhs.uk/live-well/exercise/strength-exercises/"
          target="_blank"
          rel="noreferrer"
        >
          Ejercicios de fuerza · NHS
        </a>
      </p>
      <Button onClick={() => setConfirm(true)}>
        Usar esta rutina de dos días
      </Button>
      {confirm && (
        <Confirm
          title="Cambiar rutina activa"
          onClose={() => setConfirm(false)}
          onConfirm={() =>
            void run(async () => {
              await db.transaction(
                "rw",
                db.profiles,
                db.table("plans"),
                async () => {
                  for (const old of data.plans)
                    await repo.remove("plans", old.id);
                  await repo.save("plans", plan);
                  await db.profiles.update(p.id, { gymDays: 2 });
                },
              );
              setConfirm(false);
              onClose();
            }, "Rutina en casa activada")
          }
        >
          Se reemplaza la rutina activa de {p.name} y se fijan dos días de
          fuerza. Las sesiones anteriores se conservan.
        </Confirm>
      )}
    </Modal>
  );
}
