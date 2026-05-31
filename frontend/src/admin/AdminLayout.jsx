import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import AdminUIProvider from './components/AdminUIProvider';
import AdminSidebar from './components/AdminSidebar';
import AdminHeader from './components/AdminHeader';
import { getAdminPageMeta } from './adminRouteMeta';
import { AdminStatsProvider } from './context/AdminStatsContext';

function AdminShell() {
  const { language } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAr = language === 'ar';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { title, breadcrumbs } = getAdminPageMeta(location.pathname, isAr);

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
    <div className="flex min-h-screen bg-slate-100">
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
          menuOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminUIProvider>
      <AdminStatsProvider>
        <AdminShell />
      </AdminStatsProvider>
    </AdminUIProvider>
  );
}
