import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../data/users';
import { COMPANY } from '../data/management';
import { useThemePref } from '../lib/theme';
import {
  IconBank, IconBox, IconCart, IconDashboard, IconFactory, IconLogout, IconMenu, IconMoon, IconShield, IconShip, IconSun, IconUsers, IconWrench,
} from './Icons';

const TITLES: [RegExp, string][] = [
  [/^\/dashboard/, 'Executive Dashboard'],
  [/^\/production\/orders\/.+/, 'Production Order'],
  [/^\/production\/orders/, 'Production Orders'],
  [/^\/production\/shift-entry/, 'Shift Production Entry'],
  [/^\/production\/board/, 'Daily Production Board'],
  [/^\/production/, 'Production Process'],
  [/^\/engineering\/items/, 'Items & Bills of Material'],
  [/^\/engineering\/routings/, 'Routings'],
  [/^\/planning\/mrp/, 'MRP — Contract Explosion'],
];

/** Modules from the SRS that are planned for later phases. */
const UPCOMING = [
  { label: 'Procurement', Icon: IconCart, phase: 'P2' },
  { label: 'Inventory', Icon: IconBox, phase: 'P2' },
  { label: 'Quality', Icon: IconShield, phase: 'P3' },
  { label: 'Sales & Export', Icon: IconShip, phase: 'P2/P4' },
  { label: 'Finance', Icon: IconBank, phase: 'P2' },
  { label: 'HR & Payroll', Icon: IconUsers, phase: 'P4' },
  { label: 'Maintenance', Icon: IconShield, phase: 'P5' },
];

export default function Layout() {
  const { user, logout, can } = useAuth();
  const [theme, setTheme] = useThemePref();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'JAL ERP';
  const initials = (user?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('');
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark">J</div>
          <div>
            <div className="brand-name">{COMPANY.name}</div>
            <div className="brand-sub">Manufacturing ERP</div>
          </div>
        </div>
        <nav className="nav">
          {can('dashboard.view') && (
            <NavLink to="/dashboard"><IconDashboard /> Dashboard</NavLink>
          )}
          <div className="nav-section">Manufacturing</div>
          <NavLink to="/production" end><IconFactory /> Production process</NavLink>
          <NavLink to="/production/orders" className="nav-sub">Production orders</NavLink>
          {can('production.entry.create') && <NavLink to="/production/shift-entry" className="nav-sub">Shift entry</NavLink>}
          <NavLink to="/production/board" className="nav-sub">Daily board</NavLink>
          <div className="nav-section">Engineering &amp; planning</div>
          <NavLink to="/engineering/items"><IconBox /> Items &amp; BOM</NavLink>
          <NavLink to="/engineering/routings"><IconWrench /> Routings</NavLink>
          <NavLink to="/planning/mrp"><IconCart /> MRP explosion</NavLink>
          <div className="nav-section">Coming in later phases</div>
          {UPCOMING.map(({ label, Icon, phase }) => (
            <div key={label} className="nav-disabled" title={`Planned for ${phase}`}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon /> {label}</span>
              <span className="tag">{phase}</span>
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">{COMPANY.tagline} · v0.1 prototype</div>
      </aside>
      {open && <div className="overlay" style={{ zIndex: 30, background: 'rgba(0,0,0,.3)' }} onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><IconMenu width={20} /></button>
          <div className="crumb">{title}</div>
          <div className="spacer" />
          <span className="badge badge-primary">Factory 1 · BDT</span>
          <button className="btn btn-ghost" aria-label="Toggle colour theme" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
            {isDark ? <IconSun width={18} /> : <IconMoon width={18} />}
          </button>
          <div className="user-chip">
            <div className="avatar" aria-hidden>{initials}</div>
            <div className="user-meta">
              <div className="n">{user?.name}</div>
              <div className="r">{user && ROLE_LABEL[user.role]}</div>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={logout} aria-label="Sign out" title="Sign out"><IconLogout width={18} /></button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
