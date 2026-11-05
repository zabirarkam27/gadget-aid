import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext, useRef, useState } from "react";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, updateProfile } from "firebase/auth";
import { FcGoogle } from "react-icons/fc";
import { Helmet } from "react-helmet-async";
import { toast } from "react-toastify";
import { AuthContext } from "../provider/AuthContext";
import { authMessage, returnPath } from "../utils/authFeedback";
import AuthShell from "../components/ui/AuthShell";
import FormField from "../components/ui/FormField";
import PasswordField from "../components/ui/PasswordField";
import Button from "../components/Button";

const Registration = () => {
  const { createNewUser,setUser } = useContext(AuthContext);
  const location=useLocation(),navigate=useNavigate();
  const [pending,setPending]=useState("");
  const [error,setError]=useState("");
  const [passwordError,setPasswordError]=useState("");
  const [createdEmail,setCreatedEmail]=useState("");
  const lock=useRef(false);
  const handleSubmit = async event => {
    event.preventDefault(); if(lock.current)return;
    const form=new FormData(event.currentTarget);
    const name=String(form.get("name")).trim(), email=String(form.get("email")).trim(),password=String(form.get("password")),photo=String(form.get("photo") || "").trim();
    if(password.length<6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)){setPasswordError("Use at least 6 characters with an uppercase and a lowercase letter.");return;}
    if(!name){setError("Enter your name.");return;}
    if(photo && !/^https?:\/\//i.test(photo)){setError("Use an http or https URL for your photo.");return;}
    lock.current=true;setPending("email");setError("");setPasswordError("");
    let created=false;
    try {
      const result=await createNewUser(email,password);created=true;
      await updateProfile(result.user,{displayName:name,photoURL:photo || null});
      await signOut(getAuth());setUser(null);
      toast.success("Account created. Log in to continue.");
      navigate("/login",{replace:true,state:{...location.state,email}});
    }catch(failure){
      if(created){setCreatedEmail(email);setError("Your account was created, but we could not finish this step. Continue to login instead of creating another account.");}
      else setError(authMessage(failure));
    }finally{lock.current=false;setPending("");}
  };
  const googleLogin=async()=>{
    if(lock.current)return;lock.current=true;setPending("google");setError("");
    try{const result=await signInWithPopup(getAuth(),new GoogleAuthProvider());setUser(result.user);navigate(returnPath(location.state),{replace:true});}
    catch(failure){setError(authMessage(failure));}finally{lock.current=false;setPending("");}
  };
  return <><Helmet><title>Create an account | GadgetAid</title></Helmet><AuthShell title="Let’s get you started." description="One account to book repairs or offer your own services.">
    {createdEmail ? <div><p role="status" className="ga-muted mb-6">{error}</p><Button to="/login" state={{...location.state,email:createdEmail}} className="w-full">Continue to login</Button></div> : <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Your name" name="name" autoComplete="name" required maxLength={80} disabled={!!pending} />
        <FormField label="Email address" name="email" type="email" autoComplete="email" required disabled={!!pending} />
        <PasswordField name="password" autoComplete="new-password" required minLength={6} disabled={!!pending} helper="At least 6 characters, including uppercase and lowercase letters." error={passwordError} />
        <FormField label="Photo URL (optional)" name="photo" type="url" placeholder="https://example.com/photo.jpg" disabled={!!pending} helper="You can also use your account without a photo." />
        {error && <p role="alert" className="text-error text-sm">{error}</p>}
        <Button type="submit" loading={pending === "email"} disabled={!!pending} className="w-full">{pending === "email" ? "Creating account…" : "Create account"}</Button>
      </form>
      <div className="flex items-center gap-4 my-6 ga-muted text-xs"><span className="h-px bg-base-300 flex-1" />OR<span className="h-px bg-base-300 flex-1" /></div>
      <Button variant="outline" className="w-full" disabled={!!pending} loading={pending === "google"} onClick={googleLogin}><FcGoogle size={20} aria-hidden="true" />Continue with Google</Button>
      <p className="text-sm text-center ga-muted mt-6">Already have an account? <Link to="/login" state={location.state} className="text-primary ga-text-link">Log in</Link></p>
    </>}
  </AuthShell></>;
};
export default Registration;
