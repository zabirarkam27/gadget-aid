import { getAuth } from "firebase/auth";
import { createAuthFetch } from "./authenticatedRequest";
export const authFetch = createAuthFetch({getUser:()=>getAuth().currentUser});
