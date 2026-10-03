import { Navigate, useLocation } from '../../app/router';
import { useAuth } from '../../context/AuthContext';
import Loader from '../ui/Loader';

export default function DriverRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/driver/login" state={{ from: location.pathname }} replace />;
  }

  if (user?.role !== 'driver') {
    return <Navigate to="/" replace />;
  }

  return children;
}
