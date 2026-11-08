import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Permission } from '../types';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return (
      <div className="empty-state">
        <h2>Access restricted</h2>
        <p>Your role does not include access to this page. Contact the system administrator if you need it.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function HomeRedirect() {
  const { can } = useAuth();
  return <Navigate to={can('dashboard.view') ? '/dashboard' : '/production'} replace />;
}
