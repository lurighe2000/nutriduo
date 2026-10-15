import { useEffect, useState, useSyncExternalStore } from "react";
import { useApp } from "../../app/context";
import { db, meta } from "../../db";
import { profileSchema, type Meal } from "../../schemas";
import {
  allowedRecipes,
  fitPortions,
  generateMenu,
  groceryPackageSchema,
  menuFoods,
  menuItems,
  menuRecipes,
  monday,
  shoppingList,
  combinedShoppingList,
} from "../../nutrition/weeklyMenu";
import { mealTotal, targets } from "../../nutrition/formulas";
import { Button, Field, NumberField, Confirm } from "../../components/ui";
import { download } from "../../services/backup";
import { niceDate, shiftDate } from "../../utils/date";
import MealEditor from "./MealEditor";
import Micronutrients from "../../components/Micronutrients";
import ChoicePicker from "../../components/ChoicePicker";
import {
  cloudCredentials,
  currentHousehold,
  loadHousehold,
  prepareHouseholdMenu,
  replaceHouseholdDish,
  subscribeHousehold,
} from "../../services/cloudBackup";

const days = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
export default function WeeklyMenu() {
  const { profile: p, date, setDate, run, notify } = useApp();
  const [day, setDay] = useState(
    (new Date(date + "T12:00:00").getDay() + 6) % 7,
  );
  const [section, setSection] = useState("Platos"),
    [draft, setDraft] = useState<Meal>(),
    [regenerate, setRegenerate] = useState(false);
  const [extra, setExtra] = useState<Record<string, number>>({}),
    [cost, setCost] = useState(0),
    [busy, setBusy] = useState(false);
  const household = useSyncExternalStore(subscribeHousehold, currentHousehold);
  const [sharedError, setSharedError] = useState("");
  const connected = Boolean(cloudCredentials(p.id));
  const sharedMenus = connected ? household?.menus : undefined;
  const menu = sharedMenus?.[p.id] ?? p.weeklyMenu;
  const sharing = Boolean(sharedMenus);
  const bothReady = Boolean(household?.members.luca && household?.members.ari);
  const sharedExcluded = sharing
    ? [
        ...(household?.members.luca?.excluded ?? []),
        ...(household?.members.ari?.excluded ?? []),
      ]
    : p.excluded;
  useEffect(() => {
    if (!cloudCredentials(p.id)) return;
    const refresh = () => {
      if (!document.hidden && navigator.onLine)
        void loadHousehold(p.id).then(
          () => setSharedError(""),
          (error) =>
            setSharedError(
              error instanceof Error
                ? error.message
                : "No pudimos actualizar el menú compartido.",
            ),
        );
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [p.id]);
  const goal = p.targets ?? targets(p, p.initialWeight);
  const selected = menu?.meals.filter((m) => m.day === day) ?? [];
  const ingredients = selected.flatMap((m) => menuItems(m.portions));
  const totals = mealTotal(ingredients);
  async function build() {
    setBusy(true);
    await run(async () => {
      if (connected && bothReady) {
        await prepareHouseholdMenu(p.id, date);
        setRegenerate(false);
        return;
      }
      const current = await db.profiles.get(p.id);
      if (!current) throw new Error("Perfil no disponible");
      await db.profiles.put(
        profileSchema.parse({
          ...current,
          weeklyMenu: generateMenu(current, date),
        }),
      );
      setRegenerate(false);
    }, "Menú semanal preparado");
    setBusy(false);
  }
  const groceries = sharedMenus
    ? combinedShoppingList([sharedMenus.luca, sharedMenus.ari])
    : menu
      ? shoppingList(menu)
      : [];
  const combined = menuFoods
    .map((f) => ({
      ...f,
      grams:
        (groceries.find((g) => g.key === f.key)?.grams ?? 0) +
        (sharing ? 0 : (extra[f.key] ?? 0)),
    }))
    .filter((f) => f.grams > 0);
  const currentGoals =
    menu && JSON.stringify(menu.targets) === JSON.stringify(goal);
  return (
    <div className="weekly-menu">
      <div className="card">
        <span className="eyebrow">PLANIFICÁ TUS CUATRO COMIDAS</span>
        <h2>
          {sharing ? "Menú semanal compartido" : `Menú semanal de ${p.name}`}
        </h2>
        <p>
          {sharing
            ? `Los mismos platos para los dos. Acá ves las porciones de ${p.name}; la lista de compras suma a Luca y Ari.`
            : "Platos caseros y porciones para tu objetivo. Activando la cuenta de ambos podrán compartir platos y compras."}{" "}
          Sin consumir consultas de IA. Las cantidades y nutrientes son
          orientativos.
        </p>
        {!bothReady && (
          <p className="notice small">
            Para compartir el menú y una sola lista de compras, ambos tienen que
            activar Más → Cuenta y respaldo. Por ahora se muestra sólo este
            perfil.
          </p>
        )}
        {sharedError && (
          <p className="notice small">
            {sharedError} Se conserva la última copia disponible.
          </p>
        )}
        {menu && (
          <p>
            Semana del {niceDate(menu.week)} · objetivo usado:{" "}
            {menu.targets.calories} kcal y {menu.targets.protein} g de proteína
            por día.
          </p>
        )}
        {menu && (!currentGoals || menu.week !== monday(date)) && (
          <p className="notice">
            Este menú corresponde a otra semana o a objetivos anteriores. Generá
            la semana seleccionada para actualizarlo.
          </p>
        )}
        <Button
          disabled={busy}
          onClick={() => (menu ? setRegenerate(true) : void build())}
        >
          {busy
            ? "Preparando…"
            : menu
              ? "Generar de nuevo esta semana"
              : connected && bothReady
                ? "Preparar menú para ambos"
                : "Preparar mi menú semanal"}
        </Button>
      </div>
      {menu && (
        <>
          <div className="tabs">
            {["Platos", "Lista de compras"].map((s) => (
              <button
                key={s}
                className={section === s ? "active" : ""}
                onClick={() => setSection(s)}
              >
                {s}
              </button>
            ))}
          </div>
          {section === "Platos" ? (
            <>
              <div className="tabs compact">
                {days.map((d, i) => (
                  <button
                    key={d}
                    className={day === i ? "active" : ""}
                    onClick={() => setDay(i)}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="summary-strip">
                <span>
                  ≈ {Math.round(totals.calories)} kcal / {menu.targets.calories}
                </span>
                <span>
                  {Math.round(totals.protein)} g proteína /{" "}
                  {menu.targets.protein}
                </span>
                <span>{Math.round(totals.carbs)} g carbos</span>
                <span>{Math.round(totals.fat)} g grasas</span>
                <span>
                  Fibra con datos: {Math.round(totals.fiber)} g /{" "}
                  {menu.targets.fiber} g
                </span>
              </div>
              {(Math.abs(totals.calories - menu.targets.calories) >
                menu.targets.calories * 0.08 ||
                totals.protein < menu.targets.protein * 0.9) && (
                <p className="notice">
                  Este día se aleja de energía o proteína objetivo. Podés
                  cambiar platos o ajustar las cantidades al revisar; el
                  generador no garantiza cubrir todos los objetivos.
                </p>
              )}
              <p className="muted small">
                La comida planificada no suma al consumo. Pesá según el estado
                indicado; arroz y lentejas se pesan secos, carnes en crudo. No
                uses estos gramos como peso del plato ya cocido. Los nutrientes
                faltantes no equivalen a cero.
              </p>
              {totals.fiber < menu.targets.fiber && (
                <p className="notice small">
                  La fibra contabilizada está por debajo de tu objetivo; algunas
                  fichas no informan fibra. Revisá esos alimentos y las
                  etiquetas. El menú aproxima energía, proteína y grasas, y no
                  garantiza cubrir toda la fibra ni los micronutrientes.
                </p>
              )}
              <div className="record-grid">
                {selected.map((m) => {
                  const recipe = menuRecipes.find((r) => r.id === m.recipe);
                  if (!recipe) return null;
                  const items = menuItems(m.portions);
                  const t = mealTotal(items);
                  return (
                    <article className="card" key={m.slot}>
                      <span className="eyebrow">
                        {m.slot} · {niceDate(shiftDate(menu.week, day), true)}
                      </span>
                      <h3>{recipe.name}</h3>
                      {sharing && (
                        <p className="muted small">
                          Tu plato · {p.name}. La receta es la misma para ambos.
                        </p>
                      )}
                      <p>
                        ≈ {Math.round(t.calories)} kcal ·{" "}
                        {Math.round(t.protein)} g proteína
                      </p>
                      <ul>
                        {Object.entries(m.portions).map(([key, g]) => {
                          const f = menuFoods.find((f) => f.key === key)!;
                          return (
                            <li key={key}>
                              {f.name}: <strong>{g} g</strong> ({f.weighing})
                              {key === "egg"
                                ? ` · ≈ ${(g / 50).toFixed(1)} huevos, según tamaño`
                                : ""}
                            </li>
                          );
                        })}
                      </ul>
                      {sharedMenus && (
                        <details>
                          <summary>Cantidades para cocinar los dos</summary>
                          <ul>
                            {Object.keys(m.portions)
                              .concat(
                                Object.keys(
                                  sharedMenus[
                                    p.id === "luca" ? "ari" : "luca"
                                  ].meals.find(
                                    (x) => x.day === day && x.slot === m.slot,
                                  )?.portions ?? {},
                                ),
                              )
                              .filter(
                                (key, index, all) => all.indexOf(key) === index,
                              )
                              .map((key) => {
                                const other =
                                  sharedMenus[
                                    p.id === "luca" ? "ari" : "luca"
                                  ].meals.find(
                                    (x) => x.day === day && x.slot === m.slot,
                                  )?.portions[key] ?? 0;
                                const food = menuFoods.find(
                                  (f) => f.key === key,
                                )!;
                                return (
                                  <li key={key}>
                                    {food.name}:{" "}
                                    <strong>
                                      {(m.portions[key] ?? 0) + other} g en
                                      total
                                    </strong>{" "}
                                    ({food.weighing}). Tu parte:{" "}
                                    {m.portions[key] ?? 0} g.
                                  </li>
                                );
                              })}
                          </ul>
                          <p className="muted small">
                            Preparen la misma base y separen las porciones según
                            el peso crudo, seco o escurrido indicado. Pan,
                            fruta, lácteos y otros acompañamientos se sirven por
                            separado según cada plato.
                          </p>
                        </details>
                      )}
                      <details>
                        <summary>Cómo prepararlo y nutrientes</summary>
                        <p>{recipe.preparation}</p>
                        <Micronutrients items={items} />
                      </details>
                      <ChoicePicker
                        label={`Cambiar plato de ${m.slot}`}
                        value={m.recipe}
                        options={allowedRecipes(m.slot, sharedExcluded).map(
                          (r) => ({ value: r.id, label: r.name }),
                        )}
                        onChange={(recipeId) => {
                          const replacement = menuRecipes.find(
                            (r) => r.id === recipeId,
                          )!;
                          if (sharing) {
                            return run(
                              () =>
                                replaceHouseholdDish(
                                  p.id,
                                  day,
                                  m.slot,
                                  replacement.id,
                                ),
                              "Plato y compras de ambos actualizados",
                            );
                          }
                          return run(async () => {
                            const current = await db.profiles.get(p.id);
                            if (!current?.weeklyMenu)
                              throw new Error("Volvé a generar el menú");
                            const updated = {
                              ...current.weeklyMenu,
                              meals: current.weeklyMenu.meals.map((x) =>
                                x.day === day && x.slot === m.slot
                                  ? {
                                      ...x,
                                      recipe: replacement.id,
                                      portions: fitPortions(
                                        replacement,
                                        current.weeklyMenu!.targets,
                                        m.slot,
                                      ),
                                    }
                                  : x,
                              ),
                            };
                            await db.profiles.put(
                              profileSchema.parse({
                                ...current,
                                weeklyMenu: updated,
                              }),
                            );
                          }, "Plato y compras actualizados");
                        }}
                      />
                      <Button
                        secondary
                        onClick={() => {
                          setDate(shiftDate(menu.week, day));
                          setDraft({
                            ...meta(p.id),
                            date: shiftDate(menu.week, day),
                            time: {
                              Desayuno: "08:00",
                              Almuerzo: "13:00",
                              Merienda: "17:00",
                              Cena: "21:00",
                            }[m.slot],
                            name: recipe.name,
                            type: m.slot,
                            items: items.map((i) => ({
                              ...i,
                              id: crypto.randomUUID(),
                            })),
                            notes: `Del menú semanal. ${recipe.preparation}`,
                          });
                        }}
                      >
                        Revisar y registrar esta comida
                      </Button>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <section className="card">
              <h3>
                Compras para siete días
                {sharing
                  ? " · Luca y Ari"
                  : Object.keys(extra).length
                    ? " · lista combinada"
                    : ` · ${p.name}`}
              </h3>
              <p className="muted small">
                {sharing &&
                  "Esta es la misma lista en ambos celulares y suma las porciones de los dos. "}
                Totales de ingredientes según el menú, en peso comestible
                crudo/seco o escurrido. Comprá margen para cáscaras y descartes.
                Revisá lo que ya tenés. Las marcas y paquetes pueden variar.
              </p>
              {combined.map((f) => (
                <div className="history-row" key={f.key}>
                  <span>
                    {f.name}
                    <small> · {f.category}</small>
                  </span>
                  <strong>
                    {f.key === "egg"
                      ? `${Math.ceil(f.grams / 50)} huevos aprox.`
                      : `${f.grams >= 1000 ? (f.grams / 1000).toFixed(2) + " kg" : Math.ceil(f.grams) + " g"}`}
                  </strong>
                </div>
              ))}
              <div className="actions">
                <Button
                  secondary
                  onClick={() =>
                    download(
                      combined
                        .map((f) => `${f.name}: ${f.grams} g (${f.weighing})`)
                        .join("\n"),
                      `NutriDuo-compras-${menu.week}.txt`,
                      "text/plain;charset=utf-8",
                    )
                  }
                >
                  Descargar lista
                </Button>
                {!sharing && (
                  <Button
                    secondary
                    onClick={() =>
                      download(
                        JSON.stringify({
                          app: "NutriDuo-compras",
                          week: menu.week,
                          amounts: Object.fromEntries(
                            groceries.map((f) => [f.key, f.grams]),
                          ),
                        }),
                        `NutriDuo-compras-${p.id}.json`,
                        "application/json",
                      )
                    }
                  >
                    Compartir compras de este perfil
                  </Button>
                )}
              </div>
              {!sharing && (
                <>
                  <Field
                    label="Sumar archivo de compras del otro perfil"
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        void run(async () => {
                          if (file.size > 100000)
                            throw new Error("Archivo demasiado grande");
                          const pack = groceryPackageSchema.parse(
                            JSON.parse(await file.text()),
                          );
                          if (pack.week !== menu.week)
                            throw new Error(
                              "Las listas deben corresponder a la misma semana",
                            );
                          if (
                            Object.keys(pack.amounts).some(
                              (k) => !menuFoods.some((f) => f.key === k),
                            )
                          )
                            throw new Error("Alimento desconocido");
                          setExtra(pack.amounts);
                          notify(
                            "Compras sumadas. El archivo no contiene objetivos ni registros de salud.",
                          );
                        });
                    }}
                  />
                  {Object.keys(extra).length > 0 && (
                    <Button secondary onClick={() => setExtra({})}>
                      Quitar lista sumada
                    </Button>
                  )}
                  <p className="muted small">
                    Para sumar a los dos, exportá la lista desde cada perfil e
                    importá la otra aquí. Sólo se comparten cantidades de
                    alimentos. La lista combinada se mantiene mientras esta
                    pantalla esté abierta.
                  </p>
                </>
              )}
              <NumberField
                label={
                  sharing
                    ? "Costo estimado de la compra de ambos (ARS)"
                    : "Costo estimado de estas compras (ARS)"
                }
                max={10000000}
                value={cost}
                onChange={setCost}
              />
              <p>
                {sharing
                  ? "Estimación manual para la compra compartida. "
                  : p.weeklyBudget
                    ? `Presupuesto semanal de este perfil: $${p.weeklyBudget.toLocaleString("es-AR")}. `
                    : "Podés definir un presupuesto semanal en Más → Tu perfil y objetivos. "}
                {cost > 0
                  ? `Costo que ingresaste: $${cost.toLocaleString("es-AR")}.`
                  : "Sin precios cargados: no estimamos el costo ni garantizamos que alcance el presupuesto."}
              </p>
            </section>
          )}
        </>
      )}
      {draft && (
        <MealEditor
          existing={draft}
          planned
          onClose={() => setDraft(undefined)}
        />
      )}
      {regenerate && (
        <Confirm
          title="Reemplazar menú semanal"
          onClose={() => setRegenerate(false)}
          onConfirm={() => void build()}
        >
          {sharing
            ? "Se reemplaza el menú compartido de ambos, con las porciones de cada uno. "
            : "Se reemplaza el menú planificado con tus objetivos actuales. "}{" "}
          Las comidas que ya registraste se conservan.
        </Confirm>
      )}
    </div>
  );
}
