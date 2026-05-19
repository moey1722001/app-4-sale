import { createContext, ReactNode, useContext, useEffect } from 'react';

export type OrganisationBrand = {
  name: string;
  tagline: string;
  logoUrl?: string;
  primary: string;
  accent: string;
  poweredBy: string;
};

export const platformBrand: OrganisationBrand = {
  name: 'Verola',
  tagline: 'Workflow SMS SaaS',
  primary: '#4f46e5',
  accent: '#06b6d4',
  poweredBy: 'Verola'
};

const OrganisationBrandContext = createContext<OrganisationBrand>(platformBrand);

export function BrandProvider({ brand, children }: { brand: OrganisationBrand; children: ReactNode }) {
  useEffect(() => {
    updateFavicon(brand.logoUrl);
  }, [brand.logoUrl]);

  return <OrganisationBrandContext.Provider value={brand}>{children}</OrganisationBrandContext.Provider>;
}

export function useBranding() {
  return useContext(OrganisationBrandContext);
}

export function updateFavicon(logoUrl?: string) {
  const href = logoUrl || '/favicon.svg';
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}
