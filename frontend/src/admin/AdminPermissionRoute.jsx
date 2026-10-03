import { Navigate } from '../app/router';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/ui/Loader';
import { hasPermission } from './adminPermissions';

export default function AdminPermissionRoute({ permission, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader size="md" />
      </div>
    );
  }

  if (!hasPermission(user, permission)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
