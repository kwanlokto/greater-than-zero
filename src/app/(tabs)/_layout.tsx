import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { BottomTabBar, Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { WorkoutBar } from '@/components/workout-bar';
import { space, useAppTheme } from '@/theme';

// Filled while its tab is open, outlined otherwise, so the open tab stands
// out by more than its colour.
function tabIcon(name: IconName, focusedName: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} color={color} size={24} />
  );
}

// The Workout bar sits just above the tabs, so it shows on every tab.
function TabBarWithWorkout(props: BottomTabBarProps) {
  const { colors } = useAppTheme();

  return (
    <View style={{ backgroundColor: colors.background }}>
      <WorkoutBar />
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={props => <TabBarWithWorkout {...props} />}
      screenOptions={{
        headerRight: () => <SettingsButton />,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: 26, fontWeight: '700', color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: space.xs,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: tabIcon('today-outline', 'today') }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: tabIcon('calendar-outline', 'calendar') }}
      />
      <Tabs.Screen
        name="food"
        options={{ title: 'Food', tabBarIcon: tabIcon('restaurant-outline', 'restaurant') }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: tabIcon('stats-chart-outline', 'stats-chart') }}
      />
    </Tabs>
  );
}

function SettingsButton() {
  const router = useRouter();

  return (
    <IconButton
      icon="settings-outline"
      label="Settings"
      // navigate, not push, so a double tap can't open Settings twice.
      onPress={() => router.navigate('/settings')}
      style={{ marginRight: space.sm }}
    />
  );
}
