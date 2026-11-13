import { useRouter } from 'expo-router';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';
import { exerciseCount, exerciseList } from '@/template-labels';
import { useTrackerQuery } from '@/use-tracker-query';

export default function TemplatesScreen() {
  const router = useRouter();
  const templates = useTrackerQuery(() => tracker.getTemplates(), []);

  return (
    <Screen fab={<Fab label="New template" onPress={() => router.push('/templates/new')} />}>
      {templates && templates.length === 0 && (
        <EmptyState
          icon="list"
          title="No templates yet"
          message="A template is a workout you repeat, with a target for each exercise. Start one from Today with a tap."
        />
      )}
      {templates && templates.length > 0 && (
        <>
          <AppText tone="muted">Tap a template to change its exercises and targets.</AppText>
          <ListGroup>
            {templates.map(template => (
              <ListRow
                key={template.id}
                title={template.name}
                subtitle={`${exerciseCount(template.exercises.length)} · ${exerciseList(template)}`}
                onPress={() =>
                  router.push({ pathname: '/templates/[id]', params: { id: template.id } })
                }
              />
            ))}
          </ListGroup>
        </>
      )}
    </Screen>
  );
}
