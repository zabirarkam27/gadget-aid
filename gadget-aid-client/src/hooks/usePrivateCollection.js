import usePagedCollection from "./usePagedCollection";
export default function usePrivateCollection(path, filters = "") {
  return usePagedCollection(`${path}?paged=1&limit=12${filters ? `&${filters}` : ""}`, true);
}
