import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { Helmet } from "react-helmet-async";
import AuthShell from "../components/ui/AuthShell";
import FormField from "../components/ui/FormField";
import Button from "../components/Button";
import { authMessage } from "../utils/authFeedback";
const ForgotPassword=()=>{
  const location=useLocation();
  const [email,setEmail]=useState(location.state?.email || "");
  const [pending,setPending]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState("");
  const lock=useRef(false);
  const submit=async event=>{
    event.preventDefault();if(lock.current)return;lock.current=true;setPending(true);setError("");
    try{await sendPasswordResetEmail(getAuth(),email.trim());setSent(true);}
    catch(failure){if(failure.code === "auth/user-not-found")setSent(true);else setError(authMessage(failure));}
    finally{lock.current=false;setPending(false);}
  };
  return <><Helmet><title>Reset your password | GadgetAid</title></Helmet><AuthShell title="A fresh start." eyebrow="Password help" description="Enter the email you use for GadgetAid to request a password reset link.">
    {sent ? <div role="status"><h2 className="text-xl font-semibold mb-3">Check your inbox</h2><p className="ga-muted">If an account exists for this email, a reset link will be sent. Check your spam folder too. For a Google account, continue with Google on the login page.</p></div> : <form onSubmit={submit} className="space-y-5"><FormField label="Email address" type="email" name="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" required disabled={pending} />{error && <p role="alert" className="text-error text-sm">{error}</p>}<Button type="submit" loading={pending} className="w-full">{pending ? "Sending link…" : "Send reset link"}</Button></form>}
    <Link to="/login" state={{email}} className="inline-block text-primary ga-text-link text-sm mt-6">← Back to login</Link>
  </AuthShell></>;
};
export default ForgotPassword;
