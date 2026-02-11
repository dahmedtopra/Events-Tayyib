import type { ReactNode } from "react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { OrientationBadge } from "../components/OrientationBadge";
import { DevTayyibControls } from "../components/DevTayyibControls";
import { useInactivityTimer } from "../hooks/useInactivityTimer";
import { BackgroundLayer } from "../components/BackgroundLayer";

type Props = {
  children: ReactNode;
};

export function KioskLayout({ children }: Props) {
  useInactivityTimer();

  return (
    <div className="relative h-screen w-full overflow-hidden bg-ivory text-charcoal">
      <BackgroundLayer />
      <OrientationBadge />
      <DevTayyibControls />
      <div className="h-full flex flex-col">
        <Header />
        <main className="flex-1 overflow-hidden">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
