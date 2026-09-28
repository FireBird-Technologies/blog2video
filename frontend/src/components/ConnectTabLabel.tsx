import { INTEGRATION_LABELS, INTEGRATION_LOGOS, INTEGRATION_PLATFORMS } from "../api/sources";

/** "Connect" tab label with the Ghost / Beehiiv / WordPress logos beside it. */
export default function ConnectTabLabel() {
  return (
    <span className="inline-flex items-center gap-1.5">
      Connect
      <span className="inline-flex items-center gap-1.5">
        {INTEGRATION_PLATFORMS.map((p) => (
          <img
            key={p}
            src={INTEGRATION_LOGOS[p]}
            alt={INTEGRATION_LABELS[p]}
            title={INTEGRATION_LABELS[p]}
            className="w-3.5 h-3.5 object-contain"
          />
        ))}
      </span>
    </span>
  );
}
