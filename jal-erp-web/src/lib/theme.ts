import { useEffect, useState } from 'react';
import { readJson, writeJson } from './storage';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'jal.theme';

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(() => readJson<ThemePref>('local', KEY) ?? 'system');
  useEffect(() => {
    applyTheme(pref);
    writeJson('local', KEY, pref);
  }, [pref]);
  return [pref, setPref];
}

/** Resolve CSS custom properties to concrete colours (SVG chart attributes cannot use var()). */
export function useCssVars<T extends string>(names: readonly T[]): Record<T, string> {
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Record<T, string>;
  };
  const [vals, setVals] = useState(read);
  useEffect(() => {
    const update = () => setVals(read());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return vals;
}

export const CHART_VARS = ['c1', 'c2', 'c3', 'c4', 'c5', 'text-muted', 'border', 'surface', 'text', 'danger', 'warning', 'success'] as const;
