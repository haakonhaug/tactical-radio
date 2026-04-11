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

      // Buffer ICE candidates that arrive before remote description is set
      const pendingCandidates: RTCIceCandidateType[] = [];
      let remoteDescriptionSet = false;

      try {
        const service = new WebRTCService();
        webrtcServiceRef.current = service;

        await service.initialize();
        setLocalStream(service.getLocalStream());

        const role: SignalingRole = initiator ? 'caller' : 'callee';

        const applyCandidate = async (candidate: RTCIceCandidateType) => {
          if (!remoteDescriptionSet) {
            pendingCandidates.push(candidate);
            return;
          }
          try {
            await service.addIceCandidate(candidate);
          } catch (err) {
            console.warn('addIceCandidate failed', err);
          }
        };

        const flushPending = async () => {
          while (pendingCandidates.length > 0) {
            const candidate = pendingCandidates.shift()!;
            try {
              await service.addIceCandidate(candidate);
            } catch (err) {
              console.warn('addIceCandidate (flush) failed', err);
            }
          }
        };

        // Create peer connection (adds local tracks, sets up event handlers)
        const offer = await service.createConnection(initiator, {
          onIceCandidate: (candidate: RTCIceCandidateType) => {
            signalingService
              .sendIceCandidate(currentCallId, candidate, role)
              .catch(err => console.warn('sendIceCandidate failed', err));
          },
          onRemoteStream: (stream: MediaStream) => {
            setRemoteStream(stream);
          },
          onConnectionStateChange: (state: string) => {
            setConnectionState(state);
          },
        });

        if (initiator && offer) {
          // CALLER: subscribe FIRST, then send offer (avoid race)
          signalingUnsubRef.current = signalingService.subscribeToSignaling(
            currentCallId,
            'caller',
            {
              onAnswer: async answer => {
                if (remoteDescriptionSet) {
                  return;
                }
                try {
                  await service.setRemoteDescription(answer);
                  remoteDescriptionSet = true;
                  await flushPending();
                } catch (err) {
                  console.warn('setRemoteDescription (caller) failed', err);
                }
              },
              onIceCandidate: applyCandidate,
            },
          );

          await signalingService.sendOffer(currentCallId, offer);
        } else {
          // CALLEE: subscribe and wait for offer
          signalingUnsubRef.current = signalingService.subscribeToSignaling(
            currentCallId,
            'callee',
            {
              onOffer: async remoteOffer => {
                if (remoteDescriptionSet) {
                  return;
                }
                try {
                  await service.setRemoteDescription(remoteOffer);
                  remoteDescriptionSet = true;
                  const answer = await service.createAnswer();
                  await signalingService.sendAnswer(currentCallId, answer);
                  await flushPending();
                } catch (err) {
                  console.warn('callee offer handling failed', err);
                }
              },
              onIceCandidate: applyCandidate,
            },
          );
        }
      } catch (err) {
        console.warn('startWebRTC failed', err);
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
