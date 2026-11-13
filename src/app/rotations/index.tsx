import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';
import { describeTemplateOrder } from '@/rotation-labels';
import { radius, space, useAppTheme } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

export default function RotationsScreen() {
  const router = useRouter();
  const rotations = useTrackerQuery(() => tracker.getRotations(), []);

  return (
    <Screen fab={<Fab label="New rotation" onPress={() => router.push('/rotations/new')} />}>
      {rotations && rotations.length === 0 && (
        <EmptyState
          icon="repeat"
          title="No rotations yet"
          message="A rotation runs your templates in turn, e.g. Push → Pull → Legs, so Today knows what's next."
        />
      )}
      {rotations && rotations.length > 0 && (
        <>
          <AppText tone="muted">The active rotation decides what's next up on Today.</AppText>
          <ListGroup>
            {rotations.map(rotation => (
              <ListRow
                key={rotation.id}
                title={rotation.name}
                subtitle={describeTemplateOrder(rotation)}
                trailing={rotation.isActive ? <ActiveBadge /> : undefined}
                onPress={() =>
                  router.push({ pathname: '/rotations/[id]', params: { id: rotation.id } })
                }
              />
            ))}
          </ListGroup>
        </>
      )}
    </Screen>
  );
}

function ActiveBadge() {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
      <AppText variant="label" style={{ color: colors.onPrimarySoft }}>
        Active
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
});
