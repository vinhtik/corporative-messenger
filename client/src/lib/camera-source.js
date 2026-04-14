const STORAGE_KEY = "preferred-camera-device-id";

const VIRTUAL_CAMERA_RE =
  /(obs|manycam|snap camera|droidcam|epoccam|iriun|camo|xsplit|ndi|virtual)/i;

const isMobileDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent || "");
};

const safeGetStoredId = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

const safeStoreId = (deviceId) => {
  if (!deviceId) return;

  try {
    localStorage.setItem(STORAGE_KEY, deviceId);
  } catch {
    // ignore
  }
};

const stopStreamSafely = (stream) => {
  if (!stream) return;

  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (error) {
      console.log("track.stop error", error);
    }
  });
};

export const rememberCameraFromStream = (stream) => {
  const track = stream?.getVideoTracks?.()[0];
  const deviceId = track?.getSettings?.().deviceId || "";

  if (deviceId) {
    safeStoreId(deviceId);
  }

  return deviceId;
};

export const listVideoInputs = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
};

const rankDevices = (devices) => {
  const storedId = safeGetStoredId();

  const score = (device) => {
    if (storedId && device.deviceId === storedId) return 0;
    if (device.deviceId !== "default" && !VIRTUAL_CAMERA_RE.test(device.label || "")) {
      return 1;
    }
    if (device.deviceId !== "default") return 2;
    if (!VIRTUAL_CAMERA_RE.test(device.label || "")) return 3;
    return 4;
  };

  return [...devices].sort((a, b) => score(a) - score(b));
};

export const resolveWorkingCameraDeviceId = async () => {
  const devices = rankDevices(await listVideoInputs());

  for (const device of devices) {
    if (!device.deviceId) continue;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: { exact: device.deviceId },
        },
      });

      const actualId =
        stream.getVideoTracks?.()[0]?.getSettings?.().deviceId || device.deviceId;

      safeStoreId(actualId);
      stopStreamSafely(stream);
      return actualId;
    } catch (error) {
      console.log("camera probe failed", device.label || device.deviceId, error);
    }
  }

  return safeGetStoredId();
};

export const getPreferredVideoConstraints = async ({
  facingMode = "user",
  width,
  height,
  aspectRatio,
} = {}) => {
  const base = {};

  if (width) base.width = { ideal: width };
  if (height) base.height = { ideal: height };
  if (aspectRatio) base.aspectRatio = aspectRatio;

  if (isMobileDevice()) {
    return {
      ...base,
      facingMode: { ideal: facingMode },
    };
  }

  const deviceId = await resolveWorkingCameraDeviceId();

  if (deviceId) {
    return {
      ...base,
      deviceId: { exact: deviceId },
    };
  }

  return base;
};

export const getPreferredLiveKitCameraOptions = async () => {
  if (isMobileDevice()) {
    return {
      facingMode: "user",
    };
  }

  const deviceId = await resolveWorkingCameraDeviceId();

  if (!deviceId) {
    return undefined;
  }

  return {
    deviceId: { exact: deviceId },
  };
};
