import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

const SUGGESTED_PROMPTS = [
  "I'm craving something spicy 🌶️",
  "What's your most popular item?",
  "Suggest a meal under $20",
  "I want a burger and fries",
  "What's vegetarian-friendly?",
];

export default function ChatScreen() {
  return (
    <SafeAreaView className="flex-1 bg-dark">
      <View className="px-4 pt-2 pb-4">
        <Text className="text-white text-2xl font-bold">AI Order</Text>
        <Text className="text-bistro-400 text-xs">Chat to order, ask questions, get recommendations</Text>
      </View>

      <View className="flex-1 items-center justify-center px-6 pb-20">
        <View className="w-24 h-24 bg-bistro-500/20 rounded-full items-center justify-center mb-4 border-2 border-bistro-500/40">
          <Text style={{ fontSize: 48 }}>🤖</Text>
        </View>
        <Text className="text-white text-xl font-bold text-center mb-2">
          Meet your AI Bistro Chef
        </Text>
        <Text className="text-white/50 text-sm text-center leading-5 mb-8">
          Tell me what you're in the mood for, ask about the menu, or let me suggest something delicious.
        </Text>

        {/* Coming soon chip */}
        <View className="bg-bistro-500/20 rounded-2xl px-5 py-3 border border-bistro-500/30 mb-6">
          <Text className="text-bistro-400 text-sm font-semibold text-center">
            🚧 AI ordering coming in Phase 3
          </Text>
        </View>

        {/* Suggested prompts preview */}
        <Text className="text-white/30 text-xs uppercase tracking-wider mb-3">Try asking...</Text>
        <View className="w-full gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <View
              key={prompt}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"
            >
              <Text className="text-white/60 text-sm">{prompt}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
