import { expect, it } from "vitest";
import { testProfiles as defaults } from "../test-profiles";
import {
  generateMenu,
  menuItems,
  shoppingList,
  menuRecipes,
} from "./weeklyMenu";
import { mealTotal } from "./formulas";
import { profileSchema } from "../schemas";
it("genera 28 comidas, ajusta porciones y conserva compras y nutrientes", () => {
  const p = {
    ...defaults[0],
    excluded: [],
    targets: {
      calories: 2200,
      protein: 115,
      carbs: 285,
      fat: 65,
      fiber: 30,
      water: 2500,
      steps: 4500,
    },
  };
  const menu = generateMenu(p, "2026-09-17");
  expect(menu.week).toBe("2026-09-14");
  expect(menu.meals).toHaveLength(28);
  expect(profileSchema.parse({ ...p, weeklyMenu: menu }).weeklyMenu).toEqual(
    menu,
  );
  for (let day = 0; day < 7; day++) {
    const meals = menu.meals.filter((m) => m.day === day);
    expect(new Set(meals.map((m) => m.slot)).size).toBe(4);
    const total = mealTotal(meals.flatMap((m) => menuItems(m.portions)));
    expect(total.calories).toBeGreaterThan(p.targets.calories * 0.9);
    expect(total.calories).toBeLessThan(p.targets.calories * 1.1);
    expect(total.protein).toBeGreaterThan(p.targets.protein * 0.85);
  }
  const shopping = shoppingList(menu);
  for (const item of shopping) {
    expect(item.grams).toBe(
      menu.meals.reduce((n, m) => n + (m.portions[item.key] ?? 0), 0),
    );
  }
  expect(mealTotal(menuItems(menu.meals[0].portions)).calories).toBeGreaterThan(
    0,
  );
  expect(
    menuItems(menu.meals[0].portions).every(
      (i) => i.nutritionReference?.source === "usda",
    ),
  ).toBe(true);
  const higher = generateMenu(
    { ...p, targets: { ...p.targets, calories: 2700 } },
    "2026-09-17",
  );
  expect(higher.meals.map((m) => m.recipe)).toEqual(
    menu.meals.map((m) => m.recipe),
  );
  expect(higher.meals[0].portions).not.toEqual(menu.meals[0].portions);
});
it("respeta exclusiones y rechaza un plan cuando no puede ofrecer platos compatibles", () => {
  const p = { ...defaults[0], excluded: ["pollo", "atun"] };
  const menu = generateMenu(p, "2026-09-17");
  expect(
    menu.meals.every(
      (m) =>
        !Object.keys(m.portions).some((k) => ["chicken", "tuna"].includes(k)),
    ),
  ).toBe(true);
  expect(() =>
    generateMenu({ ...p, excluded: ["lacteos", "huevo"] }, "2026-09-17"),
  ).toThrow();
  for (const m of menu.meals) {
    const recipe = menuRecipes.find((r) => r.id === m.recipe)!;
    for (const [key, , min, max] of recipe.ingredients) {
      expect(m.portions[key] ?? 0).toBeGreaterThanOrEqual(min);
      expect(m.portions[key] ?? 0).toBeLessThanOrEqual(max);
    }
  }
});
