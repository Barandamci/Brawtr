import React from "react";
import { View, Text, StyleSheet, Image, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface UserAvatarProps {
  photoURL?: string;
  username?: string;
  size?: number;
  isOnline?: boolean;
  hasBlueTick?: boolean;
  showOnline?: boolean;
}

export default function UserAvatar({
  photoURL,
  username,
  size = 46,
  isOnline = false,
  hasBlueTick = false,
  showOnline = false,
}: UserAvatarProps) {
  const colors = useColors();
  const initial = (username?.[0] ?? "?").toUpperCase();
  const dotSize = Math.round(size * 0.28);

  return (
    <View style={{ width: size, height: size }}>
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.muted }]}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          <Text style={[styles.initial, { fontSize: size * 0.4, color: colors.primaryForeground }]}>
            {initial}
          </Text>
        </View>
      )}
      {hasBlueTick && (
        <View style={[styles.blueTick, { right: -2, bottom: -2 }]}>
          <Ionicons name="checkmark-circle" size={dotSize + 4} color="#1D9BF0" />
        </View>
      )}
      {showOnline && isOnline && !hasBlueTick && (
        <View
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: colors.online,
              right: 0,
              bottom: 0,
              borderColor: colors.background,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  initial: {
    fontFamily: "Inter_600SemiBold",
  },
  onlineDot: {
    position: "absolute",
    borderWidth: 2,
  },
  blueTick: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});
