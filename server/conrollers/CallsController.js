import { AccessToken } from "livekit-server-sdk";
import { getWebrtcConfig } from "../lib/webrtcConfig.js";

export const getIceConfig = async (request, response) => {
  try {
    const rtcConfig = getWebrtcConfig();
    return response.status(200).json(rtcConfig);
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};

export const createLivekitToken = async (request, response) => {
  try {
    const roomName = String(request.body?.roomName || "").trim();
    const participantName = String(request.body?.name || "").trim();
    const metadata = request.body?.metadata || {};

    if (!roomName) {
      return response.status(400).json({
        message: "roomName is required",
      });
    }

    if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return response.status(500).json({
        message: "LiveKit env vars are missing",
      });
    }

    const identity = String(request.userId);

    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity,
        ttl: "2h",
        name: participantName || `user-${identity}`,
        metadata: JSON.stringify(metadata),
      }
    );

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    return response.status(200).json({
      token: jwt,
      url: process.env.LIVEKIT_URL,
      roomName,
      identity,
    });
  } catch (err) {
    console.log({ err });
    return response.status(500).send("Internal Server Error");
  }
};