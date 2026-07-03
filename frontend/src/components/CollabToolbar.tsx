import { useCollab } from "./CollabContext";

/**
 * Header portion of the collaboration UI: presence avatars and a live indicator.
 * The "Invite collaborators" action lives inside the Share menu and the edit-history
 * drawer is triggered from the tab row (both in ProjectView). Must be rendered inside
 * a <CollabProvider>.
 */
export default function CollabToolbar() {
  const { connected, peers } = useCollab();

  // Only surface presence when at least one *other* collaborator is online too —
  // ``peers`` includes the current user, so >1 means someone else is here.
  const othersOnline = peers.length > 1;

  return (
    <div className="flex items-center gap-2">
      {/* Presence avatars */}
      {othersOnline && (
        <div className="flex -space-x-2 mr-1" title={`${peers.length} online`}>
          {peers.slice(0, 4).map((p) => (
            <div key={p.user_id} className="relative">
              {p.picture ? (
                <img
                  src={p.picture}
                  alt={p.name}
                  className="w-7 h-7 rounded-full border-2 border-white"
                  title={p.name}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-[11px] font-medium text-gray-700"
                  title={p.name}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {connected && othersOnline && (
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Live
        </span>
      )}
    </div>
  );
}
