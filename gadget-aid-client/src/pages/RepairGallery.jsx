import ToolLayout from "../components/ToolLayout";
import ExamplePhotos from "../components/gallery/ExamplePhotos";
import LoadMore from "../components/ui/LoadMore";
import Button from "../components/Button";
import usePagedCollection from "../hooks/usePagedCollection";
export default function RepairGallery() {
  const page = usePagedCollection("/repair-gallery?limit=6");
  return (
    <ToolLayout
      title="Before and after repairs"
      description="Examples published only after customer consent and platform moderation. Photos are provider-supplied examples, not a promise of the same result or evidence of independently verified repair quality."
    >
      {page.loading ? (
        <p role="status">Loading approved examples…</p>
      ) : page.error ? (
        <p role="alert">
          {page.error} <Button onClick={page.retry}>Retry gallery</Button>
        </p>
      ) : (
        <>
          <div className="space-y-7">
            {page.data.map((item) => (
              <article
                key={item._id}
                className="ga-surface p-5 sm:p-8 space-y-5"
              >
                <h2 className="text-xl font-semibold break-words">
                  {item.title}
                </h2>
                <p className="ga-muted">
                  Example supplied by {item.providerName}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {item.description}
                </p>
                <ExamplePhotos item={item} />
              </article>
            ))}
          </div>
          {!page.data.length && (
            <p>
              No approved examples are available yet. Customer consent and
              review are required before anything appears here.
            </p>
          )}
          <LoadMore page={page} label="Load more repair examples" />
        </>
      )}
    </ToolLayout>
  );
}
