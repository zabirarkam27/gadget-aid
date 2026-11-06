import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../provider/AuthContext";
import { API_URL } from "../../utils/api";
import { authFetch } from "../../utils/authFetch";
function PublicPhoto({ path, label }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <p role="status">
      {label} image is unavailable. Refresh the gallery; the example may have
      been withdrawn.
    </p>
  ) : (
    <img
      src={`${API_URL}${path}`}
      alt={`${label} repair example`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="w-full max-h-80 object-contain rounded-xl"
    />
  );
}
function PrivatePhoto({ path, label }) {
  const [source, setSource] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    let url = "";
    setSource("");
    setError(false);
    authFetch(`${API_URL}${path}`, { signal: c.signal })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const blob = await response.blob();
        if (c.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setSource(url);
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => {
      c.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return error ? (
    <p role="alert">
      {label} image could not be loaded. Refresh the example before deciding.
    </p>
  ) : source ? (
    <img
      src={source}
      alt={`${label} repair example, private review`}
      onError={() => setError(true)}
      className="w-full max-h-80 object-contain rounded-xl"
    />
  ) : (
    <p role="status">Loading {label.toLowerCase()} image…</p>
  );
}
export default function ExamplePhotos({
  item,
  privateAccess = false,
  admin = false,
}) {
  const { user } = useContext(AuthContext);
  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {["before", "after"].map((slot) => (
        <figure key={slot} className="min-w-0">
          <figcaption className="font-semibold mb-3">
            {slot === "before" ? "Before" : "After"}
          </figcaption>
          {privateAccess ? (
            item[slot] ? (
              <PrivatePhoto
                key={`${user?.uid}:${item._id}:${item.revision}:${slot}`}
                path={`${admin ? "/admin/gallery" : "/examples"}/${item._id}/images/${slot}`}
                label={slot === "before" ? "Before" : "After"}
              />
            ) : (
              <p className="ga-muted">Not uploaded.</p>
            )
          ) : (
            <PublicPhoto
              key={`${item._id}:${item.revision}:${slot}`}
              path={`/repair-gallery/${item._id}/images/${slot}`}
              label={slot === "before" ? "Before" : "After"}
            />
          )}
        </figure>
      ))}
    </div>
  );
}
