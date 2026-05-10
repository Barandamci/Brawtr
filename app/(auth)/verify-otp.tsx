import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

const CODE_LENGTH = 6;

export default function VerifyOtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, pendingSignup, setPendingSignup } = useAuth();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const apiBase =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}/api`
      : `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

  useEffect(() => {
    if (!pendingSignup) {
      router.replace("/(auth)/signup");
    }
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 400);
  }, []);

  function handleDigit(text: string, index: number) {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newCode.every((d) => d !== "") && digit) {
      verifyCode(newCode.join(""));
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function verifyCode(codeStr: string) {
    if (!pendingSignup) {
      Alert.alert("Hata", "Oturum süresi dolmuş. Lütfen tekrar deneyin.");
      router.replace("/(auth)/signup");
      return;
    }
    setVerifying(true);
    try {
      const resp = await fetch(`${apiBase}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingSignup.email,
          code: codeStr,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        Alert.alert("Hatalı Kod", data.error || "Kod yanlış veya süresi dolmuş.");
        setCode(Array(CODE_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        setVerifying(false);
        return;
      }

      await signUp(
        pendingSignup.email,
        pendingSignup.password,
        pendingSignup.username,
        pendingSignup.fullName
      );
      setPendingSignup(null);
    } catch (err) {
      Alert.alert("Hata", "Doğrulama sırasında hata oluştu: " + String(err));
      setVerifying(false);
    }
  }

  async function resendCode() {
    if (!pendingSignup || timer > 0) return;
    setResending(true);
    try {
      const resp = await fetch(`${apiBase}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingSignup.email,
          fullName: pendingSignup.fullName,
          username: pendingSignup.username,
        }),
      });
      if (resp.ok) {
        setTimer(60);
        setCode(Array(CODE_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        Alert.alert("Gönderildi", "Yeni kod e-postanıza gönderildi.");
      }
    } catch {
      Alert.alert("Hata", "Kod gönderilemedi.");
    } finally {
      setResending(false);
    }
  }

  const maskedEmail = pendingSignup?.email
    ? pendingSignup.email.replace(/(.{2}).+(@.+)/, "$1****$2")
    : "e-postanıza";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View
          style={[
            styles.inner,
            {
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 32,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: colors.primary + "22",
                  borderColor: colors.primary + "44",
                },
              ]}
            >
              <Feather name="mail" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              E-posta Doğrulama
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.mutedForeground },
              ]}
            >
              6 haneli kodu{"\n"}
              <Text
                style={{
                  color: colors.text,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {maskedEmail}
              </Text>
              {"\n"}adresine gönderdik
            </Text>
          </View>

          <View style={styles.codeRow}>
            {code.map((digit, i) => (
              <TextInput
                key={i}
                ref={(r) => {
                  inputRefs.current[i] = r;
                }}
                style={[
                  styles.codeBox,
                  {
                    backgroundColor: colors.card,
                    borderColor: digit ? colors.primary : colors.border,
                    color: colors.text,
                  },
                ]}
                value={digit}
                onChangeText={(t) => handleDigit(t, i)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, i)
                }
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
                editable={!verifying}
              />
            ))}
          </View>

          {verifying && (
            <View style={styles.verifyingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text
                style={[
                  styles.verifyingText,
                  { color: colors.mutedForeground },
                ]}
              >
                Doğrulanıyor...
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.resendBtn,
              { opacity: timer > 0 ? 0.4 : 1 },
            ]}
            onPress={resendCode}
            disabled={timer > 0 || resending}
          >
            {resending ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={[styles.resendText, { color: colors.primary }]}>
                {timer > 0
                  ? `Kodu yeniden gönder (${timer}s)`
                  : "Kodu yeniden gönder"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24 },
  backBtn: {
    padding: 4,
    alignSelf: "flex-start",
    marginBottom: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
    gap: 14,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 32,
  },
  codeBox: {
    width: 48,
    height: 58,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  verifyingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  verifyingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  resendBtn: { alignItems: "center", paddingVertical: 12 },
  resendText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
