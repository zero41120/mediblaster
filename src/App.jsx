import { useEffect, useState } from 'react';
import Landing from './pages/Landing';
import MediblasterPage from './pages/Mediblaster';
import SoldierPulseRifle from './pages/SoldierPulseRifle';

const ROUTES = {
  '/': Landing,
  '/juno-mediblaster': MediblasterPage,
  '/soldier-76-pulse-rifle': SoldierPulseRifle,
};

const getRouteFromHash = () => {
  if (typeof window === 'undefined') return '/';
  const raw = window.location.hash.replace('#', '').trim();
  if (!raw) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
};

export default function App() {
  const [route, setRoute] = useState(getRouteFromHash());

  useEffect(() => {
    const handleHashChange = () => setRoute(getRouteFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const RouteComponent = ROUTES[route] || NotFound;

  return <RouteComponent />;
}

function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Route not found</h1>
        <p className="text-slate-400 text-sm">The model you requested does not exist. Head back to the landing page.</p>
        <a
          href="#/"
          className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
        >
          Back to landing
        </a>
      </div>
    </div>
  );
}
