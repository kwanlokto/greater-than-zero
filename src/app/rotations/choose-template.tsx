import { useLocalSearchParams, useRouter } from 'expo-router';

import { EmptyState } from '@/components/empty-state';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { canAddToRotation, type Template } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { exerciseCount } from '@/template-labels';
import { useTrackerQuery } from '@/use-tracker-query';

// Picks a Template to add to the end of a Rotation, from those it can take.
export default function ChooseRotationTemplateScreen() {
  const { rotationId } = useLocalSearchParams<{ rotationId: string }>();
  const router = useRouter();
  const templates = useTrackerQuery(async () => {
    const [all, rotation] = await Promise.all([
      tracker.getTemplates(),
      tracker.getRotation(rotationId),
    ]);
    return {
      hasTemplates: all.length > 0,
      addable: rotation ? all.filter(({ id }) => canAddToRotation(rotation, id)) : [],
    };
  }, [rotationId]);

  async function add(template: Template) {
    const added = await runOrAlert("Couldn't add the template", () =>
      tracker.addTemplateToRotation(rotationId, template.id),
    );
    if (added) router.back();
  }

  if (!templates) return null;

  return (
    <Screen>
      {templates.addable.length > 0 && (
        <ListGroup>
          {templates.addable.map(template => (
            <ListRow
              key={template.id}
              title={template.name}
              subtitle={exerciseCount(template.exercises.length)}
              accessibilityLabel={`Add ${template.name}`}
              trailingIcon="add-circle"
              trailingIconTone="primary"
              // Guarded by the row: a double tap adds it once.
              onPress={() => add(template)}
            />
          ))}
        </ListGroup>
      )}
      {templates.addable.length === 0 &&
        (templates.hasTemplates ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="Every template is already in this rotation."
          />
        ) : (
          <EmptyState
            icon="list"
            title="No templates yet"
            action={{
              label: 'Create one',
              icon: 'add',
              onPress: () => router.replace('/templates/new'),
            }}
          />
        ))}
    </Screen>
  );
}
