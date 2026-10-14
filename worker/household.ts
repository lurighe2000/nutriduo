import {
  householdActionSchema,
  householdSchema,
  type Household,
} from "../src/services/householdContract";
import {
  allowedRecipes,
  generateMenuForGoals,
} from "../src/nutrition/weeklyMenu";
import type { VaultStore } from "./cloud";
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
function calculate(state: Household, week: string, keepDishes = true) {
  const { luca, ari } = state.members;
  if (!luca || !ari)
    throw new Error(
      "Falta que ambos activen Cuenta y respaldo para compartir menú y compras.",
    );
  const excluded = [...new Set([...luca.excluded, ...ari.excluded])];
  const previous =
    keepDishes && state.menus?.luca.week === week
      ? state.menus.luca.meals
      : undefined;
  const compatible = previous?.every((m) =>
    allowedRecipes(m.slot, excluded).some((r) => r.id === m.recipe),
  );
  const dishes = compatible ? previous : undefined;
  return {
    luca: generateMenuForGoals(luca.targets, excluded, week, dishes),
    ari: generateMenuForGoals(ari.targets, excluded, week, dishes),
  };
}
// Called only through the Worker after authentication against the caller's own vault.
export async function householdRoute(body: unknown, storage: VaultStore) {
  try {
    const input = householdActionSchema.parse(body);
    return await storage.transaction(async (tx) => {
      const state = householdSchema.parse(
        (await tx.get("household")) ?? {
          revision: 0,
          members: {},
          menus: null,
        },
      );
      if (input.action === "read") return response(state);
      if (input.action === "publish") {
        const current = state.members[input.profileId];
        if (current && current.sourceRevision > input.member.sourceRevision)
          return response(state);
        if (JSON.stringify(current) === JSON.stringify(input.member))
          return response(state);
        const samePreferences =
          current &&
          JSON.stringify({ ...current, sourceRevision: 0 }) ===
            JSON.stringify({ ...input.member, sourceRevision: 0 });
        state.members[input.profileId] = input.member;
        if (samePreferences) {
          await tx.put("household", state);
          return response(state);
        }
        if (state.menus && state.members.luca && state.members.ari)
          state.menus = calculate(state, state.menus.luca.week);
      } else {
        if (input.revision !== state.revision)
          return response(
            {
              error:
                "El menú cambió en el otro celular. Actualizá la vista y volvé a elegir.",
            },
            409,
          );
        if (input.action === "prepare")
          state.menus = calculate(state, input.week, false);
        else {
          if (!state.menus)
            throw new Error("Primero preparen el menú compartido.");
          const excluded = [
            ...(state.members.luca?.excluded ?? []),
            ...(state.members.ari?.excluded ?? []),
          ];
          if (
            !allowedRecipes(input.slot, excluded).some(
              (r) => r.id === input.recipe,
            )
          )
            throw new Error("Ese plato no respeta las preferencias de ambos.");
          for (const menu of [state.menus.luca, state.menus.ari])
            menu.meals = menu.meals.map((m) =>
              m.day === input.day && m.slot === input.slot
                ? { ...m, recipe: input.recipe }
                : m,
            );
          state.menus = calculate(state, state.menus.luca.week);
        }
      }
      state.revision++;
      await tx.put("household", householdSchema.parse(state));
      return response(state);
    });
  } catch (error) {
    return response(
      {
        error:
          error instanceof Error && !("issues" in error)
            ? error.message
            : "Datos del menú compartido inválidos.",
      },
      400,
    );
  }
}
