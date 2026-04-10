import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Platform,
} from 'react-native';

interface Props {
  visible: boolean;
  callerCallsign: string;
  onAccept: () => void;
  onReject: () => void;
}

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

export default function IncomingCallModal({
  visible,
  callerCallsign,
  onAccept,
  onReject,
}: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      pulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [visible, pulseAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Pulsing indicator */}
          <Animated.View
            style={[styles.pulseIndicator, { opacity: pulseAnim }]}
          />

          <Text style={styles.title}>INCOMING TRANSMISSION</Text>

          <Text style={styles.callerCallsign}>{callerCallsign}</Text>

          <Text style={styles.subtitle}>REQUESTING SECURE CHANNEL</Text>

          {/* Action buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={onReject}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, styles.rejectText]}>
                REJECT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={onAccept}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, styles.acceptText]}>
                ACCEPT
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 8,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  pulseIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.green,
    marginBottom: 20,
  },
  title: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    color: COLORS.amber,
    letterSpacing: 3,
    marginBottom: 16,
  },
  callerCallsign: {
    fontFamily: MONO_FONT,
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.green,
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    color: COLORS.textDim,
    letterSpacing: 2,
    marginBottom: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptButton: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.greenDark,
  },
  rejectButton: {
    borderColor: COLORS.red,
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
  },
  actionButtonText: {
    fontFamily: MONO_FONT,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  acceptText: {
    color: COLORS.green,
  },
  rejectText: {
    color: COLORS.red,
  },
});
