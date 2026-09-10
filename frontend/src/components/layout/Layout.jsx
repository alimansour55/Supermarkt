import { Outlet, useLocation as useRouterLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import BottomTabBar from './BottomTabBar';
import CartDrawer from '../cart/CartDrawer';
import SupportChatWidget from '../support/SupportChatWidget';
import ScrollToTop from './ScrollToTop';
import LocationGateModal from '../location/LocationGateModal';
import { isLocationGateDismissedThisSession } from '../../utils/locationGate';
import { SupportChatProvider } from '../../context/SupportChatContext';
import { useLocation as useDeliveryLocation } from '../../context/LocationContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';

export default function Layout() {
  const routerLocation = useRouterLocation();
  const { settings, loading: settingsLoading } = useStoreSettings();
  const { confirmed, gateOpen } = useDeliveryLocation();

  const gateEnabled = Boolean(settings?.locationGate?.enabled);
  const showGate = gateOpen
    || (gateEnabled && !confirmed && !settingsLoading && !isLocationGateDismissedThisSession());

  return (
    <SupportChatProvider>
      <div className="flex min-h-screen flex-col">
        <ScrollToTop />
        <Header />
        <main
          data-scroll-root
          className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
        >
          <Outlet key={routerLocation.pathname} />
        </main>
        <Footer className="hidden md:block" />
        <BottomTabBar />
        <CartDrawer />
        <SupportChatWidget />
        <LocationGateModal open={showGate} />
      </div>
    </SupportChatProvider>
  );
}
