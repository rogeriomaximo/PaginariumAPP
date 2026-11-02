import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export function usePWAInstall() {
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const handler = (e: any) => {
      e.preventDefault();
      setPromptEvent(e);
      setIsInstallable(true);
    };

    (window as any).addEventListener('beforeinstallprompt', handler);
    return () => (window as any).removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setIsInstallable(false);
  };

  return { isInstallable, install };
}