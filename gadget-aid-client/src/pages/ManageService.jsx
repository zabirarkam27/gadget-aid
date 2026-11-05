import { useRef, useState } from "react";
import { toast } from "react-toastify";
import usePrivateCollection from "../hooks/usePrivateCollection";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import SummaryCards from "../components/dashboard/SummaryCards";
import CollectionState from "../components/dashboard/CollectionState";
import ServiceForm from "../components/dashboard/ServiceForm";
import ServiceImage from "../components/ui/ServiceImage";
import FormField from "../components/ui/FormField";
import EmptyState from "../components/ui/EmptyState";
import Dialog from "../components/ui/Dialog";
import Button from "../components/Button";
import { priceLabel } from "../utils/workspace";
const ManageService=()=>{
  const {data,loading,error,retry,setData}=usePrivateCollection("/my-services");
  const [query,setQuery]=useState(""),[area,setArea]=useState("");
  const [editing,setEditing]=useState(null),[deleting,setDeleting]=useState(null);
  const [saving,setSaving]=useState(false),[mutationError,setMutationError]=useState("");
  const lock=useRef(false);
  const areas=[...new Set(data.map(service=>service.area).filter(Boolean))].sort();
  const results=data.filter(service=>(!area || service.area===area) && String(service.name || "").toLowerCase().includes(query.toLowerCase()));
  const update=async values=>{
    if(lock.current)return;lock.current=true;setSaving(true);setMutationError("");
    try{
      const result=await authFetch(`${API_URL}/services/${editing._id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(values)}).then(readJson);
      if(!result.matchedCount)throw new Error("Service unavailable");
      setData(previous=>previous.map(service=>service._id===editing._id ? {...service,...values} : service));setEditing(null);toast.success("Service saved.");
    }catch{setMutationError("Your changes could not be saved. Please try again.");}finally{lock.current=false;setSaving(false);}
  };
  const remove=async()=>{
    if(lock.current)return;lock.current=true;setSaving(true);setMutationError("");
    try{
      const result=await authFetch(`${API_URL}/services/${deleting._id}`,{method:"DELETE"}).then(readJson);
      if(!result.deletedCount)throw new Error("Service unavailable");
      setData(previous=>previous.filter(service=>service._id!==deleting._id));setDeleting(null);toast.success("Service removed from the catalogue.");
    }catch{setMutationError("The service could not be removed. Please try again.");}finally{lock.current=false;setSaving(false);}
  };
  return <DashboardLayout title="My services" eyebrow="Provider workspace" description="Keep your listings clear, current and ready for the next repair request." action={<Button to="/add-service">Add a service ↗</Button>}>
    {!loading && !error && <SummaryCards items={[{label:"Services listed",value:data.length},{label:"Service areas",value:areas.length},{label:"Matching listings",value:results.length}]} />}
    <div className="grid sm:grid-cols-[1fr_16rem_auto] gap-4 items-end mb-6"><FormField label="Search my services" type="search" value={query} onChange={event=>setQuery(event.target.value)} /><FormField label="Service area" as="select" value={area} onChange={event=>setArea(event.target.value)}><option value="">All areas</option>{areas.map(value=><option key={value}>{value}</option>)}</FormField><Button variant="outline" disabled={loading} onClick={retry}>Refresh</Button></div>
    <CollectionState loading={loading} error={error} retry={retry}>{results.length ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{results.map(service=><article key={service._id} className="ga-surface overflow-hidden flex flex-col"><div className="h-40 bg-base-300"><ServiceImage src={service.image} alt={service.name} /></div><div className="p-6 flex flex-1 flex-col"><p className="ga-muted text-xs mb-3">{service.area}</p><h2 className="text-xl font-semibold">{service.name}</h2><p className="ga-muted text-sm line-clamp-2 mt-3">{service.description}</p><p className="ga-numeric font-bold text-xl mt-5">{priceLabel(service.price)}</p><div className="flex flex-wrap gap-3 pt-6 mt-auto"><Button variant="outline" onClick={()=>{setMutationError("");setEditing(service);}}>Edit service</Button><Button variant="ghost" className="text-error" onClick={()=>{setMutationError("");setDeleting(service);}}>Delete</Button></div></div></article>)}</div> : <EmptyState title={data.length ? "No matching services" : "Your expertise belongs here"} description={data.length ? "Try another name or service area." : "Add your first service so customers can discover your repairs."} action={data.length ? <Button onClick={()=>{setQuery("");setArea("");}}>Clear filters</Button> : <Button to="/add-service">Add a service</Button>} />}</CollectionState>
    <Dialog open={!!editing} onClose={()=>{if(!saving)setEditing(null);}} title="Edit your service">{editing && <ServiceForm key={editing._id} initial={editing} onSubmit={update} submitting={saving} error={mutationError} onCancel={()=>setEditing(null)} />}</Dialog>
    <Dialog open={!!deleting} onClose={()=>{if(!saving)setDeleting(null);}} title="Remove this service?"><p className="ga-muted mb-6"><strong className="text-base-content">{deleting?.name}</strong> will be removed from the catalogue. Existing bookings remain in the booking history.</p>{mutationError && <p role="alert" className="text-error text-sm mb-5">{mutationError}</p>}<div className="flex gap-3"><Button variant="destructive" loading={saving} onClick={remove}>Remove service</Button><Button variant="ghost" disabled={saving} onClick={()=>setDeleting(null)}>Keep service</Button></div></Dialog>
  </DashboardLayout>;
};
export default ManageService;
