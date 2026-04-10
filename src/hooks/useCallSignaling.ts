import { useState, useEffect, useRef, useCallback } from 'react';
import { signalingService } from '../services/SignalingService';
import { Call, CallStatus, CALL_TIMEOUT_MS } from '../types';

interface UseCallSignalingReturn {
  incomingCall: Call | null;
  outgoingCallId: string | null;
  callStatus: CallStatus | null;
  initiateCall: (
    calleeId: string,
    calleeCallsign: string,
    callerCallsign: string,
  ) => Promise<{ success: boolean; error?: string }>;
  respondToCall: (accept: boolean) => Promise<void>;
  endCall: () => Promise<void>;
  resetCallState: () => void;
}

export function useCallSignaling(uid: string | null): UseCallSignalingReturn {
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [outgoingCallId, setOutgoingCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);

  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callStatusUnsubRef = useRef<(() => void) | null>(null);
  const activeCallIdRef = useRef<string | null>(null);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  const unsubscribeCallStatus = useCallback(() => {
    if (callStatusUnsubRef.current) {
      callStatusUnsubRef.current();
      callStatusUnsubRef.current = null;
    }
  }, []);

  const resetCallState = useCallback(() => {
    clearCallTimeout();
    unsubscribeCallStatus();
    setIncomingCall(null);
    setOutgoingCallId(null);
    setCallStatus(null);
    activeCallIdRef.current = null;
  }, [clearCallTimeout, unsubscribeCallStatus]);

  // Subscribe to call status updates for a given callId
  const subscribeToCall = useCallback(
    (callId: string) => {
      unsubscribeCallStatus();
      callStatusUnsubRef.current = signalingService.subscribeToCallStatus(
        callId,
        (call: Call) => {
          setCallStatus(call.status);

          // Auto-cleanup on terminal states
          if (
            call.status === 'ended' ||
            call.status === 'rejected' ||
            call.status === 'missed'
          ) {
            clearCallTimeout();
          }
        },
      );
    },
    [clearCallTimeout, unsubscribeCallStatus],
  );

  // Subscribe to incoming calls when uid is set
  useEffect(() => {
    if (!uid) {
      return;
    }

    const unsubscribe = signalingService.subscribeToIncomingCalls(
      uid,
      (call: Call) => {
        setIncomingCall(call);
        activeCallIdRef.current = call.id;
        subscribeToCall(call.id);

        // Set timeout for unanswered incoming calls
        clearCallTimeout();
        callTimeoutRef.current = setTimeout(async () => {
          try {
            await signalingService.endCall(call.id, uid);
          } catch {
            // Call may already have been handled
          }
        }, CALL_TIMEOUT_MS);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [uid, subscribeToCall, clearCallTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCallTimeout();
      unsubscribeCallStatus();
    };
  }, [clearCallTimeout, unsubscribeCallStatus]);

  const initiateCall = useCallback(
    async (
      calleeId: string,
      calleeCallsign: string,
      callerCallsign: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!uid) {
        return { success: false, error: 'Not authenticated' };
      }

      const result = await signalingService.initiateCall(
        uid,
        callerCallsign,
        calleeId,
        calleeCallsign,
      );

      if (result.success && result.callId) {
        setOutgoingCallId(result.callId);
        activeCallIdRef.current = result.callId;
        subscribeToCall(result.callId);

        // Set timeout for unanswered outgoing calls
        clearCallTimeout();
        callTimeoutRef.current = setTimeout(async () => {
          try {
            await signalingService.endCall(result.callId!, uid);
          } catch {
            // Call may already have been handled
          }
        }, CALL_TIMEOUT_MS);

        return { success: true };
      }

      return { success: false, error: result.error };
    },
    [uid, subscribeToCall, clearCallTimeout],
  );

  const respondToCall = useCallback(
    async (accept: boolean): Promise<void> => {
      if (!incomingCall || !uid) {
        return;
      }

      clearCallTimeout();

      await signalingService.respondToCall(incomingCall.id, uid, accept);

      if (accept) {
        setOutgoingCallId(incomingCall.id);
        activeCallIdRef.current = incomingCall.id;
      }
      // Clear incoming call state in both cases — modal should dismiss
      setIncomingCall(null);
    },
    [incomingCall, uid, clearCallTimeout],
  );

  const endCall = useCallback(async (): Promise<void> => {
    const callId = activeCallIdRef.current;
    if (!callId || !uid) {
      return;
    }

    clearCallTimeout();

    try {
      await signalingService.endCall(callId, uid);
    } catch {
      // Call may already have been ended
    }

    resetCallState();
  }, [uid, clearCallTimeout, resetCallState]);

  return {
    incomingCall,
    outgoingCallId,
    callStatus,
    initiateCall,
    respondToCall,
    endCall,
    resetCallState,
  };
}
