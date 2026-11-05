import { useId } from "react";

const FormField = ({ label, helper, error, id, as = "input", className = "", children, ...props }) => {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const noteId = `${fieldId}-note`;
  const Control = as;
  const controlClass = as === "textarea" ? "textarea" : as === "select" ? "select" : "input";
  const describedBy = [props["aria-describedby"], error || helper ? noteId : null].filter(Boolean).join(" ");

  return (
    <div className="ga-field">
      <label htmlFor={fieldId} className="ga-field-label">
        {label}{props.required && <span aria-hidden="true"> *</span>}
      </label>
      <Control {...props} id={fieldId} className={`${controlClass} w-full ${className}`}
        aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={describedBy || undefined}>
        {children}
      </Control>
      {(error || helper) && (
        <p id={noteId} className={`ga-field-note ${error ? "text-error" : "ga-muted"}`} aria-live="polite">
          {error || helper}
        </p>
      )}
    </div>
  );
};

export default FormField;
