import { useEffect, useState } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

interface GoogleAuthButtonProps {
  onSuccess: (response: CredentialResponse) => void;
  onError: () => void;
  text?: "signin_with" | "signup_with" | "continue_with";
  width?: string;
}

export default function GoogleAuthButton({
  onSuccess,
  onError,
  text = "continue_with",
  width = "300",
}: GoogleAuthButtonProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-500 shadow-sm">
        Continue with Google
      </div>
    );
  }

  return (
    <GoogleLogin
      onSuccess={onSuccess}
      onError={onError}
      size="large"
      shape="pill"
      text={text}
      theme="outline"
      width={width}
    />
  );
}
