/**
 * App routing — customer storefront + admin panel.
 * RTL is applied via LanguageContext (Arabic default).
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LocationProvider } from './context/LocationContext';
import { StoreSettingsProvider } from './context/StoreSettingsContext';
import { CategoriesProvider } from './context/CategoriesContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DriverRoute from './components/auth/DriverRoute';
import DriverLayout from './components/driver/DriverLayout';
import { FavoritesProvider } from './context/FavoritesContext';
import { ToastProvider } from './components/ui/Toast';
import { withSuspense } from './app/routeSuspense';
import HomePage from './pages/HomePage';
import * as P from './app/lazyRoutes';

const AdminRoutes = lazy(() => import('./app/AdminRoutes'));

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
      <Route path="/admin/*" element={withSuspense(<AdminRoutes />)} />

      <Route path="/driver/login" element={withSuspense(<P.DriverLoginPage />)} />

      <Route
        path="/driver"
        element={withSuspense(
          <DriverRoute>
            <DriverLayout />
          </DriverRoute>,
        )}
      >
        <Route index element={withSuspense(<P.DriverDeliveriesPage />)} />
        <Route path="deliveries/:id" element={withSuspense(<P.DriverDeliveryPage />)} />
      </Route>

      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={withSuspense(<P.LoginPage />)} />
        <Route path="register" element={withSuspense(<P.RegisterPage />)} />
        <Route path="verify-email" element={withSuspense(<P.LoginPage />)} />
        <Route path="verify-email/:token" element={withSuspense(<P.LoginPage />)} />
        <Route path="forgot-password" element={withSuspense(<P.LoginPage />)} />
        <Route path="reset-password/:token" element={withSuspense(<P.LoginPage />)} />
        <Route path="categories" element={withSuspense(<P.CategoriesPage />)} />
        <Route path="subcategories" element={withSuspense(<P.SubcategoriesPage />)} />
        <Route path="brands" element={withSuspense(<P.BrandsPage />)} />
        <Route path="category/*" element={withSuspense(<P.CategoryBrowsePage />)} />
        <Route path="categories/:slug" element={withSuspense(<P.CategoryPage />)} />
        <Route path="products" element={withSuspense(<P.ProductListingPage />)} />
        <Route path="products/:slug" element={withSuspense(<P.ProductDetailsPage />)} />
        <Route path="cart" element={withSuspense(<P.CartPage />)} />
        <Route path="checkout" element={withSuspense(<ProtectedRoute><P.CheckoutPage /></ProtectedRoute>)} />
        <Route path="payment" element={withSuspense(<ProtectedRoute><P.PaymentPage /></ProtectedRoute>)} />
        <Route path="payment/success" element={withSuspense(<P.PaymentSuccessPage />)} />
        <Route path="payment/failed" element={withSuspense(<P.PaymentFailedPage />)} />
        <Route path="offers" element={withSuspense(<P.OffersPage />)} />
        <Route path="today-deals" element={withSuspense(<P.TodaysDealsPage />)} />
        <Route path="search" element={withSuspense(<P.SearchPage />)} />
        <Route path="search/results" element={withSuspense(<P.SearchResultsPage />)} />
        <Route path="favorites" element={withSuspense(<P.FavoritesPage />)} />
        <Route path="orders" element={withSuspense(<ProtectedRoute><P.MyOrdersPage /></ProtectedRoute>)} />
        <Route path="orders/:id" element={withSuspense(<ProtectedRoute><P.OrderDetailPage /></ProtectedRoute>)} />
        <Route path="contact" element={withSuspense(<P.StaticPage />)} />
        <Route path="faq" element={withSuspense(<P.StaticPage />)} />
        <Route path="about" element={withSuspense(<P.StaticPage />)} />
        <Route path="privacy" element={withSuspense(<P.StaticPage />)} />
        <Route path="terms" element={withSuspense(<P.StaticPage />)} />
        <Route path="returns" element={withSuspense(<P.StaticPage />)} />
        <Route path="careers" element={withSuspense(<P.StaticPage />)} />
        <Route path="track-order" element={withSuspense(<P.TrackOrderPage />)} />
        <Route path="profile" element={withSuspense(<ProtectedRoute><P.ProfilePage /></ProtectedRoute>)} />
        <Route path="account" element={withSuspense(<ProtectedRoute><P.ProfilePage /></ProtectedRoute>)} />
        <Route path="recurring-deliveries" element={withSuspense(<ProtectedRoute><P.CustomerRecurringDeliveriesPage /></ProtectedRoute>)} />
        <Route path="my-points" element={withSuspense(<ProtectedRoute><P.MyPointsPage /></ProtectedRoute>)} />
        <Route path="my-addresses" element={withSuspense(<ProtectedRoute><P.MyAddressesPage /></ProtectedRoute>)} />
        <Route path="account/settings" element={withSuspense(<ProtectedRoute><P.AccountSettingsPage /></ProtectedRoute>)} />
        <Route path="*" element={withSuspense(<P.NotFoundPage />)} />
      </Route>
    </Routes>
  );
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
              <BrowserRouter>
                <RtlWrapper>
                  <AppRoutes />
                </RtlWrapper>
              </BrowserRouter>
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
