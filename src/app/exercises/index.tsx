import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack, useRouter, useTheme } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ExerciseBrowser, ExerciseRow } from '@/components/exercise-browser';

export default function ExerciseLibraryScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <AddExerciseButton /> }} />
      <ExerciseBrowser
        renderExercise={exercise =>
          // Custom Exercises open for editing; built-in ones can't be changed.
          exercise.isCustom ? (
            <ExerciseRow
              exercise={exercise}
              icon="chevron-forward"
              onPress={() =>
                router.push({ pathname: '/exercises/[id]', params: { id: exercise.id } })
              }
            />
          ) : (
            <ExerciseRow exercise={exercise} />
          )
        }
      />
    </>
  );
}

function AddExerciseButton() {
  const { colors } = useTheme();

  return (
    <Link href="/exercises/new" asChild>
      <Pressable accessibilityLabel="Add exercise" hitSlop={12} style={styles.addButton}>
        <Ionicons name="add" size={28} color={colors.text} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  addButton: {
    marginRight: 8,
  },
});
