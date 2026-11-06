import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authFetch } from "../utils/authFetch";
import { API_URL } from "../utils/api";
import { readJson } from "../utils/readJson";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import FormField from "../components/ui/FormField";
import Dialog from "../components/ui/Dialog";
import Button from "../components/Button";
import DeviceReceipts from "../components/dashboard/DeviceReceipts";
const blank = {
  label: "",
  type: "",
  brand: "",
  model: "",
  serialNumber: "",
  purchaseDate: "",
};
const request = (path, options = {}) =>
  authFetch(`${API_URL}${path}`, options).then(readJson);
function DeviceQr({ id }) {
  const [image, setImage] = useState(""),
    [error, setError] = useState("");
  const url = `${window.location.origin}/devices/${id}`;
  useEffect(() => {
    let active = true;
    import("qrcode")
      .then((m) =>
        (m.default || m).toDataURL(url, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      )
      .then((value) => {
        if (active) setImage(value);
      })
      .catch(() => {
        if (active)
          setError("QR could not be generated. Use the private link below.");
      });
    return () => {
      active = false;
    };
  }, [url]);
  return (
    <section className="ga-surface p-6 space-y-4">
      <h2 className="text-xl font-semibold">Private passport QR</h2>
      <p className="ga-muted">
        This QR opens the device in this app. Only your signed-in account can
        read it; sharing the QR does not grant access. No serial number or
        sign-in token is encoded.
      </p>
      {image ? (
        <>
          <img
            src={image}
            width="240"
            height="240"
            alt="QR code to this sign-in-protected device passport"
            className="rounded-xl"
          />
          <a
            href={image}
            download={`device-${id}-qr.png`}
            className="text-primary ga-text-link"
          >
            Download QR image
          </a>
        </>
      ) : (
        <p role="status">{error || "Generating QR…"}</p>
      )}
      <p className="break-all text-sm ga-muted">{url}</p>
      {window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ? (
        <p className="text-sm ga-muted">
          Localhost links work on this computer. Cross-device scanning needs the
          deployed app address.
        </p>
      ) : null}
    </section>
  );
}
export default function Devices() {
  const { id } = useParams();
  return <DeviceWorkspace key={id || "list"} id={id} />;
}
function DeviceWorkspace({ id }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null),
    [history, setHistory] = useState(null),
    [cursor, setCursor] = useState(null),
    [back, setBack] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [editing, setEditing] = useState(false),
    [form, setForm] = useState(blank),
    [serialVisible, setSerialVisible] = useState(false),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState(""),
    [dialog, setDialog] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    setHistory(null);
    setEditing(false);
    setSerialVisible(false);
    setDialog("");
    const query = `?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    Promise.all([
      request(id ? `/devices/${id}` : `/devices${query}`, { signal: c.signal }),
      id
        ? request(`/devices/${id}/history${query}`, { signal: c.signal })
        : Promise.resolve(null),
    ])
      .then(([value, repairs]) => {
        if (!c.signal.aborted) {
          setData(value);
          setHistory(repairs);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [id, cursor, attempt]);
  const edit = () => {
    setForm(
      id
        ? Object.fromEntries(Object.keys(blank).map((k) => [k, data[k] || ""]))
        : blank,
    );
    setEditing(true);
    setError("");
    setNotice("");
  };
  const mutate = async (event) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const saved = await request(id ? `/devices/${id}` : "/devices", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          purchaseDate: form.purchaseDate || null,
          ...(id ? { expectedRevision: data.revision } : {}),
        }),
      });
      if (alive.current) {
        setEditing(false);
        setNotice("Device passport saved privately.");
        if (id) setAttempt((v) => v + 1);
        else navigate(`/devices/${saved._id}`);
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const sensitive = async () => {
    if (lock.current || !confirmed) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      if (dialog === "delete") {
        await request(`/devices/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmed: true,
            expectedRevision: data.revision,
          }),
        });
        if (alive.current) navigate("/devices");
      } else {
        const exported = await request(`/devices/${id}/export`);
        if (alive.current) {
          const url = URL.createObjectURL(
              new Blob([JSON.stringify(exported, null, 2)], {
                type: "application/json",
              }),
            ),
            a = document.createElement("a");
          a.href = url;
          a.download = `device-${id}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setNotice("Private passport export prepared for download.");
          setDialog("");
        }
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const page = id ? history : data;
  return (
    <DashboardLayout
      title={id ? data?.label || "Device passport" : "My devices"}
      description="Your private gadget passports, linked repair history and provider-supplied warranty records."
      action={
        <Button to="/devices" variant="outline">
          All my devices
        </Button>
      }
    >
      <div className="space-y-6 min-w-0">
        {error && (
          <div role="alert" className="text-error">
            {error}{" "}
            <Button variant="ghost" onClick={() => setAttempt((v) => v + 1)}>
              Retry
            </Button>
          </div>
        )}
        {notice && (
          <p role="status" className="text-success">
            {notice}
          </p>
        )}
        {loading ? (
          <p role="status">Loading private passport records…</p>
        ) : (
          data && (
            <>
              <div className="flex flex-wrap gap-3">
                <Button onClick={edit}>
                  {id ? "Edit device" : "Add a device"}
                </Button>
                {id && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDialog("export");
                        setConfirmed(false);
                      }}
                    >
                      Export passport
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDialog("delete");
                        setConfirmed(false);
                      }}
                    >
                      Delete device
                    </Button>
                  </>
                )}
              </div>
              {editing && (
                <section className="ga-surface p-6 space-y-5">
                  <h2 className="text-xl font-semibold">
                    {id ? "Edit private device" : "Add a private device"}
                  </h2>
                  <form onSubmit={mutate}>
                    <fieldset
                      disabled={saving}
                      className="grid sm:grid-cols-2 gap-5"
                    >
                      {[
                        ["label", "Device name", 2, 100],
                        ["type", "Device type", 2, 60],
                        ["brand", "Brand (optional)", 0, 80],
                        ["model", "Model (optional)", 0, 120],
                      ].map(([key, label, min, max]) => (
                        <FormField
                          key={key}
                          label={label}
                          required={min > 0}
                          minLength={min}
                          maxLength={max}
                          value={form[key]}
                          onChange={(e) =>
                            setForm({ ...form, [key]: e.target.value })
                          }
                        />
                      ))}
                      <div className="space-y-2">
                        <FormField
                          label="Serial number (private, optional)"
                          type={serialVisible ? "text" : "password"}
                          autoComplete="off"
                          maxLength={160}
                          value={form.serialNumber}
                          onChange={(e) =>
                            setForm({ ...form, serialNumber: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="text-primary ga-text-link text-sm"
                          aria-pressed={serialVisible}
                          onClick={() => setSerialVisible(!serialVisible)}
                        >
                          {serialVisible ? "Hide" : "Show"} serial number
                        </button>
                      </div>
                      <FormField
                        label="Purchase date (optional)"
                        type="date"
                        value={form.purchaseDate}
                        onChange={(e) =>
                          setForm({ ...form, purchaseDate: e.target.value })
                        }
                      />
                      <div className="sm:col-span-2 flex gap-3">
                        <Button type="submit" loading={saving}>
                          Save private device
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setEditing(false)}
                        >
                          Cancel editing
                        </Button>
                      </div>
                    </fieldset>
                  </form>
                </section>
              )}
              {id ? (
                <div className="grid lg:grid-cols-[1fr_320px] gap-6 min-w-0">
                  <div className="space-y-6 min-w-0">
                    <section className="ga-surface p-6 space-y-3">
                      <h2 className="text-xl font-semibold">Device details</h2>
                      <p>
                        {data.type} ·{" "}
                        {[data.brand, data.model].filter(Boolean).join(" ") ||
                          "Brand/model not added"}
                      </p>
                      <p className="ga-muted">
                        Purchase date: {data.purchaseDate || "Not added"}
                      </p>
                      <p className="ga-muted">
                        Serial number:{" "}
                        {data.serialNumber
                          ? "Saved privately — open Edit device to reveal or change"
                          : "Not added"}
                      </p>
                      <p className="text-sm ga-muted">
                        Associate this device from a booking's Gadget Passport
                        panel. Only linked GadgetAid repairs appear here; older
                        repairs are not assumed.
                      </p>
                    </section>
                    <DeviceReceipts deviceId={id} />
                    <section className="ga-surface p-6 space-y-4">
                      <h2 className="text-xl font-semibold">Repair history</h2>
                      {history?.items.length ? (
                        history.items.map((row) => (
                          <article
                            className="border-b border-base-300 pb-4 space-y-2"
                            key={row._id}
                          >
                            <h3 className="font-semibold">{row.serviceName}</h3>
                            <p className="text-sm ga-muted">
                              {row.date} · {row.status.replaceAll("_", " ")}
                            </p>
                            <p className="text-sm">
                              {row.warranty
                                ? `Provider warranty: ${row.warranty.startDate} to ${row.warranty.endDate} · ${row.warranty.periodState.replaceAll("_", " ")}`
                                : "No provider-issued warranty recorded."}
                            </p>
                            <Button
                              to={`/bookings/${row._id}`}
                              variant="outline"
                            >
                              Open repair and warranty
                            </Button>
                          </article>
                        ))
                      ) : (
                        <p className="ga-muted">No linked repairs yet.</p>
                      )}
                    </section>
                  </div>
                  <DeviceQr id={id} />
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {data.items.length ? (
                    data.items.map((row) => (
                      <article
                        key={row._id}
                        className="ga-surface p-6 space-y-3"
                      >
                        <p className="ga-eyebrow">{row.type}</p>
                        <h2 className="text-xl font-semibold break-words">
                          {row.label}
                        </h2>
                        <p className="ga-muted break-words">
                          {[row.brand, row.model].filter(Boolean).join(" ") ||
                            "Brand/model not added"}
                        </p>
                        <Button to={`/devices/${row._id}`} variant="outline">
                          Open private passport
                        </Button>
                      </article>
                    ))
                  ) : (
                    <p className="ga-muted">
                      No devices yet. Add your first private passport.
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={!back.length || loading}
                  onClick={() => {
                    setCursor(back.at(-1));
                    setBack(back.slice(0, -1));
                  }}
                >
                  Previous page
                </Button>
                <Button
                  variant="outline"
                  disabled={!page?.nextCursor || loading}
                  onClick={() => {
                    setBack([...back, cursor]);
                    setCursor(page.nextCursor);
                  }}
                >
                  Next page
                </Button>
              </div>
            </>
          )
        )}
        <p className="text-sm ga-muted">
          Private JPEG/PNG receipt uploads are available on each device. PDF
          files are not accepted. Device deletion erases its details, attached
          receipts and links; the original repair and warranty records remain
          available to their participants.
        </p>
      </div>
      <Dialog
        open={!!dialog}
        onClose={() => {
          if (!saving) setDialog("");
        }}
        title={
          dialog === "delete"
            ? "Delete this device?"
            : "Export private passport"
        }
      >
        <div className="space-y-5">
          <p className="break-words">{data?.label}</p>
          <p className="ga-muted">
            {dialog === "delete"
              ? "This permanently erases this device's saved details, serial number, attached receipt photos and repair links. Original bookings and provider warranty records are preserved. Export and download your receipts first if you need copies."
              : "The JSON file includes your private serial number, device details, receipt manifest and linked repair/warranty history. Receipt photos must be downloaded separately from Private receipts. Save these files only somewhere you trust."}
          </p>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I reviewed this exact device and confirm {dialog}.</span>
          </label>
          {error && (
            <p role="alert" className="text-error">
              {error}
            </p>
          )}
          <Button disabled={!confirmed} loading={saving} onClick={sensitive}>
            {dialog === "delete"
              ? "Permanently delete device"
              : "Download private JSON"}
          </Button>
        </div>
      </Dialog>
    </DashboardLayout>
  );
}
