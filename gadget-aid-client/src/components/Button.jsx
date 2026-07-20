const Button = ({ children, className = "", onClick, type = "button" }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`btn btn-primary px-6 py-2 text-lg rounded-xl shadow-lg transition duration-300 ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
