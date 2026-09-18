/**
 * "Sign in with Apple" button.
 *
 * Styled to Apple's Human Interface Guidelines — white pill, black Apple logo,
 * the exact wording. Stretches to fill its row in LoginModal, which is what
 * keeps it the same width as the Google button (whose iframe we cannot size
 * directly).
 */
interface AppleAuthButtonProps {
  onClick: () => void;
  disabled?: boolean;
  /** Match the Google button's width, in px, so the two pills align. */
  width?: string;
  text?: "signin_with" | "continue_with";
}

export default function AppleAuthButton({
  onClick,
  disabled = false,
  text = "continue_with",
}: AppleAuthButtonProps) {
  const label = text === "signin_with" ? "Sign in with Apple" : "Continue with Apple";

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
          padding does not move it and the three logos stay aligned.
          Apple's guidelines allow a white button with a black logo; the mark
          keeps its own colour rather than inheriting the label text. */}
      <svg
        className="absolute left-5 h-[18px] w-[18px] text-black"
        viewBox="0 0 384 512"
        fill="currentColor"
        aria-hidden
      >
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      {label}
    </button>
  );
}
