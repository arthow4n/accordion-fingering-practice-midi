import { useState } from "react";

interface UpdateBannerProps {
  show: boolean;
  onUpdate: () => void | Promise<void>;
  onDismiss: () => void;
}

export function UpdateBanner({
  show,
  onUpdate,
  onDismiss,
}: UpdateBannerProps) {
  const [updating, setUpdating] = useState(false);

  if (!show) return null;

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await onUpdate();
    } catch {
      setUpdating(false);
    }
  };

  return (
    <div className="update-banner" role="alert" aria-live="polite">
      <span className="update-banner-text">
        An update is available right now!
      </span>
      <div className="update-banner-actions">
        <button
          type="button"
          className="update-banner-button primary"
          onClick={handleUpdate}
          disabled={updating}
        >
          {updating ? "Updating…" : "Update now"}
        </button>
        <button
          type="button"
          className="update-banner-button secondary"
          onClick={onDismiss}
          disabled={updating}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
