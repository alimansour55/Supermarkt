/**
 * Route config — customer storefront, driver app and admin panel.
 *
 * Public storefront pages use route modules in src/routes/ (server loader + meta for SEO).
 * Private/interactive areas sit under ClientOnlyRoute layouts and render in the browser only.
 * The Capacitor build (BUILD_TARGET=spa) can't have server loaders, so `seo()` points
 * those routes straight at the page component, which then loads its data client-side.
 */
import { index, layout, route } from '@react-router/dev/routes';

const isSpa = process.env.BUILD_TARGET === 'spa';
const seo = (routeModule, pageModule) => (isSpa ? pageModule : routeModule);
const clientOnly = (id, children) => layout(
  isSpa ? 'app/layouts/PassthroughRoute.jsx' : 'app/layouts/ClientOnlyRoute.jsx',
  { id },
  children,
);

const STATIC_PAGES = ['contact', 'faq', 'about', 'privacy', 'terms', 'returns', 'careers'];

export default [
  clientOnly('admin-client', [
    // Admin panel keeps its own nested <Routes> (src/app/AdminRoutes.jsx).
    route('admin/*', 'app/AdminRoutes.jsx'),
  ]),

  clientOnly('driver-client', [
    route('driver/login', 'pages/driver/DriverLoginPage.jsx'),
    route('driver', 'app/layouts/DriverShell.jsx', [
      index('pages/driver/DriverDeliveriesPage.jsx'),
      route('account', 'pages/driver/DriverAccountPage.jsx'),
      route('deliveries/:id', 'pages/driver/DriverDeliveryPage.jsx'),
    ]),
  ]),

  layout('components/layout/Layout.jsx', [
    // ── Public, server-rendered ──────────────────────────────────────────
    index(seo('routes/home.jsx', 'pages/HomePage.jsx')),
    route('products/:slug', seo('routes/product.jsx', 'pages/ProductDetailsPage.jsx')),
    route('category/*', seo('routes/category-browse.jsx', 'pages/CategoryBrowsePage.jsx')),
    route('categories/:slug', seo('routes/category-legacy.jsx', 'pages/CategoryPage.jsx')),
    route('categories', seo('routes/categories.jsx', 'pages/CategoriesPage.jsx')),
    route('subcategories', seo('routes/subcategories.jsx', 'pages/SubcategoriesPage.jsx')),
    route('brands', seo('routes/brands.jsx', 'pages/BrandsPage.jsx')),
    route('products', seo('routes/products.jsx', 'pages/ProductListingPage.jsx')),
    route('offers', seo('routes/offers.jsx', 'pages/OffersPage.jsx')),
    route('today-deals', seo('routes/today-deals.jsx', 'pages/TodaysDealsPage.jsx')),
    ...STATIC_PAGES.map((slug) => route(
      slug,
      seo('routes/static-page.jsx', 'pages/StaticPage.jsx'),
      { id: `page-${slug}` },
    )),

    // ── Private / interactive, browser-only, noindex ─────────────────────
    clientOnly('storefront-client', [
      route('login', 'pages/LoginPage.jsx'),
      route('register', 'pages/RegisterPage.jsx'),
      route('verify-email', 'pages/LoginPage.jsx', { id: 'verify-email' }),
      route('verify-email/:token', 'pages/LoginPage.jsx', { id: 'verify-email-token' }),
      route('forgot-password', 'pages/LoginPage.jsx', { id: 'forgot-password' }),
      route('reset-password/:token', 'pages/LoginPage.jsx', { id: 'reset-password' }),
      route('cart', 'pages/CartPage.jsx'),
      route('payment/success', 'pages/PaymentSuccessPage.jsx'),
      route('payment/failed', 'pages/PaymentFailedPage.jsx'),
      route('search', 'pages/SearchPage.jsx'),
      route('search/results', 'pages/SearchResultsPage.jsx'),
      route('track-order', 'pages/TrackOrderPage.jsx'),

      layout('app/layouts/RequireAuth.jsx', [
        route('checkout', 'pages/CheckoutPage.jsx'),
        route('payment', 'pages/PaymentPage.jsx'),
        route('orders/:id', 'pages/OrderDetailPage.jsx'),
      ]),

      // Account area — one persistent sidebar, pages swap in the <Outlet />
      layout('app/layouts/AccountShell.jsx', [
        route('favorites', 'pages/FavoritesPage.jsx'),
        layout('app/layouts/RequireAuth.jsx', { id: 'account-require-auth' }, [
          route('orders', 'pages/MyOrdersPage.jsx'),
          route('profile', 'pages/ProfilePage.jsx'),
          route('account', 'pages/ProfilePage.jsx', { id: 'account' }),
          route('recurring-deliveries', 'pages/RecurringDeliveriesPage.jsx'),
          route('my-points', 'pages/MyPointsPage.jsx'),
          route('my-wallet', 'pages/MyWalletPage.jsx'),
          route('my-addresses', 'pages/MyAddressesPage.jsx'),
          route('account/settings', 'pages/AccountSettingsPage.jsx'),
        ]),
      ]),
    ]),

    route('*', seo('routes/not-found.jsx', 'pages/NotFoundPage.jsx')),
  ]),
];
