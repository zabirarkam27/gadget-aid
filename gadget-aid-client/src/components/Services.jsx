import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { FiSliders } from "react-icons/fi";
import useServices from "../hooks/useServices";
import ServiceCard from "./ServiceCard";
import FormField from "./ui/FormField";
import EmptyState from "./ui/EmptyState";
import Skeleton from "./ui/Skeleton";
import Button from "./Button";

const numericPrice = service => service.price === "" || service.price == null || !Number.isFinite(Number(service.price)) ? null : Number(service.price);
const Services = () => {
  const { data, loading, error, retry } = useServices();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [area, setArea] = useState("");
  const [sort, setSort] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const areas = [...new Set(data.map(service => service.area).filter(value => typeof value === "string" && value.trim()))].sort();
  const results = data.filter(service => String(service.name || "").toLowerCase().includes(query.trim().toLowerCase()) && (!area || service.area === area) && (maxPrice === "" || (numericPrice(service) !== null && numericPrice(service) <= Number(maxPrice))));
  if (sort) results.sort((a,b) => {
    const first = numericPrice(a), second = numericPrice(b);
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return sort === "low" ? first - second : second - first;
  });
  const reset = () => { setSearchParams({}); setArea(""); setSort(""); setMaxPrice(""); setVisibleCount(6); };

  return <>
    <Helmet><title>Repair services | GadgetAid</title><meta name="description" content="Explore GadgetAid repair services by name, service area and listed price." /></Helmet>
    <div className="ga-page-heading"><div className="ga-container"><p className="ga-eyebrow mb-4">The repair catalogue</p><h1 className="text-page font-bold">Find your next fix.</h1><p className="ga-muted mt-4 max-w-xl">Explore repair services, compare the listed price and find a provider in the right area.</p></div></div>
    <section className="ga-container ga-section">
      <div className="ga-surface p-5 sm:p-6 mb-8"><div className="flex items-center gap-2 mb-5 font-semibold"><FiSliders aria-hidden="true" />Find a service</div><div className="grid sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr_1.3fr] gap-4">
        <FormField label="Search services" type="search" placeholder="Try screen, laptop or router" value={query} onChange={event => { const next = new URLSearchParams(searchParams); event.target.value ? next.set("q",event.target.value) : next.delete("q"); setSearchParams(next,{replace:true}); setVisibleCount(6); }} />
        <FormField label="Service area" as="select" value={area} onChange={event => {setArea(event.target.value);setVisibleCount(6);}}><option value="">All areas</option>{areas.map(value => <option key={value} value={value}>{value}</option>)}</FormField>
        <FormField label="Maximum price ($)" type="number" min="0" step="any" placeholder="Any price" value={maxPrice} onChange={event => {setMaxPrice(event.target.value === "" ? "" : String(Math.max(0,Number(event.target.value))));setVisibleCount(6);}} />
        <FormField label="Sort services" as="select" value={sort} onChange={event => {setSort(event.target.value);setVisibleCount(6);}}><option value="">Catalogue order</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></FormField>
      </div><p className="ga-muted text-xs mt-4">Filters apply to the loaded catalogue. Prices are the amounts listed by providers.</p></div>
      {loading ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{[1,2,3,4,5,6].map(id => <Skeleton key={id} className="h-96 w-full" label="Loading repair services" />)}</div> : error ? <div role="alert"><EmptyState title="Services could not be loaded" description={error} action={<Button onClick={retry}>Try again</Button>} /></div> : <>
        <div className="flex items-center justify-between gap-4 mb-6"><p role="status" className="ga-muted text-sm ga-numeric">{results.length} {results.length === 1 ? "service" : "services"} found</p>{(query || area || maxPrice || sort) && <Button variant="ghost" size="sm" onClick={reset}>Clear filters</Button>}</div>
        {results.length ? <><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{results.slice(0,visibleCount).map(service => <ServiceCard key={service._id} service={service} />)}</div>{visibleCount < results.length && <div className="text-center mt-10"><Button variant="outline" onClick={() => setVisibleCount(count => count+6)}>Show more services ({results.length-visibleCount} remaining)</Button></div>}</> : <EmptyState title={data.length ? "No services match just yet" : "No services listed yet"} description={data.length ? "Try another search or clear your filters to explore the catalogue." : "Check back soon for available repair services."} action={data.length ? <Button onClick={reset}>Clear filters</Button> : undefined} />}
      </>}
    </section>
  </>;
};
export default Services;
