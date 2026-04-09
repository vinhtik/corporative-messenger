import { apiClient } from "@/lib/api-client";

const ICE_CONFIG_ROUTE = "/api/calls/ice-config";

class CallManager {
  constructor() {
    this.socket = null;
    this.userId = null;

    this.callId = null;
    this.peerId = null;
    this.isInitiator = false;
    this.mode = "audio";

    this.pc = null;
    this.localStream = null;
    this.remoteStream = new MediaStream();

    this.videoSender = null;
    this.cameraTrack = null;
    this.screenTrack = null;

    this.pendingIce = [];
    this.iceConfig = { iceServers: [] };

    this.accepted = false;
    this.remoteReady = false;
    this.offerCreated = false;
    this.started = false;

    this.listeners = new Set();
  }

  setContext({ socket, userId }) {
    this.socket = socket;
    this.userId = userId ? String(userId) : null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  emitState() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  getState() {
    return {
      callId: this.callId,
      peerId: this.peerId,
      mode: this.mode,
      isInitiator: this.isInitiator,
      started: this.started,
      accepted: this.accepted,
      remoteReady: this.remoteReady,
      offerCreated: this.offerCreated,
      connectionState: this.pc?.connectionState || "new",
      iceConnectionState: this.pc?.iceConnectionState || "new",
      signalingState: this.pc?.signalingState || "stable",
      localStream: this.localStream,
      remoteStream: this.remoteStream,
      isMicEnabled: this.localStream?.getAudioTracks?.()[0]?.enabled ?? true,
      isCameraEnabled: this.cameraTrack?.enabled ?? (this.mode === "video"),
      isScreenSharing: Boolean(this.screenTrack),
    };
  }

  resetFlags() {
    this.accepted = !this.isInitiator;
    this.remoteReady = !this.isInitiator;
    this.offerCreated = false;
    this.pendingIce = [];
  }

  async init({ callId, peerId, isInitiator, mode }) {
    if (this.started) {
      await this.destroy(false);
    }

    this.callId = callId;
    this.peerId = String(peerId);
    this.isInitiator = Boolean(isInitiator);
    this.mode = mode === "video" ? "video" : "audio";
    this.started = true;
    this.resetFlags();
    this.remoteStream = new MediaStream();

    const rtcResponse = await apiClient.get(ICE_CONFIG_ROUTE, {
      withCredentials: true,
    });

    this.iceConfig = rtcResponse.data || { iceServers: [] };

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: this.mode === "video",
    });

    this.cameraTrack = this.localStream.getVideoTracks()[0] || null;

    this.pc = new RTCPeerConnection(this.iceConfig);

    this.pc.onicecandidate = (event) => {
      if (!event.candidate || !this.socket || !this.peerId || !this.userId) {
        return;
      }

      this.socket.emit("webrtc-ice-candidate", {
        callId: this.callId,
        toUserId: this.peerId,
        fromUserId: this.userId,
        candidate: event.candidate,
      });
    };

    this.pc.ontrack = (event) => {
      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          const exists = this.remoteStream.getTracks().some((t) => t.id === track.id);
          if (!exists) {
            this.remoteStream.addTrack(track);
          }
        });
      });

      this.emitState();
    };

    this.pc.onconnectionstatechange = () => {
      this.emitState();
    };

    this.pc.oniceconnectionstatechange = () => {
      this.emitState();
    };

    this.localStream.getTracks().forEach((track) => {
      const sender = this.pc.addTrack(track, this.localStream);

      if (track.kind === "video") {
        this.videoSender = sender;
      }
    });

    if (!this.isInitiator && this.socket) {
      this.socket.emit("webrtc-ready", {
        callId: this.callId,
        toUserId: this.peerId,
        fromUserId: this.userId,
      });
    }

    this.emitState();
  }

  async maybeCreateOffer() {
    if (!this.started || !this.pc) return;
    if (!this.isInitiator) return;
    if (!this.accepted) return;
    if (!this.remoteReady) return;
    if (this.offerCreated) return;
    if (this.pc.signalingState !== "stable") return;

    this.offerCreated = true;

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.socket.emit("webrtc-offer", {
      callId: this.callId,
      toUserId: this.peerId,
      fromUserId: this.userId,
      description: this.pc.localDescription,
    });

    this.emitState();
  }

  async handleAccepted(fromUserId) {
    if (!this.isInitiator) return;
    if (String(fromUserId) !== String(this.peerId)) return;

    this.accepted = true;
    await this.maybeCreateOffer();
  }

  async handleReady(fromUserId) {
    if (!this.isInitiator) return;
    if (String(fromUserId) !== String(this.peerId)) return;

    this.remoteReady = true;
    await this.maybeCreateOffer();
  }

  async handleOffer({ fromUserId, description }) {
    if (String(fromUserId) !== String(this.peerId)) return;
    if (!this.pc) return;
    if (this.pc.signalingState !== "stable") return;

    await this.pc.setRemoteDescription(new RTCSessionDescription(description));
    await this.flushPendingIce();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.socket.emit("webrtc-answer", {
      callId: this.callId,
      toUserId: this.peerId,
      fromUserId: this.userId,
      description: this.pc.localDescription,
    });

    this.emitState();
  }

  async handleAnswer({ fromUserId, description }) {
    if (String(fromUserId) !== String(this.peerId)) return;
    if (!this.pc) return;
    if (this.pc.signalingState !== "have-local-offer") return;

    await this.pc.setRemoteDescription(new RTCSessionDescription(description));
    await this.flushPendingIce();
    this.emitState();
  }

  async handleIceCandidate({ fromUserId, candidate }) {
    if (String(fromUserId) !== String(this.peerId)) return;
    if (!this.pc || !candidate) return;

    if (!this.pc.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      const message = String(error?.message || "");
      if (!message.includes("Unknown ufrag")) {
        console.log(error);
      }
    }
  }

  async flushPendingIce() {
    if (!this.pc || !this.pc.remoteDescription) return;

    while (this.pendingIce.length) {
      const candidate = this.pendingIce.shift();

      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        const message = String(error?.message || "");
        if (!message.includes("Unknown ufrag")) {
          console.log(error);
        }
      }
    }
  }

  toggleMicrophone() {
    const track = this.localStream?.getAudioTracks?.()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    this.emitState();
  }

  toggleCamera() {
    if (!this.cameraTrack) return;

    this.cameraTrack.enabled = !this.cameraTrack.enabled;
    this.emitState();
  }

  async toggleScreenShare() {
    if (this.mode !== "video" || !this.videoSender) return;

    if (this.screenTrack) {
      await this.videoSender.replaceTrack(this.cameraTrack);
      this.stopTrack(this.screenTrack);
      this.screenTrack = null;

      if (this.localStream && this.cameraTrack) {
        this.localStream.getVideoTracks().forEach((track) => {
          if (track.id !== this.cameraTrack.id) {
            this.localStream.removeTrack(track);
          }
        });

        const hasCamera = this.localStream
          .getVideoTracks()
          .some((track) => track.id === this.cameraTrack.id);

        if (!hasCamera) {
          this.localStream.addTrack(this.cameraTrack);
        }
      }

      this.emitState();
      return;
    }

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    const screenTrack = displayStream.getVideoTracks()[0];
    if (!screenTrack) return;

    this.screenTrack = screenTrack;
    await this.videoSender.replaceTrack(screenTrack);

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => this.localStream.removeTrack(track));
      this.localStream.addTrack(screenTrack);
    }

    screenTrack.onended = async () => {
      if (!this.videoSender || !this.cameraTrack) return;

      await this.videoSender.replaceTrack(this.cameraTrack);

      if (this.localStream) {
        this.localStream.getVideoTracks().forEach((track) => {
          if (track.id !== this.cameraTrack.id) {
            this.localStream.removeTrack(track);
          }
        });

        const hasCamera = this.localStream
          .getVideoTracks()
          .some((track) => track.id === this.cameraTrack.id);

        if (!hasCamera) {
          this.localStream.addTrack(this.cameraTrack);
        }
      }

      this.stopTrack(this.screenTrack);
      this.screenTrack = null;
      this.emitState();
    };

    this.emitState();
  }

  stopTrack(track) {
    if (!track) return;
    try {
      track.stop();
    } catch (error) {
      console.log(error);
    }
  }

  async destroy(notifyPeer = true) {
    if (notifyPeer && this.socket && this.peerId && this.userId && this.callId) {
      this.socket.emit("end-call", {
        callId: this.callId,
        toUserId: this.peerId,
        fromUserId: this.userId,
      });
    }

    if (this.pc) {
      try {
        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.onconnectionstatechange = null;
        this.pc.oniceconnectionstatechange = null;
        this.pc.close();
      } catch (error) {
        console.log(error);
      }
    }

    this.stopTrack(this.screenTrack);
    this.screenTrack = null;

    stopStream(this.localStream);
    stopStream(this.remoteStream);

    this.pc = null;
    this.localStream = null;
    this.remoteStream = createEmptyStream();
    this.cameraTrack = null;
    this.videoSender = null;

    this.callId = null;
    this.peerId = null;
    this.started = false;
    this.mode = "audio";
    this.isInitiator = false;
    this.resetFlags();

    this.emitState();
  }
}

export const callManager = new CallManager();