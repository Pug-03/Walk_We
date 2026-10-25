import { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { lazyPage, preloadPages } from './lazyPage.ts';
import Landing from './pages/Landing.tsx';
// The planner is the first screen for returning users ("/" redirects
// there), so it ships in the main bundle too; MapLibre stays a separate chunk.
import Plan from './pages/Plan.tsx';
import { SosButton } from './components/sos/SosButton.tsx';
import { ScrollManager } from './components/ScrollManager.tsx';
import { loadSession } from './nav/session.ts';
import { hasOnboarded, resetFirstRun } from './store/onboarding.ts';
import { hasDoneSetup } from './store/contacts.ts';
import { useFullscreenKey } from './utils/useFullscreenKey.ts';

// Landing ships in the main bundle so first visits paint fast; the rest are
// chunks (same split as DeePer). The map library is a further chunk inside
// Plan, so even the plan screen's shell paints before MapLibre arrives.

const Navigate_ = lazyPage(() => import('./pages/Navigate.tsx'));
const DataLimits = lazyPage(() => import('./pages/DataLimits.tsx'));
const Contacts = lazyPage(() => import('./pages/Contacts.tsx'));
const Privacy = lazyPage(() => import('./pages/Privacy.tsx'));
const SafetySetup = lazyPage(() => import('./pages/SafetySetup.tsx'));

/** Checked on every visit (not once at startup): setup comes before the planner. */
function PlanGate() {
  return hasOnboarded() && !hasDoneSetup() ? <Navigate to="/setup" replace /> : <Plan />;
}

/** "/" decides on every visit too: walk in progress → landing → setup → planner. */
function Home() {
  if (loadSession()) return <Navigate to="/navigate" replace />;
  if (!hasOnboarded()) return <Landing />;
  if (!hasDoneSetup()) return <Navigate to="/setup" replace />;
  return <Navigate to="/plan" replace />;
}

/** First-run link: shows the new-user flow again, keeping the user's data. */
function StartOver() {
  resetFirstRun();
  return <Navigate to="/welcome" replace />;
}

function PageSkeleton() {
  return <div className="map-skeleton" role="status" aria-label="…" />;
}

export default function App() {
  useEffect(preloadPages, []);
  useFullscreenKey();
  return (
    <>
      {/* SOS: top-right on the planner and navigation screens only (see SOS_SCREENS). */}
      <ScrollManager />
      <SosButton />
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {/* Returning users skip the landing page; a walk in progress (even
            after an offline reload) goes straight back to its step. */}
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<StartOver />} />
        <Route path="/setup" element={<SafetySetup />} />
        <Route path="/welcome" element={<Landing />} />
        {/* The swipe intro was dropped (user, 15 Oct 2026): Start goes straight to setup. */}
        <Route path="/onboarding" element={<Navigate to="/setup" replace />} />
        {/* Asked once before entering the app (own number + contacts for SOS). */}
        <Route path="/plan" element={<PlanGate />} />
        <Route path="/navigate" element={<Navigate_ />} />
        <Route path="/data" element={<DataLimits />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </>
  );
}
