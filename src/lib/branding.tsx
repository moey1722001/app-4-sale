import { createContext, ReactNode, useContext, useEffect } from 'react';

export type OrganisationBrand = {
  name: string;
  tagline: string;
  logoUrl?: string;
  appIconUrl?: string;
  faviconUrl?: string;
  lightLogoUrl?: string;
  darkLogoUrl?: string;
  emailHeaderLogoUrl?: string;
  primary: string;
  accent: string;
  poweredBy: string;
};

export const platformBrand: OrganisationBrand = {
  name: 'Verola',
  tagline: 'Run your business. Grow every day.',
  logoUrl: '/verola-logo.png',
  appIconUrl: '/verola-icon-512.png',
  faviconUrl: '/favicon.svg',
  lightLogoUrl: '/verola-logo.png',
  darkLogoUrl: '/verola-logo.png',
  emailHeaderLogoUrl: '/verola-logo.png',
  primary: '#4f46e5',
  accent: '#06b6d4',
  poweredBy: 'Verola'
};

const OrganisationBrandContext = createContext<OrganisationBrand>(platformBrand);
let dynamicManifestUrl = '';

export function BrandProvider({ brand, children }: { brand: OrganisationBrand; children: ReactNode }) {
  useEffect(() => {
    updateDocumentBranding(brand);
  }, [brand]);

  return <OrganisationBrandContext.Provider value={brand}>{children}</OrganisationBrandContext.Provider>;
}

export function useBranding() {
  return useContext(OrganisationBrandContext);
}

function upsertHeadLink(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

function upsertMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

export function updateDocumentBranding(brand: OrganisationBrand) {
  const iconHref = brand.faviconUrl || brand.appIconUrl || brand.logoUrl || platformBrand.faviconUrl || '/favicon.png';
  upsertHeadLink('icon', iconHref);
  upsertHeadLink('apple-touch-icon', brand.appIconUrl || brand.logoUrl || platformBrand.appIconUrl || '/verola-icon-512.png');
  updateManifest(brand, iconHref);
  upsertMeta('theme-color', brand.primary || platformBrand.primary);
}

function updateManifest(brand: OrganisationBrand, iconHref: string) {
  const manifest = {
    name: brand.name === platformBrand.name ? 'Verola' : `${brand.name} by Verola`,
    short_name: brand.name || 'Verola',
    description: brand.tagline || platformBrand.tagline,
    start_url: '/business-admin',
    scope: '/',
    display: 'standalone',
    background_color: '#f3f6ff',
    theme_color: brand.primary || platformBrand.primary,
    icons: [
      { src: iconHref, sizes: '192x192', type: iconHref.endsWith('.svg') ? 'image/svg+xml' : 'image/png', purpose: 'any maskable' },
      { src: iconHref, sizes: '512x512', type: iconHref.endsWith('.svg') ? 'image/svg+xml' : 'image/png', purpose: 'any maskable' }
    ]
  };

  // Browser/PWA limitation: installed Home Screen icons may be cached by the OS.
  // This dynamic manifest gives the best per-tenant result before install, while
  // production can later replace it with a server-rendered /manifest per tenant.
  if (dynamicManifestUrl) URL.revokeObjectURL(dynamicManifestUrl);
  dynamicManifestUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
  upsertHeadLink('manifest', dynamicManifestUrl);
}
