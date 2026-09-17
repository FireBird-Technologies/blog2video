/**
 * "Sign in with Microsoft" button.
 *
 * Follows Microsoft's branding guidance — white surface, grey border, the
 * four-square logo in its fixed colours, and the prescribed wording. Stretches
 * to fill its row in LoginModal, which is what keeps it the same width as the
 * Google button (whose iframe we cannot size directly).
 */
interface MicrosoftAuthButtonProps {
  onClick: () => void;
  disabled?: boolean;
  text?: "signin_with" | "continue_with";
}

export default function MicrosoftAuthButton({
  onClick,
  disabled = false,
  text = "continue_with",
}: MicrosoftAuthButtonProps) {
  const label =
    text === "signin_with" ? "Sign in with Microsoft" : "Continue with Microsoft";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="relative flex h-10 w-full items-center justify-center rounded-full border pl-[22px] border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {/* Google Identity Services centres its own label inside its iframe and
          we cannot restyle it, so ours centre too. Its label measures ~11px
          right of a plain centre, so `pl-[22px]` on this box shifts our centred
          label by half that to match. The icon stays absolutely positioned, so
          padding does not move it and the three logos stay aligned. */}
      <svg className="absolute left-5 h-[18px] w-[18px]" viewBox="0 0 21 21" aria-hidden>
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
      {label}
    </button>
  );
}
