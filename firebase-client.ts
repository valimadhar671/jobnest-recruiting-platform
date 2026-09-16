import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  GithubAuthProvider,
  GoogleAuthProvider,
  getAuth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  or,
  onSnapshot,
  limit,
  orderBy,
  Unsubscribe,
} from "firebase/firestore";
import { getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(Boolean);
}

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) throw new Error("Firebase is not configured.");
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase Auth is not configured. Add NEXT_PUBLIC_FIREBASE_* values to .env.local.");
  }

  const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

export function getFirebaseDb(): Firestore {
  const app = getFirebaseApp();
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Another module may have initialized Firestore already, or IndexedDB may
    // be unavailable (private browsing/SSR). The network-backed client remains
    // fully usable in either case.
    return getFirestore(app);
  }
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

export async function saveFirestoreDocument(collectionName: string, id: string, data: Record<string, unknown>) {
  await setDoc(doc(getFirebaseDb(), collectionName, id), data, { merge: true });
}

export async function readFirestoreCollection<T>(
  collectionName: string,
  filter?: { field: string; value: string },
): Promise<Array<T & { id: string }>> {
  const source = collection(getFirebaseDb(), collectionName);
  const constraints = filter ? [where(filter.field, "==", filter.value)] : [];
  const snapshot = await getDocs(query(source, ...constraints, limit(200)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as T & { id: string }));
}

type RealtimeCollection = "users" | "jobs" | "applications" | "reminders";
type RealtimeRecord = Record<string, unknown> & { id: string };
type RealtimeListener = (collectionName: RealtimeCollection, records: RealtimeRecord[]) => void;

const realtimeSubscribers = new Set<RealtimeListener>();
let realtimeUnsubscribers: Unsubscribe[] = [];
let realtimeKey = "";
let realtimeGeneration = 0;

/**
 * Starts one listener set per signed-in identity. Firestore rules determine the
 * records visible to each query; no client-side broadening of those queries is
 * performed here.
 */
export function subscribeToAuthorizedFirestore(listener: RealtimeListener): () => void {
  realtimeSubscribers.add(listener);
  const authUser = getFirebaseAuth().currentUser;
  if (authUser) {
    void configureRealtimeListeners(authUser.uid);
  }

  return () => {
    realtimeSubscribers.delete(listener);
    if (realtimeSubscribers.size === 0) {
      stopAuthorizedFirestore();
    }
  };
}

export function stopAuthorizedFirestore() {
  realtimeGeneration += 1;
  realtimeUnsubscribers.forEach((unsubscribe) => unsubscribe());
  realtimeUnsubscribers = [];
  realtimeKey = "";
}

async function configureRealtimeListeners(uid: string) {
  const auth = getFirebaseAuth();
  const authUser = auth.currentUser;
  if (!authUser || authUser.uid !== uid) return;
  const token = await authUser.getIdTokenResult();
  const isAdmin = token.claims.admin === true;
  const key = `${uid}:${isAdmin ? "admin" : "user"}`;
  if (realtimeKey === key || realtimeSubscribers.size === 0) return;

  stopAuthorizedFirestore();
  realtimeKey = key;
  const generation = realtimeGeneration;
  const db = getFirebaseDb();
  const emit = (collectionName: RealtimeCollection, snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => {
    if (generation !== realtimeGeneration) return;
    const records = snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, unknown>) }));
    realtimeSubscribers.forEach((subscriber) => subscriber(collectionName, records));
  };

  const listen = (collectionName: RealtimeCollection, source: ReturnType<typeof collection> | ReturnType<typeof query>) => {
    realtimeUnsubscribers.push(onSnapshot(source, (snapshot) => emit(collectionName, snapshot)));
  };

  listen("users", isAdmin ? query(collection(db, "users"), orderBy("createdAt", "desc"), limit(500)) : query(collection(db, "users"), where("id", "==", uid), limit(1)));
  listen("jobs", query(collection(db, "jobs"), where("status", "==", "open"), orderBy("postedAt", "desc"), limit(100)));
  listen(
    "applications",
    isAdmin
      ? query(collection(db, "applications"), orderBy("appliedAt", "desc"), limit(200))
      : query(
          collection(db, "applications"),
          or(where("candidateId", "==", uid), where("recruiterId", "==", uid)),
          orderBy("appliedAt", "desc"),
          limit(200),
        ),
  );
  listen(
    "reminders",
    isAdmin
      ? query(collection(db, "reminders"), orderBy("createdAt", "desc"), limit(200))
      : query(collection(db, "reminders"), where("recipientId", "==", uid), orderBy("createdAt", "desc"), limit(100)),
  );
}

export async function uploadUserFile(userId: string, file: File, type: "resume" | "intro") {
  const allowedTypes = type === "resume"
    ? ["application/pdf"]
    : ["video/mp4", "video/webm", "video/quicktime"];
  if (!allowedTypes.includes(file.type) || file.size >= 15 * 1024 * 1024) {
    throw new Error(type === "resume" ? "Resume must be a PDF under 15 MB." : "Intro video must be MP4, WebM, or QuickTime under 15 MB.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const fileRef = ref(getFirebaseStorage(), `users/${userId}/${type}-${crypto.randomUUID()}.${extension}`);
  const result = await uploadBytes(fileRef, file, { contentType: file.type || undefined });
  return getDownloadURL(result.ref);
}

export function getGoogleProvider() {
  return new GoogleAuthProvider();
}

export function getGithubProvider() {
  return new GithubAuthProvider();
}

export async function signOutFirebase() {
  if (isFirebaseConfigured()) {
    const { signOut } = await import("firebase/auth");
    await signOut(getFirebaseAuth());
  }
}
