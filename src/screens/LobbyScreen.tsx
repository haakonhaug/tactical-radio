import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, User } from '../types';
import { getCurrentUser, signOut } from '../services/AuthService';
import { usePresence } from '../hooks/usePresence';
import { useCallSignaling } from '../hooks/useCallSignaling';
import UserListItem from '../components/UserListItem';
import IncomingCallModal from '../components/IncomingCallModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  border: '#333333',
  green: '#00ff41',
  greenDark: '#003300',
  amber: '#ff9800',
  red: '#ff3333',
  text: '#e0e0e0',
  textDim: '#666666',
};

const MONO_FONT = Platform.select({ android: 'monospace', default: 'monospace' });

export default function LobbyScreen({ navigation }: Props) {
  const [uid, setUid] = useState<string | null>(null);
  const [callsign, setCallsign] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Track whether we have already navigated to Call, to avoid double navigation
  const hasNavigatedRef = useRef(false);

  const { users, refreshing, refresh } = usePresence(uid, callsign);
  const {
    incomingCall,
    outgoingCallId,
    callStatus,
    initiateCall,
    respondToCall,
    endCall,
    resetCallState,
  } = useCallSignaling(uid);

  // Load current user on mount
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user) {
        setUid(user.uid);
        setCallsign(user.callsign);
      } else {
        // Not authenticated — go back to login
        navigation.replace('Login');
      }
    })();
  }, [navigation]);

  // Reset call state when the screen comes back into focus (returning from Call)
  useFocusEffect(
    useCallback(() => {
      hasNavigatedRef.current = false;
      resetCallState();
    }, [resetCallState]),
  );

  // Watch outgoing call status for accepted/rejected/ended/missed
  useEffect(() => {
    if (!callStatus || hasNavigatedRef.current) {
      return;
    }

    if (callStatus === 'accepted' && outgoingCallId) {
      // Find the callee callsign from the call we initiated
      // outgoingCallId is set, navigate to call
      hasNavigatedRef.current = true;
      // We don't have the remote callsign stored directly, but we can
      // derive it: when we initiated, we passed calleeCallsign.
      // For outgoing calls where status becomes accepted, we need to navigate.
      // The remote callsign was the callee we selected. We'll store it via ref.
      navigation.navigate('Call', {
        callId: outgoingCallId,
        isInitiator: true,
        remoteCallsign: outgoingCallRefCallsign.current,
      });
    } else if (
      callStatus === 'rejected' ||
      callStatus === 'ended' ||
      callStatus === 'missed'
    ) {
      const label =
        callStatus === 'rejected'
          ? 'CALL REJECTED'
          : callStatus === 'missed'
            ? 'CALL MISSED'
            : 'CALL ENDED';
      Alert.alert(label, 'The connection was not established.', [
        { text: 'OK', onPress: () => resetCallState() },
      ]);
    }
  }, [callStatus, outgoingCallId, navigation, resetCallState]);

  // Ref to store the remote callsign for outgoing calls
  const outgoingCallRefCallsign = useRef('');

  const handleUserPress = async (user: User) => {
    if (connecting || !uid) {
      return;
    }

    setConnecting(true);
    outgoingCallRefCallsign.current = user.callsign;

    const result = await initiateCall(user.uid, user.callsign, callsign);

    setConnecting(false);

    if (!result.success) {
      Alert.alert('CONNECTION FAILED', result.error || 'Unable to connect.');
    }
  };

  const handleAcceptIncoming = async () => {
    if (!incomingCall) {
      return;
    }

    const remoteCallsign = incomingCall.callerCallsign;
    const callId = incomingCall.id;

    await respondToCall(true);

    hasNavigatedRef.current = true;
    navigation.navigate('Call', {
      callId,
      isInitiator: false,
      remoteCallsign,
    });
  };

  const handleRejectIncoming = async () => {
    await respondToCall(false);
  };

  const handleSignOut = async () => {
    try {
      await endCall();
      await signOut();
    } catch {
      // Best-effort sign out
    }
    navigation.replace('Login');
  };

  const renderUser = ({ item }: { item: User }) => (
    <UserListItem user={item} onPress={handleUserPress} disabled={connecting} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>NO STATIONS ONLINE</Text>
      <Text style={styles.emptySubtext}>PULL DOWN TO REFRESH</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>RADIO NETWORK</Text>
          <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={styles.signOutText}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.userInfo}>
            <View style={styles.statusDot} />
            <Text style={styles.callsignText}>{callsign}</Text>
          </View>
          <Text style={styles.onlineCount}>
            {users.length} STATION{users.length !== 1 ? 'S' : ''} ONLINE
          </Text>
        </View>
      </View>

      {/* User list */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        renderItem={renderUser}
        ListEmptyComponent={renderEmpty}
        onRefresh={refresh}
        refreshing={refreshing}
        style={styles.list}
        contentContainerStyle={users.length === 0 ? styles.listEmpty : undefined}
      />

      {/* Incoming call modal */}
      <IncomingCallModal
        visible={incomingCall !== null}
        callerCallsign={incomingCall?.callerCallsign ?? ''}
        onAccept={handleAcceptIncoming}
        onReject={handleRejectIncoming}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: MONO_FONT,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.green,
    letterSpacing: 3,
  },
  signOutText: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 1,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
    marginRight: 8,
  },
  callsignText: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    color: COLORS.text,
    letterSpacing: 2,
  },
  onlineCount: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    color: COLORS.textDim,
    letterSpacing: 1,
  },
  list: {
    flex: 1,
  },
  listEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontFamily: MONO_FONT,
    fontSize: 14,
    color: COLORS.textDim,
    letterSpacing: 3,
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    color: COLORS.textDim,
    letterSpacing: 2,
    opacity: 0.6,
  },
});
