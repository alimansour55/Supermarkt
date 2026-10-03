import { Routes, Route, Navigate } from './router';
import { withSuspense } from './routeSuspense';
import * as P from './lazyAdminRoutes';

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="login" element={withSuspense(<P.AdminLoginPage />)} />
      <Route
        element={withSuspense(
          <P.AdminRoute>
            <P.AdminLayout />
          </P.AdminRoute>,
        )}
      >
        <Route index element={withSuspense(<P.DashboardPage />)} />
        <Route path="products" element={withSuspense(<P.ProductsPage />)} />
        <Route path="stock-alerts" element={withSuspense(<P.StockAlertsPage />)} />
        <Route path="products/new" element={withSuspense(<P.ProductFormPage />)} />
        <Route path="products/:id/edit" element={withSuspense(<P.ProductFormPage />)} />
        <Route path="categories" element={withSuspense(<P.AdminPermissionRoute permission="categories:write"><P.AdminCategoriesPage /></P.AdminPermissionRoute>)} />
        <Route path="brands" element={withSuspense(<P.AdminPermissionRoute permission="brands:write"><P.AdminBrandsPage /></P.AdminPermissionRoute>)} />
        <Route path="orders" element={withSuspense(<P.AdminOrdersPage />)} />
        <Route path="invoices" element={withSuspense(<P.AdminPermissionRoute permission="orders:read"><P.InvoicesPage /></P.AdminPermissionRoute>)} />
        <Route path="live-deliveries" element={withSuspense(<P.AdminPermissionRoute permission="orders:read"><P.LiveDeliveriesPage /></P.AdminPermissionRoute>)} />
        <Route path="recurring-deliveries" element={withSuspense(<P.AdminPermissionRoute permission="orders:read"><P.AdminRecurringDeliveriesPage /></P.AdminPermissionRoute>)} />
        <Route path="order-chats" element={withSuspense(<P.OrderChatsPage />)} />
        <Route path="returns" element={withSuspense(<P.OrderReturnsPage />)} />
        <Route path="callback-requests" element={withSuspense(<P.AdminPermissionRoute permission="orders:read"><P.CallbackRequestsPage /></P.AdminPermissionRoute>)} />
        <Route path="live-chat" element={withSuspense(<P.AdminPermissionRoute permission="support:chat"><P.LiveChatPage /></P.AdminPermissionRoute>)} />
        <Route path="order-trash" element={withSuspense(<P.AdminPermissionRoute permission="orders:delete"><P.OrderTrashPage /></P.AdminPermissionRoute>)} />
        <Route path="revenue" element={withSuspense(<P.AdminPermissionRoute permission="reports:read"><P.RevenuePage /></P.AdminPermissionRoute>)} />
        <Route path="reports" element={withSuspense(<P.AdminPermissionRoute permission="reports:read"><P.ReportsPage /></P.AdminPermissionRoute>)} />
        <Route path="partner-revenue" element={withSuspense(<P.AdminPermissionRoute permission="reports:read"><P.PartnerRevenuePage /></P.AdminPermissionRoute>)} />
        <Route path="search-analytics" element={withSuspense(<P.AdminPermissionRoute permission="reports:read"><P.SearchAnalyticsPage /></P.AdminPermissionRoute>)} />
        <Route path="trending-searches" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.TrendingSearchesPage /></P.AdminPermissionRoute>)} />
        <Route path="filter-settings" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.FilterSettingsPage /></P.AdminPermissionRoute>)} />
        <Route path="users" element={withSuspense(<P.AdminPermissionRoute permission="users:read"><P.UsersPage /></P.AdminPermissionRoute>)} />
        <Route path="team" element={withSuspense(<P.AdminPermissionRoute permission="users:write"><P.TeamPage /></P.AdminPermissionRoute>)} />
        <Route path="coupons" element={withSuspense(<P.AdminPermissionRoute permission="coupons:write"><P.CouponsPage /></P.AdminPermissionRoute>)} />
        <Route path="promotions" element={withSuspense(<P.AdminPermissionRoute permission="promotions:write"><P.PromotionsPage /></P.AdminPermissionRoute>)} />
        <Route path="banners" element={withSuspense(<P.AdminPermissionRoute permission="banners:write"><P.BannersPage /></P.AdminPermissionRoute>)} />
        <Route path="homepage" element={withSuspense(<P.AdminPermissionRoute permission="homepage:write"><P.HomepageBuilderPage /></P.AdminPermissionRoute>)} />
        <Route path="navigation" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.NavigationPage /></P.AdminPermissionRoute>)} />
        <Route path="content" element={withSuspense(<P.AdminPermissionRoute permission="content:write"><P.ContentPagesPage /></P.AdminPermissionRoute>)} />
        <Route path="seo" element={<Navigate to="/admin/settings/identity" replace />} />
        <Route path="appearance" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.AppearancePage /></P.AdminPermissionRoute>)} />
        <Route path="coverage-area" element={withSuspense(<P.AdminPermissionRoute permission="delivery:write"><P.CoverageAreaPage /></P.AdminPermissionRoute>)} />
        <Route path="delivery" element={withSuspense(<P.AdminPermissionRoute permission="delivery:write"><P.DeliveryZonesPage /></P.AdminPermissionRoute>)} />
        <Route path="fulfillment-locations" element={withSuspense(<P.AdminPermissionRoute permission="delivery:write"><P.FulfillmentLocationsPage /></P.AdminPermissionRoute>)} />
        <Route path="reviews" element={withSuspense(<P.AdminPermissionRoute permission="reviews:moderate"><P.ReviewsPage /></P.AdminPermissionRoute>)} />
        <Route path="loyalty" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.LoyaltyPage /></P.AdminPermissionRoute>)} />
        <Route path="wallet" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.WalletPage /></P.AdminPermissionRoute>)} />
        <Route path="payments" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.PaymentMethodsPage /></P.AdminPermissionRoute>)} />
        <Route path="customer-service" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.CustomerServiceSettingsPage /></P.AdminPermissionRoute>)} />
        <Route path="notifications" element={withSuspense(<P.AdminPermissionRoute permission="notifications:write"><P.NotificationTemplatesPage /></P.AdminPermissionRoute>)} />
        <Route path="push" element={withSuspense(<P.AdminPermissionRoute permission="notifications:write"><P.PushNotificationsPage /></P.AdminPermissionRoute>)} />
        <Route path="settings">
          <Route index element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.StoreSettingsPage /></P.AdminPermissionRoute>)} />
          <Route path="identity" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.StoreIdentitySettingsPage /></P.AdminPermissionRoute>)} />
          <Route path="contact" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.StoreContactSettingsPage /></P.AdminPermissionRoute>)} />
          <Route path="delivery" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.StoreDeliverySettingsPage /></P.AdminPermissionRoute>)} />
          <Route path="experience" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.StoreExperienceSettingsPage /></P.AdminPermissionRoute>)} />
          <Route path="invoice" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.StoreInvoiceSettingsPage /></P.AdminPermissionRoute>)} />
          <Route path="admin" element={withSuspense(<P.AdminPermissionRoute permission="settings:write"><P.StoreAdminSettingsPage /></P.AdminPermissionRoute>)} />
        </Route>
        <Route path="audit-log" element={withSuspense(<P.AdminPermissionRoute permission="audit:read"><P.AuditLogPage /></P.AdminPermissionRoute>)} />
      </Route>
    </Routes>
  );
}
