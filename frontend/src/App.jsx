/**
 * App routing — customer storefront + admin panel.
 * RTL is applied via LanguageContext (Arabic default).
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LocationProvider } from './context/LocationContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { FavoritesProvider } from './context/FavoritesContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CategoriesPage from './pages/CategoriesPage';
import CategoryPage from './pages/CategoryPage';
import ProductListingPage from './pages/ProductListingPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentPage from './pages/PaymentPage';
import PaymentFailedPage from './pages/PaymentFailedPage';
import MyOrdersPage from './pages/MyOrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import ProfilePage from './pages/ProfilePage';
import StaticPage from './pages/StaticPage';
import TrackOrderPage from './pages/TrackOrderPage';
import SearchResultsPage from './pages/SearchResultsPage';
import SearchPage from './pages/SearchPage';
import FavoritesPage from './pages/FavoritesPage';
import OffersPage from './pages/OffersPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminRoute from './admin/AdminRoute';
import AdminPermissionRoute from './admin/AdminPermissionRoute';
import AdminLayout from './admin/AdminLayout';
import AdminLoginPage from './admin/pages/AdminLoginPage';
import DashboardPage from './admin/pages/DashboardPage';
import ProductsPage from './admin/pages/ProductsPage';
import ProductFormPage from './admin/pages/ProductFormPage';
import AdminCategoriesPage from './admin/pages/CategoriesPage';
import AdminOrdersPage from './admin/pages/OrdersPage';
import UsersPage from './admin/pages/UsersPage';
import CouponsPage from './admin/pages/CouponsPage';
import BannersPage from './admin/pages/BannersPage';
import ReportsPage from './admin/pages/ReportsPage';
import AuditLogPage from './admin/pages/AuditLogPage';
import { useEffect } from 'react';

function RtlWrapper({ children }) {
  const { language, isRTL } = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [language, isRTL]);
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={(
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        )}
      >
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:id/edit" element={<ProductFormPage />} />
        <Route path="categories" element={<AdminPermissionRoute permission="categories:write"><AdminCategoriesPage /></AdminPermissionRoute>} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="reports" element={<AdminPermissionRoute permission="reports:read"><ReportsPage /></AdminPermissionRoute>} />
        <Route path="users" element={<AdminPermissionRoute permission="users:read"><UsersPage /></AdminPermissionRoute>} />
        <Route path="coupons" element={<AdminPermissionRoute permission="coupons:write"><CouponsPage /></AdminPermissionRoute>} />
        <Route path="banners" element={<AdminPermissionRoute permission="banners:write"><BannersPage /></AdminPermissionRoute>} />
        <Route path="audit-log" element={<AdminPermissionRoute permission="audit:read"><AuditLogPage /></AdminPermissionRoute>} />
      </Route>

      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<LoginPage />} />
        <Route path="verify-email/:token" element={<LoginPage />} />
        <Route path="forgot-password" element={<LoginPage />} />
        <Route path="reset-password/:token" element={<LoginPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="categories/:slug" element={<CategoryPage />} />
        <Route path="products" element={<ProductListingPage />} />
        <Route path="products/:slug" element={<ProductDetailsPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="payment" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
        <Route path="payment/success" element={<PaymentSuccessPage />} />
        <Route path="payment/failed" element={<PaymentFailedPage />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="search/results" element={<SearchResultsPage />} />
        {/* Legacy: product search URLs still work on /products?q= */}
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
        <Route path="orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
        <Route path="contact" element={<StaticPage />} />
        <Route path="faq" element={<StaticPage />} />
        <Route path="about" element={<StaticPage />} />
        <Route path="privacy" element={<StaticPage />} />
        <Route path="terms" element={<StaticPage />} />
        <Route path="returns" element={<StaticPage />} />
        <Route path="careers" element={<StaticPage />} />
        <Route path="track-order" element={<TrackOrderPage />} />
        <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="account" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <LocationProvider>
        <AuthProvider>
          <FavoritesProvider>
            <CartProvider>
            <BrowserRouter>
              <RtlWrapper>
                <AppRoutes />
              </RtlWrapper>
            </BrowserRouter>
            </CartProvider>
          </FavoritesProvider>
        </AuthProvider>
      </LocationProvider>
    </LanguageProvider>
  );
}
