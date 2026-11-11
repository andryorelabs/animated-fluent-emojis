import { createHash } from "node:crypto";

import { THEME_COLORS, THEME_STORAGE_KEY } from "./theme-keys";

/**
 * Blocking inline script that applies the stored or system theme to `<html>`
 * before first paint, sets `theme-color` for a stored override, and follows
 * live system changes while the preference is `system`. Its CSP hash is derived
 * from this exact string, so edit it only here.
 */
export const THEME_INIT_SCRIPT = `{const root=document.documentElement;const query=matchMedia('(prefers-color-scheme: dark)');let theme='system';try{const stored=localStorage.getItem('${THEME_STORAGE_KEY}');if(stored==='light'||stored==='dark')theme=stored}catch{theme='system'}root.classList.toggle('dark',theme==='dark'||(theme==='system'&&query.matches));root.dataset.theme=theme;if(theme!=='system')for(const meta of document.querySelectorAll('meta[name="theme-color"]'))meta.setAttribute('content',theme==='dark'?'${THEME_COLORS.dark}':'${THEME_COLORS.light}');query.addEventListener('change',event=>{if(root.dataset.theme==='system')root.classList.toggle('dark',event.matches)})}`;

/**
 * CSP hash source (without quotes) for {@link THEME_INIT_SCRIPT}, in the form
 * Astro's `security.csp.scriptDirective.hashes` expects.
 */
export const THEME_INIT_HASH: `sha256-${string}` = `sha256-${createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64")}`;
