import { FoodForm } from '@/components/food-form';
import {
  problemWithFoodItem,
  type FoodItem,
  type FoodItemValues,
  type FoodValues,
} from '@/core/tracker';

type Props = {
  // The Food item being changed; a new one starts blank.
  initial: FoodItem | undefined;
  submitLabel: string;
  onSubmit: (values: FoodItemValues) => Promise<void>;
};

// A one-off Food item's name, amount eaten and macros.
export function FoodItemForm({ initial, submitLabel, onSubmit }: Props) {
  return (
    <FoodForm
      initial={initial && valuesOf(initial)}
      amountLabel="Amount"
      problemOf={values => problemWithFoodItem(foodItemValuesOf(values))}
      submitLabel={submitLabel}
      onSubmit={values => onSubmit(foodItemValuesOf(values))}
    />
  );
}

// Its calories show only when they were typed.
function valuesOf(item: FoodItem): FoodValues {
  const { name, quantity, unit, typedCalories, protein, carbs, fat } = item;
  return { name, amount: quantity, unit, calories: typedCalories, protein, carbs, fat };
}

function foodItemValuesOf({ amount, ...values }: FoodValues): FoodItemValues {
  return { ...values, quantity: amount };
}
