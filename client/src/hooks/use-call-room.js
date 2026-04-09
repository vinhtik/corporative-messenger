import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CALL_EVENTS } from "@/call/actions";
import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/store";

const ICE_CONFIG_ROUTE = "api/calls/ice-config";

const buildUserPayload = (userInfo) => ({
  _id: userInfo.id,
  firstName: userInfo.firstName,
  lastName: userInfo.lastName,
  email: userInfo.email,
  image: userInfo.image,
  color: userInfo.color,
});

const summarizeConnectionStates = (statesMap) => {
  const states = Object.values(statesMap);

  if (!states.length) {
    return "waiting";
  }

  if (states.includes("connected")) {
    return "connected";
  }

  if (states.includes("connecting")) {
    return "connecting";
  }

  if (states.includes("disconnected")) {
    return "disconnected";
  }

  if (states.includes("failed")) {
    return "failed";
  }

  if (states.includes("closed")) {
    return "closed";
  }

  return states[0] || "waiting";
};

const summarizeIceStates = (statesMap) => {
  const states = Object.values(statesMap);

  if (!states.length) {
    return "waiting";
  }

  if (states.includes("connected")) {
    return "connected";
  }

  if (states.includes("completed")) {
    return "completed";
  }

  if (states.includes("checking")) {
    return "checking";
  }

  if (states.includes("disconnected")) {
    return "disconnected";
  }

  if (states.includes("failed")) {
    return "failed";
  }

  if (states.includes("closed")) {
    return "closed";
  }

  return states[0] || "waiting";
};

const upsertParticipant = (list, nextParticipant) => {
  const existing = list.find((item) => item.peerID === nextParticipant.peerID);

  if (!existing) {
    return [...list, nextParticipant];
  }

  return list.map((item) =>
    item.peerID === nextParticipant.peerID
      ? {
          ...item,
          ...nextParticipant,
          user: nextParticipant.user ?? item.user ?? null,
          stream: nextParticipant.stream ?? item.stream ?? null,
        }
      : item
  );
};

export const useCallRoom = ({
  socket,
  callId,
  peerId,
  isInitiator,
  mode = "audio",
  chatType = "contact",
  channelId,
}) => {
  const { userInfo } = useAppStore();

  const initialCallState = useMemo(
    () => (isInitiator ? "ringing" : "connecting"),
    [isInitiator]
  );

  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [callState, setCallState] = useState(initialCallState);
  const [connectionState, setConnectionState] = useState("waiting");
  const [iceConnectionState, setIceConnectionState] = useState("waiting");
  const [localStream, setLocalStream] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(mode === "video");
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const rtcConfigRef = useRef({ iceServers: [] });
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const pendingIceCandidatesRef = useRef({});
  const connectionStatesRef = useRef({});
  const iceConnectionStatesRef = useRef({});
  const joinedRoomRef = useRef(false);
  const hasEndedRef = useRef(false);
  const screenTrackRef = useRef(null);
  const originalCameraTrackRef = useRef(null);

  const syncLocalPreview = useCallback(() => {
    if (!localStreamRef.current) {
      setLocalStream(null);
      return;
    }

    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
  }, []);

  const refreshConnectionSummaries = useCallback(() => {
    setConnectionState(summarizeConnectionStates(connectionStatesRef.current));
    setIceConnectionState(summarizeIceStates(iceConnectionStatesRef.current));
  }, []);

  const closeAllPeerConnections = useCallback(() => {
    Object.values(peerConnectionsRef.current).forEach((peerConnection) => {
      try {
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.close();
      } catch (err) {
        console.error("Error closing peer connection:", err);
      }
    });

    peerConnectionsRef.current = {};
    pendingIceCandidatesRef.current = {};
    connectionStatesRef.current = {};
    iceConnectionStatesRef.current = {};
    setRemoteParticipants([]);
    setConnectionState("waiting");
    setIceConnectionState("waiting");
  }, []);

  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.error("Error stopping track:", err);
        }
      });
    }

    localStreamRef.current = null;
    screenTrackRef.current = null;
    originalCameraTrackRef.current = null;
    setLocalStream(null);
    setIsScreenSharing(false);
  }, []);

  const leaveRoomOnServer = useCallback(() => {
    if (!socket || !callId || !joinedRoomRef.current) {
      return;
    }

    socket.emit(CALL_EVENTS.LEAVE_CALL_ROOM, {
      callId,
      chatType,
      channelId,
    });

    joinedRoomRef.current = false;
  }, [socket, callId, chatType, channelId]);

  const replaceVideoTrackForPeers = useCallback(async (nextTrack) => {
    const peerConnections = Object.values(peerConnectionsRef.current);

    await Promise.all(
      peerConnections.map(async (peerConnection) => {
        const videoSender = peerConnection
          .getSenders()
          .find((sender) => sender.track && sender.track.kind === "video");

        if (videoSender) {
          await videoSender.replaceTrack(nextTrack || null);
          return;
        }

        if (nextTrack && localStreamRef.current) {
          peerConnection.addTrack(nextTrack, localStreamRef.current);
        }
      })
    );
  }, []);

  const flushPendingIceCandidates = useCallback(async (peerID) => {
    const peerConnection = peerConnectionsRef.current[peerID];
    const pendingCandidates = pendingIceCandidatesRef.current[peerID] || [];

    if (!peerConnection || !peerConnection.remoteDescription || !pendingCandidates.length) {
      return;
    }

    pendingIceCandidatesRef.current[peerID] = [];

    for (const candidate of pendingCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error applying pending ICE candidate:", err);
      }
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    const stream = localStreamRef.current;
    const screenTrack = screenTrackRef.current;
    const fallbackCameraTrack = originalCameraTrackRef.current;

    if (!stream || !screenTrack) {
      return;
    }

    try {
      stream.removeTrack(screenTrack);
    } catch (err) {
      console.error("Error removing screen track:", err);
    }

    try {
      screenTrack.stop();
    } catch (err) {
      console.error("Error stopping screen track:", err);
    }

    screenTrackRef.current = null;

    if (fallbackCameraTrack) {
      const hasFallbackTrack = stream
        .getVideoTracks()
        .some((track) => track.id === fallbackCameraTrack.id);

      if (!hasFallbackTrack) {
        stream.addTrack(fallbackCameraTrack);
      }

      await replaceVideoTrackForPeers(fallbackCameraTrack);
      setIsCameraEnabled(Boolean(fallbackCameraTrack.enabled));
    } else {
      await replaceVideoTrackForPeers(null);
      setIsCameraEnabled(false);
    }

    setIsScreenSharing(false);
    syncLocalPreview();
  }, [replaceVideoTrackForPeers, syncLocalPreview]);

  const cleanupLocalRoomState = useCallback(
    ({ stopLocal = true } = {}) => {
      closeAllPeerConnections();

      if (stopLocal) {
        stopLocalMedia();
      }
    },
    [closeAllPeerConnections, stopLocalMedia]
  );

  const endCall = useCallback(() => {
    if (!socket || !callId) {
      return;
    }

    hasEndedRef.current = true;
    joinedRoomRef.current = false;

    socket.emit("end-call", {
      callId,
      chatType,
      channelId,
      toUserId: peerId || null,
    });

    cleanupLocalRoomState({ stopLocal: true });
    setErrorText("Вы завершили звонок.");
    setCallState("ended");
  }, [socket, callId, chatType, channelId, peerId, cleanupLocalRoomState]);

  const handleRemovePeer = useCallback(
    ({ peerID }) => {
      const peerConnection = peerConnectionsRef.current[peerID];

      if (peerConnection) {
        try {
          peerConnection.close();
        } catch (err) {
          console.error("Error closing removed peer connection:", err);
        }
      }

      delete peerConnectionsRef.current[peerID];
      delete pendingIceCandidatesRef.current[peerID];
      delete connectionStatesRef.current[peerID];
      delete iceConnectionStatesRef.current[peerID];

      setRemoteParticipants((prev) => prev.filter((item) => item.peerID !== peerID));
      refreshConnectionSummaries();
    },
    [refreshConnectionSummaries]
  );

  const handleAddPeer = useCallback(
    async ({ peerID, createOffer, peerUser }) => {
      if (!localStreamRef.current) {
        return;
      }

      if (peerConnectionsRef.current[peerID]) {
        return;
      }

      const peerConnection = new RTCPeerConnection(rtcConfigRef.current || { iceServers: [] });
      peerConnectionsRef.current[peerID] = peerConnection;

      connectionStatesRef.current[peerID] = peerConnection.connectionState;
      iceConnectionStatesRef.current[peerID] = peerConnection.iceConnectionState;
      refreshConnectionSummaries();

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }

        socket.emit(CALL_EVENTS.RELAY_ICE, {
          callId,
          peerID,
          iceCandidate: event.candidate,
        });
      };

      peerConnection.onconnectionstatechange = () => {
        connectionStatesRef.current[peerID] = peerConnection.connectionState;
        refreshConnectionSummaries();
      };

      peerConnection.oniceconnectionstatechange = () => {
        iceConnectionStatesRef.current[peerID] = peerConnection.iceConnectionState;
        refreshConnectionSummaries();
      };

      peerConnection.ontrack = ({ streams }) => {
        const [remoteStream] = streams;

        if (!remoteStream) {
          return;
        }

        setRemoteParticipants((prev) =>
          upsertParticipant(prev, {
            peerID,
            user: peerUser || null,
            stream: remoteStream,
          })
        );

        setCallState("connected");
      };

      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });

      if (createOffer) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit(CALL_EVENTS.RELAY_SDP, {
          callId,
          peerID,
          sessionDescription: offer,
        });
      }
    },
    [socket, callId, refreshConnectionSummaries]
  );

  const handleSessionDescription = useCallback(
    async ({ peerID, sessionDescription, peerUser }) => {
      if (!peerConnectionsRef.current[peerID]) {
        await handleAddPeer({
          peerID,
          createOffer: false,
          peerUser,
        });
      }

      const peerConnection = peerConnectionsRef.current[peerID];

      if (!peerConnection) {
        return;
      }

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(sessionDescription)
      );

      setRemoteParticipants((prev) =>
        upsertParticipant(prev, {
          peerID,
          user: peerUser || null,
        })
      );

      await flushPendingIceCandidates(peerID);

      if (sessionDescription.type === "offer") {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit(CALL_EVENTS.RELAY_SDP, {
          callId,
          peerID,
          sessionDescription: answer,
        });
      }
    },
    [handleAddPeer, flushPendingIceCandidates, socket, callId]
  );

  const handleIceCandidate = useCallback(
    async ({ peerID, iceCandidate }) => {
      const peerConnection = peerConnectionsRef.current[peerID];

      if (!peerConnection || !peerConnection.remoteDescription) {
        pendingIceCandidatesRef.current[peerID] = [
          ...(pendingIceCandidatesRef.current[peerID] || []),
          iceCandidate,
        ];
        return;
      }

      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
      } catch (err) {
        pendingIceCandidatesRef.current[peerID] = [
          ...(pendingIceCandidatesRef.current[peerID] || []),
          iceCandidate,
        ];
      }
    },
    []
  );

  const handleCallEnded = useCallback(
    (payload) => {
      if (!payload?.callId || payload.callId !== callId) {
        return;
      }

      hasEndedRef.current = true;
      joinedRoomRef.current = false;

      cleanupLocalRoomState({ stopLocal: true });

      const reason =
        payload.reason === "rejected"
          ? "Пользователь отклонил звонок."
          : "Собеседник завершил звонок.";

      setErrorText(reason);
      setCallState("ended");
      setIsLoading(false);
    },
    [callId, cleanupLocalRoomState]
  );

  const toggleMicrophone = useCallback(() => {
    const stream = localStreamRef.current;

    if (!stream) {
      return;
    }

    const audioTracks = stream.getAudioTracks();

    if (!audioTracks.length) {
      return;
    }

    const nextEnabled = !audioTracks[0].enabled;

    audioTracks.forEach((track) => {
      track.enabled = nextEnabled;
    });

    setIsMicEnabled(nextEnabled);
  }, []);

  const toggleCamera = useCallback(async () => {
    if (mode !== "video" || screenTrackRef.current) {
      return;
    }

    const stream = localStreamRef.current;

    if (!stream) {
      return;
    }

    const currentVideoTrack = stream.getVideoTracks()[0];

    if (currentVideoTrack) {
      const nextEnabled = !currentVideoTrack.enabled;
      currentVideoTrack.enabled = nextEnabled;
      setIsCameraEnabled(nextEnabled);
      syncLocalPreview();
      return;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
        },
      });

      const [newVideoTrack] = cameraStream.getVideoTracks();

      if (!newVideoTrack) {
        return;
      }

      stream.addTrack(newVideoTrack);
      originalCameraTrackRef.current = newVideoTrack;
      await replaceVideoTrackForPeers(newVideoTrack);
      setIsCameraEnabled(true);
      syncLocalPreview();
    } catch (err) {
      console.error(err);
      setErrorText("Не удалось включить камеру.");
    }
  }, [mode, replaceVideoTrackForPeers, syncLocalPreview]);

  const toggleScreenShare = useCallback(async () => {
    if (mode !== "video" || !localStreamRef.current) {
      return;
    }

    if (screenTrackRef.current) {
      await stopScreenShare();
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const [nextScreenTrack] = displayStream.getVideoTracks();

      if (!nextScreenTrack) {
        return;
      }

      const stream = localStreamRef.current;
      const currentVideoTrack = stream.getVideoTracks()[0] || null;

      if (currentVideoTrack) {
        originalCameraTrackRef.current = currentVideoTrack;
        stream.removeTrack(currentVideoTrack);
      }

      stream.addTrack(nextScreenTrack);
      screenTrackRef.current = nextScreenTrack;

      await replaceVideoTrackForPeers(nextScreenTrack);

      nextScreenTrack.onended = () => {
        stopScreenShare();
      };

      setIsScreenSharing(true);
      setIsCameraEnabled(true);
      syncLocalPreview();
    } catch (err) {
      console.error(err);
      setErrorText("Не удалось начать демонстрацию экрана.");
    }
  }, [mode, replaceVideoTrackForPeers, stopScreenShare, syncLocalPreview]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.on(CALL_EVENTS.ADD_PEER, handleAddPeer);
    socket.on(CALL_EVENTS.SESSION_DESCRIPTION, handleSessionDescription);
    socket.on(CALL_EVENTS.ICE_CANDIDATE, handleIceCandidate);
    socket.on(CALL_EVENTS.REMOVE_PEER, handleRemovePeer);
    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off(CALL_EVENTS.ADD_PEER, handleAddPeer);
      socket.off(CALL_EVENTS.SESSION_DESCRIPTION, handleSessionDescription);
      socket.off(CALL_EVENTS.ICE_CANDIDATE, handleIceCandidate);
      socket.off(CALL_EVENTS.REMOVE_PEER, handleRemovePeer);
      socket.off("call-ended", handleCallEnded);
    };
  }, [
    socket,
    handleAddPeer,
    handleSessionDescription,
    handleIceCandidate,
    handleRemovePeer,
    handleCallEnded,
  ]);

  useEffect(() => {
    if (!socket || !callId || !userInfo?.id) {
      return;
    }

    let cancelled = false;

    const startCallRoom = async () => {
      try {
        setIsLoading(true);
        setErrorText("");
        setCallState(initialCallState);

        const rtcConfigResponse = await apiClient.get(ICE_CONFIG_ROUTE, {
          withCredentials: true,
        });

        rtcConfigRef.current = rtcConfigResponse?.data || { iceServers: [] };

        const mediaConstraints =
          mode === "video"
            ? {
                audio: true,
                video: {
                  width: 1280,
                  height: 720,
                },
              }
            : {
                audio: true,
                video: false,
              };

        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        originalCameraTrackRef.current = stream.getVideoTracks()[0] || null;

        setLocalStream(stream);
        setIsMicEnabled(Boolean(stream.getAudioTracks()[0]?.enabled ?? true));
        setIsCameraEnabled(
          mode === "video" ? Boolean(stream.getVideoTracks()[0]?.enabled ?? true) : false
        );

        socket.emit(CALL_EVENTS.JOIN_CALL_ROOM, {
          callId,
          chatType,
          channelId,
          user: buildUserPayload(userInfo),
        });

        joinedRoomRef.current = true;
        setIsLoading(false);
      } catch (err) {
        console.error(err);
        setErrorText("Не удалось получить доступ к микрофону или камере.");
        setCallState("ended");
        setIsLoading(false);
      }
    };

    startCallRoom();

    return () => {
      cancelled = true;

      if (!hasEndedRef.current) {
        leaveRoomOnServer();
      }

      cleanupLocalRoomState({ stopLocal: true });
    };
  }, [
    socket,
    callId,
    userInfo,
    mode,
    chatType,
    channelId,
    initialCallState,
    leaveRoomOnServer,
    cleanupLocalRoomState,
  ]);

  useEffect(() => {
    if (hasEndedRef.current || isLoading) {
      return;
    }

    if (remoteParticipants.length > 0) {
      setCallState("connected");
      return;
    }

    setCallState(initialCallState);
  }, [remoteParticipants.length, isLoading, initialCallState]);

  return {
    isLoading,
    errorText,
    callState,
    connectionState,
    iceConnectionState,
    localStream,
    remoteParticipants,
    isMicEnabled,
    isCameraEnabled,
    isScreenSharing,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    endCall,
  };
};