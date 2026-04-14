import { createContext, useContext, useState, useRef, ReactNode } from "react";

interface TourSpotlightContextValue {
  spotlightHref: string | null;
  setSpotlightHref: (href: string | null) => void;
  openMobileMenu: () => void;
  registerOpenMobileMenu: (fn: () => void) => void;
}

const TourSpotlightContext = createContext<TourSpotlightContextValue>({
  spotlightHref: null,
  setSpotlightHref: () => {},
  openMobileMenu: () => {},
  registerOpenMobileMenu: () => {},
});

export function TourSpotlightProvider({ children }: { children: ReactNode }) {
  const [spotlightHref, setSpotlightHref] = useState<string | null>(null);
  const openMobileMenuRef = useRef<() => void>(() => {});

  const registerOpenMobileMenu = (fn: () => void) => {
    openMobileMenuRef.current = fn;
  };

  const openMobileMenu = () => {
    openMobileMenuRef.current();
  };

  return (
    <TourSpotlightContext.Provider value={{ spotlightHref, setSpotlightHref, openMobileMenu, registerOpenMobileMenu }}>
      {children}
    </TourSpotlightContext.Provider>
  );
}

export function useTourSpotlight() {
  return useContext(TourSpotlightContext);
}
