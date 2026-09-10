import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { walletService } from '../services/apiServices';
import Loader from '../components/ui/Loader';
import WalletPanel from '../components/account/WalletPanel';

export default function MyWalletPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(() => walletService.getMe(language)
    .then(({ data }) => { if (mounted.current) setWallet(data); })
    .catch(() => { if (mounted.current) setWallet(null); })
    .finally(() => { if (mounted.current) setLoading(false); }), [language]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-w-0">
      <h1 className="mb-6 text-2xl font-bold md:text-3xl">{isAr ? 'المحفظة' : 'My Wallet'}</h1>

      {loading ? (
        <div className="flex justify-center py-16"><Loader /></div>
      ) : (
        <div className="max-w-2xl">
          <WalletPanel isAr={isAr} wallet={wallet} onRefresh={load} showAllHistory />
        </div>
      )}
    </div>
  );
}
