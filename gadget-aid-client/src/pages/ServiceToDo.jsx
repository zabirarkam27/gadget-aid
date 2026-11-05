import { useRef, useState } from "react";
import { toast } from "react-toastify";
import usePrivateCollection from "../hooks/usePrivateCollection";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
import { bookingStatus, statusCounts } from "../utils/workspace";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import SummaryCards from "../components/dashboard/SummaryCards";
import CollectionState from "../components/dashboard/CollectionState";
import BookingCard from "../components/dashboard/BookingCard";
import Button from "../components/Button";
import FormField from "../components/ui/FormField";
import EmptyState from "../components/ui/EmptyState";
import Dialog from "../components/ui/Dialog";
const ServiceToDo = () => {
  const { data, loading, error, retry, setData } = usePrivateCollection("/all-bookings");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [change, setChange] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const lock = useRef(false);
  const results = data.filter(booking => (!status || bookingStatus(booking) === status) && `${booking.serviceName || ""} ${booking.userEmail || ""}`.toLowerCase().includes(query.toLowerCase()));
  const update = async () => {
    if (!change || lock.current) return;
    lock.current = true; setSaving(true); setSaveError("");
    try {
      const result = await authFetch(`${API_URL}/all-bookings/${change.booking._id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({status:change.status}) }).then(readJson);
      if (!result.matchedCount) throw new Error("Booking unavailable");
      setData(previous => previous.map(booking => booking._id === change.booking._id ? {...booking,status:change.status} : booking));
      toast.success("Repair status updated."); setChange(null);
    } catch (failure) { setSaveError(failure.message || "The status could not be updated. Please try again."); }
    finally {lock.current = false; setSaving(false);}
  };
  return <DashboardLayout title="Work queue" eyebrow="Provider workspace" description="Manage requests for your services. Keep customers informed as repairs progress." action={<Button variant="outline" onClick={retry} disabled={loading}>Refresh queue</Button>}>
    {!loading && !error && <SummaryCards items={statusCounts(data)} />}
    <div className="grid sm:grid-cols-[1fr_14rem] gap-4 mb-6"><FormField label="Search repair requests" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search service or customer email" /><FormField label="Repair status" as="select" value={status} onChange={event=>setStatus(event.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="working">Working</option><option value="completed">Completed</option></FormField></div>
    <CollectionState loading={loading} error={error} retry={retry}>{results.length ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{results.map(booking=><BookingCard key={booking._id} booking={booking} provider action={<FormField label="Update repair status" as="select" value={bookingStatus(booking)} onChange={event=>{setSaveError("");setChange({booking,status:event.target.value});}}>{!["pending","working","completed"].includes(bookingStatus(booking)) && <option value={bookingStatus(booking)} disabled>Unknown status</option>}<option value="pending">Pending</option><option value="working">Working</option><option value="completed">Completed</option></FormField>} />)}</div> : <EmptyState title={data.length ? "No matching requests" : "Your queue is clear"} description={data.length ? "Try another search or status." : "Bookings for your services will appear here."} action={data.length ? <Button onClick={()=>{setQuery("");setStatus("");}}>Clear filters</Button> : <Button to="/manage-services" variant="outline">View my services</Button>} />}</CollectionState>
    <Dialog open={!!change} onClose={()=>{if(!saving)setChange(null);}} title="Update repair status?"><p className="ga-muted mb-6">Change <strong className="text-base-content">{change?.booking.serviceName}</strong> to <strong className="text-base-content">{change?.status}</strong>? The customer will see this when they refresh their bookings.</p>{saveError && <p role="alert" className="text-error text-sm mb-5">{saveError}</p>}<div className="flex gap-3"><Button onClick={update} loading={saving}>Confirm update</Button><Button variant="ghost" disabled={saving} onClick={()=>setChange(null)}>Cancel</Button></div></Dialog>
  </DashboardLayout>;
};
export default ServiceToDo;
