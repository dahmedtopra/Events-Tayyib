import { useEffect, useState } from "react";
import { KioskLayout } from "../layouts/KioskLayout";
import { useLang } from "../hooks/useLang";

export function SharePage() {
  const { t } = useLang();
  const [hasPayload, setHasPayload] = useState(false);

  useEffect(() => {
    const hash = window.location.hash || "";
    setHasPayload(hash.includes("#d="));
  }, []);

  return (
    <KioskLayout>
      <div className="h-full p-6">
        <div className="rounded-xl border border-amber-200 bg-white/70 p-6 h-full">
          <div className="text-xl font-semibold mb-4">{t.shareTitle}</div>
          <div className="text-sm text-gray-600">
            {hasPayload ? t.checklistLoaded : t.checklistMissing}
          </div>
        </div>
      </div>
    </KioskLayout>
  );
}
