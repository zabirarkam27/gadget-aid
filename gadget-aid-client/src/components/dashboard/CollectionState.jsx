import Skeleton from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import Button from "../Button";
const CollectionState = ({ loading, error, retry, children }) => loading ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{[1,2,3].map(id => <Skeleton key={id} className="h-80 w-full" label="Loading workspace" />)}</div> : error ? <div role="alert"><EmptyState title="Could not load your workspace" description={error} action={<Button onClick={retry}>Try again</Button>} /></div> : children;
export default CollectionState;
