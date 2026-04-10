export type UserStatus = 'online' | 'busy' | 'in_call' | 'offline';

export interface User {
  uid: string;
  callsign: string;
  status: UserStatus;
  lastSeen: number;
}

export type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';

export interface Call {
  id: string;
  callerId: string;
  callerCallsign: string;
  calleeId: string;
  calleeCallsign: string;
  status: CallStatus;
  createdAt: number;
}

export interface RTCSessionDescriptionType {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface RTCIceCandidateType {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export type SignalingRole = 'caller' | 'callee';

export type RootStackParamList = {
  Login: undefined;
  Lobby: undefined;
  Call: {
    callId: string;
    isInitiator: boolean;
    remoteCallsign: string;
  };
};

export const FIREBASE_PATHS = {
  users: 'users',
  calls: 'calls',
  signaling: 'signaling',
} as const;

export const ICE_SERVERS: RTCIceServer[] = [
  {urls: 'stun:stun.l.google.com:19302'},
  {urls: 'stun:stun1.l.google.com:19302'},
  {urls: 'stun:stun2.l.google.com:19302'},
  {urls: 'stun:stun3.l.google.com:19302'},
  {urls: 'stun:stun4.l.google.com:19302'},
];

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export const CALL_TIMEOUT_MS = 30000;
