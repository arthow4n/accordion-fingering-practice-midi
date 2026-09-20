import { useState } from "react";
import {
  checkForUpdate,
  forceUpdate,
  getAppVersionInfo,
} from "../../adapters/pwa/pwaService";

interface AppFooterProps {
  registration?: ServiceWorkerRegistration;
  onUpdateDetected?: () => void;
}

export function AppFooter({
  registration,
  onUpdateDetected,
}: AppFooterProps) {
  const { version, commitHash, commitUrl } = getAppVersionInfo();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const handleCheckUpdate = async () => {
    setChecking(true);
    setStatusMessage("Checking for updates…");
    try {
      const result = await checkForUpdate(registration);
      setStatusMessage(result.message);
      if (result.hasUpdate && onUpdateDetected) {
        onUpdateDetected();
      }
    } catch (error) {
      setStatusMessage(
        `Check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setChecking(false);
    }
  };

  const handleForceUpdate = async () => {
    setStatusMessage("Purging cache and forcing update…");
    await forceUpdate();
  };

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
          disabled={checking}
        >
          {checking ? "Checking…" : "Check update"}
        </button>{" "}
        <button type="button" onClick={handleForceUpdate}>
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
