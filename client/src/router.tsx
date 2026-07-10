import { createRootRoute, createRoute, createRouter, useNavigate, useRouterState } from '@tanstack/react-router';
import App, { useTravelData } from './App';
import InterrailMap from './components/InterrailMap';
import TravelStats from './components/TravelStats';
import Feed from './components/Feed';
import SessionsPanel from './components/SessionsPanel';
import { useAuth } from './contexts/AuthContext';
import { useEffect } from 'react';

export function useEditMode(): boolean {
  const { location } = useRouterState();
  return location.pathname === '/redigera';
}

const rootRoute = createRootRoute({ component: App });

function MainContent() {
  const { positions, posts, fetchPositions } = useTravelData();
  return (
    <>
      <InterrailMap positions={positions} posts={posts} onPositionDeleted={fetchPositions} />
      <TravelStats positions={positions} />
      <Feed posts={posts} onPostDeleted={fetchPositions} />
    </>
  );
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MainContent,
});

const redigeraRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/redigera',
  component: () => {
    const { isAdminMode } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
      if (!isAdminMode) navigate({ to: '/', replace: true });
    }, [isAdminMode, navigate]);

    if (!isAdminMode) return null;
    return <MainContent />;
  },
});

const sessionerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessioner',
  component: () => {
    const { isAdminMode } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
      if (!isAdminMode) navigate({ to: '/', replace: true });
    }, [isAdminMode, navigate]);

    if (!isAdminMode) return null;
    return <SessionsPanel />;
  },
});

const routeTree = rootRoute.addChildren([indexRoute, redigeraRoute, sessionerRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
