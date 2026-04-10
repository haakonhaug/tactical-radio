import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { ICE_SERVERS, RTCSessionDescriptionType, RTCIceCandidateType } from '../types';

interface ConnectionCallbacks {
  onIceCandidate: (candidate: RTCIceCandidateType) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: string) => void;
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;

  async initialize(): Promise<void> {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    this.localStream = stream as MediaStream;
  }

  async createConnection(
    isInitiator: boolean,
    callbacks: ConnectionCallbacks,
  ): Promise<RTCSessionDescriptionType | null> {
    const configuration = {
      iceServers: ICE_SERVERS,
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Add local audio tracks to the connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // ICE candidate handler
    this.peerConnection.addEventListener('icecandidate', (event: any) => {
      if (event.candidate) {
        const candidate: RTCIceCandidateType = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        };
        callbacks.onIceCandidate(candidate);
      }
    });

    // Remote track handler
    this.peerConnection.addEventListener('track', (event: any) => {
      if (event.streams && event.streams[0]) {
        callbacks.onRemoteStream(event.streams[0]);
      }
    });

    // Connection state change handler
    this.peerConnection.addEventListener(
      'iceconnectionstatechange',
      () => {
        if (this.peerConnection) {
          callbacks.onConnectionStateChange(
            this.peerConnection.iceConnectionState,
          );
        }
      },
    );

    if (isInitiator) {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await this.peerConnection.setLocalDescription(offer);
      return {
        type: offer.type as 'offer',
        sdp: offer.sdp!,
      };
    }

    // Not initiator — will set remote description when offer arrives
    return null;
  }

  async setRemoteDescription(
    description: RTCSessionDescriptionType,
  ): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    const rtcDescription = new RTCSessionDescription(description);
    await this.peerConnection.setRemoteDescription(rtcDescription);
  }

  async createAnswer(): Promise<RTCSessionDescriptionType> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return {
      type: answer.type as 'answer',
      sdp: answer.sdp!,
    };
  }

  async addIceCandidate(candidate: RTCIceCandidateType): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    const rtcCandidate = new RTCIceCandidate(candidate);
    await this.peerConnection.addIceCandidate(rtcCandidate);
  }

  closeConnection(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // true = muted
      }
    }
    return false;
  }

  toggleSpeaker(): boolean {
    // On mobile, speaker toggling is device-specific.
    // react-native-webrtc does not expose a direct speaker toggle API.
    // This is typically handled via InCallManager or a native module.
    // Returning a toggled state for the UI to track.
    return false;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  cleanup(): void {
    this.closeConnection();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}

export default WebRTCService;
