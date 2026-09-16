"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase-client";
import { getUsers, hydrateFromFirestore, setSession, startRealtimeSync, stopRealtimeSync, writeUsers } from "@/lib/jobnest-data";

export function FirebaseAuthSync() {
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (!firebaseUser) {
        setSession(null);
        stopRealtimeSync();
        return;
      }

      await hydrateFromFirestore();
      const users = getUsers();
      const existing = users.find((user) => user.id === firebaseUser.uid);
      if (!existing) {
        users.push({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "JobNest user",
          email: firebaseUser.email || "",
          role: "candidate",
          approved: true,
          status: "active",
          createdAt: new Date().toISOString(),
        });
        writeUsers(users);
      }

      setSession({ userId: firebaseUser.uid });
      await startRealtimeSync();
    });

    return unsubscribe;
  }, []);

  return null;
}
