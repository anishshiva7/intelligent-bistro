import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { MenuItem } from '@bistro/shared';
import { useCartStore } from '../store/cartStore';

interface Props {
  item: MenuItem;
}

export function MenuItemCard({ item }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const cartEntry = cartItems.find((ci) => ci.menuItem.id === item.id);
  const qty = cartEntry?.quantity ?? 0;

  // Spring scale on press
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 20 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 20 }).start();

  // Badge pop when qty increases
  const badgeScale = useRef(new Animated.Value(1)).current;
  const prevQty = useRef(qty);
  useEffect(() => {
    if (qty > prevQty.current) {
      Animated.sequence([
        Animated.spring(badgeScale, { toValue: 1.35, useNativeDriver: true, tension: 400, friction: 8 }),
        Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 12 }),
      ]).start();
    }
    prevQty.current = qty;
  }, [qty]);

  return (
    <Animated.View
      className="mx-4 mb-3"
      style={{ transform: [{ scale }] }}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => qty === 0 && addItem(item)}
        style={{
          backgroundColor: '#fff',
          borderRadius: 20,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        }}
      >
        {/* Image area */}
        <View
          className="h-32 items-center justify-center relative"
          style={{ backgroundColor: '#ecfeff' }}
        >
          <Text style={{ fontSize: 62 }}>{item.imageEmoji}</Text>
          {item.popular && (
            <View
              className="absolute top-2.5 left-2.5 rounded-full px-2.5 py-0.5 flex-row items-center"
              style={{ backgroundColor: '#06b6d4', gap: 3 }}
            >
              <Text style={{ fontSize: 10 }}>⭐</Text>
              <Text className="text-white font-bold" style={{ fontSize: 10 }}>Popular</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View className="p-3.5">
          <View className="flex-row items-start justify-between mb-1">
            <Text className="text-dark font-bold text-base flex-1 mr-2" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="font-bold text-base" style={{ color: '#0891b2' }}>
              ${item.price.toFixed(2)}
            </Text>
          </View>

          <Text className="text-gray-400 text-xs mb-3 leading-[17px]" numberOfLines={2}>
            {item.description}
          </Text>

          {/* Tags */}
          <View className="flex-row flex-wrap mb-3" style={{ gap: 5 }}>
            {item.tags.slice(0, 3).map((tag) => (
              <View
                key={tag}
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#a5f3fc' }}
              >
                <Text style={{ color: '#0e7490', fontSize: 11 }} className="capitalize">
                  {tag.replace('-', ' ')}
                </Text>
              </View>
            ))}
          </View>

          {/* Cart controls */}
          {qty === 0 ? (
            <Pressable
              onPress={() => addItem(item)}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#0891b2' : '#06b6d4',
                borderRadius: 12,
                paddingVertical: 11,
                alignItems: 'center',
              })}
            >
              <Text className="text-white font-bold text-sm">Add to Cart</Text>
            </Pressable>
          ) : (
            // Uniform white stepper — no tinted center
            <View
              className="flex-row items-center justify-between rounded-xl overflow-hidden"
              style={{ borderWidth: 1.5, borderColor: '#a5f3fc' }}
            >
              <Pressable
                onPress={() =>
                  qty === 1 ? removeItem(item.id) : updateQuantity(item.id, qty - 1)
                }
                style={({ pressed }) => ({
                  width: 38,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? '#ecfeff' : '#fff',
                })}
              >
                <Text style={{ color: '#06b6d4', fontWeight: '700', fontSize: 18 }}>
                  {qty === 1 ? '×' : '−'}
                </Text>
              </Pressable>

              <Animated.View
                className="flex-1 items-center justify-center"
                style={{ backgroundColor: '#fff', height: 40, transform: [{ scale: badgeScale }] }}
              >
                <Text className="text-dark font-bold text-base">{qty}</Text>
              </Animated.View>

              <Pressable
                onPress={() => updateQuantity(item.id, qty + 1)}
                style={({ pressed }) => ({
                  width: 38,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? '#ecfeff' : '#fff',
                })}
              >
                <Text style={{ color: '#06b6d4', fontWeight: '700', fontSize: 18 }}>+</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
