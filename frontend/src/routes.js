/**
 * Route config — customer storefront, driver app and admin panel.
 * Each file is a route module (default export = page component) and is code-split automatically.
 */
import { index, layout, route } from '@react-router/dev/routes';

export default [
  // Admin panel keeps its own nested <Routes> (src/app/AdminRoutes.jsx).
  route('admin/*', 'app/AdminRoutes.jsx'),

  route('driver/login', 'pages/driver/DriverLoginPage.jsx'),
  route('driver', 'app/layouts/DriverShell.jsx', [
    index('pages/driver/DriverDeliveriesPage.jsx'),
    route('account', 'pages/driver/DriverAccountPage.jsx'),
    route('deliveries/:id', 'pages/driver/DriverDeliveryPage.jsx'),
  ]),

  layout('components/layout/Layout.jsx', [
    index('pages/HomePage.jsx'),
    route('login', 'pages/LoginPage.jsx'),
    route('register', 'pages/RegisterPage.jsx'),
    route('verify-email', 'pages/LoginPage.jsx', { id: 'verify-email' }),
    route('verify-email/:token', 'pages/LoginPage.jsx', { id: 'verify-email-token' }),
    route('forgot-password', 'pages/LoginPage.jsx', { id: 'forgot-password' }),
    route('reset-password/:token', 'pages/LoginPage.jsx', { id: 'reset-password' }),
    route('categories', 'pages/CategoriesPage.jsx'),
    route('subcategories', 'pages/SubcategoriesPage.jsx'),
    route('brands', 'pages/BrandsPage.jsx'),
    route('category/*', 'pages/CategoryBrowsePage.jsx'),
    route('categories/:slug', 'pages/CategoryPage.jsx'),
    route('products', 'pages/ProductListingPage.jsx'),
    route('products/:slug', 'pages/ProductDetailsPage.jsx'),
    route('cart', 'pages/CartPage.jsx'),
    route('payment/success', 'pages/PaymentSuccessPage.jsx'),
    route('payment/failed', 'pages/PaymentFailedPage.jsx'),
    route('offers', 'pages/OffersPage.jsx'),
    route('today-deals', 'pages/TodaysDealsPage.jsx'),
    route('search', 'pages/SearchPage.jsx'),
    route('search/results', 'pages/SearchResultsPage.jsx'),
    route('contact', 'pages/StaticPage.jsx', { id: 'page-contact' }),
    route('faq', 'pages/StaticPage.jsx', { id: 'page-faq' }),
    route('about', 'pages/StaticPage.jsx', { id: 'page-about' }),
    route('privacy', 'pages/StaticPage.jsx', { id: 'page-privacy' }),
    route('terms', 'pages/StaticPage.jsx', { id: 'page-terms' }),
    route('returns', 'pages/StaticPage.jsx', { id: 'page-returns' }),
    route('careers', 'pages/StaticPage.jsx', { id: 'page-careers' }),
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

    route('*', 'pages/NotFoundPage.jsx'),
  ]),
];
