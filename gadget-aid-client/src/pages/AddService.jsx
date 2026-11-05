import { useContext, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthContext } from "../provider/AuthProvider";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import ServiceForm from "../components/dashboard/ServiceForm";
const AddService=()=>{
  const {user}=useContext(AuthContext);
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  const lock=useRef(false);
  const navigate=useNavigate();
  const submit=async values=>{
    if(lock.current)return;lock.current=true;setSaving(true);setError("");
    try{
      const result=await authFetch(`${API_URL}/services`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...values,providerName:user.displayName,providerEmail:user.email,providerPhoto:user.photoURL,createdAt:new Date()})}).then(readJson);
      if(!result.insertedId)throw new Error("Service not saved");
      toast.success("Your service is listed.");navigate("/manage-services");
    }catch{setError("Your service could not be saved. Please try again.");}finally{lock.current=false;setSaving(false);}
  };
  return <DashboardLayout title="Add a service" eyebrow="Provider workspace" description="Tell customers what you repair, where you work and what the service costs."><div className="grid lg:grid-cols-[1.6fr_1fr] gap-8 items-start"><div className="ga-surface p-6 sm:p-8"><ServiceForm onSubmit={submit} submitting={saving} error={error} submitLabel="Publish service" /></div><aside className="ga-surface p-6"><h2 className="text-xl font-semibold mb-4">Make the details count.</h2><ul className="ga-muted space-y-4 text-sm list-disc pl-5"><li>Use a descriptive name and an image of the actual repair or device.</li><li>State what is included in the listed price.</li><li>Describe service coverage and explain any warranty conditions.</li><li>Your account is used as the service provider. Manage requests in Work queue.</li></ul></aside></div></DashboardLayout>;
};
export default AddService;
