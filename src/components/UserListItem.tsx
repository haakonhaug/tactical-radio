import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { User } from '../types';

interface Props {
  user: User;
  onPress: (user: User) => void;
  disabled?: boolean;
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

function getStatusColor(status: User['status']): string {
  switch (status) {
    case 'online':
      return COLORS.green;
    case 'busy':
    case 'in_call':
      return COLORS.amber;
    default:
      return COLORS.textDim;
  }
}

function getStatusLabel(status: User['status']): string {
  switch (status) {
    case 'busy':
      return 'BUSY';
    case 'in_call':
      return 'IN CALL';
    default:
      return '';
  }
}

export default function UserListItem({ user, onPress, disabled }: Props) {
  const isBusy = user.status === 'busy' || user.status === 'in_call';
  const isDisabled = disabled || isBusy;
  const statusColor = getStatusColor(user.status);
  const statusLabel = getStatusLabel(user.status);

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={styles.info}>
          <Text style={styles.callsign}>{user.callsign}</Text>
          {statusLabel !== '' && (
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.connectButton, isDisabled && styles.connectButtonDisabled]}
        onPress={() => onPress(user)}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.connectButtonText,
            isDisabled && styles.connectButtonTextDisabled,
          ]}
        >
          CONNECT
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  callsign: {
    fontFamily: MONO_FONT,
    fontSize: 15,
    color: COLORS.text,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  statusText: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 2,
  },
  connectButton: {
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  connectButtonDisabled: {
    borderColor: COLORS.textDim,
    opacity: 0.4,
  },
  connectButtonText: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: COLORS.green,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  connectButtonTextDisabled: {
    color: COLORS.textDim,
  },
});
