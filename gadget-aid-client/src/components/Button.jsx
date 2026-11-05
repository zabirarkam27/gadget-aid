import { Link } from "react-router-dom";

const variants = { primary: "btn-primary", secondary: "btn-secondary", outline: "btn-outline btn-primary", ghost: "btn-ghost", destructive: "btn-error" };
const sizes = { sm: "btn-sm", md: "", lg: "btn-lg" };

const Button = ({ children, className = "", onClick, type = "button", variant = "primary", size = "md", loading = false, disabled = false, to, ...props }) => {
  const unavailable = disabled || loading;
  const classes = `btn ga-button ${variants[variant] || variants.primary} ${sizes[size] || ""} ${className}`;
  const content = <>
    {loading && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
    {children}
  </>;

  if (to !== undefined) {
    return (
      <Link {...props} to={to} className={classes}
        aria-disabled={unavailable || undefined} aria-busy={loading || undefined}
        tabIndex={unavailable ? -1 : props.tabIndex}
        onClick={(event) => {
          if (unavailable) event.preventDefault();
          else onClick?.(event);
        }}>
        {content}
      </Link>
    );
  }

  return (
    <button
      {...props}
      type={type}
      onClick={onClick}
      disabled={unavailable}
      aria-busy={loading || undefined}
      className={classes}
    >
      {content}
    </button>
  );
};

export default Button;
