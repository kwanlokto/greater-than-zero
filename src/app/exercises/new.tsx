import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ExerciseForm } from '@/components/exercise-form';
import { tracker } from '@/database';

export default function NewExerciseScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ExerciseForm
        initial={{}}
        submitLabel="Add exercise"
        onSubmit={async values => {
          await tracker.createExercise(values);
          router.back();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});
