import { Link } from "react-router-dom";


const Brand = () => (
  <Link to="/" className="inline-flex shrink-0 items-center gap-2.5" aria-label="GadgetAid home">
    <img src="/logo.png" alt="" width="40" height="40" className="h-10 w-10 object-contain" />
    <span className="text-xl font-bold tracking-tight">Gadget<span className="text-primary">Aid</span></span>
  </Link>
);
export default Brand;

