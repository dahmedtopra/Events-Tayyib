import { KioskLayout } from "../layouts/KioskLayout";
import { SearchExperience } from "../screens/SearchExperience";

export function HomePage() {
  return (
    <KioskLayout>
      <SearchExperience startAt="ATTRACT" />
    </KioskLayout>
  );
}
