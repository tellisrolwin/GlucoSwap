import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native'; // Import StyleSheet

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: { // Merge existing styles with display: 'none'
           display: 'none', // Add this line to hide the tab bar
           ...(Platform.OS === 'ios' ? styles.iosTabBar : {}), // Keep existing platform-specific styles if needed
        },
      }}>
      {/* You don't need to define Tabs.Screen here if using file-based routing */}
      {/* <Tabs.Screen name="index" options={{ title: 'Converter' }} /> */}
    </Tabs>
  );
}

// Keep existing styles if they were separate
const styles = StyleSheet.create({
 iosTabBar: {
    position: 'absolute',
    // Add other iOS specific styles if you had them
 }
});
