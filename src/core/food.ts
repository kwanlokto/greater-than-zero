import { and, asc, desc, eq, lt, sql, type SQL } from 'drizzle-orm';

import { localDateOf } from './local-dates';
import { notDeleted, positionAfterLast, softDelete, stillThere } from './records';
import { foodItems, meals, savedFoods } from './schema';
import type { TrackerDatabase } from './tracker';

// Meals and the Food items they're made of.

// Calories, and the grams of each macro.
export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

// How much to eat in a day: calories, and grams of each macro. Null for one
// the lifter hasn't set.
export type MacroTargets = Record<Macro, number | null>;

// Calories or one of the macros.
export type Macro = keyof Macros;

// Why these Macro targets can't be set, or undefined when they can: each is
// left blank or a number above 0. setMacroTargets enforces it; screens use it
// to decide when to allow saving.
export function problemWithMacroTargets(targets: MacroTargets): string | undefined {
  const chosen = Object.values(targets).filter(target => target !== null);
  if (chosen.every(target => Number.isFinite(target) && target > 0)) return undefined;
  return 'Macro targets must be numbers above 0, or left blank';
}

export function requireValidMacroTargets(targets: MacroTargets): MacroTargets {
  const problem = problemWithMacroTargets(targets);
  if (problem) throw new Error(problem);
  const { calories, protein, carbs, fat } = targets;
  return { calories, protein, carbs, fat };
}

// What the lifter enters for a Food item. Calories are left null to work them
// out from the macros.
export type FoodItemValues = {
  name: string;
  quantity: number;
  unit: string;
  calories: number | null;
  protein: number;
  carbs: number;
  fat: number;
};

// A food in a Meal, keeping its own name, amount and macros.
export type FoodItem = Macros & {
  id: string;
  name: string;
  // How much, in `unit` (e.g. 150 g, 1 scoop).
  quantity: number;
  unit: string;
  // As typed, or null when `calories` is worked out from the macros.
  typedCalories: number | null;
  // The Saved food it was added from, if any. Only a record of where it came
  // from: its own copies of the name and macros are what count.
  savedFoodId: string | null;
};

// What the lifter enters for a Saved food: a Serving, such as 100 g or 1
// scoop, and its macros. Calories are left null to work them out from the
// macros.
export type SavedFoodValues = {
  name: string;
  servingAmount: number;
  servingUnit: string;
  calories: number | null;
  protein: number;
  carbs: number;
  fat: number;
};

// A food kept to add to Meals again. Its macros are for one Serving.
export type SavedFood = Macros & {
  id: string;
  name: string;
  servingAmount: number;
  servingUnit: string;
  // As typed, or null when `calories` is worked out from the macros.
  typedCalories: number | null;
};

// Something eaten at one time, made of Food items.
export type Meal = {
  id: string;
  // The phone's local calendar date it was added on, as YYYY-MM-DD.
  localDate: string;
  eatenAt: Date;
  name: string;
  // In the order they were added.
  items: FoodItem[];
  // Its Food items' added up.
  totals: Macros;
};

// A time on a clock, e.g. 7:15 as { hours: 7, minutes: 15 }.
export type TimeOfDay = {
  hours: number;
  minutes: number;
};

// A new Meal's name, from the time of day it's added. Always editable.
export function defaultMealName(time: Date): string {
  const hour = time.getHours();
  if (hour >= 4 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 15) return 'Lunch';
  if (hour >= 17 && hour < 22) return 'Dinner';
  return 'Snack';
}

export function requireMealName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('A Meal needs a name');
  return name;
}

// The moment `time` comes on a YYYY-MM-DD local date, so a Meal moved to
// another time stays on its day.
export function timeOnDay(localDate: string, { hours, minutes }: TimeOfDay): Date {
  const isWhole = (value: number, below: number) =>
    Number.isInteger(value) && value >= 0 && value < below;
  if (!isWhole(hours, 24) || !isWhole(minutes, 60)) {
    throw new Error('A time of day is 0–23 hours and 0–59 minutes');
  }
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

// Calories from the macros: 4 kcal per gram of protein and of carbs, 9 per
// gram of fat.
export function caloriesFromMacros({ protein, carbs, fat }: Omit<Macros, 'calories'>): number {
  return 4 * protein + 4 * carbs + 9 * fat;
}

// Several Food items' macros added up.
export function totalsOf(items: Macros[]): Macros {
  return items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// How a kind of food is named when saying what's wrong with it, e.g. "A Saved
// food" needs "a serving amount".
type FoodNouns = { subject: string; amountNoun: string; unitNoun: string };

// A Food item or a Saved food: a name, an amount in a unit, and the macros of
// that much. For a Food item the amount is how much was eaten; for a Saved
// food it's the Serving its macros are for. Null calories are worked out from
// the macros.
export type FoodValues = {
  name: string;
  amount: number;
  unit: string;
  calories: number | null;
  protein: number;
  carbs: number;
  fat: number;
};

// The rule Food items and Saved foods share: a name, an amount above 0 in a
// unit, and calories (when typed) and macros of 0 or more.
function problemWithFood(nouns: FoodNouns, food: FoodValues): string | undefined {
  const { subject, amountNoun, unitNoun } = nouns;
  const { name, amount, unit, calories, protein, carbs, fat } = food;
  if (!name.trim()) return `${subject} needs a name`;
  if (!Number.isFinite(amount) || amount <= 0) return `${subject} needs ${amountNoun} above 0`;
  if (!unit.trim()) return `${subject} needs ${unitNoun}, like g or scoop`;
  const amounts = calories === null ? [protein, carbs, fat] : [calories, protein, carbs, fat];
  if (!amounts.every(value => Number.isFinite(value) && value >= 0)) {
    return `${subject}'s calories and macros must be numbers, 0 or more`;
  }
  return undefined;
}

// Why a Food item can't be saved with these values, or undefined when it can.
// The Food item commands enforce it; screens use it to decide when to allow
// saving.
export function problemWithFoodItem(values: FoodItemValues): string | undefined {
  const nouns = { subject: 'A Food item', amountNoun: 'a quantity', unitNoun: 'a unit' };
  return problemWithFood(nouns, { ...values, amount: values.quantity });
}

// The same for a Saved food, whose amount is its Serving.
export function problemWithSavedFood(values: SavedFoodValues): string | undefined {
  const nouns = {
    subject: 'A Saved food',
    amountNoun: 'a serving amount',
    unitNoun: 'a serving unit',
  };
  return problemWithFood(nouns, {
    ...values,
    amount: values.servingAmount,
    unit: values.servingUnit,
  });
}

// The values to save: checked against problemWithFoodItem, with the name and
// unit trimmed. Only these, so a whole Food item passed in can't change which
// row it is or the Saved food it's linked to.
export function requireValidFoodItem(values: FoodItemValues): FoodItemValues {
  const problem = problemWithFoodItem(values);
  if (problem) throw new Error(problem);
  const { name, quantity, unit, calories, protein, carbs, fat } = values;
  return { name: name.trim(), quantity, unit: unit.trim(), calories, protein, carbs, fat };
}

// The values to save: checked against problemWithSavedFood, with the name and
// serving unit trimmed. Only these, as for a Food item.
export function requireValidSavedFood(values: SavedFoodValues): SavedFoodValues {
  const problem = problemWithSavedFood(values);
  if (problem) throw new Error(problem);
  const { name, servingAmount, servingUnit, calories, protein, carbs, fat } = values;
  return {
    name: name.trim(),
    servingAmount,
    servingUnit: servingUnit.trim(),
    calories,
    protein,
    carbs,
    fat,
  };
}

// A Food item or Saved food as read back: its calories as typed, or worked
// out from its macros when none were, so they follow any change to them.
export function withCaloriesWorkedOut<
  Row extends Omit<Macros, 'calories'> & { calories: number | null },
>({ calories, ...row }: Row): Omit<Row, 'calories'> & Pick<FoodItem, 'calories' | 'typedCalories'> {
  return { ...row, typedCalories: calories, calories: calories ?? caloriesFromMacros(row) };
}

// The macros of `quantity` of a Saved food, in its Serving unit: its macros ×
// quantity ÷ serving amount. There's no converting between units.
export function portionOf(savedFood: SavedFood, quantity: number): Macros {
  const servings = quantity / savedFood.servingAmount;
  return {
    calories: savedFood.calories * servings,
    protein: savedFood.protein * servings,
    carbs: savedFood.carbs * servings,
    fat: savedFood.fat * servings,
  };
}

// A Food item of `quantity` of a Saved food, in its Serving unit: its own copy
// of the name, and the macros of that portion (see portionOf). Calories left
// blank on the Saved food stay blank, to be worked out from the portion's
// macros, which comes to the same.
export function foodItemFromSavedFood(savedFood: SavedFood, quantity: number): FoodItemValues {
  const { calories, ...macros } = portionOf(savedFood, quantity);
  return {
    name: savedFood.name,
    quantity,
    unit: savedFood.servingUnit,
    calories: savedFood.typedCalories === null ? null : calories,
    ...macros,
  };
}

// Why `quantity` of a Saved food can't be added to a Meal, or undefined when
// it can: the Food item rule, for the copy it would add. addSavedFoodToMeal
// enforces it; screens use it to decide when to allow adding.
export function problemWithPortion(savedFood: SavedFood, quantity: number): string | undefined {
  return problemWithFoodItem(foodItemFromSavedFood(savedFood, quantity));
}

// A day's calories or one macro against its target: how much was eaten, the
// target, and how much of it is left, below 0 once it's gone over. The target
// and what's left are null with no target set.
export type MacroProgress = {
  eaten: number;
  target: number | null;
  left: number | null;
};

// What was eaten in a day against the Macro targets.
export type DailyTotals = Record<Macro, MacroProgress>;

// A day's Meals added up and compared with the Macro targets.
export function dailyTotalsOf(meals: Meal[], targets: MacroTargets): DailyTotals {
  const eaten = totalsOf(meals.map(meal => meal.totals));
  const progressOf = (macro: Macro): MacroProgress => {
    const target = targets[macro];
    return { eaten: eaten[macro], target, left: target === null ? null : target - eaten[macro] };
  };
  return {
    calories: progressOf('calories'),
    protein: progressOf('protein'),
    carbs: progressOf('carbs'),
    fat: progressOf('fat'),
  };
}

// Meals go in order by date, then by when they were eaten; latestMealFirst is
// the other way round. Meals added at the same moment go in the order added.
const mealOrder = [asc(meals.localDate), asc(meals.eatenAt), asc(meals.createdAt)];

const latestMealFirst = [desc(meals.localDate), desc(meals.eatenAt), desc(meals.createdAt)];

// A Saved food's columns, for selecting one.
const savedFoodColumns = {
  id: savedFoods.id,
  name: savedFoods.name,
  servingAmount: savedFoods.servingAmount,
  servingUnit: savedFoods.servingUnit,
  calories: savedFoods.calories,
  protein: savedFoods.protein,
  carbs: savedFoods.carbs,
  fat: savedFoods.fat,
};

type FoodDependencies = {
  db: TrackerDatabase;
  now: () => Date;
  getMacroTargets: () => Promise<MacroTargets>;
};

export function createFood({ db, now, getMacroTargets }: FoodDependencies) {
  // The Meals matching `where`, in the order they were eaten, or the latest
  // first, up to `limit`, each with its Food items in the order they were
  // added. Deleted ones are left out.
  async function findMeals(
    where: SQL | undefined,
    { latestFirst = false, limit }: { latestFirst?: boolean; limit?: number } = {},
  ): Promise<Meal[]> {
    const found = await db.query.meals.findMany({
      where: and(where, notDeleted(meals)),
      orderBy: latestFirst ? latestMealFirst : mealOrder,
      limit,
      columns: { id: true, localDate: true, eatenAt: true, name: true },
      with: {
        items: {
          where: notDeleted(foodItems),
          orderBy: asc(foodItems.position),
          columns: {
            id: true,
            name: true,
            quantity: true,
            unit: true,
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
            savedFoodId: true,
          },
        },
      },
    });
    return found.map(({ items, ...meal }) => {
      const foodItems = items.map(withCaloriesWorkedOut);
      return { ...meal, items: foodItems, totals: totalsOf(foodItems) };
    });
  }

  // Adds a Food item, already checked, after the Meal's others, as part of a
  // larger transaction.
  function insertFoodItem(
    tx: TrackerDatabase,
    mealId: string,
    values: FoodItemValues,
    savedFoodId: string | null = null,
  ): { id: string } {
    const meal = tx.select({ id: meals.id }).from(meals).where(stillThere(meals, mealId)).get();
    if (!meal) throw new Error('No such Meal');
    const position = positionAfterLast(
      tx,
      foodItems,
      foodItems.position,
      eq(foodItems.mealId, mealId),
    );
    return tx
      .insert(foodItems)
      .values({ mealId, position, ...values, savedFoodId })
      .returning({ id: foodItems.id })
      .get();
  }

  // The Saved foods matching `where`, by name. Deleted ones are left out.
  async function findSavedFoods(where: SQL | undefined): Promise<SavedFood[]> {
    const found = await db
      .select(savedFoodColumns)
      .from(savedFoods)
      .where(and(where, notDeleted(savedFoods)))
      .orderBy(sql`${savedFoods.name} COLLATE NOCASE`);
    return found.map(withCaloriesWorkedOut);
  }

  // The Meals added on a local date, as YYYY-MM-DD, in the order eaten.
  function mealsOn(localDate: string): Promise<Meal[]> {
    return findMeals(eq(meals.localDate, localDate));
  }

  const commands = {
    // A new Meal eaten now, on today's date, named for the time of day.
    async createMeal(): Promise<{ id: string }> {
      const eatenAt = now();
      return db
        .insert(meals)
        .values({ localDate: localDateOf(eatenAt), eatenAt, name: defaultMealName(eatenAt) })
        .returning({ id: meals.id })
        .get();
    },

    async renameMeal(id: string, name: string): Promise<void> {
      const renamed = await db
        .update(meals)
        .set({ name: requireMealName(name) })
        .where(stillThere(meals, id))
        .returning({ id: meals.id });
      if (renamed.length === 0) throw new Error('No such Meal');
    },

    // Moves the Meal to another time on the day it's recorded on, which
    // doesn't change.
    async setMealTime(id: string, time: TimeOfDay): Promise<void> {
      db.transaction(tx => {
        const meal = tx
          .select({ localDate: meals.localDate })
          .from(meals)
          .where(stillThere(meals, id))
          .get();
        if (!meal) throw new Error('No such Meal');
        tx.update(meals)
          .set({ eatenAt: timeOnDay(meal.localDate, time) })
          .where(eq(meals.id, id))
          .run();
      });
    },

    // A new Meal eaten now, on today's date, with the Meal's name and a copy
    // of each of its Food items as logged: the same amounts and macros (typed
    // calories kept, blank ones still worked out), and the same Saved food
    // links, so the copy counts as using them again.
    async copyMeal(id: string): Promise<{ id: string }> {
      const eatenAt = now();
      return db.transaction(tx => {
        const meal = tx.select({ name: meals.name }).from(meals).where(stillThere(meals, id)).get();
        if (!meal) throw new Error('No such Meal');
        const items = tx
          .select({
            name: foodItems.name,
            quantity: foodItems.quantity,
            unit: foodItems.unit,
            calories: foodItems.calories,
            protein: foodItems.protein,
            carbs: foodItems.carbs,
            fat: foodItems.fat,
            savedFoodId: foodItems.savedFoodId,
          })
          .from(foodItems)
          .where(and(eq(foodItems.mealId, id), notDeleted(foodItems)))
          .orderBy(asc(foodItems.position))
          .all();
        const copy = tx
          .insert(meals)
          .values({ localDate: localDateOf(eatenAt), eatenAt, name: meal.name })
          .returning({ id: meals.id })
          .get();
        for (const { savedFoodId, ...values } of items) {
          insertFoodItem(tx, copy.id, values, savedFoodId);
        }
        return copy;
      });
    },

    // Soft-deletes the Meal with its Food items, together.
    async deleteMeal(id: string): Promise<void> {
      db.transaction(tx => {
        const deleted = softDelete(tx, meals, eq(meals.id, id), now());
        if (deleted.length === 0) throw new Error('No such Meal');
      });
    },

    // Adds a Food item after the Meal's others. Enforces problemWithFoodItem.
    async addFoodItem(mealId: string, values: FoodItemValues): Promise<{ id: string }> {
      const checked = requireValidFoodItem(values);
      // Checked and added together, so the Meal can't be deleted in between.
      return db.transaction(tx => insertFoodItem(tx, mealId, checked));
    },

    // Adds `quantity` of a Saved food, in its Serving unit, after the Meal's
    // other Food items: a copy of it with its macros scaled to match (see
    // foodItemFromSavedFood), linked to it. Enforces problemWithPortion.
    async addSavedFoodToMeal(
      mealId: string,
      savedFoodId: string,
      quantity: number,
    ): Promise<{ id: string }> {
      // Looked up first: the copy stands on its own, so the Saved food being
      // deleted meanwhile leaves a Food item linked to a deleted one, which
      // is how every Food item ends up once its Saved food is deleted.
      const [savedFood] = await findSavedFoods(eq(savedFoods.id, savedFoodId));
      if (!savedFood) throw new Error('No such Saved food');
      const values = requireValidFoodItem(foodItemFromSavedFood(savedFood, quantity));
      return db.transaction(tx => insertFoodItem(tx, mealId, values, savedFood.id));
    },

    // Enforces problemWithFoodItem. Null calories work them out from the
    // macros again.
    async editFoodItem(foodItemId: string, values: FoodItemValues): Promise<void> {
      const changed = await db
        .update(foodItems)
        .set(requireValidFoodItem(values))
        .where(stillThere(foodItems, foodItemId))
        .returning({ id: foodItems.id });
      if (changed.length === 0) throw new Error('No such Food item');
    },

    // Soft delete: the others keep their positions, so their order holds.
    async deleteFoodItem(foodItemId: string): Promise<void> {
      const deleted = softDelete(db, foodItems, eq(foodItems.id, foodItemId), now());
      if (deleted.length === 0) throw new Error('No such Food item');
    },

    // The Meals added on a local date, as YYYY-MM-DD, in the order eaten.
    getMeals(localDate: string): Promise<Meal[]> {
      return mealsOn(localDate);
    },

    // What was eaten on a local date, as YYYY-MM-DD, against the Macro targets.
    async getDailyTotals(localDate: string): Promise<DailyTotals> {
      return dailyTotalsOf(await mealsOn(localDate), await getMacroTargets());
    },

    // The latest Meals from before a local date, as YYYY-MM-DD, up to `limit`,
    // the most recent first: the ones to copy into today from.
    getMealsBefore(localDate: string, limit: number): Promise<Meal[]> {
      return findMeals(lt(meals.localDate, localDate), { latestFirst: true, limit });
    },

    async getMeal(id: string): Promise<Meal | undefined> {
      const [meal] = await findMeals(eq(meals.id, id));
      return meal;
    },

    // Enforces problemWithSavedFood.
    async createSavedFood(values: SavedFoodValues): Promise<{ id: string }> {
      return db
        .insert(savedFoods)
        .values(requireValidSavedFood(values))
        .returning({ id: savedFoods.id })
        .get();
    },

    // Enforces problemWithSavedFood. Food items added from it before keep the
    // macros they were logged with.
    async editSavedFood(id: string, values: SavedFoodValues): Promise<void> {
      const changed = await db
        .update(savedFoods)
        .set(requireValidSavedFood(values))
        .where(stillThere(savedFoods, id))
        .returning({ id: savedFoods.id });
      if (changed.length === 0) throw new Error('No such Saved food');
    },

    // Soft delete. Food items added from it keep their copies.
    async deleteSavedFood(id: string): Promise<void> {
      const deleted = softDelete(db, savedFoods, eq(savedFoods.id, id), now());
      if (deleted.length === 0) throw new Error('No such Saved food');
    },

    // Every Saved food, by name.
    getSavedFoods(): Promise<SavedFood[]> {
      return findSavedFoods(undefined);
    },

    // Every Saved food, those most recently added to a Meal first, for adding
    // food quickly; then those never added, or whose Food items were all
    // deleted, by name.
    async getSavedFoodsByRecentUse(): Promise<SavedFood[]> {
      // Its last Food item still logged: rowids go up as rows are added, rows
      // are only ever soft-deleted, and a Backup import puts them back in the
      // same order (see writeTables), so the highest is the latest. Null, for
      // one never used, sorts after every rowid.
      const lastUse = sql`max(${foodItems}.rowid)`;
      const found = await db
        .select(savedFoodColumns)
        .from(savedFoods)
        // Deleting a Meal deletes its Food items too.
        .leftJoin(foodItems, and(eq(foodItems.savedFoodId, savedFoods.id), notDeleted(foodItems)))
        .where(notDeleted(savedFoods))
        .groupBy(savedFoods.id)
        .orderBy(desc(lastUse), sql`${savedFoods.name} COLLATE NOCASE`);
      return found.map(withCaloriesWorkedOut);
    },

    async getSavedFood(id: string): Promise<SavedFood | undefined> {
      const [savedFood] = await findSavedFoods(eq(savedFoods.id, id));
      return savedFood;
    },
  };

  return { commands, mealsOn };
}
