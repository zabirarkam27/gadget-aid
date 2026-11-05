import { useContext, useRef, useState } from "react";
import { NotificationsContext } from "../provider/NotificationsContext";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import Button from "../components/Button";
import EmptyState from "../components/ui/EmptyState";
const Notifications = () => {
  const {
    items,
    unreadCount,
    unreadMessages,
    loading,
    error,
    refresh,
    markRead,
  } = useContext(NotificationsContext);
  const [saving, setSaving] = useState(false),
    [failure, setFailure] = useState("");
  const lock = useRef(false);
  const mark = async (ids) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setFailure("");
    try {
      await markRead(ids);
    } catch (error) {
      setFailure(error.message);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  const unread = items.filter((item) => !item.readAt);
  return (
    <DashboardLayout
      title="Notifications"
      description="Booking updates and new messages. This page checks for updates every 30 seconds while visible."
      action={
        <Button
          variant="outline"
          onClick={refresh}
          disabled={loading || saving}
        >
          Refresh notifications
        </Button>
      }
    >
      <div className="ga-surface p-5 sm:p-7 mb-6 flex flex-wrap justify-between gap-4 items-center">
        <p role="status">
          <strong>{unreadCount}</strong> unread notification
          {unreadCount === 1 ? "" : "s"} · <strong>{unreadMessages}</strong>{" "}
          unread message{unreadMessages === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          disabled={!unread.length || saving}
          loading={saving}
          onClick={() => mark(unread.map((item) => item._id))}
        >
          Mark visible notifications read
        </Button>
      </div>
      {(error || failure) && (
        <p role="alert" className="text-error mb-5">
          {failure || error}{" "}
          <button className="underline" onClick={refresh}>
            Try again
          </button>
        </p>
      )}
      {loading && !items.length ? (
        <p role="status">Loading notifications…</p>
      ) : items.length ? (
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={item._id}
              className={`ga-surface p-5 sm:p-7 ${!item.readAt ? "border-l-4 border-l-primary" : ""}`}
            >
              <div className="flex flex-wrap gap-4 justify-between">
                <div className="space-y-2 min-w-0">
                  <p className="text-xs ga-muted">
                    {item.readAt ? "Read" : "Unread"} ·{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Dhaka",
                    }).format(new Date(item.createdAt))}
                  </p>
                  <h2 className="font-semibold text-lg">{item.title}</h2>
                  <p className="ga-muted break-words">{item.serviceName}</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <Button
                    to={`/bookings/${item.bookingId}${item.view === "provider" ? "?view=provider" : ""}`}
                    variant="outline"
                  >
                    Open repair
                  </Button>
                  {!item.readAt && (
                    <Button
                      variant="ghost"
                      disabled={saving}
                      onClick={() => mark([item._id])}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <EmptyState
            title="You're all caught up"
            description="New booking updates and message notifications will appear here."
          />
        )
      )}
      <p className="text-sm ga-muted mt-6">
        Showing the latest 100 notifications. Marking an alert read does not
        mark its conversation read. Open the repair to read messages.
      </p>
    </DashboardLayout>
  );
};
export default Notifications;
