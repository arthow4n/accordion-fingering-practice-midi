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

export interface UpdateCheckResult {
  hasUpdate: boolean;
  message: string;
}

export function waitForWorkerInstallation(
  worker: ServiceWorker,
  timeoutMs = 15000,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (worker.state === "installed") {
      resolve(true);
      return;
    }
    if (worker.state === "redundant") {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve(worker.state === "installed");
    }, timeoutMs);
    const onStateChange = () => {
      if (worker.state === "installed") {
        cleanup();
        resolve(true);
      } else if (worker.state === "redundant") {
        cleanup();
        resolve(false);
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      if (typeof worker.removeEventListener === "function") {
        worker.removeEventListener("statechange", onStateChange);
      }
    };
    if (typeof worker.addEventListener === "function") {
      worker.addEventListener("statechange", onStateChange);
    }
  });
}

export async function checkForUpdate(
  registration?: ServiceWorkerRegistration,
  timeoutMs = 15000,
): Promise<UpdateCheckResult> {
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
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        reg = registrations[0];
      }
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
    let installingWorker: ServiceWorker | null = null;
    const onUpdateFound = () => {
      installingWorker = reg?.installing ?? null;
    };

    if (typeof reg.addEventListener === "function") {
      reg.addEventListener("updatefound", onUpdateFound, { once: true });
    }

    if (typeof reg.update === "function") {
      await reg.update();
    }

    if (reg.waiting) {
      if (typeof reg.removeEventListener === "function") {
        reg.removeEventListener("updatefound", onUpdateFound);
      }
      return {
        hasUpdate: true,
        message: "An update is available!",
      };
    }

    const worker = installingWorker || reg.installing;
    if (worker) {
      if (typeof reg.removeEventListener === "function") {
        reg.removeEventListener("updatefound", onUpdateFound);
      }
      const installed = await waitForWorkerInstallation(worker, timeoutMs);
      if (installed) {
        return {
          hasUpdate: true,
          message: "An update is available!",
        };
      }
    }

    // Allow a short delay (250ms) for updatefound event if queued by browser
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
    if (typeof reg.removeEventListener === "function") {
      reg.removeEventListener("updatefound", onUpdateFound);
    }

    if (reg.waiting) {
      return {
        hasUpdate: true,
        message: "An update is available!",
      };
    }

    const delayedWorker = installingWorker || reg.installing;
    if (delayedWorker) {
      const installed = await waitForWorkerInstallation(delayedWorker, timeoutMs);
      if (installed) {
        return {
          hasUpdate: true,
          message: "An update is available!",
        };
      }
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

export async function applyUpdate(
  registration?: ServiceWorkerRegistration,
  customUpdateSW?: (reloadPage?: boolean) => Promise<void>,
  timeoutMs = 1500,
): Promise<void> {
  let reloaded = false;
  const reload = () => {
    if (!reloaded) {
      reloaded = true;
      if (typeof window !== "undefined" && window.location) {
        window.location.reload();
      }
    }
  };

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      navigator.serviceWorker.addEventListener("controllerchange", reload, {
        once: true,
      });
    } catch {
      // Ignored
    }
  }

  if (customUpdateSW) {
    try {
      await customUpdateSW(true);
    } catch {
      // Ignored
    }
  }

  let reg = registration;
  if (!reg && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length > 0) {
          reg = registrations[0];
        }
      }
    } catch {
      // Ignored
    }
  }

  if (reg) {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } else if (reg.installing) {
      const installingWorker = reg.installing;
      await waitForWorkerInstallation(installingWorker, 5000);
      const waitingWorker = (reg as ServiceWorkerRegistration).waiting;
      if (waitingWorker) {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
      } else if (installingWorker.state === "installed") {
        installingWorker.postMessage({ type: "SKIP_WAITING" });
      }
    }
  }

  // Fallback: If controllerchange has not fired within timeoutMs, reload
  setTimeout(reload, timeoutMs);
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
