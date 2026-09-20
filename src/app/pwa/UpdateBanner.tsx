interface UpdateBannerProps {
  show: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({
  show,
  onUpdate,
  onDismiss,
}: UpdateBannerProps) {
  if (!show) return null;

  return (
    <div className="update-banner" role="alert" aria-live="polite">
      <span className="update-banner-text">
        An update is available right now!
      </span>
      <div className="update-banner-actions">
        <button
          type="button"
          className="update-banner-button primary"
          onClick={onUpdate}
        >
          Update now
        </button>
        <button
          type="button"
          className="update-banner-button secondary"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
