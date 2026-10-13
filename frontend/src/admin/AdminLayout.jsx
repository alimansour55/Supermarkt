import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from '../app/router';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import AdminUIProvider from './components/AdminUIProvider';
import AdminSidebar from './components/AdminSidebar';
import AdminHeader from './components/AdminHeader';
import { getAdminPageMeta } from './adminRouteMeta.js';
import { AdminStatsProvider } from './context/AdminStatsContext';
import { AdminPanelProvider } from './context/AdminPanelContext';
import ScrollToTop from '../components/layout/ScrollToTop';
import useAdminNav from './hooks/useAdminNav';

function AdminShell() {
  const { language } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAr = language === 'ar';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { current } = useAdminNav();
  const { title, breadcrumbs } = getAdminPageMeta(location.pathname, isAr, current);
  const cleanPath = location.pathname.replace(/\/$/, '');
  // Tabs only on the tab screens themselves, not on pages opened from them (e.g. product edit).
  const tabs = current?.tab && current.tab.path === cleanPath ? current.item.tabs : null;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <ScrollToTop />
      <AdminSidebar
        isAr={isAr}
        user={user}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={() => setSidebarOpen(false)}
        onStore={() => navigate('/')}
        onLogout={handleLogout}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ps-64">
        <AdminHeader
          title={title}
          breadcrumbs={breadcrumbs}
          tabs={tabs}
          activeTabPath={current?.tab?.path}
          menuOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main data-scroll-root className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminUIProvider>
      <AdminPanelProvider>
        <AdminStatsProvider>
          <AdminShell />
        </AdminStatsProvider>
      </AdminPanelProvider>
    </AdminUIProvider>
  );
}
