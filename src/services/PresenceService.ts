import database from '@react-native-firebase/database';
import {db} from '../config/firebase';
import {User, UserStatus, FIREBASE_PATHS} from '../types';

let connectedListener: (() => void) | null = null;

export async function goOnline(uid: string, callsign: string): Promise<void> {
  const userRef = db.ref(`${FIREBASE_PATHS.users}/${uid}`);
  const connectedRef = database().ref('.info/connected');

  const userData: User = {
    uid,
    callsign,
    status: 'online',
    lastSeen: Date.now(),
  };

  // Remove entry entirely on disconnect — no stale data ever
  await userRef.onDisconnect().remove();

  // Write the online state
  await userRef.set({
    ...userData,
    lastSeen: database.ServerValue.TIMESTAMP,
  });

  // Re-establish on every reconnect
  const onConnected = connectedRef.on('value', async snapshot => {
    if (snapshot.val() === true) {
      await userRef.onDisconnect().remove();
      await userRef.set({
        uid,
        callsign,
        status: 'online',
        lastSeen: database.ServerValue.TIMESTAMP,
      });
    }
  });

  connectedListener = () => connectedRef.off('value', onConnected);
}

export async function goOffline(uid: string): Promise<void> {
  const userRef = db.ref(`${FIREBASE_PATHS.users}/${uid}`);

  // Stop listening to connection state
  if (connectedListener) {
    connectedListener();
    connectedListener = null;
  }

  // Cancel onDisconnect and remove the entry
  await userRef.onDisconnect().cancel();
  await userRef.remove();
}

export function subscribeToUsers(
  currentUid: string,
  callback: (users: User[]) => void,
): () => void {
  const usersRef = db.ref(FIREBASE_PATHS.users);

  const onValue = usersRef.on('value', snapshot => {
    const users: User[] = [];

    snapshot.forEach(child => {
      // Filter by key (most reliable) — skip self
      if (child.key === currentUid) {
        return undefined;
      }

      const user = child.val() as User;

      // Only include entries that have a callsign and are online
      if (user && user.callsign && user.status && user.status !== 'offline') {
        users.push({
          uid: child.key!,
          callsign: user.callsign,
          status: user.status,
          lastSeen: user.lastSeen || 0,
        });
      }

      return undefined;
    });

    callback(users);
  });

  return () => {
    usersRef.off('value', onValue);
  };
}

export async function setStatus(
  uid: string,
  status: UserStatus,
): Promise<void> {
  const userRef = db.ref(`${FIREBASE_PATHS.users}/${uid}`);
  await userRef.update({
    status,
    lastSeen: database.ServerValue.TIMESTAMP,
  });
}
