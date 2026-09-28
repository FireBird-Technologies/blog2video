import { useState, type InputHTMLAttributes } from "react";

/**
 * A password-type input for API keys and application passwords that the
 * browser must not autofill with the user's saved Blog2Video login.
 *
 * Chrome ignores `autoComplete="off"`/`"new-password"` on password fields,
 * but never autofills a read-only field — so it stays read-only until the user
 * focuses it. Password-manager extensions are told to skip it too.
 */
export default function SecretInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [editable, setEditable] = useState(false);
  return (
    <input
      {...props}
      type="password"
      autoComplete="new-password"
      spellCheck={false}
      readOnly={!editable}
      onFocus={(e) => {
        setEditable(true);
        props.onFocus?.(e);
      }}
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
    />
  );
}
