import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { signInAnonymously, setCallsign } from '../services/AuthService';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const CALLSIGN_REGEX = /^[A-Za-z0-9]{3,16}$/;

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

export default function LoginScreen({ navigation }: Props) {
  const [callsign, setCallsignValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = CALLSIGN_REGEX.test(callsign);

  const handleGoOnline = async () => {
    if (!isValid || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const uid = await signInAnonymously();
      await setCallsign(uid, callsign.toUpperCase());
      navigation.replace('Lobby');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Connection failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>TACTICAL RADIO</Text>
          <Text style={styles.subtitle}>ENCRYPTED P2P COMMS</Text>
          <View style={styles.divider} />
        </View>

        {/* Input section */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>CALLSIGN</Text>
          <TextInput
            style={[
              styles.input,
              callsign.length > 0 && !isValid && styles.inputError,
              callsign.length > 0 && isValid && styles.inputValid,
            ]}
            value={callsign}
            onChangeText={(text) => {
              setCallsignValue(text.replace(/[^A-Za-z0-9]/g, ''));
              setError(null);
            }}
            placeholder="ENTER CALLSIGN"
            placeholderTextColor={COLORS.textDim}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={16}
            editable={!loading}
          />
          {callsign.length > 0 && !isValid && (
            <Text style={styles.validationText}>
              3-16 ALPHANUMERIC CHARACTERS REQUIRED
            </Text>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[
              styles.button,
              (!isValid || loading) && styles.buttonDisabled,
            ]}
            onPress={handleGoOnline}
            disabled={!isValid || loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <Text style={styles.buttonText}>GO ONLINE</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            AES-256 ENCRYPTED | DTLS-SRTP SECURE
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontFamily: MONO_FONT,
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.green,
    letterSpacing: 4,
  },
  subtitle: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    color: COLORS.amber,
    letterSpacing: 3,
    marginTop: 8,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: COLORS.green,
    marginTop: 16,
    opacity: 0.5,
  },
  inputSection: {
    marginBottom: 48,
  },
  label: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: COLORS.textDim,
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    fontFamily: MONO_FONT,
    fontSize: 18,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    letterSpacing: 2,
  },
  inputError: {
    borderColor: COLORS.red,
  },
  inputValid: {
    borderColor: COLORS.green,
  },
  validationText: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    color: COLORS.amber,
    marginTop: 6,
    letterSpacing: 1,
  },
  errorText: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: COLORS.red,
    marginTop: 8,
    letterSpacing: 1,
  },
  button: {
    backgroundColor: COLORS.green,
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: COLORS.greenDark,
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: MONO_FONT,
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.background,
    letterSpacing: 3,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontFamily: MONO_FONT,
    fontSize: 9,
    color: COLORS.textDim,
    letterSpacing: 2,
  },
});
