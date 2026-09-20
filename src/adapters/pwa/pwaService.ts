export interface AppVersionInfo {
  version: string;
  commitHash: string;
  commitUrl: string;
}

export function getAppVersionInfo(): AppVersionInfo {
  const version =
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
  const commitHash =
    typeof __COMMIT_HASH__ !== "undefined" ? __COMMIT_HASH__ : "dev";
  const commitUrl =
    typeof __COMMIT_URL__ !== "undefined"
      ? __COMMIT_URL__
      : "https://github.com/arthow4n/accordion-fingering-practice-midi";

  return { version, commitHash, commitUrl };
}

export async function checkForUpdate(
  registration?: ServiceWorkerRegistration,
): Promise<{ hasUpdate: boolean; message: string }> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return {
      hasUpdate: false,
      message: "Service workers are not supported by this browser.",
    };
  }

  let reg = registration;
  if (!reg) {
    try {
      reg = await navigator.serviceWorker.getRegistration();
    } catch {
      // Ignored
    }
  }

  if (!reg) {
    return {
      hasUpdate: false,
      message: "No active service worker registered.",
    };
  }

  try {
    await reg.update();
    if (reg.waiting || reg.installing) {
      return {
        hasUpdate: true,
        message: "An update is available!",
      };
    }
    return {
      hasUpdate: false,
      message: "Application is up to date.",
    };
  } catch (error) {
    return {
      hasUpdate: false,
      message: `Failed to check for update: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function forceUpdate(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
    const cacheStorage =
      typeof caches !== "undefined"
        ? caches
        : typeof window !== "undefined"
          ? window.caches
          : undefined;
    if (cacheStorage) {
      const cacheNames = await cacheStorage.keys();
      await Promise.all(cacheNames.map((name) => cacheStorage.delete(name)));
    }
  } catch (error) {
    console.error("Failed to purge service worker and caches:", error);
  }

  if (typeof window !== "undefined" && window.location) {
    window.location.reload();
  }
}
