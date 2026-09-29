import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NameField } from '@/components/name-field';
import { PrimaryButton } from '@/components/primary-button';
import { TextButton } from '@/components/text-button';
import type { FoodItem, Meal } from '@/core/tracker';
import { tracker } from '@/database';
import { formatTimeOfDay } from '@/dates';
import { describeFoodItem, describeMacros } from '@/food-labels';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// One Meal: its name, when it was eaten, its Food items and their totals.
// Every change is saved as it's made.
export default function MealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  // Null once there's no such Meal, e.g. after it's deleted.
  const meal = useTrackerQuery(async () => (await tracker.getMeal(id)) ?? null, [id]);

  if (meal === undefined) return null;
  if (meal === null) {
    return <Text style={[styles.message, { color: colors.text }]}>This meal was deleted.</Text>;
  }

  const confirmDelete = () => {
    Alert.alert(`Delete ${meal.name}?`, 'Its food will be removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await runOrAlert("Couldn't delete the meal", () => tracker.deleteMeal(id))) {
            router.back();
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: meal.name }} />
      <NameField
        name={meal.name}
        accessibilityLabel="Meal name"
        failureTitle="Couldn't rename the meal"
        rename={name => tracker.renameMeal(id, name)}
      />
      <MealTime meal={meal} />
      <Text style={[styles.totals, { color: colors.text }]}>{describeMacros(meal.totals)}</Text>
      {meal.items.length === 0 ? (
        <Text style={[styles.message, { color: colors.text }]}>No food yet.</Text>
      ) : (
        meal.items.map(item => <FoodItemRow key={item.id} meal={meal} item={item} />)
      )}
      <PrimaryButton
        label="Add food"
        onPress={() => router.push({ pathname: '/meals/food-item', params: { mealId: id } })}
      />
      <TextButton label="Delete meal" destructive onPress={confirmDelete} />
    </ScrollView>
  );
}

// When the Meal was eaten; tapping it picks another time that day.
function MealTime({ meal }: { meal: Meal }) {
  const { colors } = useTheme();

  const pickTime = () => {
    DateTimePickerAndroid.open({
      value: meal.eatenAt,
      mode: 'time',
      onChange: (event, picked) => {
        if (event.type !== 'set' || !picked) return;
        const time = { hours: picked.getHours(), minutes: picked.getMinutes() };
        runOrAlert("Couldn't change the time", () => tracker.setMealTime(meal.id, time));
      },
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Picks another time"
      onPress={pickTime}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Text style={[styles.cardText, styles.itemName, { color: colors.text }]}>
        Eaten at {formatTimeOfDay(meal.eatenAt)}
      </Text>
      <Ionicons name="time-outline" size={20} color={colors.text} />
    </Pressable>
  );
}

// A Food item with its amount and macros; tapping it opens it for editing.
function FoodItemRow({ meal, item }: { meal: Meal; item: FoodItem }) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens this food for editing"
      onPress={() =>
        router.navigate({
          pathname: '/meals/food-item',
          params: { mealId: meal.id, foodItemId: item.id },
        })
      }
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.cardText}>
        <Text style={[styles.itemName, { color: colors.text }]}>{describeFoodItem(item)}</Text>
        <Text style={[styles.details, { color: colors.text }]}>{describeMacros(item)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  totals: {
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 16,
  },
  details: {
    fontSize: 14,
    opacity: 0.7,
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
