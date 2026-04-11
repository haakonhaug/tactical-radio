import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types';
import { goOnline, goOffline, subscribeToUsers } from '../services/PresenceService';

interface UsePresenceResult {
  users: User[];
  refreshing: boolean;
  refresh: () => void;
}

/**
 * React hook that manages presence and provides a live list of online users.
 *
 * @param uid - The current user's uid, or null if not logged in.
 * @param callsign - The current user's callsign.
 * @returns An object with the user list, refreshing state, and a refresh function.
 */
export function usePresence(uid: string | null, callsign: string): UsePresenceResult {
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const subscribe = useCallback((currentUid: string) => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    const unsub = subscribeToUsers(currentUid, updatedUsers => {
      setUsers(updatedUsers);
      setRefreshing(false);
    });
    unsubscribeRef.current = unsub;
  }, []);

  // Set up presence and subscription only when BOTH uid and callsign are set
  useEffect(() => {
    if (!uid || !callsign) {
      setUsers([]);
      return;
    }

    goOnline(uid, callsign);
    subscribe(uid);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      goOffline(uid);
    };
  }, [uid, callsign, subscribe]);

  const refresh = useCallback(() => {
    if (!uid) {
      return;
    }
    setRefreshing(true);
    subscribe(uid);
  }, [uid, subscribe]);

  return { users, refreshing, refresh };
}
