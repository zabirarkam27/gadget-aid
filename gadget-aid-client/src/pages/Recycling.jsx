import ToolLayout from "../components/ToolLayout";
import Button from "../components/Button";
export default function Recycling() {
  return (
    <ToolLayout
      title="Responsible recycling"
      description="Consider repair, reuse and safe disposal. GadgetAid currently has no recycling collection partner or pickup process, and does not accept devices for recycling."
    >
      <div className="grid md:grid-cols-2 gap-6">
        <article className="ga-surface p-6">
          <h2 className="text-xl font-semibold">Before disposal</h2>
          <ul className="list-disc pl-5 space-y-3 mt-5">
            <li>
              Ask a qualified technician whether repair or reuse is practical. A
              low listed price alone cannot establish safety or repairability.
            </li>
            <li>
              For a safe, working device, follow the manufacturer's instructions
              to back up data, remove accounts and erase it before handing it to
              another party. Do not power on a damaged device just to erase it.
            </li>
            <li>
              Check your manufacturer or local authority for an authorized
              electronics collection route. Verify availability, battery
              acceptance, data handling and fees directly.
            </li>
          </ul>
        </article>
        <article className="ga-surface p-6">
          <h2 className="text-xl font-semibold">
            Damaged batteries need qualified help
          </h2>
          <p className="mt-5">
            Stop using and charging swollen, smoking, unusually hot or
            liquid-damaged electronics. Do not open devices or remove built-in
            batteries. Seek qualified advice for handling and disposal. Do not
            put damaged batteries or electronics in household rubbish or a
            normal recycling bin.
          </p>
          <p className="mt-4">
            For smoke or fire, move away and contact local emergency services.
            Do not wait for a repair or recycling booking.
          </p>
        </article>
      </div>
      <div className="ga-surface p-6 mt-6">
        <h2 className="text-xl font-semibold">Independent information</h2>
        <p className="ga-muted mt-3">
          These are general resources, not local partner listings or a statement
          of Bangladesh collection rules.
        </p>
        <ul className="space-y-3 mt-4">
          <li>
            <a
              className="ga-text-link text-primary"
              href="https://www.epa.gov/recycle/electronics-donation-and-recycling"
              target="_blank"
              rel="noreferrer"
            >
              US EPA: electronics donation and recycling ↗
            </a>
          </li>
          <li>
            <a
              className="ga-text-link text-primary"
              href="https://www.consumerproductsafety.gov.sg/consumers/product-safety-tips/products-that-charge-or-power-appliances/safety-tips-on-lithium-ion-batteries/"
              target="_blank"
              rel="noreferrer"
            >
              Consumer Product Safety Office: battery safety ↗
            </a>
          </li>
        </ul>
        <div className="mt-5">
          <Button to="/services" variant="outline">
            Explore repair options
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
}
