import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../utils/api";
import { authFetch } from "../../utils/authFetch";
import { readJson } from "../../utils/readJson";
import Button from "../Button";
import FormField from "../ui/FormField";
import Dialog from "../ui/Dialog";
const POLICY = "private-receipts-v1",
  MAX_BYTES = 3 * 1024 * 1024;
export default function DeviceReceipts({ deviceId }) {
  const [data, setData] = useState(null),
    [file, setFile] = useState(null),
    [label, setLabel] = useState(""),
    [accepted, setAccepted] = useState(false),
    [pending, setPending] = useState(""),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [removing, setRemoving] = useState(null),
    [confirmed, setConfirmed] = useState(false);
  const input = useRef(null),
    lock = useRef(false),
    alive = useRef(true),
    uploadId = useRef(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setError("");
    authFetch(`${API_URL}/devices/${deviceId}/receipts`, { signal: c.signal })
      .then(readJson)
      .then((value) => {
        if (!c.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [deviceId, attempt]);
  const choose = (event) => {
    const next = event.target.files?.[0] || null;
    setError("");
    setNotice("");
    setAccepted(false);
    uploadId.current = crypto.randomUUID();
    if (
      next &&
      (!["image/jpeg", "image/png"].includes(next.type) ||
        next.size > MAX_BYTES ||
        !next.size)
    ) {
      setFile(null);
      event.target.value = "";
      setError(
        "Choose a JPEG/PNG receipt photo up to 3 MiB. PDF and other files are not supported.",
      );
      return;
    }
    setFile(next);
  };
  const upload = async (event) => {
    event.preventDefault();
    if (lock.current || !file || !accepted) return;
    lock.current = true;
    setPending("upload");
    setError("");
    setNotice("");
    try {
      await authFetch(`${API_URL}/devices/${deviceId}/receipts`, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-Upload-Id": uploadId.current,
          "X-Receipt-Policy": POLICY,
          "X-Receipt-Label": encodeURIComponent(label.trim()),
        },
        body: file,
      }).then(readJson);
      if (alive.current) {
        setNotice(
          "Receipt photo uploaded privately. Download it to check the saved copy before discarding your original.",
        );
        setFile(null);
        setLabel("");
        setAccepted(false);
        if (input.current) input.current.value = "";
        setAttempt((v) => v + 1);
      }
    } catch (e) {
      if (alive.current)
        setError(
          e.message +
            " Refresh the list before retrying if the upload outcome is uncertain.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setPending("");
    }
  };
  const download = async (row) => {
    if (lock.current) return;
    lock.current = true;
    setPending(row._id);
    setError("");
    try {
      const response = await authFetch(
        `${API_URL}/devices/${deviceId}/receipts/${row._id}/content`,
      );
      if (!response.ok) await readJson(response);
      const blob = await response.blob();
      if (alive.current) {
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = `receipt-${row._id}.jpg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice("Private JPEG prepared for download.");
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      lock.current = false;
      if (alive.current) setPending("");
    }
  };
  const remove = async () => {
    if (lock.current || !confirmed) return;
    lock.current = true;
    setPending("delete");
    setError("");
    try {
      await authFetch(
        `${API_URL}/devices/${deviceId}/receipts/${removing._id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
        },
      ).then(readJson);
      if (alive.current) {
        setRemoving(null);
        setConfirmed(false);
        setNotice("Receipt and its encrypted content were deleted.");
        setAttempt((v) => v + 1);
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      lock.current = false;
      if (alive.current) setPending("");
    }
  };
  return (
    <section className="ga-surface p-6 space-y-5 min-w-0">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <h2 className="text-xl font-semibold">Private receipts</h2>
        <Button
          variant="outline"
          disabled={!!pending}
          onClick={() => setAttempt((v) => v + 1)}
        >
          Refresh receipts
        </Button>
      </div>
      <p className="ga-muted">
        Upload a JPEG/PNG photo of your invoice or receipt, up to 3 MiB. Images
        are validated, converted to JPEG and stripped of original metadata
        before encrypted storage. PDF uploads are not available.
      </p>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-success">
          {notice}
        </p>
      )}
      {!data ? (
        <p role="status">Checking private storage…</p>
      ) : (
        <>
          {!data.available && (
            <p className="text-warning">
              Encrypted receipt storage is not configured. Uploads are
              unavailable; existing receipt deletion remains available.
            </p>
          )}
          <ul className="space-y-4">
            {data.items.length ? (
              data.items.map((row) => (
                <li
                  className="border-b border-base-300 pb-4 space-y-2"
                  key={row._id}
                >
                  <h3 className="font-semibold break-words">{row.label}</h3>
                  <p className="text-sm ga-muted">
                    JPEG · {Math.ceil(row.size / 1024)} KiB · {row.width} ×{" "}
                    {row.height}
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <Button
                      variant="outline"
                      disabled={!!pending || !data.available}
                      loading={pending === row._id}
                      onClick={() => download(row)}
                    >
                      Download receipt
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!!pending}
                      onClick={() => {
                        setRemoving(row);
                        setConfirmed(false);
                      }}
                    >
                      Delete receipt
                    </Button>
                  </div>
                </li>
              ))
            ) : (
              <li className="ga-muted">
                No receipts uploaded for this device.
              </li>
            )}
          </ul>
          <form onSubmit={upload} className="space-y-4">
            <fieldset
              disabled={
                !!pending ||
                !data.available ||
                data.items.length >= data.maxPerDevice
              }
              className="space-y-4"
            >
              <FormField
                label="Receipt label"
                required
                minLength={2}
                maxLength={100}
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setAccepted(false);
                }}
                placeholder="Purchase invoice or repair receipt"
              />
              <label
                className="ga-field-label"
                htmlFor={`receipt-file-${deviceId}`}
              >
                Receipt photo
              </label>
              <input
                id={`receipt-file-${deviceId}`}
                ref={input}
                type="file"
                accept="image/jpeg,image/png"
                required
                onChange={choose}
                className="file-input w-full max-w-full"
              />
              <p className="text-sm ga-muted">
                Only you can read these files. They stay until you delete the
                receipt or device. Device deletion erases attached receipts too;
                retained infrastructure backups follow the operator's backup
                policy. Do not upload passwords or identity documents.
              </p>
              <label className="flex gap-3 items-start">
                <input
                  type="checkbox"
                  className="checkbox shrink-0"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  I have permission to store this receipt and accept the private
                  storage and deletion policy.
                </span>
              </label>
              <Button
                type="submit"
                disabled={!file || !accepted}
                loading={pending === "upload"}
              >
                Upload private receipt
              </Button>
            </fieldset>
          </form>
          <p className="text-sm ga-muted">
            Limits: 10 receipts per device, 50 per account and 30 MiB of saved
            images per account. A receipt is a user-supplied document and does
            not verify purchase, repair completion or warranty coverage.
          </p>
        </>
      )}
      <Dialog
        open={!!removing}
        onClose={() => {
          if (!pending) setRemoving(null);
        }}
        title="Permanently delete receipt?"
      >
        <div className="space-y-4">
          <p className="break-words">{removing?.label}</p>
          <p className="ga-muted">
            This removes the stored receipt photo and encrypted content.
            Download a copy first if you need it.
          </p>
          <label className="flex gap-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I confirm deletion of this exact receipt.</span>
          </label>
          {error && (
            <p role="alert" className="text-error">
              {error}
            </p>
          )}
          <Button
            disabled={!confirmed}
            loading={pending === "delete"}
            onClick={remove}
          >
            Permanently delete receipt
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
