import { KioskLayout } from "../layouts/KioskLayout";
import { SearchExperience } from "../screens/SearchExperience";

export function AskPage() {
  return (
    <KioskLayout>
      <SearchExperience startAt="SEARCH_READY" />
    </KioskLayout>
  );
}
