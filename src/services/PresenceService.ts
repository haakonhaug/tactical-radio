import database from '@react-native-firebase/database';
import { db } from '../config/firebase';
import { User, UserStatus, FIREBASE_PATHS } from '../types';

/**
 * Sets up Firebase presence for a user.
 * Writes user data to /users/{uid} with status "online" and configures
 * onDisconnect to automatically set status to "offline" when the client drops.
 */
export async function goOnline(uid: string, callsign: string): Promise<void> {
  const userRef = db.ref(`${FIREBASE_PATHS.users}/${uid}`);
  const connectedRef = database().ref('.info/connected');

  const userData: User = {
    uid,
    callsign,
    status: 'online',
    lastSeen: Date.now(),
  };

  // Set up onDisconnect before writing presence so there's no gap
  await userRef.onDisconnect().set({
    ...userData,
    status: 'offline',
    lastSeen: database.ServerValue.TIMESTAMP,
  });

  // Now write the online state
  await userRef.set({
    ...userData,
    lastSeen: database.ServerValue.TIMESTAMP,
  });

  // Re-establish onDisconnect each time Firebase reconnects
  connectedRef.on('value', async (snapshot) => {
    if (snapshot.val() === true) {
      await userRef.onDisconnect().set({
        uid,
        callsign,
        status: 'offline',
        lastSeen: database.ServerValue.TIMESTAMP,
      });

      await userRef.update({
        status: 'online',
        lastSeen: database.ServerValue.TIMESTAMP,
      });
    }
  });
}

/**
 * Manually sets the user's status to "offline" and cancels onDisconnect handlers.
 * Also stops listening to .info/connected.
 */
export async function goOffline(uid: string): Promise<void> {
  const userRef = db.ref(`${FIREBASE_PATHS.users}/${uid}`);
  const connectedRef = database().ref('.info/connected');

  // Cancel any pending onDisconnect operations
  await userRef.onDisconnect().cancel();

  // Stop listening to connection state
  connectedRef.off('value');

  // Set status to offline
  await userRef.update({
    status: 'offline',
    lastSeen: database.ServerValue.TIMESTAMP,
  });
}

/**
 * Subscribes to the /users/ node in the Realtime Database.
 * Filters out the current user and any offline users, then invokes the
 * callback with the resulting list whenever the data changes.
 *
 * Returns an unsubscribe function to stop listening.
 */
export function subscribeToUsers(
  currentUid: string,
  callback: (users: User[]) => void,
): () => void {
  const usersRef = db.ref(FIREBASE_PATHS.users);

  const onValue = usersRef.on('value', (snapshot) => {
    const users: User[] = [];

    snapshot.forEach((child) => {
      const user = child.val() as User;
      if (user.uid !== currentUid && user.status !== 'offline') {
        users.push(user);
      }
      return undefined; // forEach expects a return
    });

    callback(users);
  });

  // Return unsubscribe function
  return () => {
    usersRef.off('value', onValue);
  };
}

/**
 * Updates just the status field for a given user.
 */
export async function setStatus(uid: string, status: UserStatus): Promise<void> {
  const userRef = db.ref(`${FIREBASE_PATHS.users}/${uid}`);
  await userRef.update({
    status,
    lastSeen: database.ServerValue.TIMESTAMP,
  });
}
