const SummaryCards = ({ items }) => <dl className="grid sm:grid-cols-3 gap-4 mb-8">{items.map(item => <div key={item.label} className="ga-surface p-5"><dt className="ga-muted text-sm">{item.label}</dt><dd className="ga-numeric text-3xl font-bold mt-2">{item.value}</dd></div>)}</dl>;
export default SummaryCards;
