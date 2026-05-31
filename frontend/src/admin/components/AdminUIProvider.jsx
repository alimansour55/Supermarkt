import { ConfirmProvider } from './ConfirmDialog';
import { ToastProvider } from './Toast';

export default function AdminUIProvider({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
