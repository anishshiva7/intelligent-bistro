import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../../store/cartStore';
import { parseOrder } from '../../lib/api';
import { OrderAction } from '@bistro/shared';
import { MENU_ITEMS } from '../../constants/menu';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "Add two spicy chicken sandwiches 🌶️",
  "Build me a meal under $20",
  "What's most popular?",
  "Remove fries",
  "Clear my cart",
];

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
      case 'UPDATE_QUANTITY':
        store.updateQuantity(action.itemId, action.quantity);
        break;
      case 'CLEAR_CART':
        store.clearCart();
        break;
    }
  }
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View className={`mb-3 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <View className="w-8 h-8 rounded-full bg-bistro-500/20 border border-bistro-500/40 items-center justify-center mr-2 mt-1 shrink-0">
          <Text style={{ fontSize: 16 }}>🤖</Text>
        </View>
      )}
      <View
        className={`max-w-[78%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-bistro-500 rounded-tr-sm'
            : 'bg-white/10 border border-white/10 rounded-tl-sm'
        }`}
      >
        <Text className={`text-sm leading-5 ${isUser ? 'text-white' : 'text-white/90'}`}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View className="mb-3 flex-row justify-start">
      <View className="w-8 h-8 rounded-full bg-bistro-500/20 border border-bistro-500/40 items-center justify-center mr-2 mt-1">
        <Text style={{ fontSize: 16 }}>🤖</Text>
      </View>
      <View className="bg-white/10 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
        <View className="flex-row gap-1 items-center">
          <View className="w-2 h-2 rounded-full bg-white/50" />
          <View className="w-2 h-2 rounded-full bg-white/30" />
          <View className="w-2 h-2 rounded-full bg-white/20" />
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
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
  const listRef = useRef<FlatList>(null);

  const cartItems = useCartStore((s) => s.items);
  const store = useCartStore.getState;

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setInput('');
      setShowSuggestions(false);
      setLoading(true);

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const result = await parseOrder(trimmed, cartItems);
        applyActions(result.actions, store());

        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: result.assistantMessage,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: "Sorry, I'm having trouble connecting. Please check that the server is running and try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [loading, cartItems, store]
  );

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-3 border-b border-white/5">
          <Text className="text-white text-2xl font-bold">AI Order</Text>
          <Text className="text-bistro-400 text-xs">Powered by Claude</Text>
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

        {/* Suggested prompts */}
        {showSuggestions && (
          <View className="pb-2">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {SUGGESTED_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  onPress={() => send(prompt)}
                  className="bg-white/8 border border-white/15 rounded-full px-4 py-2"
                  activeOpacity={0.7}
                >
                  <Text className="text-white/80 text-xs font-medium">{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input bar */}
        <View className="px-4 pb-4 pt-2">
          <View className="flex-row items-end bg-white/8 border border-white/15 rounded-2xl px-4 py-3 gap-3">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message your Bistro AI..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              className="flex-1 text-white text-sm"
              style={{ fontSize: 14, maxHeight: 100 }}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              submitBehavior="newline"
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => send(input)}
              disabled={loading || input.trim().length === 0}
              className={`w-9 h-9 rounded-xl items-center justify-center ${
                loading || input.trim().length === 0
                  ? 'bg-white/10'
                  : 'bg-bistro-500'
              }`}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
              ) : (
                <Text className="text-white font-bold" style={{ fontSize: 16, lineHeight: 20 }}>↑</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
