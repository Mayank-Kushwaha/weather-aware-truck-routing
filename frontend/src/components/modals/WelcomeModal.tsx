import { HEALTH_URL } from "@/api";
import { Modal } from "@/components/modals/Modal";
import { useBackendStatus } from "@/hooks/useBackendStatus";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenGuide: () => void;
}

const STATUS_TEXT = {
  checking: "Checking the backend…",
  waking: "Backend is waking up. This can take up to a minute.",
  online: "Backend is online. You are ready to go.",
} as const;

export function WelcomeModal({ open, onClose, onOpenGuide }: Props) {
  const status = useBackendStatus(open);
  return (
    <Modal
      open={open}
      title="Welcome to Weather-Aware Truck Routing"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onOpenGuide}>
            Read the full guide
          </button>
          <button type="button" className="btn primary" onClick={onClose}>
            Start exploring
          </button>
        </>
      }
    >
      <div className={`wake ${status}`}>
        <div className="wake-text">
          <strong>Step 1: wake the backend</strong>
          <p>
            The server runs on a free Render plan that falls asleep when idle. Until it wakes, city suggestions and presets cannot load.
            Open the link below once; it opens in a new tab and you can close it afterwards.
          </p>
          <a className="btn primary link" href={HEALTH_URL} target="_blank" rel="noopener noreferrer">
            Wake the backend ↗
          </a>
        </div>
        <div className="wake-status" role="status" aria-live="polite">
          <span className="dot" />
          {STATUS_TEXT[status]}
        </div>
      </div>

      <h3 className="tour-title">Quick tour</h3>
      <ul className="tour">
        <li>
          <span className="ico">🛣️</span>
          <div>
            <strong>Compare 3 routes.</strong> Enter origin, destination, departure time and load. The app checks the weather at each
            checkpoint at the time your truck gets there and recommends the safest route.
          </div>
        </li>
        <li>
          <span className="ico">⚡</span>
          <div>
            <strong>Presets under the form.</strong> Pick a harsh or calm corridor (India, neighbouring countries, USA). The departure is
            chosen from the live forecast and the analysis runs for you.
          </div>
        </li>
        <li>
          <span className="ico">✨</span>
          <div>
            <strong>One-click example.</strong> The "Try an example" button fills Chicago → Denver so you can see results straight away.
          </div>
        </li>
        <li>
          <span className="ico">🚚</span>
          <div>
            <strong>Follow the route.</strong> After a search, press "Trace route" under the checkpoint table to watch a truck drive the
            route with play, pause and step controls.
          </div>
        </li>
      </ul>
    </Modal>
  );
}
