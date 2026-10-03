/**
 * Root route — HTML document shell + app-wide providers.
 * RTL is applied via LanguageContext (Arabic default).
 */
import { useEffect } from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  isRouteErrorResponse,
  useRouteError,
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
import Loader from './components/ui/Loader';

const DEFAULT_FONT_HREF = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap';

export const links = () => [
  { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: stylesheet },
];

export const meta = () => [
  { title: 'سوق+' },
  { name: 'description', content: 'تسوق البقالة والمنتجات المنزلية أونلاين مع توصيل سريع' },
];

export function Layout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, interactive-widget=overlays-content"
        />
        <Meta />
        {/* applySiteFont swaps this href when the admin picks another font */}
        <link id="site-font-link" rel="stylesheet" href={DEFAULT_FONT_HREF} />
        <Links />
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
  return (
    <LanguageProvider>
      <StoreSettingsProvider>
        <CategoriesProvider>
          <LocationProvider>
            <ToastProvider>
              <AuthProvider>
                <FavoritesProvider>
                  <CartProvider>
                    <RtlWrapper>
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

/**
 * Phase 1 (framework mode, no SSR yet): the root renders on the client only,
 * exactly like the old Vite SPA. Removed once the providers are SSR-safe.
 */
export async function clientLoader() {
  return null;
}
clientLoader.hydrate = true;

export function HydrateFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader size="lg" />
    </div>
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
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
      <p className="text-slate-500">{detail}</p>
      <a href="/" className="rounded-xl bg-primary-600 px-5 py-2.5 font-semibold text-white">
        العودة للرئيسية
      </a>
    </main>
  );
}
