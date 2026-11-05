import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import FormField from "./FormField";
const PasswordField = ({ label = "Password", ...props }) => {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><FormField {...props} type={visible ? "text" : "password"} label={label} className="pr-12" /><button type="button" className="absolute right-3 top-10 text-primary" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible ? <FiEyeOff size={20} aria-hidden="true" /> : <FiEye size={20} aria-hidden="true" />}</button></div>;
};
export default PasswordField;
