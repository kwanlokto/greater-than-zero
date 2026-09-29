import type { FoodFields } from '@/components/food-form';
import type { FoodItem, FoodItemValues, SavedFood, SavedFoodValues } from '@/core/tracker';

// A Food item in the food form, its amount being how much was eaten. Calories
// show only when they were typed.
export function fieldsOfFoodItem(item: FoodItem): FoodFields {
  const { name, quantity, unit, typedCalories, protein, carbs, fat } = item;
  return { name, amount: quantity, unit, calories: typedCalories, protein, carbs, fat };
}

export function foodItemValuesOf({ amount, ...fields }: FoodFields): FoodItemValues {
  return { ...fields, quantity: amount };
}

// A Saved food in the food form, its amount being its Serving.
export function fieldsOfSavedFood(food: SavedFood): FoodFields {
  const { name, servingAmount, servingUnit, typedCalories, protein, carbs, fat } = food;
  return {
    name,
    amount: servingAmount,
    unit: servingUnit,
    calories: typedCalories,
    protein,
    carbs,
    fat,
  };
}

export function savedFoodValuesOf({ amount, unit, ...fields }: FoodFields): SavedFoodValues {
  return { ...fields, servingAmount: amount, servingUnit: unit };
}
