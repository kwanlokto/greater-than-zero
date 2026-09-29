import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { FoodForm, type FoodFields } from '@/components/food-form';
import { TextButton } from '@/components/text-button';
import { problemWithSavedFood } from '@/core/tracker';
import { tracker } from '@/database';
import { fieldsOfSavedFood, savedFoodValuesOf } from '@/food-fields';
import { servingHint } from '@/food-labels';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// One Saved food, to change or delete. Meals it was added to keep the macros
// they were logged with either way.
export default function SavedFoodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  // Null once there's no such Saved food, e.g. after it's deleted.
  const savedFood = useTrackerQuery(async () => (await tracker.getSavedFood(id)) ?? null, [id]);

  if (savedFood === undefined) return null;
  if (savedFood === null) {
    return <Text style={[styles.message, { color: colors.text }]}>This food was deleted.</Text>;
  }

  async function save(fields: FoodFields) {
    const values = savedFoodValuesOf(fields);
    if (await runOrAlert("Couldn't save the food", () => tracker.editSavedFood(id, values))) {
      router.back();
    }
  }

  const confirmDelete = () => {
    Alert.alert(`Delete ${savedFood.name}?`, 'Meals it was added to keep it as it was logged.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await runOrAlert("Couldn't delete the food", () => tracker.deleteSavedFood(id))) {
            router.back();
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: savedFood.name }} />
      <FoodForm
        initial={fieldsOfSavedFood(savedFood)}
        amountLabel="Serving"
        amountHint={servingHint}
        problemOf={fields => problemWithSavedFood(savedFoodValuesOf(fields))}
        submitLabel="Save"
        onSubmit={save}
      />
      <TextButton label="Delete saved food" destructive onPress={confirmDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
