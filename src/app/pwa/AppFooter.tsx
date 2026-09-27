import { useState } from "react";
import {
  checkForUpdate,
  forceUpdate,
  getAppVersionInfo,
} from "../../adapters/pwa/pwaService";

interface AppFooterProps {
  registration?: ServiceWorkerRegistration;
  onUpdateDetected?: () => void;
  onApplyUpdate?: () => void | Promise<void>;
  needRefresh?: boolean;
}

export function AppFooter({
  registration,
  onUpdateDetected,
  onApplyUpdate,
  needRefresh,
}: AppFooterProps) {
  const { version, commitHash, commitUrl } = getAppVersionInfo();
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [hasUpdateDetected, setHasUpdateDetected] = useState(false);

  const handleCheckUpdate = async () => {
    setChecking(true);
    setStatusMessage("Checking for updates…");
    try {
      const result = await checkForUpdate(registration);
      setStatusMessage(result.message);
      if (result.hasUpdate) {
        setHasUpdateDetected(true);
        if (onUpdateDetected) {
          onUpdateDetected();
        }
      } else {
        setHasUpdateDetected(false);
      }
    } catch (error) {
      setStatusMessage(
        `Check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!onApplyUpdate) return;
    setUpdating(true);
    setStatusMessage("Applying update and reloading…");
    try {
      await onApplyUpdate();
    } catch (error) {
      setUpdating(false);
      setStatusMessage(
        `Update failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleForceUpdate = async () => {
    setStatusMessage("Purging cache and forcing update…");
    await forceUpdate();
  };

  const showUpdateNow =
    (Boolean(needRefresh) || hasUpdateDetected) && Boolean(onApplyUpdate);

  return (
    <footer className="app-footer">
      <p className="app-footer-version">
        <span>Version {version}</span>
        {" · "}
        <span>
          Commit{" "}
          <a
            href={commitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="commit-link"
          >
            {commitHash}
          </a>
        </span>
      </p>
      <p className="app-footer-actions">
        <button
          type="button"
          onClick={handleCheckUpdate}
          disabled={checking || updating}
        >
          {checking ? "Checking…" : "Check update"}
        </button>{" "}
        {showUpdateNow && (
          <>
            <button
              type="button"
              className="update-banner-button primary"
              onClick={handleApplyUpdate}
              disabled={updating}
            >
              {updating ? "Updating…" : "Update now"}
            </button>{" "}
          </>
        )}
        <button
          type="button"
          onClick={handleForceUpdate}
          disabled={checking || updating}
        >
          Force update
        </button>
      </p>
      {statusMessage && (
        <p className="app-footer-status" role="status">
          {statusMessage}
        </p>
      )}
    </footer>
  );
}
