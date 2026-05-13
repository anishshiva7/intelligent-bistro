import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useCartStore } from '../../store/cartStore';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View className="items-center justify-center pt-1">
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text
        className={`text-xs mt-0.5 font-medium ${
          focused ? 'text-bistro-500' : 'text-gray-400'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

function CartTabIcon({ focused }: { focused: boolean }) {
  const itemCount = useCartStore((s) => s.itemCount());
  return (
    <View className="items-center justify-center pt-1">
      <View>
        <Text style={{ fontSize: 22 }}>🛒</Text>
        {itemCount > 0 && (
          <View className="absolute -top-1 -right-2 bg-bistro-500 rounded-full w-4 h-4 items-center justify-center">
            <Text className="text-white text-xs font-bold" style={{ fontSize: 10 }}>
              {itemCount > 9 ? '9+' : itemCount}
            </Text>
          </View>
        )}
      </View>
      <Text
        className={`text-xs mt-0.5 font-medium ${
          focused ? 'text-bistro-500' : 'text-gray-400'
        }`}
      >
        Cart
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a0a00',
          borderTopColor: '#3d1f00',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 8,
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
