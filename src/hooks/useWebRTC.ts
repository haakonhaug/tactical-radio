import { useState, useEffect, useRef, useCallback } from 'react';
import { MediaStream } from 'react-native-webrtc';
import WebRTCService from '../services/WebRTCService';
import { signalingService } from '../services/SignalingService';
import { RTCIceCandidateType, SignalingRole } from '../types';

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isSpeaker: boolean;
  connectionState: string;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

export function useWebRTC(
  callId: string | null,
  isInitiator: boolean,
  active: boolean,
): UseWebRTCReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('new');

  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const signalingUnsubRef = useRef<(() => void) | null>(null);
  const isSettingUpRef = useRef(false);

  const cleanup = useCallback(() => {
    if (signalingUnsubRef.current) {
      signalingUnsubRef.current();
      signalingUnsubRef.current = null;
    }
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.cleanup();
      webrtcServiceRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsSpeaker(false);
    setConnectionState('new');
    isSettingUpRef.current = false;
  }, []);

  const startWebRTC = useCallback(
    async (currentCallId: string, initiator: boolean) => {
      if (isSettingUpRef.current) {
        return;
      }
      isSettingUpRef.current = true;

      try {
        const service = new WebRTCService();
        webrtcServiceRef.current = service;

        // Initialize audio
        await service.initialize();
        setLocalStream(service.getLocalStream());

        const role: SignalingRole = initiator ? 'caller' : 'callee';

        // Create peer connection
        const offer = await service.createConnection(initiator, {
          onIceCandidate: (candidate: RTCIceCandidateType) => {
            signalingService.sendIceCandidate(currentCallId, candidate, role);
          },
          onRemoteStream: (stream: MediaStream) => {
            setRemoteStream(stream);
          },
          onConnectionStateChange: (state: string) => {
            setConnectionState(state);
          },
        });

        if (initiator && offer) {
          // Caller flow: send offer, then listen for answer + callee ICE candidates
          await signalingService.sendOffer(currentCallId, offer);

          signalingUnsubRef.current = signalingService.subscribeToSignaling(
            currentCallId,
            'caller',
            {
              onAnswer: async answer => {
                try {
                  await service.setRemoteDescription(answer);
                } catch {
                  // Remote description may already be set
                }
              },
              onIceCandidate: async candidate => {
                try {
                  await service.addIceCandidate(candidate);
                } catch {
                  // Candidate may arrive before remote description
                }
              },
            },
          );
        } else {
          // Callee flow: listen for offer, create answer, listen for caller ICE candidates
          signalingUnsubRef.current = signalingService.subscribeToSignaling(
            currentCallId,
            'callee',
            {
              onOffer: async remoteOffer => {
                try {
                  await service.setRemoteDescription(remoteOffer);
                  const answer = await service.createAnswer();
                  await signalingService.sendAnswer(currentCallId, answer);
                } catch {
                  // Offer handling may fail if connection is already set up
                }
              },
              onIceCandidate: async candidate => {
                try {
                  await service.addIceCandidate(candidate);
                } catch {
                  // Candidate may arrive before remote description
                }
              },
            },
          );
        }
      } catch {
        cleanup();
      }
    },
    [cleanup],
  );

  // Start/stop WebRTC based on active flag
  useEffect(() => {
    if (active && callId) {
      startWebRTC(callId, isInitiator);
    } else if (!active) {
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [active, callId, isInitiator, startWebRTC, cleanup]);

  const endCall = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (webrtcServiceRef.current) {
      const muted = webrtcServiceRef.current.toggleMute();
      setIsMuted(muted);
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.toggleSpeaker();
      // Toggle local state since the service doesn't track this
      setIsSpeaker(prev => !prev);
    }
  }, []);

  return {
    localStream,
    remoteStream,
    isMuted,
    isSpeaker,
    connectionState,
    endCall,
    toggleMute,
    toggleSpeaker,
  };
}
