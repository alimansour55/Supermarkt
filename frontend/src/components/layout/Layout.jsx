import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import BottomTabBar from './BottomTabBar';
import CartDrawer from '../cart/CartDrawer';

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <Outlet />
      </main>
      <Footer className="hidden md:block" />
      <BottomTabBar />
      <CartDrawer />
    </div>
  );
}
