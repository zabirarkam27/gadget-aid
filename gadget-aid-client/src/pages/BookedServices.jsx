import { useState } from "react";
import usePrivateCollection from "../hooks/usePrivateCollection";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import SummaryCards from "../components/dashboard/SummaryCards";
import CollectionState from "../components/dashboard/CollectionState";
import BookingCard from "../components/dashboard/BookingCard";
import Button from "../components/Button";
import FormField from "../components/ui/FormField";
import EmptyState from "../components/ui/EmptyState";
import { bookingStatus, statusCounts } from "../utils/workspace";
const BookedServices = () => {
  const { data, loading, error, retry } = usePrivateCollection("/bookings");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const results = data.filter(booking => (!status || bookingStatus(booking) === status) && `${booking.serviceName || ""} ${booking.providerName || ""}`.toLowerCase().includes(query.toLowerCase()));
  return <DashboardLayout title="My bookings" eyebrow="Customer workspace" description="Your repair requests, provider details and latest updates in one place." action={<Button to="/services">Find a repair service ↗</Button>}>
    {!loading && !error && <SummaryCards items={statusCounts(data)} />}
    <div className="flex flex-wrap items-end gap-4 mb-6"><div className="flex-1 min-w-0 sm:min-w-64"><FormField label="Search bookings" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search service or provider" /></div><div className="w-full sm:w-48"><FormField label="Booking status" as="select" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="working">Working</option><option value="completed">Completed</option></FormField></div><Button variant="outline" onClick={retry} disabled={loading}>Refresh</Button></div>
    <CollectionState loading={loading} error={error} retry={retry}>{results.length ? <><p className="ga-muted text-sm mb-5" role="status">{results.length} booking{results.length === 1 ? "" : "s"}</p><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{results.map(booking => <BookingCard key={booking._id} booking={booking} />)}</div></> : <EmptyState title={data.length ? "No matching bookings" : "Your next repair starts here"} description={data.length ? "Try another search or status." : "Explore a service and send your first booking request."} action={data.length ? <Button onClick={() => {setQuery("");setStatus("");}}>Clear filters</Button> : <Button to="/services">Explore services</Button>} />}</CollectionState>
  </DashboardLayout>;
};
export default BookedServices;
