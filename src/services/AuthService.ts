import { db, firebaseAuth } from '../config/firebase';
import { User, FIREBASE_PATHS } from '../types';

/**
 * Signs in the user anonymously via Firebase Auth.
 * Returns the uid of the newly created anonymous user.
 */
export async function signInAnonymously(): Promise<string> {
  const credential = await firebaseAuth.signInAnonymously();
  const uid = credential.user.uid;
  return uid;
}

/**
 * Writes a callsign to /users/{uid} in the Realtime Database.
 * Initialises the user record with status "online" and a lastSeen timestamp.
 */
export async function setCallsign(uid: string, callsign: string): Promise<void> {
  const userRef = db.ref(`${FIREBASE_PATHS.users}/${uid}`);
  await userRef.set({
    uid,
    callsign,
    status: 'online',
    lastSeen: Date.now(),
  } satisfies User);
}

/**
 * Returns the currently authenticated user's uid and callsign,
 * or null if no user is signed in or the user record doesn't exist.
 */
export async function getCurrentUser(): Promise<{ uid: string; callsign: string } | null> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    return null;
  }

  const snapshot = await db
    .ref(`${FIREBASE_PATHS.users}/${currentUser.uid}`)
    .once('value');

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.val() as User;
  return { uid: currentUser.uid, callsign: data.callsign };
}

/**
 * Signs out the current user and removes their data from the database.
 */
export async function signOut(): Promise<void> {
  const currentUser = firebaseAuth.currentUser;
  if (currentUser) {
    await db.ref(`${FIREBASE_PATHS.users}/${currentUser.uid}`).remove();
  }
  await firebaseAuth.signOut();
}
