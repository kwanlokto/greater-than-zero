import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useTheme } from 'expo-router';
import { BottomTabBar, Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, View, type ColorValue } from 'react-native';

import { WorkoutBar } from '@/components/workout-bar';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

// The Workout bar sits just above the tabs, so it shows on every tab.
function TabBarWithWorkout(props: BottomTabBarProps) {
  return (
    <View>
      <WorkoutBar />
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <TabBarWithWorkout {...props} />}
      screenOptions={{ headerRight: () => <SettingsButton /> }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('today-outline') }} />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: tabIcon('calendar-outline') }}
      />
      <Tabs.Screen
        name="food"
        options={{ title: 'Food', tabBarIcon: tabIcon('restaurant-outline') }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: tabIcon('trending-up-outline') }}
      />
    </Tabs>
  );
}

function SettingsButton() {
  const { colors } = useTheme();

  return (
    <Link href="/settings" asChild>
      <Pressable accessibilityLabel="Settings" hitSlop={12} style={{ marginRight: 16 }}>
        <Ionicons name="settings-outline" size={24} color={colors.text} />
      </Pressable>
    </Link>
  );
}
