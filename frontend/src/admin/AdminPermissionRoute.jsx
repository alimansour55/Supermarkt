import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from './adminPermissions';

export default function AdminPermissionRoute({ permission, children }) {
  const { user } = useAuth();

  if (!hasPermission(user?.role, permission)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
