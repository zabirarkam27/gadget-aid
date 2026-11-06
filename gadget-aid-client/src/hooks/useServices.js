import usePagedCollection from "./usePagedCollection";
export default function useServices(filters = "limit=3") {
  return usePagedCollection(`/services?paged=1&${filters}`);
}
