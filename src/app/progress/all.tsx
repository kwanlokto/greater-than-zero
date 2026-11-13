import { useRouter } from 'expo-router';

import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';
import { exerciseDetails } from '@/exercise-labels';
import { useTrackerQuery } from '@/use-tracker-query';

// Every Exercise there's progress to chart, the most recently done first: the
// whole list the Progress tab shows the start of.
export default function AllProgressExercisesScreen() {
  const router = useRouter();
  const exercises = useTrackerQuery(() => tracker.getProgressExercises(), []);

  return (
    <Screen>
      {exercises && (
        <ListGroup>
          {exercises.map(exercise => (
            <ListRow
              key={exercise.id}
              title={exercise.name}
              subtitle={exerciseDetails(exercise)}
              accessibilityHint="Opens its progress chart"
              // navigate, not push, so a double tap can't open it twice.
              onPress={() =>
                router.navigate({
                  pathname: '/progress/[exerciseId]',
                  params: { exerciseId: exercise.id },
                })
              }
            />
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}
