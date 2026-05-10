import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useColors } from "@/hooks/useColors";
import UserAvatar from "@/components/UserAvatar";
import { Chat, BrawUser } from "@/types";
import { Timestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

interface ChatListItemProps {
  chat: Chat;
  otherUser?: BrawUser;
  onPress: () => void;
}

function formatTime(ts: Timestamp | null): string {
  if (!ts) return "";
  const date = ts.toDate();
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 604800000) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

export default function ChatListItem({ chat, otherUser, onPress }: ChatListItemProps) {
  const colors = useColors();

  const displayName = chat.isGroup
    ? chat.name || "Grup"
    : otherUser?.username || "Kullanıcı";

  const photoURL = chat.isGroup ? chat.photoURL : otherUser?.photoURL;
  const isOnline = !chat.isGroup && otherUser?.isOnline;
  const hasBlueTick = !chat.isGroup && otherUser?.hasBlueTick;

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <UserAvatar
        photoURL={photoURL}
        username={displayName}
        size={52}
        isOnline={isOnline}
        hasBlueTick={hasBlueTick}
        showOnline
      />
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {chat.isGroup && (
              <Ionicons name="people" size={14} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {formatTime(chat.lastMessageTime)}
          </Text>
        </View>
        <Text style={[styles.lastMessage, { color: colors.mutedForeground }]} numberOfLines={1}>
          {chat.lastMessage || "Henüz mesaj yok"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  time: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  lastMessage: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
});
