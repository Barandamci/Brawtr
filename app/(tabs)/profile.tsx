import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { Feather, Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { uploadMedia } from "@/lib/cloudinary";
import UserAvatar from "@/components/UserAvatar";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, refreshProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const botInset = Platform.OS === "web" ? 34 : insets.bottom;

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0] && user) {
      setSaving(true);
      try {
        const uploaded = await uploadMedia(result.assets[0].uri, "image");
        await updateDoc(doc(db, "users", user.uid), { photoURL: uploaded.url });
        await refreshProfile();
      } catch {
        Alert.alert("Hata", "Fotoğraf yüklenirken sorun oluştu.");
      } finally {
        setSaving(false);
      }
    }
  }

  async function handleSaveBio() {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        bio: bio.trim(),
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setEditing(false);
    } catch {
      Alert.alert("Hata", "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    Alert.alert("Çıkış Yap", "Hesabından çıkmak istediğine emin misin?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  }

  if (!profile) return null;

  const roleLabel: Record<string, string> = {
    owner: "Kurucu",
    admin: "Admin",
    user: "Kullanıcı",
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profil</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)}>
          <Feather name={editing ? "x" : "edit-2"} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botInset + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8}>
            <UserAvatar
              photoURL={profile.photoURL}
              username={profile.username}
              size={90}
              isOnline
              hasBlueTick={profile.hasBlueTick}
              showOnline
            />
            <View style={[styles.cameraBtn, { backgroundColor: colors.primary }]}>
              <Feather name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <Text style={[styles.username, { color: colors.text }]}>@{profile.username}</Text>
            {profile.hasBlueTick && (
              <Ionicons name="checkmark-circle" size={18} color="#1D9BF0" />
            )}
          </View>

          <View style={[styles.roleBadge, { backgroundColor: profile.role === "user" ? colors.muted : colors.primary + "22" }]}>
            <Text style={[styles.roleText, { color: profile.role === "user" ? colors.mutedForeground : colors.primary }]}>
              {roleLabel[profile.role]}
            </Text>
          </View>

          <Text style={[styles.email, { color: colors.mutedForeground }]}>{profile.email}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Bio</Text>
          {editing ? (
            <>
              <TextInput
                style={[styles.bioInput, { color: colors.text, borderColor: colors.border }]}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={120}
                placeholderTextColor={colors.mutedForeground}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveBio}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.bioText, { color: colors.text }]}>{profile.bio || "Bio eklenmemiş"}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.signOutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.signOutText, { color: colors.destructive }]}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 28 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, gap: 16 },
  avatarSection: { alignItems: "center", gap: 8, marginBottom: 8 },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  username: { fontFamily: "Inter_700Bold", fontSize: 22 },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  email: { fontFamily: "Inter_400Regular", fontSize: 13 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  bioText: { fontFamily: "Inter_400Regular", fontSize: 15 },
  bioInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
  },
  saveBtn: { borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  saveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 8,
  },
  signOutText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
