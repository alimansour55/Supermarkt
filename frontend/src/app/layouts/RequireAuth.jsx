import { Outlet } from '../router';
import ProtectedRoute from '../../components/auth/ProtectedRoute';

/** Layout route: children render only for signed-in customers. */
export default function RequireAuth() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}
