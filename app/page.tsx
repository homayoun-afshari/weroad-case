import { SearchApp } from "@/components/SearchApp";
import { pageStateFor } from "@/lib/page/view";

/** The page opens with a search already applied, run by the same function as the search button. */
const OPENING_SEARCH = { text: "northern lights" };

export default function Page() {
  return <SearchApp initial={pageStateFor(OPENING_SEARCH)} />;
}
