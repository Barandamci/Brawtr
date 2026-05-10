import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  arrayRemove,
  arrayUnion,
} from "firebase/firestore";
import { Feather, Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { Chat, BrawUser } from "@/types";
import UserAvatar from "@/components/UserAvatar";

export default function GroupSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();

  const [chat, setChat] = useState<Chat | null>(null);
  const [memberUsers, setMemberUsers] = useState<BrawUser[]>([]);
  const [loading, setLoading] = useState(true);

  const isGroupAdmin = chat?.admins?.includes(user?.uid ?? "") || chat?.createdBy === user?.uid;
  const isAdminOrOwner = profile?.role === "admin" || profile?.role === "owner";
  const canManage = isGroupAdmin || isAdminOrOwner;

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "chats", id), async (snap) => {
      if (!snap.exists()) return;
      const chatData = { id: snap.id, ...snap.data() } as Chat;
      setChat(chatData);
      setLoading(false);

      const users: BrawUser[] = [];
      for (const uid of chatData.members) {
        const s = await getDoc(doc(db, "users", uid));
        if (s.exists()) users.push(s.data() as BrawUser);
      }
      setMemberUsers(users);
    });
    return () => unsub();
  }, [id]);

  async function toggleRestricted() {
    if (!id || !canManage) return;
    await updateDoc(doc(db, "chats", id), { restrictedMode: !chat?.restrictedMode });
  }

  async function makeAdmin(uid: string) {
    if (!id || !isGroupAdmin) return;
    await updateDoc(doc(db, "chats", id), { admins: arrayUnion(uid) });
  }

  async function removeAdmin(uid: string) {
    if (!id || !isGroupAdmin || uid === chat?.createdBy) return;
    await updateDoc(doc(db, "chats", id), { admins: arrayRemove(uid) });
  }

  async function removeMember(uid: string) {
    if (!id || !canManage || uid === chat?.createdBy) return;
    Alert.alert("Üyeyi Çıkar", "Bu kişiyi gruptan çıkarmak istiyor musun?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkar",
        style: "destructive",
        onPress: async () => {
          await updateDoc(doc(db, "chats", id), { members: arrayRemove(uid) });
        },
      },
    ]);
  }

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Grup Ayarları</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.groupInfo}>
          <UserAvatar photoURL={chat?.photoURL} username={chat?.name || "G"} size={72} />
          <Text style={[styles.groupName, { color: colors.text }]}>{chat?.name || "Grup"}</Text>
          <Text style={[styles.memberCount, { color: colors.mutedForeground }]}>
            {memberUsers.length} üye
          </Text>
        </View>

        {canManage && (
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Kısıtlı Mod</Text>
            <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>
              Aktif olduğunda sadece yöneticiler mesaj atabilir.
            </Text>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: chat?.restrictedMode ? colors.primary : colors.mutedForeground }]}>
                {chat?.restrictedMode ? "Aktif" : "Pasif"}
              </Text>
              <Switch
                value={!!chat?.restrictedMode}
                onValueChange={toggleRestricted}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ÜYELER</Text>
        {memberUsers.map((m) => {
          const isAdmin = chat?.admins?.includes(m.uid) || chat?.createdBy === m.uid;
          const isCreator = chat?.createdBy === m.uid;
          return (
            <View key={m.uid} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => router.push(`/user/${m.uid}`)} style={styles.memberInfo}>
                <UserAvatar photoURL={m.photoURL} username={m.username} size={42} isOnline={m.isOnline} showOnline />
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={[styles.memberName, { color: colors.text }]}>@{m.username}</Text>
                    {m.hasBlueTick && <Ionicons name="checkmark-circle" size={14} color="#1D9BF0" />}
                  </View>
                  {isAdmin && (
                    <Text style={[styles.adminLabel, { color: colors.primary }]}>
                      {isCreator ? "Kurucu" : "Yönetici"}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              {canManage && m.uid !== user?.uid && (
                <View style={styles.memberActions}>
                  {isGroupAdmin && !isCreator && (
                    <TouchableOpacity
                      onPress={() => isAdmin ? removeAdmin(m.uid) : makeAdmin(m.uid)}
                      style={[styles.actionPill, { backgroundColor: isAdmin ? colors.muted : colors.primary + "22" }]}
                    >
                      <Feather name="shield" size={12} color={isAdmin ? colors.mutedForeground : colors.primary} />
                    </TouchableOpacity>
                  )}
                  {!isCreator && (
                    <TouchableOpacity
                      onPress={() => removeMember(m.uid)}
                      style={[styles.actionPill, { backgroundColor: colors.destructive + "22" }]}
                    >
                      <Feather name="user-minus" size={12} color={colors.destructive} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  scroll: { padding: 20, gap: 12 },
  groupInfo: { alignItems: "center", gap: 8, marginBottom: 8 },
  groupName: { fontFamily: "Inter_700Bold", fontSize: 20 },
  memberCount: { fontFamily: "Inter_400Regular", fontSize: 13 },
  settingCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  settingTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  settingDesc: { fontFamily: "Inter_400Regular", fontSize: 13 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  switchLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
  sectionLabel: { fontFamily: "Inter_500Medium", fontSize: 12, letterSpacing: 0.5, marginTop: 8 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  memberName: { fontFamily: "Inter_500Medium", fontSize: 14 },
  adminLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  memberActions: { flexDirection: "row", gap: 6 },
  actionPill: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
});
