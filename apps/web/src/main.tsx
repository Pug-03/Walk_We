import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/ibm-plex-sans-thai/700.css';
import './styles/tokens.css';
import './styles/app.css';
import App from './App.tsx';
import { ToastProvider } from './components/ui.tsx';
import { env } from './env.ts';
import { LangProvider } from './store/i18n.tsx';
import { PlacesProvider } from './store/places.tsx';
import { ThemeProvider } from './store/theme.tsx';
import { captureInstallPrompt } from './pwa/install.ts';
import { loadSession } from './nav/session.ts';
import { loadPhotoManifest } from './nav/guides.ts';
import { installErrorReporter } from './utils/errorReporter.ts';

installErrorReporter(env.errorTrackingUrl);
// Screenshot mode for phone mockups: Chrome's device emulation has no notch or
// home bar, so a capture dropped into an iPhone frame sits under the Dynamic
// Island. ?mockup=iphone reserves iPhone 15 safe areas (59 px top, 34 px
// bottom) for this tab; ?mockup=off clears it. Real phones use env(safe-area-*).
{
  const m = new URLSearchParams(location.search).get('mockup');
  try {
    if (m === 'iphone') sessionStorage.setItem('ww_mockup', 'iphone');
    if (m === 'off') sessionStorage.removeItem('ww_mockup');
    if (sessionStorage.getItem('ww_mockup') === 'iphone') document.documentElement.classList.add('mockup-iphone');
  } catch {
    /* storage blocked: no mockup mode */
  }
}
captureInstallPrompt();
// A walk in progress reopens on its step: start fetching that screen and the
// photo manifest now, in parallel, instead of one after the other.
if (loadSession()) {
  void import('./pages/Navigate.tsx');
  void loadPhotoManifest();
}
// Offline support: the service worker exists only in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LangProvider>
        <ThemeProvider>
          <PlacesProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </PlacesProvider>
        </ThemeProvider>
      </LangProvider>
    </BrowserRouter>
  </StrictMode>,
);
