import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import useServices from "../hooks/useServices";
import { API_URL } from "../utils/api";
import { readJson } from "../utils/readJson";
import ServiceCard from "./ServiceCard";
import FormField from "./ui/FormField";
import EmptyState from "./ui/EmptyState";
import Skeleton from "./ui/Skeleton";
import LoadMore from "./ui/LoadMore";
import Button from "./Button";

export default function Services() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState(false);
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const filters = new URLSearchParams({ limit: "6", ...Object.fromEntries([...params].filter(([key]) => ["q", "area", "category", "maxPrice", "sort"].includes(key))) });
  const page = useServices(filters.toString());
  const { data, loading, error, retry } = page;
  const update = (key, value) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); setParams(next, { replace: true }); };
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/categories`, { signal: controller.signal }).then(readJson).then(rows => {
      if (!Array.isArray(rows)) throw Error();
      if (!controller.signal.aborted) { setCategories(rows); setCategoryError(false); }
    }).catch(() => { if (!controller.signal.aborted) setCategoryError(true); });
    return () => controller.abort();
  }, [categoryAttempt]);
  return <>
    <Helmet><title>Repair services | GadgetAid</title></Helmet>
    <div className="ga-page-heading"><div className="ga-container"><p className="ga-eyebrow mb-4">The repair catalogue</p><h1 className="text-page font-bold">Find your next fix.</h1><p className="ga-muted mt-4 max-w-xl">Explore services by category, area and listed price.</p></div></div>
    <section className="ga-container ga-section">
      <div className="ga-surface p-5 sm:p-6 mb-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="Search services" type="search" maxLength={80} value={params.get("q") || ""} onChange={e => update("q", e.target.value)} placeholder="Screen, laptop or router" />
          <FormField label="Category" as="select" value={params.get("category") || ""} onChange={e => update("category", e.target.value)}><option value="">All categories</option>{categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</FormField>
          <FormField label="Service area" maxLength={120} placeholder="For example, Dhaka" value={params.get("area") || ""} onChange={e => update("area", e.target.value)} />
          <FormField label="Maximum price ($)" type="number" min="0" step="0.01" value={params.get("maxPrice") || ""} onChange={e => update("maxPrice", e.target.value)} />
          <FormField label="Sort services" as="select" value={params.get("sort") || "newest"} onChange={e => update("sort", e.target.value)}><option value="newest">Newest first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></FormField>
        </div>
        {categoryError && <div role="alert" className="mt-3 text-sm">Categories could not be loaded. <Button variant="ghost" size="sm" onClick={() => setCategoryAttempt(n => n + 1)}>Retry categories</Button></div>}
        <p className="ga-muted text-xs mt-4">Filters search the catalogue. Prices are the amounts listed by providers.</p>
      </div>
      {loading ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{[1,2,3].map(n => <Skeleton key={n} className="h-96 w-full" label="Loading repair services" />)}</div> : error ? <div role="alert"><EmptyState title="Services could not be loaded" description={error} action={<Button onClick={retry}>Try again</Button>} /></div> : <>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6"><p role="status" className="ga-muted text-sm">{data.length} services loaded</p>{params.size > 0 && <Button variant="ghost" size="sm" onClick={() => setParams({})}>Clear filters</Button>}</div>
        {data.length ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{data.map(service => <ServiceCard key={service._id} service={service} />)}</div> : <EmptyState title="No services match just yet" description="Try another search or clear your filters." action={<Button onClick={() => setParams({})}>Clear filters</Button>} />}
        <LoadMore page={page} label="Show more services" />
      </>}
    </section>
  </>;
}
