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