import { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import Button from "../components/Button";
import ThemeChanger from "../components/ThemeChanger";
import FormField from "../components/ui/FormField";
import StatusBadge from "../components/ui/StatusBadge";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Dialog from "../components/ui/Dialog";

const DesignSystemPreview = () => {
  const [open, setOpen] = useState(false);
  return (
    <main className="ga-container ga-section space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-primary font-semibold mb-3">GadgetAid / UI foundation</p>
          <h1 className="text-display font-bold">Built for better repair.</h1>
          <p className="ga-muted max-w-xl mt-4">Development preview of the Premium Tech design system. These examples do not create bookings or modify service records.</p>
        </div>
        <div className="flex items-center gap-3"><span className="text-sm">Appearance</span><ThemeChanger /></div>
      </header>
      <section className="ga-surface p-6 space-y-5" aria-labelledby="actions-title">
        <h2 id="actions-title" className="text-section font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setOpen(true)}>Open dialog</Button>
          <Button variant="secondary" onClick={() => toast.success("Preview feedback — no data was changed.")}>Show feedback</Button>
          <Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button><Button loading>Saving…</Button>
        </div>
        <div className="flex flex-wrap gap-3 items-center"><Button size="sm">Small</Button><Button>Default</Button><Button size="lg">Large</Button><Button to="/services" reloadDocument variant="outline">Browse services</Button></div>
      </section>
      <section className="grid md:grid-cols-2 gap-6" aria-label="Form and status examples">
        <div className="ga-surface p-6 space-y-5">
          <h2 className="text-section font-semibold">Clear, accessible fields</h2>
          <FormField label="Device name" placeholder="e.g. Laptop" helper="Use the name you recognize." required />
          <FormField label="Email address" type="email" defaultValue="invalid" error="Enter a valid email address." />
          <FormField label="Device category" as="select" defaultValue="phone"><option value="phone">Phone</option><option value="laptop">Laptop</option></FormField>
          <FormField label="Problem description" as="textarea" rows={3} placeholder="Describe the issue" />
          <FormField label="Unavailable field" disabled value="Not editable" />
        </div>
        <div className="space-y-6">
          <div className="ga-surface p-6 space-y-4">
            <h2 className="text-section font-semibold">Status and loading</h2>
            <div className="flex flex-wrap gap-3"><StatusBadge status="pending" /><StatusBadge status="working" /><StatusBadge status="completed" /><StatusBadge status="unknown" /></div>
            <Skeleton className="h-28 w-full" /><Skeleton /><Skeleton className="h-5 w-2/3" />
            <p className="ga-muted ga-numeric">Example price: $85.00</p>
          </div>
          <EmptyState title="No bookings yet" description="Empty-state example. Provide one clear action when a real workflow is connected." />
        </div>
      </section>
      <footer className="ga-muted flex items-center justify-between gap-4"><span>Second synchronized theme control</span><ThemeChanger /></footer>
      <Dialog open={open} onClose={() => setOpen(false)} title="Review the details">
        <p className="ga-muted mb-6">This native dialog supports Escape, keyboard focus containment and returning focus to its trigger.</p>
        <Button onClick={() => setOpen(false)}>Done</Button>
      </Dialog>
      <ToastContainer />
    </main>
  );
};

export default DesignSystemPreview;
