import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/ui/Loader';
import { isStaffRole } from './adminPermissions';

export default function AdminRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/admin/login"
        state={{ from: location.pathname, reason: 'session' }}
        replace
      />
    );
  }

  if (!isStaffRole(user?.role)) {
    return (
      <Navigate
        to="/admin/login"
        state={{
          from: location.pathname,
          reason: isAuthenticated ? 'staff_required' : 'session',
        }}
        replace
      />
    );
  }

  return children;
}
