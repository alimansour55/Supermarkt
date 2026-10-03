import { Outlet, useLocation as useRouterLocation } from '../../app/router';
import Header from './Header';
import Footer from './Footer';
import BottomTabBar from './BottomTabBar';
import ScrollToTop from './ScrollToTop';
import DeferredWidgets from './DeferredWidgets';
import { isLocationGateDismissedThisSession } from '../../utils/locationGate';
import { SupportChatProvider } from '../../context/SupportChatContext';
import { useLocation as useDeliveryLocation } from '../../context/LocationContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';

export default function Layout() {
  const routerLocation = useRouterLocation();
  const { settings, loading: settingsLoading } = useStoreSettings();
  const { confirmed, confirmedReady, gateOpen } = useDeliveryLocation();

  const gateEnabled = Boolean(settings?.locationGate?.enabled);
  // Never part of the server HTML: the popup only opens once the visitor's stored
  // location choice has been read in the browser.
  const showGate = gateOpen
    || (confirmedReady && gateEnabled && !confirmed && !settingsLoading
      && !isLocationGateDismissedThisSession());

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
        <DeferredWidgets showLocationGate={showGate} />
      </div>
    </SupportChatProvider>
  );
}
