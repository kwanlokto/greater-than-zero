import { FoodForm } from '@/components/food-form';
import {
  problemWithSavedFood,
  type FoodValues,
  type SavedFood,
  type SavedFoodValues,
} from '@/core/tracker';

type Props = {
  // The Saved food being changed; a new one starts blank.
  initial: SavedFood | undefined;
  submitLabel: string;
  onSubmit: (values: SavedFoodValues) => Promise<void>;
};

// A Saved food's name, its Serving, and the macros of one Serving.
export function SavedFoodForm({ initial, submitLabel, onSubmit }: Props) {
  return (
    <FoodForm
      initial={initial && valuesOf(initial)}
      amountLabel="Serving"
      amountHint="The calories and macros below are for this much, e.g. 100 g."
      problemOf={values => problemWithSavedFood(savedFoodValuesOf(values))}
      submitLabel={submitLabel}
      onSubmit={values => onSubmit(savedFoodValuesOf(values))}
    />
  );
}

// Its calories show only when they were typed.
function valuesOf(food: SavedFood): FoodValues {
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

function savedFoodValuesOf({ amount, unit, ...values }: FoodValues): SavedFoodValues {
  return { ...values, servingAmount: amount, servingUnit: unit };
}
