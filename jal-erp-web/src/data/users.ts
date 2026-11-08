import type { Permission, Role, User } from '../types';

/**
 * DEMO ACCOUNTS — front-end prototype only.
 * In the real system authentication is server-side (Argon2 hashes, TOTP MFA) per SRS NFR-SEC-001.
 * These credentials exist only to exercise the UI.
 */
export interface DemoUser extends User {
  password: string;
  /** Fixed one-time code used for the demo MFA step. */
  otp?: string;
}

export const DEMO_USERS: DemoUser[] = [
  { id: 'u-board', username: 'board', password: 'Board@2026', name: 'Board Member (Samuda)', designation: 'Board / Oversight', role: 'BOARD', mfa: true, otp: '246810' },
  { id: 'u-ceo', username: 'ceo', password: 'Ceo@2026', name: 'Chief Executive', designation: 'CEO', role: 'CEO', mfa: true, otp: '246810' },
  { id: 'u-fh', username: 'factory.head', password: 'Factory@2026', name: 'Factory Head', designation: 'Head of Factory', role: 'FACTORY_HEAD', mfa: false },
  { id: 'u-pm', username: 'prod.manager', password: 'Prod@2026', name: 'Production Manager', designation: 'Manager — Production', role: 'PRODUCTION_MANAGER', mfa: false },
  { id: 'u-sup', username: 'supervisor', password: 'Super@2026', name: 'Line Supervisor', designation: 'Line In-charge — Loom Shed', role: 'LINE_SUPERVISOR', mfa: false },
];

export const ROLE_LABEL: Record<Role, string> = {
  BOARD: 'Board / Samuda Viewer',
  CEO: 'CEO / MD',
  FACTORY_HEAD: 'Factory Head',
  PRODUCTION_MANAGER: 'Production Manager',
  LINE_SUPERVISOR: 'Line Supervisor',
};

/** SRS Part 4 §4.1.2 — subset of permissions relevant to these screens. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  BOARD: ['dashboard.view', 'production.view'],
  CEO: ['dashboard.view', 'production.view'],
  FACTORY_HEAD: [
    'dashboard.view', 'production.view', 'production.order.create', 'production.order.release',
    'production.order.close', 'production.entry.create', 'production.entry.post',
  ],
  PRODUCTION_MANAGER: [
    'dashboard.view', 'production.view', 'production.order.create', 'production.order.release',
    'production.order.close', 'production.entry.create', 'production.entry.post',
  ],
  LINE_SUPERVISOR: ['production.view', 'production.entry.create', 'production.entry.post'],
};

export function toPublicUser({ password: _p, otp: _o, ...u }: DemoUser): User {
  return u;
}
