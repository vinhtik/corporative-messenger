const DEFAULT_RELEASE_DELAY = 500;

let activeOwner = null;
let activeStream = null;
let activeRelease = null;
let queue = Promise.resolve();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runSerialized = async (task) => {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
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

const releaseCurrentOwnerInternal = async (reason = "unknown") => {
  const release = activeRelease;
  const stream = activeStream;

  activeOwner = null;
  activeRelease = null;
  activeStream = null;

  if (release) {
    try {
      await release({ reason });
    } catch (error) {
      console.log("activeRelease error", error);
    }
  }

  stopStreamSafely(stream);
  await wait(DEFAULT_RELEASE_DELAY);
};

export const requestManagedUserMedia = async ({
  owner,
  constraints,
  releaseDelayMs = DEFAULT_RELEASE_DELAY,
}) => {
  if (!owner) {
    throw new Error("owner is required");
  }

  return runSerialized(async () => {
    if (activeOwner) {
      await releaseCurrentOwnerInternal("before-user-media");
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    activeOwner = owner;
    activeStream = stream;
    activeRelease = async () => {
      stopStreamSafely(stream);
      await wait(releaseDelayMs);
    };

    return stream;
  });
};

export const warmupManagedMedia = async ({ constraints }) => {
  return runSerialized(async () => {
    if (activeOwner) {
      await releaseCurrentOwnerInternal("before-warmup");
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stopStreamSafely(stream);
    await wait(DEFAULT_RELEASE_DELAY);
  });
};

export const registerManagedExternalOwner = async ({ owner, release }) => {
  if (!owner) {
    throw new Error("owner is required");
  }

  return runSerialized(async () => {
    if (activeOwner && activeOwner !== owner) {
      await releaseCurrentOwnerInternal("switch-owner");
    }

    activeOwner = owner;
    activeStream = null;
    activeRelease = release
      ? async (context) => {
          await release(context);
          await wait(DEFAULT_RELEASE_DELAY);
        }
      : null;
  });
};

export const releaseManagedOwner = async (owner) => {
  if (!owner) return;

  return runSerialized(async () => {
    if (activeOwner === owner) {
      await releaseCurrentOwnerInternal("owner-release");
    }
  });
};

export const releaseAllManagedMedia = async () => {
  return runSerialized(async () => {
    if (activeOwner) {
      await releaseCurrentOwnerInternal("release-all");
    }
  });
};
