import LoadMore from "../components/ui/LoadMore";
import { useState } from "react";
import usePrivateCollection from "../hooks/usePrivateCollection";
import {
  repairStatuses,
} from "../utils/workspace";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import SummaryCards from "../components/dashboard/SummaryCards";
import CollectionState from "../components/dashboard/CollectionState";
import BookingCard from "../components/dashboard/BookingCard";
import Button from "../components/Button";
import FormField from "../components/ui/FormField";
import EmptyState from "../components/ui/EmptyState";
const ServiceToDo = () => {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const page = usePrivateCollection("/all-bookings", new URLSearchParams({ q: query, status }).toString());
  const { data, loading, error, retry } = page;
  const results = data;
  return (
    <DashboardLayout
      title="Work queue"
      eyebrow="Provider workspace"
      description="Manage requests for your services. Keep customers informed as repairs progress."
      action={
        <Button variant="outline" onClick={retry} disabled={loading}>
          Refresh queue
        </Button>
      }
    >
      {!loading && !error && <SummaryCards items={page.summary || []} />}
      <div className="grid sm:grid-cols-[1fr_14rem] gap-4 mb-6">
        <FormField
          label="Search repair requests"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search service or customer email"
        />
        <FormField
          label="Repair status"
          as="select"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(repairStatuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FormField>
      </div>
      <CollectionState loading={loading} error={error} retry={retry}>
        {results.length ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((booking) => (
              <BookingCard key={booking._id} booking={booking} provider />
            ))}
          </div>
        ) : (
          <EmptyState
            title={data.length ? "No matching requests" : "Your queue is clear"}
            description={
              data.length
                ? "Try another search or status."
                : "Bookings for your services will appear here."
            }
            action={
              data.length ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setStatus("");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button to="/manage-services" variant="outline">
                  View my services
                </Button>
              )
            }
          />
        )}
      </CollectionState>
      {!loading && !error && <LoadMore page={page} label="Load more bookings" />}
    </DashboardLayout>
  );
};
export default ServiceToDo;
