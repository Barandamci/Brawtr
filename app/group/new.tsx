import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  getDoc,
  doc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { BrawUser } from "@/types";
import { uploadMedia } from "@/lib/cloudinary";
import UserAvatar from "@/components/UserAvatar";

export default function NewGroupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [groupName, setGroupName] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [members, setMembers] = useState<BrawUser[]>([]);
  const [photoURI, setPhotoURI] = useState("");
  const [creating, setCreating] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<BrawUser | null>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  async function handleSearch() {
    if (!searchQ.trim()) return;
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const snap = await getDoc(doc(db, "usernames", searchQ.trim().toLowerCase()));
      if (!snap.exists()) { setSearchLoading(false); return; }
      const { uid } = snap.data() as { uid: string };
      if (uid === user?.uid) { setSearchLoading(false); return; }
      const usnap = await getDoc(doc(db, "users", uid));
      if (usnap.exists()) setSearchResult(usnap.data() as BrawUser);
    } finally {
      setSearchLoading(false);
    }
  }

  function addMember(u: BrawUser) {
    if (members.find((m) => m.uid === u.uid)) return;
    setMembers([...members, u]);
    setSearchResult(null);
    setSearchQ("");
  }

  function removeMember(uid: string) {
    setMembers(members.filter((m) => m.uid !== uid));
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) setPhotoURI(res.assets[0].uri);
  }

  async function handleCreate() {
    if (!groupName.trim()) { Alert.alert("Hata", "Grup adı zorunludur."); return; }
    if (members.length < 1) { Alert.alert("Hata", "En az 1 üye ekleyin."); return; }
    if (!user) return;

    setCreating(true);
    try {
      let photoURL = "";
      if (photoURI) {
        const uploaded = await uploadMedia(photoURI, "image");
        photoURL = uploaded.url;
      }

      const allMembers = [user.uid, ...members.map((m) => m.uid)];
      const ref = await addDoc(collection(db, "chats"), {
        members: allMembers,
        isGroup: true,
        name: groupName.trim(),
        photoURL,
        lastMessage: "Grup oluşturuldu",
        lastMessageTime: serverTimestamp(),
        admins: [user.uid],
        createdBy: user.uid,
        restrictedMode: false,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "messages", ref.id, "messages"), {
        text: "Grup oluşturuldu 🎉",
        senderId: user.uid,
        timestamp: serverTimestamp(),
        deleted: false,
      });

      router.replace(`/chat/${ref.id}`);
    } catch {
      Alert.alert("Hata", "Grup oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="x" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yeni Grup</Text>
        <TouchableOpacity onPress={handleCreate} disabled={creating}>
          {creating ? <ActivityIndicator color={colors.primary} /> : (
            <Text style={[styles.createBtn, { color: colors.primary }]}>Oluştur</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.photoRow}>
          <TouchableOpacity onPress={pickPhoto} style={[styles.photoPicker, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.8}>
            <UserAvatar photoURL={photoURI} username={groupName || "G"} size={70} />
            <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
              <Feather name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.nameField, { color: colors.text }]}
              placeholder="Grup adı..."
              placeholderTextColor={colors.mutedForeground}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ÜYE EKLE</Text>
        <View style={styles.searchRow}>
          <View style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} style={{ marginRight: 8 }} />
            <TextInput
              style={[{ flex: 1, color: colors.text, fontFamily: "Inter_400Regular", fontSize: 15 }]}
              placeholder="Kullanıcı adı ara..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQ}
              onChangeText={setSearchQ}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.primary }]}
            onPress={handleSearch}
          >
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {searchLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />}

        {searchResult && (
          <TouchableOpacity
            style={[styles.resultRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => addMember(searchResult)}
            activeOpacity={0.8}
          >
            <UserAvatar photoURL={searchResult.photoURL} username={searchResult.username} size={40} />
            <Text style={[styles.resultName, { color: colors.text }]}>@{searchResult.username}</Text>
            <View style={[styles.addBadge, { backgroundColor: colors.primary }]}>
              <Feather name="plus" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {members.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 16 }]}>
              EKLENECEK ÜYELER ({members.length})
            </Text>
            {members.map((m) => (
              <View key={m.uid} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                <UserAvatar photoURL={m.photoURL} username={m.username} size={40} />
                <Text style={[styles.memberName, { color: colors.text }]}>@{m.username}</Text>
                <TouchableOpacity onPress={() => removeMember(m.uid)}>
                  <Feather name="x" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  createBtn: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  scroll: { padding: 16, gap: 8 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  photoPicker: { position: "relative", borderRadius: 40, borderWidth: 1, padding: 2 },
  cameraOverlay: {
    position: "absolute", bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: "center", alignItems: "center",
  },
  nameInput: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 14 : 10,
  },
  nameField: { fontSize: 16, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontFamily: "Inter_500Medium", fontSize: 12, letterSpacing: 0.5, marginBottom: 8 },
  searchRow: { flexDirection: "row", gap: 10 },
  searchInput: {
    flex: 1, flexDirection: "row", alignItems: "center",
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 14 : 10,
  },
  searchBtn: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  resultRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 8,
  },
  resultName: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15 },
  addBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberName: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
});
