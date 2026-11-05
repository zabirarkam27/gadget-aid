import Button from "./Button";
import ServiceCard from "./ServiceCard";
import EmptyState from "./ui/EmptyState";
import Skeleton from "./ui/Skeleton";
import useServices from "../hooks/useServices";

const PopularServices = () => {
  const { data, loading, error, retry } = useServices();
  return (
    <section className="ga-container ga-section" aria-labelledby="featured-title">
      <div className="flex flex-wrap justify-between items-end gap-5 mb-8"><div><p className="ga-eyebrow mb-3">A good place to start</p><h2 id="featured-title" className="text-page font-bold">Find the right fix.</h2><p className="ga-muted mt-3">Featured services from the GadgetAid catalogue.</p></div><Button to="/services" variant="outline">Browse all services ↗</Button></div>
      {loading ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{[1,2,3].map(id => <Skeleton key={id} className="h-96 w-full" label="Loading featured services" />)}</div> : error ? <div role="alert"><EmptyState title="Could not load services" description={error} action={<Button onClick={retry}>Try again</Button>} /></div> : data.length ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{data.slice(0,3).map(service => <ServiceCard key={service._id} service={service} />)}</div> : <EmptyState title="Services are on their way" description="Check back soon, or offer a repair service of your own." action={<Button to="/add-service">Offer a service</Button>} />}
    </section>
  );
};
export default PopularServices;
