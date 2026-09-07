import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import BottomTabBar from './BottomTabBar';
import CartDrawer from '../cart/CartDrawer';
import SupportChatWidget from '../support/SupportChatWidget';
import ScrollToTop from './ScrollToTop';
import { SupportChatProvider } from '../../context/SupportChatContext';

export default function Layout() {
  const location = useLocation();

  return (
    <SupportChatProvider>
      <div className="flex min-h-screen flex-col">
        <ScrollToTop />
        <Header />
        <main
          data-scroll-root
          className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
        >
          <Outlet key={location.pathname} />
        </main>
        <Footer className="hidden md:block" />
        <BottomTabBar />
        <CartDrawer />
        <SupportChatWidget />
      </div>
    </SupportChatProvider>
  );
}
