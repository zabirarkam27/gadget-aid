import { useState, useEffect } from "react";
import { AuthContext } from "./AuthContext";
import app from "../firebase/firebase.config";
import { createSecurityActions } from "../utils/accountSecurity";

import {
  getAuth,
  sendEmailVerification,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  linkWithCredential,
  linkWithPopup,
  reload,
  validatePassword,
} from "firebase/auth";

const auth = getAuth(app);
const googleProvider = (user) => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    login_hint: user.email,
    prompt: "select_account",
  });
  return provider;
};
const security = createSecurityActions({
  getUser: () => auth.currentUser,
  reauthenticatePassword: (user, password) =>
    reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, password),
    ),
  reauthenticateGoogle: (user) =>
    reauthenticateWithPopup(user, googleProvider(user)),
  updatePassword,
  linkPassword: (user, password) =>
    linkWithCredential(
      user,
      EmailAuthProvider.credential(user.email, password),
    ),
  linkGoogle: (user) => linkWithPopup(user, googleProvider(user)),
  reload,
  validatePassword: async (password) =>
    (await validatePassword(auth, password)).isValid,
  signOut: () => signOut(auth),
});

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const createNewUser = async (email, password) => {
    if (!(await validatePassword(auth, password)).isValid)
      throw Object.assign(new Error("Password policy not met."), {
        code: "auth/weak-password",
      });
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logOut = () => {
    return signOut(auth).then(() => {
      setUser(null);
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    const storedUser = auth.currentUser;
    if (storedUser) {
      setUser(storedUser);
      setLoading(false);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const authInfo = {
    user,
    loading,
    setUser,
    createNewUser,
    sendVerificationEmail: () => sendEmailVerification(auth.currentUser),
    login,
    logOut,
    security,
  };
  if (loading) {
    return (
      <p role="status" className="flex items-center justify-center h-screen">
        <span className="sr-only">Loading your account</span>
        <span
          className="loading loading-ring loading-lg"
          aria-hidden="true"
        ></span>
      </p>
    );
  }

  return (
    <AuthContext.Provider value={authInfo}>{children}</AuthContext.Provider>
  );
};

export default AuthProvider;
