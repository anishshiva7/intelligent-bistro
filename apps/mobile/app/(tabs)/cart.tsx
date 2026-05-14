import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../../store/cartStore';
import { CartItem } from '@bistro/shared';

// ─── Place Order modal ────────────────────────────────────────────────────────

function SuccessView({ total, onDone }: { total: number; onDone: () => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const orderNumber = useRef(Math.floor(1000 + Math.random() * 9000)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity }} className="items-center px-6 py-10">
      <Animated.View
        style={{
          transform: [{ scale }],
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: '#22c55e',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 40, color: '#fff' }}>✓</Text>
      </Animated.View>

      <Text className="text-white text-2xl font-bold mb-2">Order Placed!</Text>
      <Text className="text-white/50 text-sm mb-1">Order #{orderNumber}</Text>
      <Text className="text-white/40 text-xs mb-8">Estimated time: 15–20 min</Text>

      <View className="w-full rounded-xl px-4 py-3 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
        <View className="flex-row justify-between">
          <Text className="text-white/60 text-sm">Total charged</Text>
          <Text className="text-white font-bold text-sm">${total.toFixed(2)}</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onDone}
        className="w-full rounded-2xl py-4 items-center"
        style={{ backgroundColor: '#06b6d4' }}
        activeOpacity={0.85}
      >
        <Text className="text-white font-bold text-base">Done</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function PlaceOrderModal({
  visible,
  items,
  subtotal,
  tax,
  total,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => setConfirmed(false), 400);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const handleConfirm = () => {
    setConfirmed(true);
    setTimeout(onConfirm, 1800);
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <View
          className="rounded-t-3xl"
          style={{ backgroundColor: '#09090b', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {/* Drag handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
          </View>

          {confirmed ? (
            <SuccessView total={total} onDone={onCancel} />
          ) : (
            <View className="px-5 pb-8 pt-2">
              <Text className="text-white text-xl font-bold mb-4">Review Order</Text>

              {items.map((ci) => (
                <View key={ci.menuItem.id} className="flex-row items-center mb-3">
                  <Text style={{ fontSize: 22, width: 30 }}>{ci.menuItem.imageEmoji}</Text>
                  <View className="flex-1 mx-3">
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                      {ci.menuItem.name}
                    </Text>
                    <Text className="text-white/40 text-xs">× {ci.quantity}</Text>
                  </View>
                  <Text className="text-white/80 text-sm font-medium">
                    ${(ci.menuItem.price * ci.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}

              <View className="mt-2 mb-5 rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-white/50 text-sm">Subtotal</Text>
                  <Text className="text-white/70 text-sm">${subtotal.toFixed(2)}</Text>
                </View>
                <View className="flex-row justify-between mb-3">
                  <Text className="text-white/50 text-sm">Tax (8.75%)</Text>
                  <Text className="text-white/70 text-sm">${tax.toFixed(2)}</Text>
                </View>
                <View className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
                <View className="flex-row justify-between mt-3">
                  <Text className="text-white font-bold text-base">Total</Text>
                  <Text className="font-bold text-base" style={{ color: '#06b6d4' }}>
                    ${total.toFixed(2)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleConfirm}
                className="rounded-2xl py-4 items-center mb-3"
                style={{ backgroundColor: '#06b6d4' }}
                activeOpacity={0.85}
              >
                <Text className="text-white font-bold text-base">
                  Place Order · ${total.toFixed(2)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onCancel} className="py-2.5 items-center">
                <Text className="text-white/40 text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Cart item row ────────────────────────────────────────────────────────────

function CartRow({ item }: { item: CartItem }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const decrement = () =>
    item.quantity === 1
      ? removeItem(item.menuItem.id)
      : updateQuantity(item.menuItem.id, item.quantity - 1);

  const increment = () => updateQuantity(item.menuItem.id, item.quantity + 1);

  return (
    <View
      className="mb-3 rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}
    >
      <View className="flex-row items-center p-3">
        {/* Emoji */}
        <View
          className="w-14 h-14 rounded-xl items-center justify-center mr-3 shrink-0"
          style={{ backgroundColor: '#ecfeff' }}
        >
          <Text style={{ fontSize: 30 }}>{item.menuItem.imageEmoji}</Text>
        </View>

        {/* Name + price */}
        <View className="flex-1 mr-2">
          <Text className="text-dark font-bold text-sm" numberOfLines={1}>
            {item.menuItem.name}
          </Text>
          <Text className="font-semibold text-sm mt-0.5" style={{ color: '#0891b2' }}>
            ${(item.menuItem.price * item.quantity).toFixed(2)}
          </Text>
          {item.quantity > 1 && (
            <Text className="text-gray-400 text-xs mt-0.5">
              ${item.menuItem.price.toFixed(2)} each
            </Text>
          )}
        </View>

        {/* Quantity stepper — uniform white throughout */}
        <View
          className="flex-row items-center rounded-xl overflow-hidden"
          style={{ borderWidth: 1.5, borderColor: '#a5f3fc' }}
        >
          <Pressable
            onPress={decrement}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? '#ecfeff' : '#fff',
            })}
          >
            <Text style={{ color: '#06b6d4', fontWeight: '700', fontSize: 18, lineHeight: 22 }}>
              {item.quantity === 1 ? '×' : '−'}
            </Text>
          </Pressable>
          <View
            className="items-center justify-center"
            style={{ width: 32, height: 36, backgroundColor: '#fff' }}
          >
            <Text className="text-dark font-bold text-sm">{item.quantity}</Text>
          </View>
          <Pressable
            onPress={increment}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? '#ecfeff' : '#fff',
            })}
          >
            <Text style={{ color: '#06b6d4', fontWeight: '700', fontSize: 18, lineHeight: 22 }}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CartScreen() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const tax = useCartStore((s) => s.tax());
  const total = useCartStore((s) => s.total());
  const clearCart = useCartStore((s) => s.clearCart);

  const [modalVisible, setModalVisible] = useState(false);
  const isEmpty = items.length === 0;
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#09090b' }}>
      {/* Header */}
      <View
        className="px-4 pt-2 pb-4 flex-row items-center justify-between"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
      >
        <View>
          <Text className="text-white text-2xl font-bold tracking-tight">Your Cart</Text>
          <Text className="text-bistro-400 text-xs mt-0.5">
            {isEmpty ? 'Nothing here yet' : `${itemCount} item${itemCount !== 1 ? 's' : ''}`}
          </Text>
        </View>
        {!isEmpty && (
          <TouchableOpacity
            onPress={clearCart}
            className="rounded-full px-3.5 py-1.5"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            activeOpacity={0.7}
          >
            <Text className="text-white/60 text-xs font-medium">Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center pb-20">
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-5"
            style={{ backgroundColor: 'rgba(6,182,212,0.1)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.2)' }}
          >
            <Text style={{ fontSize: 44 }}>🛒</Text>
          </View>
          <Text className="text-white text-xl font-bold mb-2">Cart is empty</Text>
          <Text className="text-white/40 text-sm text-center px-10 leading-5">
            Browse the menu or ask your AI assistant to build an order
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.menuItem.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <CartRow item={item} />}
          />

          {/* Order summary + CTA */}
          <View className="px-4 pb-4">
            <View
              className="rounded-2xl px-4 py-4 mb-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <Text className="text-white font-bold text-sm mb-3">Order Summary</Text>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-white/50 text-sm">Subtotal</Text>
                <Text className="text-white/80 text-sm font-medium">${subtotal.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between mb-3">
                <Text className="text-white/50 text-sm">Tax (8.75%)</Text>
                <Text className="text-white/80 text-sm font-medium">${tax.toFixed(2)}</Text>
              </View>
              <View className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <View className="flex-row justify-between mt-3">
                <Text className="text-white font-bold text-base">Total</Text>
                <Text className="font-bold text-base" style={{ color: '#06b6d4' }}>
                  ${total.toFixed(2)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              className="rounded-2xl py-4 items-center"
              style={{ backgroundColor: '#06b6d4' }}
              activeOpacity={0.85}
            >
              <Text className="text-white font-bold text-base">
                Place Order · ${total.toFixed(2)}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <PlaceOrderModal
        visible={modalVisible}
        items={items}
        subtotal={subtotal}
        tax={tax}
        total={total}
        onConfirm={() => clearCart()}
        onCancel={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}
