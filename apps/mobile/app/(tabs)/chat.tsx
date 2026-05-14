import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCartStore } from '../../store/cartStore';
import { parseOrder } from '../../lib/api';
import { OrderAction, MenuItem, ConversationTurn } from '@bistro/shared';
import { MENU_ITEMS } from '../../constants/menu';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  { label: 'Build me a spicy meal', emoji: '🔥' },
  { label: 'Meal under $20', emoji: '💸' },
  { label: "What's popular?", emoji: '⭐' },
  { label: 'Vegetarian options', emoji: '🥗' },
  { label: 'Add a drink', emoji: '🥤' },
  { label: 'Add fries', emoji: '🍟' },
];

function extractSuggestedItem(text: string): MenuItem | null {
  const matches = MENU_ITEMS.filter((item) =>
    text.toLowerCase().includes(item.name.toLowerCase())
  );
  return matches.length === 1 ? matches[0] : null;
}

const CONFIRM_RE =
  /\b(yes|yeah|yep|sure|ok|okay|perfect|sounds\s+good|go\s+for\s+it)\b|add\s+(that|it|one)|i'?ll\s+(take|have|get)\s+(it|one|that)|let\s+me\s+(have|get|try)\s+(one\s+of\s+that|one|it|that)|throw\s+it\s+in|give\s+me\s+(that|one)|i\s+want\s+(that|it)|put\s+it\s+in/i;

const QTY_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function resolveMessage(text: string, lastItem: MenuItem | null): string {
  if (!lastItem) return text;
  const lower = text.toLowerCase().trim();
  const countMatch = lower.match(/\b(\w+)\s+of\s+(?:those|them|it|that)\b/i);
  if (countMatch) {
    const word = countMatch[1].toLowerCase();
    const qty = QTY_WORDS[word] ?? parseInt(word, 10);
    if (qty > 0 && !isNaN(qty)) return `Add ${qty} ${lastItem.name}`;
  }
  return text;
}

function applyActions(actions: OrderAction[], store: ReturnType<typeof useCartStore.getState>) {
  for (const action of actions) {
    switch (action.type) {
      case 'ADD_ITEM': {
        const item = MENU_ITEMS.find((m) => m.id === action.itemId);
        if (item) store.addItem(item, action.quantity, action.modifiers);
        break;
      }
      case 'REMOVE_ITEM':
        store.removeItem(action.itemId);
        break;
      case 'DECREMENT_ITEM':
        store.decrementItem(action.itemId, action.quantity);
        break;
      case 'UPDATE_QUANTITY':
        store.updateQuantity(action.itemId, action.quantity);
        break;
      case 'CLEAR_CART':
        store.clearCart();
        break;
    }
  }
}

// ─── Animated typing indicator ────────────────────────────────────────────────

function TypingIndicator() {
  const dots = [0, 1, 2].map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    const stagger = 180;
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * stagger),
          Animated.timing(dot, {
            toValue: 1,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 250,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(500 - i * stagger),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View className="mb-4 flex-row justify-start">
      <View
        className="w-8 h-8 rounded-full items-center justify-center mr-2.5 mt-1 shrink-0"
        style={{ backgroundColor: 'rgba(6,182,212,0.15)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)' }}
      >
        <Text style={{ fontSize: 15 }}>🤖</Text>
      </View>
      <View
        style={{ paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, borderTopLeftRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', height: 14 }}>
          {dots.map((dot, i) => (
            <Animated.View
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: '#06b6d4',
                opacity: 0.85,
                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -6],
                    }),
                  },
                ],
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Cart nudge ───────────────────────────────────────────────────────────────

function CartNudge({ message, onPress }: { message: string; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      >
        <View
          className="mx-4 mb-2 rounded-2xl px-4 py-3 flex-row items-center justify-between"
          style={{
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 1,
            borderColor: 'rgba(6, 182, 212, 0.3)',
          }}
        >
          <Text className="text-white/90 text-sm font-medium">
            🛒 {message}
          </Text>
          <View className="flex-row items-center" style={{ gap: 3 }}>
            <Text className="text-bistro-400 text-sm font-semibold">View Cart</Text>
            <Text className="text-bistro-400 text-sm">›</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View className={`mb-3 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-2.5 mt-0.5 shrink-0"
          style={{
            backgroundColor: 'rgba(6,182,212,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(6,182,212,0.3)',
          }}
        >
          <Text style={{ fontSize: 15 }}>🤖</Text>
        </View>
      )}
      <View
        className={`max-w-[78%] rounded-2xl px-4 py-3 ${
          isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'
        }`}
        style={
          isUser
            ? { backgroundColor: '#06b6d4' }
            : {
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }
        }
      >
        <Text
          className="text-sm leading-[21px]"
          style={{ color: isUser ? '#fff' : 'rgba(255,255,255,0.92)' }}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hey! I'm your Bistro AI. Tell me what you'd like to order, ask about the menu, or let me suggest something delicious. 🍔",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [lastItem, setLastItem] = useState<MenuItem | null>(null);
  const [cartNudge, setCartNudge] = useState<string | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList>(null);

  const cartItems = useCartStore((s) => s.items);
  const store = useCartStore.getState;

  useEffect(() => {
    return () => {
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    };
  }, []);

  const showCartNudge = useCallback((text: string) => {
    setCartNudge(text);
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setCartNudge(null), 4000);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setInput('');
      setShowSuggestions(false);
      if (cartNudge) setCartNudge(null);

      const conversationHistory: ConversationTurn[] = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-18)
        .map((m) => ({ role: m.role, text: m.text }));

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      if (CONFIRM_RE.test(trimmed) && lastItem) {
        const item = lastItem;
        setLastItem(null);
        store().addItem(item, 1, []);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: `Added ${item.name} to your cart! 🛒`,
            timestamp: new Date(),
          },
        ]);
        showCartNudge(`${item.name} added`);
        return;
      }

      setLoading(true);

      try {
        const resolvedText = resolveMessage(trimmed, lastItem);
        const result = await parseOrder(resolvedText, cartItems, conversationHistory);
        applyActions(result.actions, store());

        setLastItem(extractSuggestedItem(result.assistantMessage));

        const addedActions = result.actions.filter((a) => a.type === 'ADD_ITEM');
        if (addedActions.length > 0) {
          const totalQty = addedActions.reduce(
            (sum, a) => sum + ((a as any).quantity ?? 1),
            0
          );
          showCartNudge(
            totalQty === 1 ? `1 item added to cart` : `${totalQty} items added to cart`
          );
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: result.assistantMessage,
            timestamp: new Date(),
          },
        ]);
      } catch {
        setLastItem(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: "Sorry, I'm having trouble connecting. Please check that the server is running and try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, cartItems, store, lastItem, messages, cartNudge, showCartNudge]
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#09090b' }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View
          className="px-4 pt-2 pb-3"
          style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
        >
          <Text className="text-white text-2xl font-bold tracking-tight">AI Order</Text>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={loading ? <TypingIndicator /> : null}
        />

        {/* Cart nudge */}
        {cartNudge && (
          <CartNudge
            message={cartNudge}
            onPress={() => {
              setCartNudge(null);
              if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
              router.push('/(tabs)/cart');
            }}
          />
        )}

        {/* Suggested prompts */}
        {showSuggestions && (
          <View className="pb-2">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {SUGGESTED_PROMPTS.map((p) => (
                <TouchableOpacity
                  key={p.label}
                  onPress={() => send(`${p.emoji} ${p.label}`)}
                  className="flex-row items-center rounded-full px-3.5 py-2"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.13)',
                    gap: 5,
                  }}
                  activeOpacity={0.65}
                >
                  <Text style={{ fontSize: 14 }}>{p.emoji}</Text>
                  <Text className="text-white/75 text-xs font-medium">{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input bar */}
        <View className="px-4 pb-4 pt-2">
          <View
            className="flex-row items-end rounded-2xl px-4 py-3"
            style={{
              backgroundColor: 'rgba(255,255,255,0.07)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.13)',
              gap: 10,
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message your Bistro AI..."
              placeholderTextColor="rgba(255,255,255,0.28)"
              className="flex-1 text-white"
              style={{ fontSize: 14, lineHeight: 20, maxHeight: 100 }}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              submitBehavior="newline"
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => send(input)}
              disabled={loading || input.trim().length === 0}
              className="w-9 h-9 rounded-xl items-center justify-center"
              style={{
                backgroundColor:
                  loading || input.trim().length === 0 ? 'rgba(255,255,255,0.08)' : '#06b6d4',
              }}
              activeOpacity={0.8}
            >
              {loading ? (
                <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>…</Text>
              ) : (
                <Text
                  className="text-white font-bold"
                  style={{ fontSize: 18, lineHeight: 22, marginBottom: 1 }}
                >
                  ↑
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
