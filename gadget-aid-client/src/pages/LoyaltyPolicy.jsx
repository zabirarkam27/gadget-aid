import ToolLayout from "../components/ToolLayout";
import Button from "../components/Button";
export default function LoyaltyPolicy() {
  return (
    <ToolLayout
      title="Discount points policy"
      description="Promotional, non-cash points for verified accounts and eligible recorded handovers. Discounts are funded only by technicians who explicitly opt into the individual quotation."
    >
      <article className="ga-surface p-5 sm:p-8 space-y-5">
        <h2 className="text-xl font-semibold">Earn and use points</h2>
        <ul className="list-disc pl-5 space-y-3">
          <li>
            20 points for the first eligible completed repair per customer per
            Bangladesh calendar day. Eligibility requires a customer-approved
            quotation of at least $20 USD total and $10 labor, plus a recorded
            handover by a different approved technician. Only new handovers
            under this policy qualify; old or unquoted legacy completions are
            not backfilled.
          </li>
          <li>
            40 referral points after a verified referred customer's first
            eligible completed repair with an independent technician. The
            referral must be claimed once before any booking. Maximum three
            referral rewards per referrer per calendar month. No self-referral
            or referral loops.
          </li>
          <li>
            Points become usable seven days after the qualifying handover and
            expire 365 days after that handover. Referral and repair credits are
            not cash and cannot be transferred or withdrawn.
          </li>
          <li>
            100 available unexpired points may fund a 5% labor-only discount,
            rounded down to a cent and capped at $5 USD per repair. Parts are
            not discounted. This uses the platform's existing USD quotation
            model, not the calculator's optional currency assumptions.
          </li>
          <li>
            The technician must explicitly agree to fund the discount when
            creating that quotation. The customer then explicitly authorizes the
            points redemption when approving it. No technician is automatically
            enrolled, and the platform does not reimburse discounts or promise
            cash.
          </li>
        </ul>
        <h2 className="text-xl font-semibold">
          Approval, expiry and cancellation
        </h2>
        <p>
          Points are consumed atomically when you approve the discount
          quotation, using credits closest to expiry first. A pending/rejected
          quotation does not reserve or spend points. If your balance changes or
          expires before approval, ask for another quotation without the points
          offer. Only one redemption is allowed per repair.
        </p>
        <p>
          If an approved repair is later cancelled through the supported
          workflow, unexpired points are restored once with their original
          expiry; expired points are not renewed. There is no separate cash
          refund because GadgetAid does not collect payments. Completed repairs
          cannot be cancelled through that workflow.
        </p>
        <h2 className="text-xl font-semibold">Programme controls and limits</h2>
        <p>
          Verified email, distinct customer/provider accounts, canonical
          handover events, daily/monthly caps, shared wallet guards and an
          auditable ledger control earning and redemption. They do not prove
          payment or detect every multi-account abuse. Restricted accounts
          cannot earn, claim referrals or redeem. Report a dispute through
          booking support; the platform can restrict abuse. Existing quote terms
          remain recorded.
        </p>
        <p className="ga-muted">
          The current programme has no administrative cash adjustments,
          automatic payment integrations or transferable balances. A final
          quotation is binding only through the existing provider/customer
          approval process; the assistant and estimate tools cannot grant
          discounts.
        </p>
        <Button to="/loyalty">Open my points wallet</Button>
      </article>
    </ToolLayout>
  );
}
