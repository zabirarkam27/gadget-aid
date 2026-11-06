import Button from "../Button";
export default function LoadMore({ page, label = "Load more" }) {
  return <div className="mt-8 space-y-3 text-center">
    {page.moreError && <p role="alert" className="text-error text-sm">{page.moreError}</p>}
    {page.nextCursor && <Button variant="outline" loading={page.loadingMore} onClick={page.loadMore}>{page.moreError ? "Retry loading more" : label}</Button>}
  </div>;
}
