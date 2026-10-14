import { mealPhotos } from "../../services/photos";
import { MealPhotoGallery } from "./MealPhotos";
import { useState } from "react";
import { Plus, Copy, Star, Trash2, Pencil } from "lucide-react";
import { useApp } from "../../app/context";
import { useHistoryChoice } from "../../app/navigation";
import {
  Button,
  Empty,
  SectionTitle,
  Confirm,
  Modal,
} from "../../components/ui";
import { meta, db } from "../../db";
import {
  mealTotal,
  recipePortion,
  dailyTotals,
} from "../../nutrition/formulas";
import { rounded, shiftDate, niceDate } from "../../utils/date";
import { type Meal, type Recipe, type Food } from "../../schemas";
import { SOURCE_LABELS } from "../../nutrition/constants";
import MealEditor, { ItemFields } from "./MealEditor";
import Micronutrients from "../../components/Micronutrients";
import WeeklyMenu from "./WeeklyMenu";
export default function Meals() {
  const { data, profile: p, date, repo, run, addMeal } = useApp();
  const [tab, setTab] = useHistoryChoice<string>("meals.tab", "Hoy");
  const [editing, setEditing] = useState<Meal>(),
    [recipe, setRecipe] = useState<Recipe | null | undefined>(),
    [remove, setRemove] = useState<Meal>(),
    [food, setFood] = useState<Food>(),
    [duplicate, setDuplicate] = useState(false);
  const meals = data.meals
    .filter((m) => tab === "Recientes" || m.date === date)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const total = dailyTotals(data.meals, date);
  async function repeat(meal: Meal) {
    await run(
      () =>
        repo.save("meals", {
          ...meal,
          ...meta(p.id),
          date,
          time: new Date().toTimeString().slice(0, 5),
        }),
      "Comida repetida en el día seleccionado",
    );
  }
  return (
    <>
      <SectionTitle eyebrow="REGISTRO DIARIO" title="Comidas">
        <Button onClick={addMeal}>
          <Plus size={18} />
          Registrar comida
        </Button>
      </SectionTitle>
      <p className="page-subtitle">
        Guardá lo habitual. Disfrutá lo que comés.
      </p>
      <div className="tabs">
        {["Hoy", "Menú semanal", "Recientes", "Recetas", "Alimentos"].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      {["Hoy", "Recientes"].includes(tab) ? (
        <>
          <div className="summary-strip">
            <span>
              ≈ <strong>{rounded(total.calories)}</strong> kcal
            </span>
            <span>
              <strong>{rounded(total.protein)} g</strong> proteína
            </span>
            <span>
              <strong>{rounded(total.carbs)} g</strong> carbos
            </span>
            <span>
              <strong>{rounded(total.fat)} g</strong> grasas
            </span>
          </div>
          {tab === "Hoy" && meals.length > 0 && (
            <Micronutrients items={meals.flatMap((m) => m.items)} />
          )}
          {tab === "Hoy" && (
            <button className="text-button" onClick={() => setDuplicate(true)}>
              <Copy size={16} />
              Duplicar comidas de ayer
            </button>
          )}
          {!meals.length ? (
            <div className="card">
              <Empty
                title="Tu registro empieza con una comida"
                detail="Podés cargar una etiqueta, una receta casera o un análisis externo."
                action="Registrar mi primera comida"
                onAction={addMeal}
              />
            </div>
          ) : (
            <div className="record-grid">
              {meals.slice(0, 60).map((m) => (
                <article className="card meal-detail" key={m.id}>
                  <MealPhotoGallery photos={mealPhotos(m)} alt={m.name} />
                  <div className="card-heading">
                    <span className="eyebrow">
                      {m.type} · {m.time}
                    </span>
                    <span className="muted small">
                      {niceDate(m.date, true)}
                    </span>
                  </div>
                  <h2>{m.name}</h2>
                  <strong className="calorie-label">
                    ≈ {rounded(mealTotal(m.items).calories)} <small>kcal</small>
                  </strong>
                  <div className="ingredients-list">
                    {m.items.map((i) => (
                      <div key={i.id}>
                        <span>
                          {i.name}
                          <small>{SOURCE_LABELS[i.source]}</small>
                        </span>
                        <strong>{i.grams} g</strong>
                      </div>
                    ))}
                  </div>
                  <div className="actions">
                    <Button secondary onClick={() => setEditing(m)}>
                      <Pencil size={16} />
                      Editar gramos
                    </Button>
                    <Button secondary onClick={() => void repeat(m)}>
                      <Copy size={16} />
                      Repetir
                    </Button>
                    <button
                      className="icon-button danger"
                      aria-label={`Eliminar ${m.name}`}
                      onClick={() => setRemove(m)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <Micronutrients items={m.items} />
                </article>
              ))}
            </div>
          )}
        </>
      ) : tab === "Menú semanal" ? (
        <WeeklyMenu key={p.id} />
      ) : tab === "Recetas" ? (
        <>
          <Button secondary onClick={() => setRecipe(null)}>
            <Plus size={18} />
            Crear receta
          </Button>
          {!data.recipes.length ? (
            <Empty
              title="Tus clásicos, a un toque"
              detail="Sumá ingredientes, indicá las porciones y reutilizá tus recetas."
            />
          ) : (
            <div className="record-grid">
              {data.recipes.map((r) => (
                <article className="card" key={r.id}>
                  <h2>{r.name}</h2>
                  <p>
                    {r.servings} porciones · ≈{" "}
                    {rounded(recipePortion(r).calories)} kcal por porción
                  </p>
                  <div className="actions">
                    <Button secondary onClick={() => setRecipe(r)}>
                      Editar receta
                    </Button>
                    <Button
                      onClick={() => {
                        setEditing({
                          ...meta(p.id),
                          name: r.name,
                          date,
                          time: new Date().toTimeString().slice(0, 5),
                          type: "Almuerzo",
                          items: r.items.map((i) => ({
                            ...i,
                            id: crypto.randomUUID(),
                            grams: i.grams / r.servings,
                          })),
                          notes: "",
                        });
                      }}
                    >
                      Cargar 1 porción
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="muted">
            Biblioteca personal · todos los valores se pueden corregir.
          </p>
          {!data.foods.length ? (
            <Empty
              title="Una biblioteca que crece con vos"
              detail="Al registrar comidas podés guardar los alimentos para encontrarlos acá."
            />
          ) : (
            data.foods.map((f) => (
              <div className="card food-row" key={f.id}>
                <button
                  className="icon-button"
                  aria-label={`Favorito ${f.name}`}
                  onClick={() =>
                    void run(() =>
                      repo.save("foods", { ...f, favorite: !f.favorite }),
                    )
                  }
                >
                  <Star size={19} fill={f.favorite ? "currentColor" : "none"} />
                </button>
                <div>
                  <strong>{f.name}</strong>
                  <small>
                    {SOURCE_LABELS[f.source]} · {rounded(f.per100.calories)}{" "}
                    kcal / 100 {f.unit}
                  </small>
                </div>
                <Button secondary onClick={() => setFood(f)}>
                  Editar
                </Button>
              </div>
            ))
          )}
        </>
      )}
      {editing && (
        <MealEditor
          existing={
            data.meals.some((m) => m.id === editing.id) ? editing : undefined
          }
          recipe={
            !data.meals.some((m) => m.id === editing.id)
              ? {
                  ...meta(p.id),
                  name: editing.name,
                  servings: 1,
                  items: editing.items,
                }
              : undefined
          }
          onClose={() => setEditing(undefined)}
        />
      )}
      {recipe !== undefined && (
        <MealEditor
          recipeMode
          recipe={recipe ?? undefined}
          onClose={() => setRecipe(undefined)}
        />
      )}
      {remove && (
        <Confirm
          title="¿Eliminar esta comida?"
          onClose={() => setRemove(undefined)}
          onConfirm={() =>
            void run(async () => {
              await repo.remove("meals", remove.id);
              setRemove(undefined);
            }, "Comida eliminada")
          }
        >
          {remove.name}. Esta acción elimina el registro seleccionado.
        </Confirm>
      )}
      {duplicate && (
        <Confirm
          title="Repetir las comidas de ayer"
          onClose={() => setDuplicate(false)}
          onConfirm={() =>
            void run(async () => {
              const yesterday = data.meals.filter(
                (m) => m.date === shiftDate(date, -1),
              );
              await db.transaction("rw", db.table("meals"), async () => {
                for (const m of yesterday)
                  await repo.save("meals", { ...m, ...meta(p.id), date });
              });
              setDuplicate(false);
            }, "Comidas copiadas")
          }
        >
          Se agregarán{" "}
          {data.meals.filter((m) => m.date === shiftDate(date, -1)).length}{" "}
          comidas al día seleccionado, sin reemplazar las existentes.
        </Confirm>
      )}
      {food && (
        <Modal title="Editar alimento" onClose={() => setFood(undefined)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await repo.save("foods", food);
                setFood(undefined);
              }, "Alimento actualizado");
            }}
          >
            <ItemFields
              item={{
                id: food.id,
                name: food.name,
                grams: food.servingSize,
                per100: food.per100,
                source: food.source,
                cooking: "",
                micronutrientsPer100: food.micronutrientsPer100,
                nutritionReference: food.nutritionReference,
                fiberKnown: food.fiberKnown,
              }}
              onChange={(i) =>
                setFood({
                  ...food,
                  name: i.name,
                  servingSize: i.grams,
                  per100: i.per100,
                  source: i.source,
                  micronutrientsPer100: i.micronutrientsPer100,
                  nutritionReference: i.nutritionReference,
                  fiberKnown: i.fiberKnown,
                })
              }
              onRemove={() => setFood(undefined)}
            />
            <p className="muted small">
              Las comidas que ya registraste conservan sus valores originales.
            </p>
            <Button type="submit">Guardar alimento</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
