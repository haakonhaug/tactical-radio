import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useWebRTC } from '../hooks/useWebRTC';
import { useCallSignaling } from '../hooks/useCallSignaling';
import { getCurrentUser } from '../services/AuthService';

type Props = NativeStackScreenProps<RootStackParamList, 'Call'>;

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  border: '#333333',
  green: '#00ff41',
  greenDark: '#003300',
  amber: '#ff9800',
  red: '#ff3333',
  redDark: '#660000',
  text: '#e0e0e0',
  textDim: '#666666',
};

const MONO_FONT = Platform.select({ android: 'monospace', default: 'monospace' });

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getConnectionLabel(state: string): { text: string; color: string } {
  switch (state) {
    case 'new':
    case 'checking':
      return { text: 'CONNECTING...', color: COLORS.amber };
    case 'connected':
      return { text: 'SECURING CHANNEL...', color: COLORS.amber };
    case 'completed':
      return { text: 'ENCRYPTED LINK ACTIVE', color: COLORS.green };
    case 'disconnected':
      return { text: 'LINK DISRUPTED', color: COLORS.red };
    case 'failed':
      return { text: 'CONNECTION FAILED', color: COLORS.red };
    case 'closed':
      return { text: 'LINK CLOSED', color: COLORS.textDim };
    default:
      return { text: 'STANDBY', color: COLORS.textDim };
  }
}

export default function CallScreen({ route, navigation }: Props) {
  const { callId, isInitiator, remoteCallsign } = route.params;

  const [uid, setUid] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [showEndedMessage, setShowEndedMessage] = useState(false);

  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isEndingRef = useRef(false);

  // Fetch current user uid on mount
  useEffect(() => {
    getCurrentUser().then(user => {
      if (user) {
        setUid(user.uid);
      }
    });
  }, []);

  const {
    isMuted,
    isSpeaker,
    connectionState,
    endCall: webrtcEndCall,
    toggleMute,
    toggleSpeaker,
  } = useWebRTC(callId, isInitiator, true);

  const { callStatus, endCall: signalingEndCall } = useCallSignaling(uid);

  // Duration timer: start when connected, stop on cleanup
  useEffect(() => {
    if (connectionState === 'connected' || connectionState === 'completed') {
      if (!durationIntervalRef.current) {
        durationIntervalRef.current = setInterval(() => {
          setDuration(prev => prev + 1);
        }, 1000);
      }
    }

    return () => {
      // Only clean up on unmount, not on every state change
    };
  }, [connectionState]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, []);

  const handleEndCall = useCallback(async () => {
    if (isEndingRef.current) {
      return;
    }
    isEndingRef.current = true;

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    try {
      await signalingEndCall();
    } catch {
      // Signaling end may fail if already ended
    }
    webrtcEndCall();
    navigation.goBack();
  }, [signalingEndCall, webrtcEndCall, navigation]);

  // Watch callStatus for remote hangup / rejection
  useEffect(() => {
    if (callStatus === 'ended' || callStatus === 'rejected') {
      if (isEndingRef.current) {
        return;
      }
      isEndingRef.current = true;

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      webrtcEndCall();
      setShowEndedMessage(true);

      const timeout = setTimeout(() => {
        navigation.goBack();
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [callStatus, webrtcEndCall, navigation]);

  // Prevent Android back button from navigating away -- route through endCall
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      // Allow navigation if we are already in the ending flow
      if (isEndingRef.current) {
        return;
      }

      // Prevent default back behavior
      e.preventDefault();
      handleEndCall();
    });

    return unsubscribe;
  }, [navigation, handleEndCall]);

  const connLabel = getConnectionLabel(connectionState);
  const isConnected = connectionState === 'connected' || connectionState === 'completed';

  if (showEndedMessage) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContent}>
          <Text style={styles.endedText}>TRANSMISSION ENDED</Text>
          <Text style={styles.endedSubtext}>LINK TERMINATED BY REMOTE</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top status bar */}
      <View style={styles.topBar}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusDot, { color: connLabel.color }]}>
            {'\u25CF'}{' '}
          </Text>
          <Text style={[styles.statusText, { color: connLabel.color }]}>
            {connLabel.text}
          </Text>
        </View>
        {isConnected && (
          <View style={styles.encryptedBadge}>
            <Text style={styles.lockIcon}>[LOCK]</Text>
            <Text style={styles.encryptedText}> ENCRYPTED</Text>
          </View>
        )}
      </View>

      {/* Main call info */}
      <View style={styles.centeredContent}>
        <Text style={styles.callsignLabel}>REMOTE STATION</Text>
        <Text style={styles.callsign}>{remoteCallsign}</Text>
        <View style={styles.divider} />
        <Text style={styles.duration}>{formatDuration(duration)}</Text>
        {isConnected && (
          <Text style={styles.secureNote}>DTLS-SRTP | AES-128</Text>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlsRow}>
          {/* Mute button */}
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.controlButtonText,
                isMuted && styles.controlButtonTextActive,
              ]}
            >
              {isMuted ? 'UNMUTE' : 'MUTE'}
            </Text>
            <Text
              style={[
                styles.controlState,
                { color: isMuted ? COLORS.red : COLORS.green },
              ]}
            >
              {isMuted ? 'MIC OFF' : 'MIC ON'}
            </Text>
          </TouchableOpacity>

          {/* Speaker button */}
          <TouchableOpacity
            style={[styles.controlButton, isSpeaker && styles.controlButtonActive]}
            onPress={toggleSpeaker}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.controlButtonText,
                isSpeaker && styles.controlButtonTextActive,
              ]}
            >
              {isSpeaker ? 'EARPIECE' : 'SPEAKER'}
            </Text>
            <Text
              style={[
                styles.controlState,
                { color: isSpeaker ? COLORS.amber : COLORS.textDim },
              ]}
            >
              {isSpeaker ? 'SPEAKER ON' : 'SPEAKER OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* End call button */}
        <TouchableOpacity
          style={styles.endButton}
          onPress={handleEndCall}
          activeOpacity={0.7}
        >
          <Text style={styles.endButtonText}>END TRANSMISSION</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    fontSize: 10,
  },
  statusText: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    letterSpacing: 1,
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.greenDark,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  lockIcon: {
    fontFamily: MONO_FONT,
    fontSize: 9,
    color: COLORS.green,
  },
  encryptedText: {
    fontFamily: MONO_FONT,
    fontSize: 9,
    color: COLORS.green,
    letterSpacing: 1,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callsignLabel: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: COLORS.textDim,
    letterSpacing: 3,
    marginBottom: 8,
  },
  callsign: {
    fontFamily: MONO_FONT,
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.green,
    letterSpacing: 4,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: COLORS.green,
    marginVertical: 20,
    opacity: 0.5,
  },
  duration: {
    fontFamily: MONO_FONT,
    fontSize: 48,
    color: COLORS.text,
    letterSpacing: 6,
  },
  secureNote: {
    fontFamily: MONO_FONT,
    fontSize: 9,
    color: COLORS.textDim,
    letterSpacing: 2,
    marginTop: 12,
  },
  controlsContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  controlButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  controlButtonActive: {
    borderColor: COLORS.amber,
    backgroundColor: '#1a1400',
  },
  controlButtonText: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
    letterSpacing: 2,
  },
  controlButtonTextActive: {
    color: COLORS.amber,
  },
  controlState: {
    fontFamily: MONO_FONT,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 4,
  },
  endButton: {
    backgroundColor: COLORS.red,
    borderRadius: 4,
    paddingVertical: 18,
    alignItems: 'center',
  },
  endButtonText: {
    fontFamily: MONO_FONT,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 3,
  },
  endedText: {
    fontFamily: MONO_FONT,
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.red,
    letterSpacing: 3,
    textAlign: 'center',
  },
  endedSubtext: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: COLORS.textDim,
    letterSpacing: 2,
    marginTop: 12,
    textAlign: 'center',
  },
});
