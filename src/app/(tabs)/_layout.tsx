import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useTheme } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, type ColorValue } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerRight: () => <SettingsButton /> }}>
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
