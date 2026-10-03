import DriverRoute from '../../components/auth/DriverRoute';
import DriverLayout from '../../components/driver/DriverLayout';

/** Layout route for the driver app: requires a signed-in driver. */
export default function DriverShell() {
  return (
    <DriverRoute>
      <DriverLayout />
    </DriverRoute>
  );
}
