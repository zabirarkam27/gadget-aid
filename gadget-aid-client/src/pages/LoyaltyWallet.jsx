import { useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AuthContext } from "../provider/AuthContext";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import FormField from "../components/ui/FormField";
import Button from "../components/Button";
import LoadMore from "../components/ui/LoadMore";
import usePagedCollection from "../hooks/usePagedCollection";
import { API_URL } from "../utils/api";
import { authFetch } from "../utils/authFetch";
import { readJson } from "../utils/readJson";
const date = (value) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
export default function LoyaltyWallet() {
  const { user } = useContext(AuthContext);
  return <Wallet key={user?.uid || "guest"} />;
}
function Wallet() {
  const [params] = useSearchParams(),
    [data, setData] = useState(null),
    [cursor, setCursor] = useState(""),
    [history, setHistory] = useState([]),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [code, setCode] = useState(params.get("ref") || ""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    alive = useRef(true);
  const spends = usePagedCollection("/loyalty/redemptions?limit=10", true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    authFetch(
      `${API_URL}/loyalty?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal: c.signal },
    )
      .then(readJson)
      .then((value) => {
        if (
          !Array.isArray(value.items) ||
          !Number.isFinite(value.availablePoints) ||
          !Number.isFinite(value.pendingPoints)
        )
          throw Error();
        if (!c.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError("Your points wallet could not be loaded.");
      });
    return () => c.abort();
  }, [cursor, attempt]);
  const refresh = () => {
    setAttempt((n) => n + 1);
    spends.retry();
  };
  const claim = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await authFetch(`${API_URL}/loyalty/referral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toLowerCase(), confirmed }),
      }).then(readJson);
      if (alive.current) {
        setNotice(
          "Referral recorded. Rewards require an eligible independent completed handover.",
        );
        setConfirmed(false);
        refresh();
      }
    } catch (f) {
      if (alive.current)
        setError(f.message || "Referral could not be recorded.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <DashboardLayout
      title="Discount points"
      description="Private, non-cash promotional points. A provider-funded labor discount is available only when the technician explicitly offers it in your quotation."
      action={
        <Button to="/loyalty-policy" variant="outline">
          Read complete points policy
        </Button>
      }
    >
      <Button variant="outline" onClick={refresh}>
        Refresh wallet
      </Button>
      {error && (
        <p role="alert" className="text-error mt-4">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4">
          {notice}
        </p>
      )}
      {!data && !error && (
        <p role="status" className="mt-5">
          Loading points wallet…
        </p>
      )}
      {data && (
        <div className="space-y-6 mt-6">
          <dl className="grid sm:grid-cols-2 gap-5">
            {[
              ["Available points", data.availablePoints],
              ["Pending points (7-day hold)", data.pendingPoints],
            ].map(([label, value]) => (
              <div key={label} className="ga-surface p-5">
                <dt className="ga-muted">{label}</dt>
                <dd className="text-3xl ga-numeric mt-3">{value}</dd>
              </div>
            ))}
          </dl>
          {!data.emailVerified && (
            <p role="status">
              Verify your email in Account access before earning, claiming
              referrals or redeeming points.
            </p>
          )}
          {data.reconciliationPending && (
            <p role="status">
              More qualifying repairs remain to be reconciled. Refresh the
              wallet to continue.
            </p>
          )}
          <article className="ga-surface p-5 space-y-4">
            <h2 className="text-xl font-semibold">How this works</h2>
            <p>
              20 points for the first eligible completed repair per day; 40 for
              an eligible referral, at most three per month. Eligibility
              requires an approved quotation of at least $20 USD total and $10
              labor, a recorded independent handover and verified account.
              Credits unlock after seven days and expire after 365 days. 100
              points can provide 5% off labor, capped at $5 USD, only when the
              provider opts into that quotation. Approval explicitly spends
              points; parts are not discounted.
            </p>
            <p className="ga-muted text-sm">
              The platform does not collect payment, promise cash, or
              automatically enroll technicians. Unexpired points from a
              cancelled approved repair return with their original expiry.
            </p>
          </article>
          {data.referralCode && (
            <article className="ga-surface p-5 space-y-3">
              <h2 className="text-xl font-semibold">Your referral code</h2>
              <p className="font-mono break-all select-all">
                {data.referralCode}
              </p>
              <p className="ga-muted text-sm">
                Share this code yourself with a new verified customer before
                they book. It reveals no account email or UID. Rewards follow
                the independent-handover rules; merely signing up does not earn
                points.
              </p>
            </article>
          )}
          {data.canClaimReferral && (
            <form onSubmit={claim} className="ga-surface p-5 space-y-4">
              <h2 className="text-xl font-semibold">
                Claim a referral before your first booking
              </h2>
              <FormField
                label="Inviter's referral code"
                required
                pattern="[a-fA-F0-9]{24}"
                maxLength={24}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setConfirmed(false);
                }}
                disabled={busy}
              />
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm shrink-0"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I choose this inviter once and understand that previous
                  bookings make me ineligible. Self-referrals and loops are not
                  allowed.
                </span>
              </label>
              <Button type="submit" disabled={!confirmed} loading={busy}>
                Record referral
              </Button>
            </form>
          )}
          {data.referralClaimed && (
            <p>
              Your referral choice is already recorded and cannot be changed.
            </p>
          )}
          {!data.canClaimReferral&&!data.referralClaimed&&data.emailVerified&&<p>A referral can only be claimed before your first booking on an unrestricted account.</p>}
          <article className="ga-surface p-5 space-y-4">
            <h2 className="text-xl font-semibold">Reward entries</h2>
            {!data.items.length ? (
              <p>
                No earned points on this page. Old completed repairs are not
                backfilled.
              </p>
            ) : (
              <ul className="space-y-4">
                {data.items.map((row) => (
                  <li key={row._id} className="border-b border-base-300 pb-4">
                    <p>
                      {row.type === "referral"
                        ? "Referral reward"
                        : "Completed-repair reward"}{" "}
                      · {row.points} points · {row.remainingPoints} not spent
                    </p>
                    <p className="ga-muted text-sm">
                      Issued {date(row.issuedAt)} · usable{" "}
                      {date(row.availableAt)} · expires {date(row.expiresAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!history.length}
                onClick={() => {
                  setCursor(history.at(-1));
                  setHistory((values) => values.slice(0, -1));
                }}
              >
                Previous entries
              </Button>
              <Button
                disabled={!data.nextCursor}
                onClick={() => {
                  setHistory((values) => [...values, cursor]);
                  setCursor(data.nextCursor);
                }}
              >
                Next entries
              </Button>
            </div>
          </article>
        </div>
      )}
      <section className="ga-surface p-5 mt-6 space-y-4">
        <h2 className="text-xl font-semibold">Redemption ledger</h2>
        {spends.loading ? (
          <p role="status">Loading redemptions…</p>
        ) : spends.error ? (
          <p role="alert">
            {spends.error}
            <Button onClick={spends.retry}>Retry ledger</Button>
          </p>
        ) : !spends.data.length ? (
          <p>No point redemptions yet.</p>
        ) : (
          <ul className="space-y-4">
            {spends.data.map((row) => (
              <li key={row._id} className="border-b border-base-300 pb-4">
                <p>
                  {row.points} points redeemed for ${row.discount.toFixed(2)}{" "}
                  {row.currency} labor discount · {date(row.createdAt)}
                </p>
                {row.refunded && (
                  <p>
                    {row.restoredPoints} unexpired points restored after
                    cancellation; original expiry applies.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <LoadMore page={spends} label="Load more redemptions" />
      </section>
    </DashboardLayout>
  );
}
