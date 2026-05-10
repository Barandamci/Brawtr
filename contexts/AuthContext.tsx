import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { BrawUser } from "@/types";
import { registerForPushNotifications } from "@/lib/notifications";

const OWNER_EMAIL =
  process.env.EXPO_PUBLIC_OWNER_EMAIL || "barandamci@icloud.com";

export interface PendingSignup {
  email: string;
  password: string;
  username: string;
  fullName: string;
}

interface AuthContextType {
  user: User | null;
  profile: BrawUser | null;
  loading: boolean;
  profileComplete: boolean;
  pendingSignup: PendingSignup | null;
  setPendingSignup: (data: PendingSignup | null) => void;
  signUp: (
    email: string,
    password: string,
    username: string,
    fullName: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<BrawUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(
    null
  );

  const profileComplete = !!(profile?.username);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }

      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", firebaseUser.uid);

      unsubProfile = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as BrawUser);
        } else {
          setProfile(null);
        }
        setLoading(false);
      });

      updateDoc(userRef, { isOnline: true }).catch(() => {});

      registerForPushNotifications().then((token) => {
        if (token) {
          updateDoc(userRef, { pushToken: token }).catch(() => {});
        }
      });
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  async function signUp(
    email: string,
    password: string,
    username: string,
    fullName: string
  ) {
    const isOwner = email.toLowerCase() === OWNER_EMAIL.toLowerCase();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const role = isOwner ? "owner" : "user";
    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");

    await setDoc(doc(db, "usernames", cleanUsername), { uid: cred.user.uid });
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      email,
      username: cleanUsername,
      fullName: fullName.trim(),
      bio: "",
      photoURL: "",
      role,
      isBanned: false,
      hasBlueTick: false,
      isOnline: true,
      pushToken: "",
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    if (user) {
      await updateDoc(doc(db, "users", user.uid), {
        isOnline: false,
        lastSeen: serverTimestamp(),
        pushToken: "",
      }).catch(() => {});
    }
    await firebaseSignOut(auth);
  }

  async function refreshProfile() {
    if (!user) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) setProfile(snap.data() as BrawUser);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileComplete,
        pendingSignup,
        setPendingSignup,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
