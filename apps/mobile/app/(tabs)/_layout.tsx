import { Tabs } from 'expo-router';
import { Text, View, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useCartStore } from '../../store/cartStore';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: focused ? -5 : 0,
      tension: 280,
      friction: 16,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  return (
    <Animated.View
      className="items-center justify-center pt-1"
      style={{ transform: [{ translateY }] }}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 11,
          marginTop: 3,
          fontWeight: focused ? '700' : '500',
          color: focused ? '#06b6d4' : '#6b7280',
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

function CartTabIcon({ focused }: { focused: boolean }) {
  const itemCount = useCartStore((s) => s.itemCount());
  const prevCount = useRef(itemCount);
  const badgeScale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (itemCount > prevCount.current) {
      Animated.sequence([
        Animated.spring(badgeScale, {
          toValue: 1.5,
          tension: 400,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.spring(badgeScale, {
          toValue: 1,
          tension: 300,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevCount.current = itemCount;
  }, [itemCount]);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: focused ? -5 : 0,
      tension: 280,
      friction: 16,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  return (
    <Animated.View
      className="items-center justify-center pt-1"
      style={{ transform: [{ translateY }] }}
    >
      <View>
        <Text style={{ fontSize: 22 }}>🛒</Text>
        {itemCount > 0 && (
          <Animated.View
            style={{
              position: 'absolute',
              top: -4,
              right: -8,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#06b6d4',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: badgeScale }],
            }}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
              {itemCount > 9 ? '9+' : itemCount}
            </Text>
          </Animated.View>
        )}
      </View>
      <Text
        style={{
          fontSize: 11,
          marginTop: 3,
          fontWeight: focused ? '700' : '500',
          color: focused ? '#06b6d4' : '#6b7280',
        }}
      >
        Cart
      </Text>
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#07070a',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: 82,
          paddingBottom: 10,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🍽️" label="Menu" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          tabBarIcon: ({ focused }) => <CartTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🤖" label="AI Order" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
