import { useRouteError } from "react-router-dom";
import { FiTool } from "react-icons/fi";
import Button from "../components/Button";
const Error=()=>{
  const error=useRouteError();
  const missing=error?.status === 404;
  return <main className="ga-container min-h-screen flex flex-col items-center justify-center text-center py-16"><FiTool className="text-primary mb-6" size={40} aria-hidden="true" /><p className="ga-eyebrow mb-4">{missing ? "404 · Page not found" : "Something went wrong"}</p><h1 className="text-page font-bold">{missing ? "This link needs a little repair." : "Let’s try that again."}</h1><p className="ga-muted max-w-md mt-5 mb-8">{missing ? "The page may have moved, or the address may be incorrect. You can still explore GadgetAid’s repair services." : "We could not display this page. Reload it or head back to the homepage."}</p><div className="flex flex-wrap gap-3 justify-center"><Button to="/">Back to home</Button>{missing ? <Button to="/services" variant="outline">Find a service</Button> : <Button variant="outline" onClick={()=>window.location.reload()}>Reload page</Button>}</div></main>;
};
export default Error;
