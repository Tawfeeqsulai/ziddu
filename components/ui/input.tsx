import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type FieldProps = { label?: string; error?: string; helper?: string; children: ReactNode };

export function Field({ label, error, helper, children }: FieldProps) {
  return <label className="ui-field">{label && <span className="ui-field-label">{label}</span>}{children}{error ? <span className="ui-field-error" role="alert">{error}</span> : helper ? <span className="ui-field-helper">{helper}</span> : null}</label>;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-input ${props["aria-invalid"] ? "is-invalid" : ""}`} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-input ui-textarea ${props["aria-invalid"] ? "is-invalid" : ""}`} {...props} />;
}
