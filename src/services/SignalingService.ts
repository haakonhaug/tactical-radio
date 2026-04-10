import { db } from '../config/firebase';
import {
  Call,
  CallStatus,
  RTCSessionDescriptionType,
  RTCIceCandidateType,
  SignalingRole,
  FIREBASE_PATHS,
} from '../types';

interface InitiateCallResult {
  success: boolean;
  callId?: string;
  error?: string;
}

interface SignalingCallbacks {
  onOffer?: (offer: RTCSessionDescriptionType) => void;
  onAnswer?: (answer: RTCSessionDescriptionType) => void;
  onIceCandidate?: (candidate: RTCIceCandidateType) => void;
}

class SignalingService {
  async initiateCall(
    callerId: string,
    callerCallsign: string,
    calleeId: string,
    calleeCallsign: string,
  ): Promise<InitiateCallResult> {
    const calleeStatusRef = db.ref(
      `${FIREBASE_PATHS.users}/${calleeId}/status`,
    );

    try {
      const transactionResult = await calleeStatusRef.transaction(
        (currentStatus: string | null) => {
          if (currentStatus === 'online') {
            return 'busy';
          }
          // Abort transaction — user is not available
          return undefined;
        },
      );

      if (!transactionResult.committed) {
        return { success: false, error: 'User is busy' };
      }

      // Transaction succeeded — callee is now "busy"
      // Set caller status to "busy"
      await db
        .ref(`${FIREBASE_PATHS.users}/${callerId}/status`)
        .set('busy');

      // Generate call ID
      const callId = db.ref(FIREBASE_PATHS.calls).push().key!;

      // Create call record
      const call: Omit<Call, 'id'> & { id: string } = {
        id: callId,
        callerId,
        callerCallsign,
        calleeId,
        calleeCallsign,
        status: 'ringing',
        createdAt: Date.now(),
      };

      await db.ref(`${FIREBASE_PATHS.calls}/${callId}`).set(call);

      // Create empty signaling record
      await db.ref(`${FIREBASE_PATHS.signaling}/${callId}`).set({});

      return { success: true, callId };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to initiate call',
      };
    }
  }

  async respondToCall(
    callId: string,
    _calleeId: string,
    accept: boolean,
  ): Promise<void> {
    // Read call record to get both user IDs
    const callSnapshot = await db
      .ref(`${FIREBASE_PATHS.calls}/${callId}`)
      .once('value');
    const call: Call = callSnapshot.val();

    if (!call) {
      throw new Error('Call not found');
    }

    if (accept) {
      const updates: Record<string, unknown> = {
        [`${FIREBASE_PATHS.calls}/${callId}/status`]: 'accepted' as CallStatus,
        [`${FIREBASE_PATHS.users}/${call.callerId}/status`]: 'in_call',
        [`${FIREBASE_PATHS.users}/${call.calleeId}/status`]: 'in_call',
      };
      await db.ref().update(updates);
    } else {
      const updates: Record<string, unknown> = {
        [`${FIREBASE_PATHS.calls}/${callId}/status`]: 'rejected' as CallStatus,
        [`${FIREBASE_PATHS.users}/${call.callerId}/status`]: 'online',
        [`${FIREBASE_PATHS.users}/${call.calleeId}/status`]: 'online',
      };
      await db.ref().update(updates);
    }
  }

  async endCall(callId: string, _userId: string): Promise<void> {
    // Read call record to get both user IDs
    const callSnapshot = await db
      .ref(`${FIREBASE_PATHS.calls}/${callId}`)
      .once('value');
    const call: Call = callSnapshot.val();

    if (!call) {
      throw new Error('Call not found');
    }

    const updates: Record<string, unknown> = {
      [`${FIREBASE_PATHS.calls}/${callId}/status`]: 'ended' as CallStatus,
      [`${FIREBASE_PATHS.users}/${call.callerId}/status`]: 'online',
      [`${FIREBASE_PATHS.users}/${call.calleeId}/status`]: 'online',
    };
    await db.ref().update(updates);

    // Clean up signaling data
    await db.ref(`${FIREBASE_PATHS.signaling}/${callId}`).remove();
  }

  subscribeToIncomingCalls(
    uid: string,
    callback: (call: Call) => void,
  ): () => void {
    const callsRef = db
      .ref(FIREBASE_PATHS.calls)
      .orderByChild('calleeId')
      .equalTo(uid);

    const onChildAdded = callsRef.on('child_added', snapshot => {
      const call: Call = snapshot.val();
      if (call && call.status === 'ringing') {
        callback(call);
      }
    });

    const onChildChanged = callsRef.on('child_changed', snapshot => {
      const call: Call = snapshot.val();
      if (call && call.status === 'ringing') {
        callback(call);
      }
    });

    return () => {
      callsRef.off('child_added', onChildAdded);
      callsRef.off('child_changed', onChildChanged);
    };
  }

  subscribeToCallStatus(
    callId: string,
    callback: (call: Call) => void,
  ): () => void {
    const callRef = db.ref(`${FIREBASE_PATHS.calls}/${callId}`);

    const onValue = callRef.on('value', snapshot => {
      const call: Call = snapshot.val();
      if (call) {
        callback(call);
      }
    });

    return () => {
      callRef.off('value', onValue);
    };
  }

  async sendOffer(
    callId: string,
    offer: RTCSessionDescriptionType,
  ): Promise<void> {
    await db.ref(`${FIREBASE_PATHS.signaling}/${callId}/offer`).set(offer);
  }

  async sendAnswer(
    callId: string,
    answer: RTCSessionDescriptionType,
  ): Promise<void> {
    await db.ref(`${FIREBASE_PATHS.signaling}/${callId}/answer`).set(answer);
  }

  async sendIceCandidate(
    callId: string,
    candidate: RTCIceCandidateType,
    role: SignalingRole,
  ): Promise<void> {
    const path =
      role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
    await db
      .ref(`${FIREBASE_PATHS.signaling}/${callId}/${path}`)
      .push(candidate);
  }

  subscribeToSignaling(
    callId: string,
    role: SignalingRole,
    callbacks: SignalingCallbacks,
  ): () => void {
    const unsubscribes: Array<() => void> = [];
    const signalingBase = `${FIREBASE_PATHS.signaling}/${callId}`;

    if (role === 'caller') {
      // Caller listens for answer + calleeCandidates
      if (callbacks.onAnswer) {
        const answerRef = db.ref(`${signalingBase}/answer`);
        const onAnswer = answerRef.on('value', snapshot => {
          const answer = snapshot.val();
          if (answer) {
            callbacks.onAnswer!(answer as RTCSessionDescriptionType);
          }
        });
        unsubscribes.push(() => answerRef.off('value', onAnswer));
      }

      if (callbacks.onIceCandidate) {
        const candidatesRef = db.ref(`${signalingBase}/calleeCandidates`);
        const onCandidate = candidatesRef.on('child_added', snapshot => {
          const candidate = snapshot.val();
          if (candidate) {
            callbacks.onIceCandidate!(candidate as RTCIceCandidateType);
          }
        });
        unsubscribes.push(() =>
          candidatesRef.off('child_added', onCandidate),
        );
      }
    } else {
      // Callee listens for offer + callerCandidates
      if (callbacks.onOffer) {
        const offerRef = db.ref(`${signalingBase}/offer`);
        const onOffer = offerRef.on('value', snapshot => {
          const offer = snapshot.val();
          if (offer) {
            callbacks.onOffer!(offer as RTCSessionDescriptionType);
          }
        });
        unsubscribes.push(() => offerRef.off('value', onOffer));
      }

      if (callbacks.onIceCandidate) {
        const candidatesRef = db.ref(`${signalingBase}/callerCandidates`);
        const onCandidate = candidatesRef.on('child_added', snapshot => {
          const candidate = snapshot.val();
          if (candidate) {
            callbacks.onIceCandidate!(candidate as RTCIceCandidateType);
          }
        });
        unsubscribes.push(() =>
          candidatesRef.off('child_added', onCandidate),
        );
      }
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }
}

export const signalingService = new SignalingService();
