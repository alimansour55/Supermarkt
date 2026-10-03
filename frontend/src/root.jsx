/**
 * Root route — HTML document shell, app-wide providers and SSR data shared by every page
 * (store settings + category tree). RTL is applied via LanguageContext (Arabic default).
 */
import { useEffect } from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
  // Raw hook on purpose: <html lang> needs the real, prefixed URL.
  // eslint-disable-next-line no-restricted-imports
  useLocation as useRouterLocation,
} from 'react-router';
import stylesheet from './index.css?url';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LocationProvider } from './context/LocationContext';
import { StoreSettingsProvider } from './context/StoreSettingsContext';
import { CategoriesProvider } from './context/CategoriesContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { ToastProvider } from './components/ui/Toast';
import NavigationProgress from './components/ui/NavigationProgress';
import { markHydrated } from './utils/hydration';
import { normalizeStoreSettings } from './utils/normalizeStoreSettings';
import {
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_SHADE,
  THEME_SHADES,
  getThemeColors,
} from './constants/siteThemes';
import { getFont } from './constants/siteFonts';
import { buildMeta } from './seo/meta';
import { DEFAULT_LANG, langFromPath } from './i18n/routing';
import { apiGetSafe } from './server/api.server';
import { isSpaBuild, resolveSiteUrl } from './server/site.server';

export async function loader({ request }) {
  // The Capacitor build is prerendered once at build time — no API there.
  if (isSpaBuild()) {
    return { siteUrl: '', settings: null, categoryTree: null };
  }
  const [settingsBody, treeBody] = await Promise.all([
    apiGetSafe('/store-settings', { cached: true, ttlMs: 60_000 }),
    apiGetSafe('/categories/tree', { cached: true, ttlMs: 60_000 }),
  ]);
  return {
    siteUrl: resolveSiteUrl(request),
    settings: normalizeStoreSettings(settingsBody?.data) ?? null,
    categoryTree: Array.isArray(treeBody?.data) ? treeBody.data : null,
  };
}

// Settings/categories refresh themselves in the browser; no need to re-run on navigation.
export const shouldRevalidate = () => false;

export const links = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: stylesheet },
];

export const meta = ({ matches, location }) => buildMeta({ matches, location });

/** Primary palette + font as CSS variables so the first paint already uses the store theme. */
function themeCss(settings) {
  const colors = getThemeColors(
    settings?.themeColor || DEFAULT_THEME_COLOR,
    settings?.themeShade ?? DEFAULT_THEME_SHADE,
  );
  const font = getFont(settings?.siteFont);
  const vars = THEME_SHADES
    .filter((level) => colors[level])
    .map((level) => `--color-primary-${level}:${colors[level]};`)
    .join('');
  return `:root{${vars}--font-sans:'${font.family}', system-ui, sans-serif;}`;
}

function fontHref(settings) {
  const font = getFont(settings?.siteFont);
  return `https://fonts.googleapis.com/css2?family=${font.googleParam}&display=swap`;
}

function analyticsId(settings) {
  const id = String(settings?.seo?.googleAnalyticsId || '').trim();
  return /^G-[A-Z0-9]+$/i.test(id) ? id : null;
}

export function Layout({ children }) {
  const data = useRouteLoaderData('root');
  const lang = langFromPath(useRouterLocation().pathname) || DEFAULT_LANG;
  const settings = data?.settings;
  const gaId = analyticsId(settings);
  const themeColor = getThemeColors(
    settings?.themeColor || DEFAULT_THEME_COLOR,
    settings?.themeShade ?? DEFAULT_THEME_SHADE,
  )[600];

  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, interactive-widget=overlays-content"
        />
        {themeColor && <meta name="theme-color" content={themeColor} />}
        <Meta />
        <link rel="icon" href={settings?.faviconUrl || '/favicon.svg'} />
        {/* applySiteFont swaps this href when the admin picks another font */}
        <link id="site-font-link" rel="stylesheet" href={fontHref(settings)} />
        <style id="ssr-theme" dangerouslySetInnerHTML={{ __html: themeCss(settings) }} />
        <Links />
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
              }}
            />
          </>
        )}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RtlWrapper({ children }) {
  const { language, isRTL } = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [language, isRTL]);
  return children;
}

export default function App() {
  const data = useLoaderData();

  // Root effects run last in the hydration commit — from here on, components
  // may read browser storage during render.
  useEffect(() => {
    markHydrated();
  }, []);

  return (
    <LanguageProvider>
      <StoreSettingsProvider initialSettings={data?.settings}>
        <CategoriesProvider initialTree={data?.categoryTree}>
          <LocationProvider>
            <ToastProvider>
              <AuthProvider>
                <FavoritesProvider>
                  <CartProvider>
                    <RtlWrapper>
                      <NavigationProgress />
                      <Outlet />
                    </RtlWrapper>
                  </CartProvider>
                </FavoritesProvider>
              </AuthProvider>
            </ToastProvider>
          </LocationProvider>
        </CategoriesProvider>
      </StoreSettingsProvider>
    </LanguageProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const title = is404 ? 'الصفحة غير موجودة' : 'حدث خطأ غير متوقع';
  const detail = is404
    ? 'Page not found'
    : 'Something went wrong. Please try again.';

  if (!is404) console.error(error);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <title>{title}</title>
      <meta name="robots" content="noindex" />
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
      <p className="text-slate-500">{detail}</p>
      <a href="/" className="rounded-xl bg-primary-600 px-5 py-2.5 font-semibold text-white">
        العودة للرئيسية
      </a>
    </main>
  );
}
