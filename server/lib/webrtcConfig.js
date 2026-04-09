const normalizeIceUrl = (value) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const splitIceUrls = (value) => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => normalizeIceUrl(item))
    .filter(Boolean);
};

export const getIceServers = () => {
  const iceServers = [];

  const stunUrls = splitIceUrls(process.env.STUN_URLS);
  const turnUrls = splitIceUrls(process.env.TURN_URLS);

  if (stunUrls.length) {
    iceServers.push({
      urls: stunUrls,
    });
  }

  if (turnUrls.length) {
    const username = process.env.TURN_USERNAME?.trim();
    const credential = process.env.TURN_PASSWORD?.trim();

    if (username && credential) {
      iceServers.push({
        urls: turnUrls,
        username,
        credential,
      });
    }
  }

  return iceServers;
};

export const getWebrtcConfig = () => {
  return {
    iceServers: getIceServers(),
  };
};