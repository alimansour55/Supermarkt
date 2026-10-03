import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router';

/**
 * Thin top progress bar shown while the next page's code/data loads.
 * Delayed slightly so instant navigations don't flash it.
 */
export default function NavigationProgress() {
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, [busy]);

  return (
    <div
      role="progressbar"
      aria-hidden={!visible}
      aria-label="Loading"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="h-full w-1/3 animate-[nav-progress_1.1s_ease-in-out_infinite] bg-primary-500" />
    </div>
  );
}
