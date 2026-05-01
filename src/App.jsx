/*
 * SQL — run in Supabase SQL editor before testing new features:
 *
 * -- Feature: view counts
 * ALTER TABLE wants ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;
 *
 * -- Feature: item condition
 * ALTER TABLE wants ADD COLUMN IF NOT EXISTS condition text;
 *
 * -- Feature: flexible/negotiable budget
 * ALTER TABLE wants ADD COLUMN IF NOT EXISTS negotiable boolean DEFAULT false;
 *
 * -- Feature: referral system
 * ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
 * ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by text;
 * ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count integer DEFAULT 0;
 *
 * -- Feature: listing bump
 * ALTER TABLE wants ADD COLUMN IF NOT EXISTS bumped_at timestamptz;
 *
 * -- Feature: service listings
 * ALTER TABLE wants ADD COLUMN IF NOT EXISTS listing_type text DEFAULT 'item';
 * ALTER TABLE wants ADD COLUMN IF NOT EXISTS estimated_hours text;
 *
 * -- Feature: IRD number (for DPI tax reporting)
 * ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ird_number text;
 *
 * -- Feature: report details (for HDCA compliance)
 * ALTER TABLE reports ADD COLUMN IF NOT EXISTS details text;
 *
 * -- Feature: response time tracking
 * ALTER TABLE offers ADD COLUMN IF NOT EXISTS responded_at timestamptz;
 *
 * -- Feature: price confidence signal (run when ready to show price data)
 * CREATE TABLE IF NOT EXISTS price_history (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   category text NOT NULL,
 *   accepted_price numeric NOT NULL,
 *   want_budget numeric,
 *   created_at timestamptz DEFAULT now()
 * );
 */
import { useState, useEffect, useRef, useCallback, Fragment, useMemo } from 'react'
import { supabase } from './supabase'

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  html, body { overflow-x: hidden; width: 100%; }
  html { background-color: #F6F4EE; }
  body { background: transparent; font-family: 'Inter', system-ui, sans-serif; color: #16110A; }
  .side-decor { position: fixed; top: 0; bottom: 0; z-index: -1; overflow: hidden; pointer-events: none; }
  .side-decor-left { left: 0; width: calc(50vw - 320px); background: url('/mountains-bg2.jpg') right center / cover no-repeat; }
  .side-decor-right { right: 0; width: calc(50vw - 320px); background: url('/mountains-bg2.jpg') left center / cover no-repeat; }
  html[data-dark="true"] .side-decor-left { background: url('/mountains-bgnight.jpg') right center / cover no-repeat; }
  html[data-dark="true"] .side-decor-right { background: url('/mountains-bgnight.jpg') left center / cover no-repeat; }
  @media (max-width: 720px) { .side-decor { display: none !important; } }
  ::placeholder { color: #7A6F5C; }

  input, textarea, select {
    width: 100%; padding: 12px 14px; border-radius: 10px;
    border: 1.5px solid #E8E2D5; background: #FFFFFF;
    font-family: 'Inter', system-ui, sans-serif; font-size: 14px; color: #16110A;
    outline: none; transition: border-color 0.15s ease; appearance: none;
  }
  input:focus, textarea:focus, select:focus { border-color: #1E5470; box-shadow: 0 0 0 3px rgba(30,84,112,0.12); }
  input[type="checkbox"], input[type="radio"] { appearance: auto; -webkit-appearance: auto; width: auto; height: auto; padding: 0; border: none; background: transparent; border-radius: 0; outline: revert; }
  button { font-family: 'Inter', system-ui, sans-serif; cursor: pointer; transition: all 0.15s ease; }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 500;
    border: 1.5px solid #E8E2D5; background: #FFFFFF; color: #16110A;
    box-shadow: 0 1px 2px rgba(22,17,10,0.05);
  }
  .btn:hover { border-color: #1E5470; background: #EAF0F4; color: #1E5470; transform: translateY(-1px); }
  .btn-primary { background: #16110A; color: #FFFFFF; border: 1.5px solid #16110A; box-shadow: none; }
  .btn-primary:hover { background: #2A2218; border-color: #2A2218; box-shadow: none; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .btn-green { background: #EDFAF4; color: #3F6F4E; border: 1.5px solid #B5D4C0; }
  .btn-green:hover { background: #d4f5e8; }
  .btn-red { background: #FEF2F2; color: #9B3232; border: 1.5px solid #DEB8B8; }
  .btn-red:hover { background: #fee2e2; }
  .btn-amber { background: #FFFBEB; color: #A86A1A; border: 1.5px solid #E8C898; }
  .btn-amber:hover { background: #fef3c7; }

  .card {
    background: #FFFFFF; border: 1.5px solid #E8E2D5; border-radius: 12px;
    box-shadow: 0 1px 0 rgba(0,0,0,0.04);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }
  .card-hover:hover { border-color: #C9D7E0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transform: translateY(-2px); cursor: pointer; }

  .badge { display: inline-flex; align-items: center; flex-shrink: 0; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.03em; }
  .badge-want { background: #EAF0F4; color: #1E5470; }
  .badge-service { background: #A0522D; color: #fff; }
  .badge-filled { background: #EDE6D6; color: #7A6F5C; }
  .badge-accepted { background: #FAF0E0; color: #A86A1A; }

  .tag { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #3D3528; }
  .divider { height: 1px; background: #EDE6D6; }

  .nav-btn { flex: 1; padding: 8px 12px; background: transparent; border: none; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; color: #7A6F5C; }
  .nav-btn svg { width: 22px; height: 22px; stroke-width: 1.75; stroke: currentColor; flex-shrink: 0; }
  .nav-btn span { font-size: 11px; font-weight: 500; color: currentColor; }
  .nav-btn.active { color: #16110A; }
  html[data-dark="true"] .nav-btn { color: #8A7E6E; }
  html[data-dark="true"] .nav-btn.active { color: #F0EBE0; }
  .nav-label { font-size: 11px; font-weight: 500; }
  .bottom-nav-bar { display: flex; }
  @media (min-width: 641px) { .bottom-nav-bar { display: none !important; } }
  .header-desktop-nav { display: none; gap: 2px; align-items: center; }
  @media (min-width: 641px) { .header-desktop-nav { display: flex; } }
  .header-nav-btn { background: transparent; border: none; padding: 6px 12px; cursor: pointer; font-size: 13px; font-weight: 500; color: #7A6F5C; border-radius: 8px; font-family: 'Inter', system-ui, sans-serif; transition: all 0.12s; }
  .header-nav-btn:hover { color: #3D3528; background: rgba(22,17,10,0.04); }
  .header-nav-btn.active { color: #16110A; font-weight: 600; }
  html[data-dark="true"] .header-nav-btn { color: #8A7E6E; }
  html[data-dark="true"] .header-nav-btn:hover { color: #F0EBE0; background: rgba(240,235,224,0.06); }
  html[data-dark="true"] .header-nav-btn.active { color: #F0EBE0; }

  .img-upload-area { border: 2px dashed #E8E2D5; border-radius: 12px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.15s ease; background: #F5F3EE; }
  .img-upload-area:hover { border-color: #1E5470; background: #EAF0F4; }
  .img-thumb { width: 80px; height: 80px; object-fit: cover; border-radius: 10px; border: 1.5px solid #E8E2D5; }
  .img-gallery { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .img-gallery-full { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-bottom: 16px; }
  .img-gallery-full img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; border: 1.5px solid #E8E2D5; cursor: pointer; transition: transform 0.15s ease; }
  .img-gallery-full img:hover { transform: scale(1.02); }
  .img-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 100; cursor: pointer; }
  .img-lightbox img { max-width: 92vw; max-height: 88vh; border-radius: 12px; }

  .msg-bubble { max-width: 78%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; margin-bottom: 6px; }
  .msg-mine { background: #1E5470; color: #fff; border-radius: 14px 14px 4px 14px; align-self: flex-end; }
  .msg-theirs { background: #F5F3EE; color: #16110A; border-radius: 14px 14px 14px 4px; align-self: flex-start; border: 1px solid #E8E2D5; }
  .msg-thread { display: flex; flex-direction: column; gap: 2px; padding: 16px; max-height: 340px; overflow-y: auto; }

  .star { font-size: 22px; cursor: pointer; transition: transform 0.1s ease; line-height: 1; }
  .star:hover { transform: scale(1.2); }

  .hero { background: linear-gradient(to bottom, rgba(4,14,28,0.72) 0%, rgba(6,22,42,0.5) 45%, rgba(4,14,28,0.70) 100%), url('/mountain.jpg') center 40% / cover no-repeat; padding: 80px 24px 0; text-align: center; position: relative; overflow: hidden; width: 100%; box-sizing: border-box; }
  .hero::before { content: ''; position: absolute; inset: 0; background: none; }
  .hero::after { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0; }
  .hero-content { position: relative; z-index: 1; max-width: 560px; margin: 0 auto; padding-bottom: 0; }
  .hero-headline { font-family: 'Fraunces', serif; font-size: clamp(52px, 8vw, 76px); color: #ffffff; font-style: italic; letter-spacing: -2px; margin-bottom: 20px; text-shadow: 0 2px 24px rgba(0,0,0,0.55), 0 8px 48px rgba(0,0,0,0.3); line-height: 1.05; }
  .hero-sub { font-size: 17px; color: rgba(255,255,255,0.78); margin: 0 0 28px; font-weight: 300; line-height: 1.65; max-width: 440px; margin-left: auto; margin-right: auto; text-shadow: 0 1px 12px rgba(0,0,0,0.4); }
  .btn-hero { background: #F6F4EE; color: #16110A; border-color: #F6F4EE; }
  .btn-hero:hover { background: #ffffff; border-color: #ffffff; }
  @keyframes ambientDrift0 { 0%,100% { transform: translateY(0) rotate(-3deg); opacity: 0.7; } 50% { transform: translateY(-14px) rotate(-3deg); opacity: 1; } }
  @keyframes ambientDrift1 { 0%,100% { transform: translateY(0) rotate(2deg); opacity: 0.5; } 50% { transform: translateY(-10px) rotate(2deg); opacity: 0.85; } }
  @keyframes ambientDrift2 { 0%,100% { transform: translateY(0) rotate(-1deg); opacity: 0.6; } 50% { transform: translateY(-18px) rotate(-1deg); opacity: 1; } }
  .stats-strip { display: grid; grid-template-columns: repeat(3, 1fr); }
  .stat-tile { padding: 22px 12px; text-align: center; display: flex; flex-direction: column; align-items: center; transition: background 0.15s ease; }
  .stat-tile:hover { background: rgba(14,127,168,0.04); }
  .stat-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-num { font-family: 'Fraunces', serif; font-style: italic; font-size: 26px; font-weight: 400; color: #1E5470; line-height: 1; margin-bottom: 3px; }
  html[data-dark="true"] .stat-num { color: #5B9EC0; }
  .how-section { padding: 28px 16px 8px; max-width: 640px; margin: 0 auto; }
  .how-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; text-align: center; }
  .how-it-works { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 420px) { .how-it-works { grid-template-columns: 1fr; } }
  .how-step { border-radius: 14px; padding: 18px 14px; text-align: center; }
  .how-step-icon { margin-bottom: 8px; }
  .how-step-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .how-step-desc { font-size: 11px; line-height: 1.4; }

  @keyframes heroFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
  @keyframes marqueeScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .hero-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; padding: 5px 12px; font-size: 12px; color: rgba(255,255,255,0.8); font-weight: 500; margin-bottom: 18px; backdrop-filter: blur(8px); }
  .hero-mock-card { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 14px 16px; text-align: left; animation: heroFloat 4s ease-in-out infinite; backdrop-filter: blur(12px); max-width: 260px; margin: 28px auto 0; }
  .reveal { opacity: 0; transform: translateY(28px) scale(0.98); transition: opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.55s cubic-bezier(0.22,1,0.36,1); }
  .reveal.visible { opacity: 1; transform: translateY(0) scale(1); }
  .reveal.delay-1 { transition-delay: 0.07s; }
  .reveal.delay-2 { transition-delay: 0.14s; }
  .reveal.delay-3 { transition-delay: 0.21s; }
  .marquee-strip { overflow: hidden; -webkit-mask-image: linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%); mask-image: linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%); }
  .marquee-track { display: flex; gap: 10px; width: max-content; animation: marqueeScroll 32s linear infinite; will-change: transform; }
  @media (prefers-reduced-motion: reduce) { .marquee-track { animation: none; } .hero-headline, .hero-sub, .gsap-h0, .gsap-h1, .gsap-h2, .gsap-h3, .gsap-h4 { opacity: 1 !important; transform: none !important; } }
  .marquee-strip:hover .marquee-track { animation-play-state: paused; }
  .marquee-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500; white-space: nowrap; border: 1.5px solid #E8E2D5; background: #fff; color: #3D3528; flex-shrink: 0; }

  .ticker-strip { overflow: hidden; -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%); mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%); }
  .ticker-track { display: flex; width: max-content; animation: marqueeScroll 50s linear infinite; }
  .ticker-item { display: flex; align-items: center; gap: 7px; padding: 0 18px; white-space: nowrap; font-size: 12px; cursor: pointer; }
  .ticker-sep { color: #E8E2D5; margin: 0 2px; }
  @keyframes livePulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(14,154,110,0.4); } 50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(14,154,110,0); } }
  .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #3F6F4E; flex-shrink: 0; animation: livePulse 2.4s ease-in-out infinite; }
  .greeting-bar { padding: 14px 16px 0; max-width: 640px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  .home-alert { display: flex; align-items: center; gap: 10px; border-radius: 12px; padding: 11px 14px; margin-bottom: 12px; cursor: pointer; }

  .filter-chip { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; font-size: 13px; font-weight: 500; border: none; background: transparent; color: #7A6F5C; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; }
  .filter-chip.active { background: #16110A; color: #F6F4EE; padding: 6px 14px; }
  .filter-chip:hover { color: #3D3528; }
  .filter-toolbar-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; min-height: 36px; background: transparent; border: 1px solid #E8E2D5; border-radius: 8px; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: 0.04em; color: #3D3528; cursor: pointer; white-space: nowrap; }
  .filter-toolbar-chip span { color: #7A6F5C; }
  .filter-divider { height: 1px; background: #E8E2D5; margin: 8px 0 12px; }
  .no-photo-placeholder { height: 72px; background: #F6F4EE; border: 1px dashed #E8E2D5; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.12em; color: #7A6F5C; }
  .post-pill { width: 28px; height: 28px; border-radius: 6px; background: #16110A; color: #F6F4EE; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; line-height: 1; }
  .chips-row { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; max-width: 100%; }
  .chips-row::-webkit-scrollbar { display: none; }

  .skeleton { background: linear-gradient(90deg, #EDE6D6 25%, #F0EBDB 50%, #EDE6D6 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 8px; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  .pull-indicator { text-align: center; padding: 12px; font-size: 12px; color: #7A6F5C; transition: all 0.2s ease; }
  .page-inner { max-width: 640px; margin: 0 auto; padding: 20px 16px; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; z-index: 50; padding: 0; animation: overlayIn 0.18s ease; }
  .modal { background: #fff; border-radius: 20px 20px 0 0; padding: 24px; width: 100%; max-width: 640px; animation: modalUp 0.3s cubic-bezier(0.22,1,0.36,1); }

  @keyframes ripple { from { transform: scale(0); opacity: 1; } to { transform: scale(1); opacity: 0; } }
  .toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); min-width: 220px; max-width: 340px; padding: 11px 16px 11px 14px; border-radius: 14px; font-size: 13px; font-weight: 500; z-index: 200; animation: fadeUp 0.22s ease; display: flex; align-items: center; gap: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.22); border-left: 3.5px solid transparent; white-space: nowrap; }
  .toast-default { background: #16110A; color: #fff; border-left-color: #3D3528; }
  .toast-success { background: #0A2A1A; color: #34D399; border-left-color: #3F6F4E; }
  .toast-error { background: #2A0A0A; color: #F87171; border-left-color: #9B3232; }
  .toast-warning { background: #2A1A00; color: #FCD34D; border-left-color: #A86A1A; }
  .toast-info { background: #061828; color: #7DD3FC; border-left-color: #1E5470; }
  .toast-close { margin-left: auto; opacity: 0.5; cursor: pointer; background: none; border: none; color: inherit; font-size: 16px; line-height: 1; padding: 0 0 0 6px; flex-shrink: 0; }

  @keyframes fadeUp { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  @keyframes contentFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: contentFadeUp 0.3s ease forwards; width: 100%; }
  .fade-up.stagger-1 { animation-delay: 0.05s; opacity: 0; }
  .fade-up.stagger-2 { animation-delay: 0.1s; opacity: 0; }
  .fade-up.stagger-3 { animation-delay: 0.15s; opacity: 0; }

  @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes modalUp { from { transform: translateY(48px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes notifReveal { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  .notification-panel { animation: notifReveal 0.18s cubic-bezier(0.22,1,0.36,1); }
  .btn:active:not([disabled]) { transform: scale(0.97) !important; transition-duration: 0.1s !important; box-shadow: inset 0 2px 5px rgba(0,0,0,0.18) !important; }
  .btn-primary:active:not([disabled]) { box-shadow: inset 0 2px 5px rgba(0,0,0,0.25), 0 1px 4px rgba(14,127,168,0.2) !important; }

  .app-header { transition: box-shadow 0.35s ease, border-color 0.35s ease; }
  html[data-scrolled="true"] .app-header { box-shadow: 0 2px 32px rgba(30,84,112,0.24) !important; border-bottom-color: rgba(30,84,112,0.14) !important; }

  @supports (animation-timeline: scroll()) {
    @keyframes heroParallaxDrift { to { transform: translateY(-52px); } }
    .hero-content {
      animation: heroParallaxDrift linear both;
      animation-timeline: scroll(root block);
      animation-range: 0px 420px;
    }
  }

  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } .hero-content { animation: none !important; } }

  .gsap-h0, .gsap-h1, .gsap-h2, .gsap-h3, .gsap-h4 { opacity: 0; }

  html[data-dark="true"] { background-color: #111009; }
  html[data-dark="true"] body { background: transparent !important; color: #F0EBE0; }
  html[data-dark="true"] .hero { background: linear-gradient(to bottom, rgba(20,16,12,0.55) 0%, rgba(20,16,12,0.35) 45%, rgba(20,16,12,0.6) 100%), url('/mountains-bgnight.jpg') center 50% / cover no-repeat; }
  html[data-dark="true"] .side-decor-left, html[data-dark="true"] .side-decor-right { background-image: url('/mountains-bgnight.jpg'); }
  html[data-dark="true"] input, html[data-dark="true"] textarea, html[data-dark="true"] select { background: #241E16; border-color: #3A2F22; color: #F0EBE0; }
  html[data-dark="true"] input:focus, html[data-dark="true"] textarea:focus, html[data-dark="true"] select:focus { border-color: #7FA8B8; box-shadow: 0 0 0 3px rgba(127,168,184,0.15); }
  html[data-dark="true"] ::placeholder { color: #8A7E6E; }
  html[data-dark="true"] .card { background: #241E16; border-color: #3A2F22; box-shadow: none; }
  html[data-dark="true"] .card-hover:hover { border-color: #5A4838; box-shadow: none; }
  html[data-dark="true"] .btn { background: #241E16; border-color: #3A2F22; color: #F0EBE0; }
  html[data-dark="true"] .btn:hover { background: #2F2820; border-color: #5A4838; color: #F0EBE0; }
  html[data-dark="true"] .btn-primary { background: #F0EBE0 !important; color: #1A1612 !important; border-color: #F0EBE0 !important; }
  html[data-dark="true"] .btn-primary:hover { background: #E0D9C8 !important; }
  html[data-dark="true"] .btn-green { background: #1F2A22; color: #8FB89A; border-color: #2F4A38; }
  html[data-dark="true"] .btn-red { background: #2A1818; color: #C99A9A; border-color: #5A2828; }
  html[data-dark="true"] .btn-amber { background: #2A2218; color: #C9A87A; border-color: #5A4828; }
  html[data-dark="true"] .badge-want { background: #2A2820; color: #B5C8D2; }
  html[data-dark="true"] .badge-service { background: #5A3D24; color: #E2C9AD; }
  html[data-dark="true"] .badge-filled { background: #241E16; color: #7A6E5E; }
  html[data-dark="true"] .badge-accepted { background: #2A2218; color: #C9A87A; }
  html[data-dark="true"] .filter-chip { background: transparent; border: none; color: #8A7E6E; }
  html[data-dark="true"] .filter-chip:hover { color: #F0EBE0; }
  html[data-dark="true"] .filter-chip.active { background: #F0EBE0; color: #1A1612; }
  html[data-dark="true"] .filter-toolbar-chip { border-color: #3A2F22; color: #F0EBE0; }
  html[data-dark="true"] .filter-toolbar-chip span { color: #8A7E6E; }
  html[data-dark="true"] .filter-divider { background: #3A2F22; }
  html[data-dark="true"] .no-photo-placeholder { background: #1A1612; border-color: #3A2F22; color: #8A7E6E; }
  html[data-dark="true"] .post-pill { background: #F0EBE0; color: #1A1612; }
  html[data-dark="true"] .divider { background: #3A2F22; }
  html[data-dark="true"] .skeleton { background: linear-gradient(90deg, #241E16 25%, #2F2820 50%, #241E16 75%); background-size: 200% 100%; }
  html[data-dark="true"] .modal { background: #241E16; }
  html[data-dark="true"] .img-upload-area { background: #1A1612; border-color: #3A2F22; }
  html[data-dark="true"] .img-upload-area:hover { background: #2F2820; }
  html[data-dark="true"] .msg-theirs { background: #241E16; color: #F0EBE0; border-color: #3A2F22; }
  html[data-dark="true"] .toast-default { background: #F0EBE0; color: #1A1612; border-left-color: #7A6E5E; }
  html[data-dark="true"] .pull-indicator { color: #8A7E6E; }
  html[data-dark="true"] .img-gallery-full img { border-color: #3A2F22; }
  html[data-dark="true"] .img-thumb { border-color: #3A2F22; }
  html[data-dark="true"] a { color: #7FA8B8; }
`

function titleCase(s) {
  if (!s) return ''
  return s.replace(/\b([a-z])/g, m => m.toUpperCase())
    .replace(/\b(Pc|Cpu|Gpu|Tv|Suv|Iphone|Ipad|Imac|Macbook|Ai|Nz)\b/gi, m => m.toUpperCase())
    .replace(/\bRtx\s?(\d+)/gi, 'RTX $1')
    .replace(/\bGtx\s?(\d+)/gi, 'GTX $1')
}

function StarRating({ score, onSelect, readonly = false, size = 20 }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} className={readonly ? '' : 'star'} style={{ fontSize: size, cursor: readonly ? 'default' : 'pointer', color: i <= (hover || score) ? '#F59E0B' : '#D6E4EF', lineHeight: 1 }}
          onClick={() => !readonly && onSelect && onSelect(i)}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}>★</span>
      ))}
    </div>
  )
}

function setupScrollDrag(el) {
  if (!el) return
  if (el._cleanupScroll) el._cleanupScroll()
  let isDown = false, startX = 0, startScrollLeft = 0
  const onWheel = e => { e.preventDefault(); el.scrollLeft += e.deltaY + e.deltaX }
  const onMouseDown = e => { isDown = true; startX = e.pageX; startScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' }
  const onMouseUp = () => { isDown = false; el.style.cursor = 'grab'; el.style.userSelect = '' }
  const onMouseLeave = () => { isDown = false; el.style.cursor = 'grab'; el.style.userSelect = '' }
  const onMouseMove = e => { if (!isDown) return; e.preventDefault(); el.scrollLeft = startScrollLeft - (e.pageX - startX) }
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('mousedown', onMouseDown)
  el.addEventListener('mouseup', onMouseUp)
  el.addEventListener('mouseleave', onMouseLeave)
  el.addEventListener('mousemove', onMouseMove)
  el.style.cursor = 'grab'
  el._cleanupScroll = () => {
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('mousedown', onMouseDown)
    el.removeEventListener('mouseup', onMouseUp)
    el.removeEventListener('mouseleave', onMouseLeave)
    el.removeEventListener('mousemove', onMouseMove)
  }
}

function SkeletonCard({ hasImage = false }) {
  return (
    <div className="card" style={{ marginBottom: '10px', overflow: 'hidden' }}>
      {hasImage
        ? <div className="skeleton" style={{ height: '185px', borderRadius: '14px 14px 0 0', flexShrink: 0 }} />
        : <div style={{ height: '4px', background: '#E8E2D5' }} />}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div className="skeleton" style={{ height: '18px', width: '58%' }} />
          <div className="skeleton" style={{ height: '18px', width: '46px', borderRadius: '20px' }} />
        </div>
        <div className="skeleton" style={{ height: '13px', width: '85%', marginBottom: '7px' }} />
        <div className="skeleton" style={{ height: '13px', width: '55%', marginBottom: '14px' }} />
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          <div className="skeleton" style={{ height: '24px', width: '52px', borderRadius: '8px' }} />
          <div className="skeleton" style={{ height: '24px', width: '72px', borderRadius: '20px' }} />
          <div className="skeleton" style={{ height: '24px', width: '60px', borderRadius: '20px' }} />
        </div>
        <div style={{ height: '1px', background: '#E4EFF7', marginBottom: '12px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="skeleton" style={{ height: '12px', width: '72px', borderRadius: '20px' }} />
          <div className="skeleton" style={{ height: '12px', width: '48px' }} />
        </div>
      </div>
    </div>
  )
}

function App() {
  const [wants, setWants] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('')
  const [images, setImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [selectedWant, setSelectedWant] = useState(null)
  const [offers, setOffers] = useState([])
  const [offerPrice, setOfferPrice] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [submittingOffer, setSubmittingOffer] = useState(false)
  const [filterLocation, setFilterLocation] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSort, setFilterSort] = useState('newest')
  const [filterMaxBudget, setFilterMaxBudget] = useState('')
  const [filterType, setFilterType] = useState('')
  const [offerCounts, setOfferCounts] = useState({})
  const [page, setPage] = useState('landing')
  const [search, setSearch] = useState('')
  const [seenOffers, setSeenOffers] = useState(() => JSON.parse(localStorage.getItem('seenOffers') || '{}'))
  const [lightboxImg, setLightboxImg] = useState(null)
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [myInbox, setMyInbox] = useState([])
  const [profileEmail, setProfileEmail] = useState(null)
  const [profileWants, setProfileWants] = useState([])
  const [profileRatings, setProfileRatings] = useState([])
  const [ratingScore, setRatingScore] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [allRatings, setAllRatings] = useState({})
  const [profiles, setProfiles] = useState({}) // email -> username
  const [myProfile, setMyProfile] = useState(null)
  const [reportModal, setReportModal] = useState(null) // want object
  const [reportReason, setReportReason] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const [toast, setToast] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const pullStartRef = useRef(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [dark, setDark] = useState(() => localStorage.getItem('darkMode') === 'true')
  const [navStack, setNavStack] = useState([])
  const [condition, setCondition] = useState('')
  const [negotiable, setNegotiable] = useState(false)
  const [listingType, setListingType] = useState('item')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [seenThreads, setSeenThreads] = useState(() => new Set(JSON.parse(localStorage.getItem('seenThreads') || '[]')))
  const [settingsUsername, setSettingsUsername] = useState('')
  const [settingsIrd, setSettingsIrd] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [reportDetails, setReportDetails] = useState('')
  // Feature 1: Wishlist
  const [wishlists, setWishlists] = useState([])
  const [savedWants, setSavedWants] = useState([])
  // Feature 2: Offer expiry live timer
  const [now, setNow] = useState(Date.now())
  // Feature 3: Counter-offer
  const [counterModal, setCounterModal] = useState(null)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterNote, setCounterNote] = useState('')
  const [submittingCounter, setSubmittingCounter] = useState(false)
  // Feature 4: Recent searches
  const [recentSearches, setRecentSearches] = useState(() => JSON.parse(localStorage.getItem('offrit_recent_searches') || '[]'))
  const [seenWants, setSeenWants] = useState(() => new Set(JSON.parse(localStorage.getItem('seenWants') || '[]')))
  // Feature 5: Profile upgrade
  const [viewedProfile, setViewedProfile] = useState(null)
  const [editingBio, setEditingBio] = useState(false)
  const [bioText, setBioText] = useState('')
  const [savingBio, setSavingBio] = useState(false)
  // Feature 6: Keyword alerts & notifications
  const [newKeyword, setNewKeyword] = useState('')
  const [myKeywords, setMyKeywords] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  // Feature 7: Near me
  const [nearMe, setNearMe] = useState(false)
  const [userCity, setUserCity] = useState(null)
  // Mine page
  const [mineTab, setMineTab] = useState('listings')
  const [showOffersMenu, setShowOffersMenu] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [showBudgetDropdown, setShowBudgetDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [myOffers, setMyOffers] = useState([])
  const [loadingMyOffers, setLoadingMyOffers] = useState(false)
  // Edit listing
  const [editModal, setEditModal] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editBudget, setEditBudget] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editCondition, setEditCondition] = useState('')
  const [editNegotiable, setEditNegotiable] = useState(false)
  const [editListingType, setEditListingType] = useState('item')
  const [editEstimatedHours, setEditEstimatedHours] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  // Password reset
  const [resetSent, setResetSent] = useState(false)
  // Pagination
  const [hasMoreWants, setHasMoreWants] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  // Image carousel on cards
  const [cardImgIndexes, setCardImgIndexes] = useState({})
  const [globalDeals, setGlobalDeals] = useState(0)
  const [profileResponseRate, setProfileResponseRate] = useState(null)
  const [dealRatingModal, setDealRatingModal] = useState(null)
  const [dealRatingScore, setDealRatingScore] = useState(0)
  const [submittingDealRating, setSubmittingDealRating] = useState(false)
  const [similarWants, setSimilarWants] = useState([])
  const [pushEnabled, setPushEnabled] = useState(false)
  const [referralCount, setReferralCount] = useState(0)
  const [myListings, setMyListings] = useState([])

  const fileInputRef = useRef()
  const messagesEndRef = useRef()
  const realtimeRef = useRef(null)
  const scrollPos = useRef({})
  const sessionRef = useRef(null)
  const lastSubmitRef = useRef({})
  const deepLinkRef = useRef(new URLSearchParams(window.location.search).get('listing'))
  const filterEffectInitRef = useRef(false)
  const toastTimerRef = useRef(null)

  const VAPID_PUBLIC_KEY = 'BLtl0nwDhatiZlu01rE9cUMkW2eMGKalSNxzSKO1n3a8eGnHvmcm6slYLLQaPgU4zbokYdrK47irxPv0KLsb9Cs'

  function urlBase64ToUint8Array(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4)
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(raw, c => c.charCodeAt(0))
  }

  function generateRefCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase()
  }

  async function fetchReferralCount(code) {
    if (!code) return
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('referred_by', code)
    setReferralCount(count || 0)
  }

  const categories = ['Electronics', 'Sport & Outdoors', 'Vehicles', 'Furniture', 'Clothing', 'Tools', 'Music', 'Other']
  const serviceCategories = ['Lawn & Garden', 'Cleaning', 'Removals & Moving', 'Handyman & Repairs', 'Plumbing', 'Electrical', 'Painting & Decorating', 'IT & Tech', 'Tutoring & Lessons', 'Pet Care', 'Deliveries', 'Photography', 'Design & Creative', 'Personal Training', 'Cooking & Catering', 'Childcare', 'Event Help', 'Odd Jobs', 'Other']
  const conditions = ['Any', 'New', 'Like New', 'Good', 'Fair']
  const conditionColour = { 'New': '#3F6F4E', 'Like New': '#1E5470', 'Good': '#A86A1A', 'Fair': '#9B3232' }
  const locations = ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin', 'Napier', 'Palmerston North', 'Rotorua', 'Nelson', 'New Plymouth', 'Other']
  const reportReasons = ['Spam or scam', 'Inappropriate content', 'Illegal item or service', 'Wrong category', 'Already sold', 'Other']
  const LICENSED_TRADE_CATS = new Set(['Electrical', 'Plumbing'])
  const PROHIBITED_KEYWORDS = ['cannabis','methamphetamine',' cocaine ',' heroin ','mdma','ketamine','illegal firearm','unregistered gun','counterfeit','fake id','prostitut','escort service']

  function timeAgo(dateStr) {
    const d = new Date(dateStr), now = new Date()
    const s = Math.floor((now - d) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    if (s < 604800) return d.toLocaleDateString('en-NZ', { weekday: 'short' })
    if (now.getFullYear() === d.getFullYear()) return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
    return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function showToast(msg, type = 'default') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, type })
    const delay = type === 'error' ? 6000 : type === 'warning' ? 4000 : 2800
    toastTimerRef.current = setTimeout(() => setToast(null), delay)
  }

  function goBack() {
    setReportModal(null); setReportReason('')
    if (!navStack.length) { setPage(user ? 'home' : 'landing'); return }
    const prev = navStack[navStack.length - 1]
    setNavStack(s => s.slice(0, -1))
    setPage(prev.page)
    if (prev.selectedWant !== undefined) setSelectedWant(prev.selectedWant)
    if (prev.profileEmail !== undefined) setProfileEmail(prev.profileEmail)
    if (prev.activeThread !== undefined) setActiveThread(prev.activeThread)
    const savedY = scrollPos.current[prev.page] || 0
    setTimeout(() => window.scrollTo(0, savedY), 50)
  }

  useEffect(() => {
    fetchWants()
    fetchAllRatings()
    fetchGlobalStats()
  }, [])

  useEffect(() => {
    if ((page === 'home' || page === 'browse') && wants.length === 0 && !loading) {
      fetchWants()
    }
  }, [page])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      sessionRef.current = session
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        setPage('home')
        await fetchMyProfile(u)
      }
      if (deepLinkRef.current) {
        fetchAndOpenListing(deepLinkRef.current)
        deepLinkRef.current = null
      }
    })
    supabase.auth.onAuthStateChange(async (_e, session) => {
      sessionRef.current = session
      const u = session?.user ?? null
      setUser(u)
      if (u) { if (page === 'landing') setPage('home'); await fetchMyProfile(u) }
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('darkMode', dark)
    document.documentElement.dataset.dark = dark ? 'true' : 'false'
  }, [dark])

  useEffect(() => {
    const handlePopState = () => { goBack() }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [navStack, page, selectedWant, profileEmail, activeThread, user])

  useEffect(() => { if (user) fetchInbox() }, [user])
  useEffect(() => { if (user) { fetchWishlists(); fetchKeywords(); fetchNotifications() } }, [user])
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
        if (sub) setPushEnabled(true)
      }).catch(() => {})
    }
  }, [])
  const pageRef = useRef(page)
  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { const t = setInterval(() => { if (['want', 'mylistings'].includes(pageRef.current)) setNow(Date.now()) }, 10000); return () => clearInterval(t) }, [])
  useEffect(() => { if (page !== 'profile') { setViewedProfile(null); setProfileResponseRate(null) } }, [page])
  useEffect(() => { if (user && page === 'mylistings') { fetchMyListings(); fetchMyOffers(); fetchSavedWants() } }, [page, user])
  useEffect(() => { if (selectedWant) fetchSimilarWants(selectedWant) }, [selectedWant])
  useEffect(() => {
    const urlRef = new URLSearchParams(window.location.search).get('ref')
    if (urlRef) localStorage.setItem('offrit_ref', urlRef)
  }, [])
  useEffect(() => {
    if (page === 'settings' && myProfile?.referral_code) fetchReferralCount(myProfile.referral_code)
  }, [page, myProfile?.referral_code])
  useEffect(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!filterEffectInitRef.current) { filterEffectInitRef.current = true; return }
    fetchWants(0, false, buildServerFilters())
  }, [filterLocation, filterCategory, filterType, nearMe, userCity])

  useEffect(() => {
    let io
    const timer = setTimeout(() => {
      const els = document.querySelectorAll('.reveal:not(.visible)')
      if (!els.length) return
      io = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target) } })
      }, { threshold: 0.08 })
      els.forEach(el => io.observe(el))
    }, 50)
    return () => { clearTimeout(timer); io?.disconnect() }
  }, [page, wants.length])

  useEffect(() => {
    const addRipple = e => {
      const btn = e.target.closest('.btn-primary')
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2.2
      const span = document.createElement('span')
      span.style.cssText = `position:absolute;border-radius:50%;width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px;background:rgba(255,255,255,0.28);animation:ripple 0.55s ease-out forwards;pointer-events:none;`
      btn.style.overflow = 'hidden'
      btn.appendChild(span)
      span.addEventListener('animationend', () => span.remove())
    }
    document.addEventListener('click', addRipple)
    return () => document.removeEventListener('click', addRipple)
  }, [])


  useEffect(() => {
    if (page !== 'landing') return
    let cleanup = () => {}
    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap: g }, { ScrollTrigger: ST }]) => {
      g.registerPlugin(ST)
      const tl = g.timeline({ defaults: { ease: 'power3.out' } })
      tl.fromTo('.gsap-h0', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5 })
        .fromTo('.gsap-h1', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.65 }, '-=0.3')
        .fromTo('.gsap-h2', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.35')
        .fromTo('.gsap-h3', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45 }, '-=0.25')
        .fromTo('.gsap-h4', { opacity: 0, y: 30, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.65 }, '-=0.2')
      g.set('.gsap-reveal', { opacity: 0, y: 22 })
      ST.batch('.gsap-reveal', {
        onEnter: batch => g.to(batch, { opacity: 1, y: 0, duration: 0.55, stagger: 0.09, ease: 'power2.out' }),
        once: true,
        start: 'top 95%'
      })
      ST.refresh()
      cleanup = () => { tl.kill(); ST.getAll().forEach(t => t.kill()) }
    })
    return () => cleanup()
  }, [page])

  useEffect(() => {
    const handler = () => {
      document.documentElement.dataset.scrolled = window.scrollY > 8 ? 'true' : 'false'
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => { window.removeEventListener('scroll', handler); delete document.documentElement.dataset.scrolled }
  }, [])

  // Realtime messages subscription
  useEffect(() => {
    if (!activeThread || page !== 'messages') {
      if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null }
      return
    }
    const channel = supabase.channel('messages-' + activeThread.offer.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'offer_id=eq.' + activeThread.offer.id },
        payload => { setMessages(prev => [...prev, payload.new]) })
      .subscribe()
    realtimeRef.current = channel
    return () => { supabase.removeChannel(channel); realtimeRef.current = null }
  }, [activeThread, page])

  async function fetchMyProfile(u) {
    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    if (data) setMyProfile(data)
  }

  async function fetchAllProfiles(emails) {
    if (!emails || emails.length === 0) return
    const { data } = await supabase.from('profiles').select('email, username').in('email', emails)
    if (data) {
      const map = {}
      data.forEach(p => { map[p.email] = p.username })
      setProfiles(prev => ({ ...prev, ...map }))
    }
  }

  async function fetchWants(offset = 0, append = false, serverFilters = {}) {
    const limit = serverFilters.active ? 200 : 20
    try {
      if (!append) setLoading(true)
      else setLoadingMore(true)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
      let url = `${supabaseUrl}/rest/v1/wants?order=created_at.desc&select=*&limit=${limit}&offset=${offset}`
      if (serverFilters.location) url += `&location=eq.${encodeURIComponent(serverFilters.location)}`
      if (serverFilters.category) url += `&category=eq.${encodeURIComponent(serverFilters.category)}`
      if (serverFilters.listing_type) url += `&listing_type=eq.${encodeURIComponent(serverFilters.listing_type)}`
      const res = await fetch(url, { headers: { 'apikey': supabaseKey, 'Content-Type': 'application/json' } })
      if (res.ok) {
        const data = await res.json()
        if (append) setWants(prev => [...prev, ...data])
        else setWants(data)
        setHasMoreWants(!serverFilters.active && data.length === limit)
        fetchAllProfiles([...new Set(data.map(w => w.user_email).filter(Boolean))])
        if (!append) fetchOfferCounts()
      }
    } catch (e) {
      console.error('fetchWants exception:', e)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  async function fetchAndOpenListing(id) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/wants?id=eq.${id}&select=*`,
        { headers: { 'apikey': supabaseKey } })
      if (res.ok) {
        const data = await res.json()
        if (data && data[0]) {
          setSelectedWant(data[0])
          setNavStack([{ page: 'home' }])
          setPage('want')
          window.history.replaceState({}, '', window.location.pathname)
        }
      }
    } catch (e) { console.error('fetchAndOpenListing:', e) }
  }

  async function fetchAllRatings() {
    const { data } = await supabase.from('ratings').select('rated_user_email, score')
    if (data) {
      const map = {}
      data.forEach(r => { if (!map[r.rated_user_email]) map[r.rated_user_email] = { total: 0, count: 0 }; map[r.rated_user_email].total += r.score; map[r.rated_user_email].count += 1 })
      const result = {}
      Object.entries(map).forEach(([e, v]) => { result[e] = { avg: (v.total / v.count).toFixed(1), count: v.count } })
      setAllRatings(result)
    }
  }

  async function fetchGlobalStats() {
    const { count } = await supabase.from('wants').select('id', { count: 'exact', head: true }).eq('status', 'filled')
    if (count !== null) setGlobalDeals(count)
  }

  async function fetchSimilarWants(want) {
    if (!want?.category) { setSimilarWants([]); return }
    const { data } = await supabase.from('wants')
      .select('id, title, budget, location, category, images, user_email, created_at, status, listing_type, views')
      .eq('category', want.category)
      .eq('status', 'active')
      .neq('id', want.id)
      .order('created_at', { ascending: false })
      .limit(8)
    setSimilarWants(data || [])
  }

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { showToast('Push not supported on this browser'); return }
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { showToast('Notifications blocked — check browser settings', 'warning'); return }
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
      const token = sessionRef.current?.access_token
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/push_subscriptions`, {
        method: 'POST',
        headers: { apikey: import.meta.env.VITE_SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ user_email: user.email, subscription: sub.toJSON() })
      })
      setPushEnabled(true)
      showToast('Push notifications enabled!', 'success')
    } catch (e) { showToast('Could not enable notifications', 'error') }
  }

  async function sendPushNotification(toEmail, title, body, url = '/') {
    const token = sessionRef.current?.access_token
    if (!token || !toEmail) return
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: { apikey: import.meta.env.VITE_SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: toEmail, title, body, url })
      })
    } catch (_) { /* silent — push is best-effort */ }
  }

  async function fetchProfileData(email) {
    const { data: ws } = await supabase.from('wants').select('*').eq('user_email', email).order('created_at', { ascending: false })
    if (ws) {
      setProfileWants(ws)
      if (ws.length > 0) {
        const wantIds = ws.map(w => w.id)
        const { count: total } = await supabase.from('offers').select('id', { count: 'exact', head: true }).in('want_id', wantIds)
        const { count: responded } = await supabase.from('offers').select('id', { count: 'exact', head: true }).in('want_id', wantIds).not('status', 'eq', 'pending')
        setProfileResponseRate(total > 0 ? Math.round((responded / total) * 100) : null)
      } else {
        setProfileResponseRate(null)
      }
    }
    const { data: rs } = await supabase.from('ratings').select('*').eq('rated_user_email', email).order('created_at', { ascending: false })
    if (rs) setProfileRatings(rs)
    const { data: prof } = await supabase.from('profiles').select('*').eq('email', email).single()
    if (prof) { setViewedProfile(prof); if (email === user?.email) setBioText(prof.bio || '') }
  }

  async function openProfile(email) {
    if (page !== 'profile') {
      scrollPos.current[page] = window.scrollY
      setNavStack(prev => [...prev, { page, selectedWant, profileEmail, activeThread }])
      window.scrollTo(0, 0)
    }
    setProfileEmail(email); setPage('profile')
    await fetchProfileData(email)
    if (email === user?.email) fetchSavedWants()
  }

  async function submitRating(targetEmail) {
    if (!ratingScore || !user) return
    setSubmittingRating(true)
    await supabase.from('ratings').insert([{ rated_user_email: targetEmail, rater_user_id: user.id, rater_email: user.email, score: ratingScore, comment: ratingComment }])
    setRatingScore(0); setRatingComment('')
    await fetchAllRatings(); await fetchProfileData(targetEmail)
    setSubmittingRating(false)
  }

  async function submitDealRating() {
    if (!dealRatingScore || !user || !dealRatingModal) return
    setSubmittingDealRating(true)
    await supabase.from('ratings').insert([{ rated_user_email: dealRatingModal.email, rater_user_id: user.id, rater_email: user.email, score: dealRatingScore, comment: '' }])
    await fetchAllRatings()
    setDealRatingScore(0); setDealRatingModal(null); setSubmittingDealRating(false)
    showToast('Rating submitted — thanks!', 'success')
  }

  async function submitReport() {
    if (!reportReason || !user || !reportModal) return
    setSubmittingReport(true)
    await supabase.from('reports').insert([{ want_id: reportModal.id, reporter_id: user.id, reporter_email: user.email, reason: reportReason, details: reportDetails || null }])
    setReportModal(null); setReportReason(''); setReportDetails('')
    setSubmittingReport(false)
    showToast('Report submitted — we\'ll review within 48 hours')
  }

  async function shareWant(want) {
    const url = window.location.origin + '?listing=' + want.id
    if (navigator.share) {
      try { await navigator.share({ title: want.title, text: 'Check out this listing on Offrit', url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      showToast('Link copied!')
    }
  }

  async function fetchOfferCounts() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const res = await fetch(`${supabaseUrl}/rest/v1/offers?select=want_id`, { headers: { apikey: supabaseKey } })
    if (res.ok) {
      const data = await res.json()
      const counts = {}
      data.forEach(o => { counts[o.want_id] = (counts[o.want_id] || 0) + 1 })
      setOfferCounts(counts)
    }
  }

  async function fetchOffers(wantId) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const res = await fetch(`${supabaseUrl}/rest/v1/offers?want_id=eq.${wantId}&order=created_at.desc`,
      { headers: { apikey: supabaseKey } })
    if (res.ok) {
      const data = await res.json()
      setOffers(data)
      fetchAllProfiles([...new Set(data.map(o => o.seller_email).filter(Boolean))])
    }
  }

  async function acceptOffer(offerId, wantId) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    const patchHeaders = { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
    await fetch(`${supabaseUrl}/rest/v1/offers?id=eq.${offerId}`, { method: 'PATCH', headers: patchHeaders, body: JSON.stringify({ status: 'accepted', responded_at: new Date().toISOString() }) })
    await fetch(`${supabaseUrl}/rest/v1/wants?id=eq.${wantId}`, { method: 'PATCH', headers: patchHeaders, body: JSON.stringify({ status: 'filled' }) })
    const acceptedOff = offers.find(o => o.id === offerId)
    // Increment seller's deal count
    if (acceptedOff?.seller_email) {
      const pr = await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(acceptedOff.seller_email)}&select=id,total_deals`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } })
      if (pr.ok) {
        const [sp] = await pr.json()
        if (sp) await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${sp.id}`, {
          method: 'PATCH', headers: patchHeaders,
          body: JSON.stringify({ total_deals: (sp.total_deals || 0) + 1 })
        })
      }
    }
    // Increment buyer's deal count
    if (user?.email) {
      const pr2 = await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(user.email)}&select=id,total_deals`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } })
      if (pr2.ok) {
        const [bp] = await pr2.json()
        if (bp) await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${bp.id}`, {
          method: 'PATCH', headers: patchHeaders,
          body: JSON.stringify({ total_deals: (bp.total_deals || 0) + 1 })
        })
      }
    }
    // Silent price tracking — fire-and-forget, table may not exist yet
    if (acceptedOff?.price && selectedWant?.category) {
      fetch(`${supabaseUrl}/rest/v1/price_history`, {
        method: 'POST',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ category: selectedWant.category, accepted_price: acceptedOff.price, want_budget: selectedWant.budget })
      }).catch(() => {})
    }
    setOffers(offers.map(o => o.id === offerId ? { ...o, status: 'accepted' } : o))
    setWants(wants.map(w => w.id === wantId ? { ...w, status: 'filled' } : w))
    if (selectedWant?.id === wantId) setSelectedWant({ ...selectedWant, status: 'filled' })
    setGlobalDeals(prev => prev + 1)
    showToast('Offer accepted!', 'success')
    const want = wants.find(w => w.id === wantId)
    if (acceptedOff?.seller_email && want) {
      sendEmailNotification(
        acceptedOff.seller_email,
        `Your offer was accepted on: ${want.title}`,
        `<p>Hi,</p><p>Great news — the buyer accepted your offer on <strong>${want.title}</strong>.</p><p>Log in to message them and sort out the details.</p><p>— The Offrit team</p>`
      )
    }
    // Trigger deal rating modal after a short pause
    if (acceptedOff?.seller_email) {
      setTimeout(() => setDealRatingModal({ email: acceptedOff.seller_email, wantTitle: want?.title }), 600)
    }
  }

  async function declineOffer(offerId) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    const res = await fetch(`${supabaseUrl}/rest/v1/offers?id=eq.${offerId}`, {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'declined' })
    })
    if (res.ok) {
      setOffers(offers.map(o => o.id === offerId ? { ...o, status: 'declined' } : o))
      showToast('Offer declined', 'warning')
    }
  }

  async function withdrawOffer(offerId) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    const res = await fetch(`${supabaseUrl}/rest/v1/offers?id=eq.${offerId}`, {
      method: 'DELETE',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      setMyOffers(myOffers.filter(o => o.id !== offerId))
      showToast('Offer withdrawn')
    }
  }

  async function saveEditWant() {
    if (!editTitle.trim() || !editModal) return
    setSavingEdit(true)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/wants?id=eq.${editModal.id}`, {
        method: 'PATCH',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ title: editTitle.trim(), description: editDescription, budget: editBudget, location: editLocation, category: editCategory, condition: editListingType === 'item' ? editCondition || null : null, negotiable: editNegotiable, listing_type: editListingType, estimated_hours: editListingType === 'service' ? editEstimatedHours || null : null })
      })
      if (!res.ok) throw new Error(res.status)
      const updated = { ...editModal, title: editTitle.trim(), description: editDescription, budget: editBudget, location: editLocation, category: editCategory, condition: editListingType === 'item' ? editCondition || null : null, negotiable: editNegotiable, listing_type: editListingType, estimated_hours: editListingType === 'service' ? editEstimatedHours || null : null }
      setWants(wants.map(w => w.id === editModal.id ? updated : w))
      if (selectedWant?.id === editModal.id) setSelectedWant(updated)
      setEditModal(null)
      showToast('Listing updated!', 'success')
    } catch (err) {
      console.error('[saveEditWant]', err)
      showToast('Failed to update listing', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  function openEditModal(want) {
    setEditModal(want)
    setEditTitle(want.title || '')
    setEditDescription(want.description || '')
    setEditBudget(want.budget || '')
    setEditLocation(want.location || '')
    setEditCategory(want.category || '')
    setEditCondition(want.condition || '')
    setEditNegotiable(want.negotiable || false)
    setEditListingType(want.listing_type || 'item')
    setEditEstimatedHours(want.estimated_hours || '')
  }

  async function sendPasswordReset() {
    if (!email) { setAuthError('Enter your email address first'); return }
    await supabase.auth.resetPasswordForEmail(email)
    setResetSent(true)
  }

  async function fetchInbox() {
    const { data } = await supabase.from('messages').select('*, offers(seller_email, price), wants(title)').order('created_at', { ascending: false })
    if (data) {
      const seen = new Set(); const threads = []
      data.forEach(m => { if (!seen.has(m.offer_id)) { seen.add(m.offer_id); threads.push(m) } })
      setMyInbox(threads)
      fetchAllProfiles([...new Set(data.map(m => m.sender_email).filter(Boolean))])
    }
  }

  async function fetchMessages(offerId) {
    const { data } = await supabase.from('messages').select('*').eq('offer_id', offerId).order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  async function openThread(offer, want) {
    scrollPos.current[page] = window.scrollY
    setNavStack(prev => [...prev, { page, selectedWant, profileEmail, activeThread }])
    const updatedSeen = new Set([...seenThreads, offer.id])
    setSeenThreads(updatedSeen)
    localStorage.setItem('seenThreads', JSON.stringify([...updatedSeen]))
    setActiveThread({ offer, want }); setMessages([]); await fetchMessages(offer.id); setPage('messages')
    window.scrollTo(0, 0)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !user || !activeThread) return
    setSendingMessage(true)
    const isOwner = activeThread.want.user_id === user.id
    const recipientEmail = isOwner ? activeThread.offer.seller_email : activeThread.want.user_email
    await supabase.from('messages').insert([{ offer_id: activeThread.offer.id, want_id: activeThread.want.id, sender_id: user.id, sender_email: user.email, recipient_email: recipientEmail, message: newMessage.trim() }])
    setNewMessage('')
    setSendingMessage(false)
    await fetchInbox()
    sendPushNotification(recipientEmail, `New message from @${getUsername(user.email)}`, newMessage.trim().slice(0, 80))
  }

  function rateLimited(key, ms = 8000) {
    const now = Date.now()
    if (lastSubmitRef.current[key] && now - lastSubmitRef.current[key] < ms) return true
    lastSubmitRef.current[key] = now
    return false
  }

  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB

  function handleImageSelect(e) {
    const valid = []
    for (const f of Array.from(e.target.files)) {
      if (!ALLOWED_IMAGE_TYPES.has(f.type)) { showToast(`${f.name} — only JPG, PNG, GIF, WebP allowed`); continue }
      if (f.size > MAX_IMAGE_SIZE) { showToast(`${f.name} is too large — max 5 MB per image`); continue }
      valid.push(f)
    }
    const files = valid.slice(0, 4)
    setImages(files)
    setImagePreviews(files.map(f => URL.createObjectURL(f)))
  }
  function removeImage(index) { setImages(images.filter((_, i) => i !== index)); setImagePreviews(imagePreviews.filter((_, i) => i !== index)) }

  async function handleAuth() {
    setAuthLoading(true); setAuthError('')
    const timeout = setTimeout(() => {
      setAuthLoading(false)
      setAuthError('Connection timed out — please try again')
    }, 12000)
    try {
      if (page === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        clearTimeout(timeout)
        if (error) setAuthError(error.message)
        else setPage('home')
      } else {
        if (!username.trim()) { clearTimeout(timeout); setAuthError('Please choose a username'); setAuthLoading(false); return }
        if (!agreedToTerms) { clearTimeout(timeout); setAuthError('Please agree to the Terms of Service and Privacy Policy to create an account'); setAuthLoading(false); return }
        const { data, error } = await supabase.auth.signUp({ email, password })
        clearTimeout(timeout)
        if (error) { setAuthError(error.message); setAuthLoading(false); return }
        if (data.user) {
          const refCode = generateRefCode()
          const referredBy = localStorage.getItem('offrit_ref') || null
          const { error: profileError } = await supabase.from('profiles').insert([{ id: data.user.id, username: username.trim().toLowerCase().replace(/\s+/g, '_'), email, referral_code: refCode, referred_by: referredBy }])
          if (profileError) { setAuthError('Username already taken — try another'); setAuthLoading(false); return }
          if (referredBy) localStorage.removeItem('offrit_ref')
        }
        setAuthError('Check your email to confirm your account!')
        setAgreedToTerms(false)
      }
    } catch {
      clearTimeout(timeout)
      setAuthError('Connection error — please try again')
    }
    setAuthLoading(false)
  }

  function handleLogout() { setUser(null); setPage('landing'); supabase.auth.signOut() }

  async function postWant() {
    if (!title || !user) return
    if (rateLimited('postWant', 15000)) { showToast('Please wait a moment before posting again', 'warning'); return }
    if (title.length > 120) { showToast('Title must be under 120 characters'); return }
    const _combined = (title + ' ' + description).toLowerCase()
    if (PROHIBITED_KEYWORDS.some(kw => _combined.includes(kw))) { showToast('This listing may contain prohibited content — please review our Terms of Service'); return }
    setPosting(true)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    const authHeaders = { apikey: supabaseKey, Authorization: `Bearer ${token}` }
    try {
      let imageUrls = []
      if (images.length > 0) {
        setUploadingImages(true)
        const tempId = crypto.randomUUID()
        for (const file of images) {
          const ext = file.name.split('.').pop()
          const path = tempId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
          const res = await fetch(`${supabaseUrl}/storage/v1/object/listing-images/${path}`, {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': file.type || 'application/octet-stream' },
            body: file
          })
          if (res.ok) {
            imageUrls.push(`${supabaseUrl}/storage/v1/object/public/listing-images/${path}`)
          }
        }
        setUploadingImages(false)
      }
      const res = await fetch(`${supabaseUrl}/rest/v1/wants`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ title, description, budget, location, category, condition: listingType === 'item' ? condition || null : null, negotiable, listing_type: listingType, estimated_hours: listingType === 'service' ? estimatedHours || null : null, user_id: user.id, user_email: user.email, images: imageUrls })
      })
      if (!res.ok) throw new Error(`Insert failed: ${res.status} ${await res.text()}`)
      const data = await res.json()
      const inserted = Array.isArray(data) ? data[0] : data
      if (inserted) { setWants([{ ...inserted, images: imageUrls }, ...wants]); setOfferCounts({ ...offerCounts, [inserted.id]: 0 }) }
      setTitle(''); setDescription(''); setBudget(''); setLocation(''); setCategory(''); setCondition(''); setNegotiable(false); setListingType('item'); setEstimatedHours(''); setImages([]); setImagePreviews([])
      setPage('home')
      showToast('Listing posted!', 'success')
    } catch (e) {
      console.error('[postWant] error:', e)
      showToast('Failed to post — please try again', 'error')
    } finally {
      setPosting(false)
      setUploadingImages(false)
    }
  }

  // ── Feature 1: Wishlist ──────────────────────────────
  async function fetchWishlists() {
    if (!user) return
    const { data } = await supabase.from('wishlists').select('want_id').eq('user_id', user.id)
    if (data) setWishlists(data.map(w => w.want_id))
  }

  async function toggleWishlist(e, wantId) {
    e.stopPropagation()
    if (!user) { setPage('login'); return }
    const isSaved = wishlists.includes(wantId)
    // Optimistic update — UI changes immediately
    if (isSaved) {
      setWishlists(wishlists.filter(id => id !== wantId))
      setSavedWants(savedWants.filter(w => w.id !== wantId))
      supabase.from('wishlists').delete().eq('user_id', user.id).eq('want_id', wantId)
    } else {
      setWishlists([...wishlists, wantId])
      const target = wants.find(w => w.id === wantId)
      if (target) setSavedWants([target, ...savedWants])
      supabase.from('wishlists').insert([{ user_id: user.id, want_id: wantId }])
    }
  }

  async function fetchSavedWants() {
    if (!user) return
    const { data } = await supabase.from('wishlists').select('want_id').eq('user_id', user.id)
    if (!data || data.length === 0) { setSavedWants([]); return }
    const ids = data.map(w => w.want_id)
    const { data: ws } = await supabase.from('wants').select('*').in('id', ids)
    if (ws) setSavedWants(ws)
  }

  // ── Feature 3: Counter-offer ─────────────────────────
  async function submitCounter(offerId) {
    setSubmittingCounter(true)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
    await fetch(`${supabaseUrl}/rest/v1/offers?id=eq.${offerId}`, { method: 'PATCH', headers, body: JSON.stringify({ counter_price: counterPrice, counter_message: counterNote, counter_status: 'pending' }) })
    setCounterModal(null); setCounterPrice(''); setCounterNote('')
    await fetchOffers(selectedWant.id)
    setSubmittingCounter(false)
    showToast('Counter sent!', 'success')
  }

  async function respondToCounter(offerId, accept) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
    await fetch(`${supabaseUrl}/rest/v1/offers?id=eq.${offerId}`, { method: 'PATCH', headers, body: JSON.stringify({ counter_status: accept ? 'accepted' : 'declined' }) })
    await fetchOffers(selectedWant.id)
    showToast(accept ? 'Counter accepted' : 'Counter declined')
  }

  // ── Feature 4: Recent searches ───────────────────────
  function saveSearch(term) {
    if (!term.trim()) return
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 10)
    setRecentSearches(updated)
    localStorage.setItem('offrit_recent_searches', JSON.stringify(updated))
  }

  function removeRecentSearch(term) {
    const updated = recentSearches.filter(s => s !== term)
    setRecentSearches(updated)
    localStorage.setItem('offrit_recent_searches', JSON.stringify(updated))
  }

  // ── Feature 5: Profile bio ───────────────────────────
  async function saveBio() {
    if (!user) return
    setSavingBio(true)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ bio: bioText })
      })
      if (!res.ok) throw new Error(res.status)
      setViewedProfile(prev => ({ ...prev, bio: bioText }))
      setMyProfile(prev => ({ ...prev, bio: bioText }))
      setEditingBio(false)
      showToast('Bio saved!', 'success')
    } catch (err) {
      console.error('[saveBio]', err)
      showToast('Failed to save bio')
    } finally {
      setSavingBio(false)
    }
  }

  // ── Feature 6: Keyword alerts & notifications ────────
  async function fetchKeywords() {
    if (!user) return
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/keyword_alerts?user_id=eq.${user.id}&order=created_at.desc`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
      })
      if (res.ok) setMyKeywords(await res.json())
    } catch (err) { console.error('[fetchKeywords]', err) }
  }

  async function fetchMyListings() {
    if (!user) return
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/wants?user_id=eq.${user.id}&order=created_at.desc&select=*`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } }
      )
      if (res.ok) {
        const data = await res.json()
        setMyListings(data)
        setWants(prev => {
          const ids = new Set(prev.map(w => w.id))
          const newOnes = data.filter(w => !ids.has(w.id))
          return newOnes.length ? [...prev, ...newOnes] : prev
        })
      }
    } catch (err) { console.error('[fetchMyListings]', err) }
  }

  async function fetchMyOffers() {
    if (!user) return
    setLoadingMyOffers(true)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/offers?seller_email=eq.${encodeURIComponent(user.email)}&order=created_at.desc&select=*,wants(id,title,status,user_email)`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } }
      )
      if (res.ok) setMyOffers(await res.json())
    } catch (err) { console.error('[fetchMyOffers]', err) }
    finally { setLoadingMyOffers(false) }
  }

  async function addKeyword() {
    if (!newKeyword.trim() || !user) return
    const kw = newKeyword.trim().toLowerCase()
    if (myKeywords.some(k => k.keyword === kw)) { showToast('Already added'); return }
    // Optimistic update immediately
    const tempId = 'tmp-' + Date.now()
    setMyKeywords(prev => [{ id: tempId, user_id: user.id, user_email: user.email, keyword: kw, created_at: new Date().toISOString() }, ...prev])
    setNewKeyword('')
    // Persist to DB in background
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/keyword_alerts`, {
        method: 'POST',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: user.id, user_email: user.email, keyword: kw })
      })
      if (res.ok) {
        const rows = await res.json()
        const realId = Array.isArray(rows) && rows[0]?.id
        if (realId) setMyKeywords(prev => prev.map(k => k.id === tempId ? { ...k, id: realId } : k))
      }
    } catch (err) {
      console.error('[addKeyword]', err)
    }
  }

  async function removeKeyword(id) {
    setMyKeywords(myKeywords.filter(k => k.id !== id))
    if (String(id).startsWith('tmp-')) return
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    fetch(`${supabaseUrl}/rest/v1/keyword_alerts?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
    }).catch(err => console.error('[removeKeyword]', err))
  }

  async function fetchNotifications() {
    if (!user) return
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).eq('read', false).order('created_at', { ascending: false })
    if (data) setNotifications(data)
  }

  async function markAllNotificationsRead() {
    if (!user || notifications.length === 0) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications([])
  }

  async function openNotificationWant(n) {
    await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    setNotifications(notifications.filter(x => x.id !== n.id))
    setShowNotifications(false)
    const target = wants.find(w => w.id === n.want_id)
    if (target) openWant(target)
  }

  // ── Feature 7: Near me ───────────────────────────────
  function activateNearMe() {
    if (nearMe) { setNearMe(false); setUserCity(null); setFilterLocation(''); return }
    if (!navigator.geolocation) { showToast('Geolocation not supported'); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        const cityCoords = {
          'Auckland': [-36.8485, 174.7633],
          'Wellington': [-41.2865, 174.7762],
          'Christchurch': [-43.5321, 172.6362],
          'Hamilton': [-37.7870, 175.2793],
          'Tauranga': [-37.6878, 176.1651],
          'Dunedin': [-45.8788, 170.5028],
          'Napier': [-39.4928, 176.9120],
          'Palmerston North': [-40.3523, 175.6082],
          'Rotorua': [-38.1368, 176.2497],
          'Nelson': [-41.2706, 173.2840],
          'New Plymouth': [-39.0556, 174.0752],
        }
        let closest = null, minDist = Infinity
        Object.entries(cityCoords).forEach(([city, [lat, lng]]) => {
          const dist = Math.hypot(latitude - lat, longitude - lng)
          if (dist < minDist) { minDist = dist; closest = city }
        })
        setUserCity(closest); setNearMe(true)
        if (closest) setFilterLocation(closest)
        showToast(`Showing listings near ${closest || 'you'}`)
      },
      () => showToast('Location access denied')
    )
  }

  // ── Feature 2: Offer expiry helpers ─────────────────
  function isOfferExpired(offer) {
    if (!offer.expires_at) return false
    return new Date(offer.expires_at) <= now
  }

  function offerTimeLeft(offer) {
    if (!offer.expires_at) return null
    const ms = new Date(offer.expires_at) - now
    if (ms <= 0) return null
    const hours = Math.floor(ms / 3600000)
    const mins = Math.floor((ms % 3600000) / 60000)
    if (hours >= 20) return null
    if (hours > 0) return `${hours}h ${mins}m left`
    return `${mins}m left`
  }

  async function deleteWant(wantId) {
    await supabase.from('wants').delete().eq('id', wantId)
    setWants(wants.filter(w => w.id !== wantId))
    if (selectedWant?.id === wantId) { setSelectedWant(null); setPage('home') }
  }

  async function markFilled(wantId) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    await fetch(`${supabaseUrl}/rest/v1/wants?id=eq.${wantId}`, {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'filled' })
    })
    setWants(wants.map(w => w.id === wantId ? { ...w, status: 'filled' } : w))
    if (selectedWant?.id === wantId) setSelectedWant({ ...selectedWant, status: 'filled' })
    setGlobalDeals(prev => prev + 1)
  }

  async function bumpListing(wantId) {
    const key = `offrit_bump_${wantId}`
    const last = Number(localStorage.getItem(key) || 0)
    const elapsed = Date.now() - last
    const cooldown = 24 * 60 * 60 * 1000
    if (last && elapsed < cooldown) {
      const hoursLeft = Math.ceil((cooldown - elapsed) / 3600000)
      showToast(`Can bump again in ${hoursLeft}h`)
      return
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    const bumpedAt = new Date().toISOString()
    const res = await fetch(`${supabaseUrl}/rest/v1/wants?id=eq.${wantId}`, {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ bumped_at: bumpedAt })
    })
    if (res.ok) {
      localStorage.setItem(key, Date.now())
      setWants(prev => prev.map(w => w.id === wantId ? { ...w, bumped_at: bumpedAt } : w))
      showToast('Listing bumped to top!', 'success')
    } else {
      showToast('Failed to bump — please try again', 'error')
    }
  }

  async function sendEmailNotification(to, subject, html) {
    const token = sessionRef.current?.access_token
    if (!token || !to) return
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { apikey: import.meta.env.VITE_SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html })
      })
    } catch (_) { /* silent */ }
  }

  async function submitOffer() {
    if (!offerMessage || !user) return
    if (rateLimited('submitOffer', 10000)) { showToast('Please wait before submitting another offer'); return }
    if (offerMessage.length > 2000) { showToast('Message too long — max 2000 characters'); return }
    setSubmittingOffer(true)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
    const token = sessionRef.current?.access_token
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
    const baseBody = { want_id: selectedWant.id, seller_email: user.email, price: offerPrice || null, message: offerMessage }
    try {
      // Try with expires_at first; fall back without it if column isn't set up
      let res = await fetch(`${supabaseUrl}/rest/v1/offers`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...baseBody, expires_at: new Date(Date.now() + 86400000).toISOString() })
      })
      if (!res.ok) {
        res = await fetch(`${supabaseUrl}/rest/v1/offers`, { method: 'POST', headers, body: JSON.stringify(baseBody) })
      }
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
      setOfferPrice(''); setOfferMessage('')
      fetchOffers(selectedWant.id)
      setOfferCounts({ ...offerCounts, [selectedWant.id]: (offerCounts[selectedWant.id] || 0) + 1 })
      showToast('Offer submitted!', 'success')
      if (myKeywords.length === 0) setTimeout(() => showToast('Tip: set up keyword alerts in Settings to find more listings like this', 'default'), 1800)
      sendEmailNotification(
        selectedWant.user_email,
        `New offer on your listing: ${selectedWant.title}`,
        `<p>Hi,</p><p>Someone made an offer on your Offrit listing <strong>${selectedWant.title}</strong>.</p>${offerPrice ? `<p>Offered price: <strong>$${offerPrice}</strong></p>` : ''}<p>Log in to view and respond.</p><p>— The Offrit team</p>`
      )
      sendPushNotification(selectedWant.user_email, 'New offer received', `${getUsername(user.email)} made an offer on: ${selectedWant.title}`)
    } catch (err) {
      console.error('[submitOffer]', err)
      showToast('Failed to submit offer', 'error')
    } finally {
      setSubmittingOffer(false)
    }
  }

  function openWant(want) {
    scrollPos.current[page] = window.scrollY
    window.history.pushState({ page: 'want' }, '')
    setNavStack(prev => [...prev, { page, selectedWant, profileEmail, activeThread }])
    let wantToShow = want
    if (want.user_id !== user?.id && !seenWants.has(want.id)) {
      wantToShow = { ...want, views: (want.views || 0) + 1 }
      const _u = import.meta.env.VITE_SUPABASE_URL, _k = import.meta.env.VITE_SUPABASE_KEY
      fetch(`${_u}/rest/v1/rpc/increment_want_views`, {
        method: 'POST',
        headers: { apikey: _k, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_want_id: want.id })
      })
      setWants(ws => ws.map(w => w.id === want.id ? wantToShow : w))
      const updatedSeen = new Set([...seenWants, want.id])
      setSeenWants(updatedSeen)
      localStorage.setItem('seenWants', JSON.stringify([...updatedSeen]))
    }
    setSelectedWant(wantToShow); setOffers([]); fetchOffers(want.id); setPage('want')
    window.scrollTo(0, 0)
    if (want.user_id === user?.id) {
      const updated = { ...seenOffers, [want.id]: offerCounts[want.id] || 0 }
      setSeenOffers(updated); localStorage.setItem('seenOffers', JSON.stringify(updated))
    }
  }

  function markAllOffersRead() {
    const updated = { ...seenOffers }
    myWants.forEach(w => { updated[w.id] = offerCounts[w.id] || 0 })
    setSeenOffers(updated)
    localStorage.setItem('seenOffers', JSON.stringify(updated))
    setShowOffersMenu(false)
  }

  function buildServerFilters() {
    if (!filterLocation && !filterCategory && !filterType && !nearMe) return {}
    const sf = { active: true }
    if (nearMe && userCity) sf.location = userCity
    else if (filterLocation) sf.location = filterLocation
    if (filterCategory) sf.category = filterCategory
    if (filterType) sf.listing_type = filterType
    return sf
  }

  async function pullToRefresh() {
    setRefreshing(true)
    await fetchWants(0, false, buildServerFilters())
    await fetchAllRatings()
    setRefreshing(false)
    showToast('Refreshed!')
  }

  // Pull to refresh handlers — pullStartRef is a ref (not state) so setting it
  // does not trigger a re-render and won't disrupt iOS Safari touch tracking.
  function onTouchStart(e) {
    if (window.scrollY === 0) pullStartRef.current = e.touches[0].clientY
  }
  function onTouchMove(e) {
    if (!pullStartRef.current) return
    const dist = e.touches[0].clientY - pullStartRef.current
    if (dist > 0) setPullDistance(Math.min(dist, 80))
  }
  function onTouchEnd() {
    if (pullDistance > 60) pullToRefresh()
    pullStartRef.current = null
    setPullDistance(0)
  }

  function getUsername(email) { return profiles[email] || email?.split('@')[0] || 'unknown' }

  const filteredWants = useMemo(() => wants.filter(w => {
    const locMatch = nearMe ? w.location === userCity : (!filterLocation || w.location === filterLocation)
    const catMatch = !filterCategory || w.category === filterCategory
    const searchMatch = !search || w.title.toLowerCase().includes(search.toLowerCase()) || (w.description || '').toLowerCase().includes(search.toLowerCase())
    const budgetMatch = !filterMaxBudget || (() => { const num = parseFloat((w.budget || '').replace(/[^0-9.]/g, '')); return !num || num <= parseFloat(filterMaxBudget) })()
    const typeMatch = !filterType || (w.listing_type || 'item') === filterType
    return locMatch && catMatch && searchMatch && budgetMatch && typeMatch
  }).sort((a, b) => {
    if (filterSort === 'newest') {
      const aTime = a.bumped_at ? new Date(a.bumped_at) : new Date(a.created_at)
      const bTime = b.bumped_at ? new Date(b.bumped_at) : new Date(b.created_at)
      return bTime - aTime
    }
    if (filterSort === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
    if (filterSort === 'most-offers') return (offerCounts[b.id] || 0) - (offerCounts[a.id] || 0)
    if (filterSort === 'budget-high') return parseFloat((b.budget || '').replace(/[^0-9.]/g, '') || 0) - parseFloat((a.budget || '').replace(/[^0-9.]/g, '') || 0)
    if (filterSort === 'budget-low') return parseFloat((a.budget || '').replace(/[^0-9.]/g, '') || 0) - parseFloat((b.budget || '').replace(/[^0-9.]/g, '') || 0)
    return 0
  }), [wants, nearMe, userCity, filterLocation, filterCategory, search, filterMaxBudget, filterType, filterSort, offerCounts])

  const myWants = useMemo(() => myListings.length ? myListings : wants.filter(w => w.user_id === user?.id), [myListings, wants, user])
  const myNewOffers = useMemo(() => myWants.reduce((sum, w) => { const current = offerCounts[w.id] || 0; const seen = seenOffers[w.id] || 0; return sum + Math.max(0, current - seen) }, 0), [myWants, offerCounts, seenOffers])
  const unreadMessages = useMemo(() => myInbox.filter(t => !seenThreads.has(t.offer_id)).length, [myInbox, seenThreads])
  const featuredWants = useMemo(() => [...wants].filter(w => (offerCounts[w.id] || 0) >= 1 && w.status !== 'filled').sort((a, b) => (offerCounts[b.id] || 0) - (offerCounts[a.id] || 0)).slice(0, 10), [wants, offerCounts])

  const C = dark ? {
    bg: '#111009', card: '#241E16', cardBorder: '#3A2F22', text: '#F0EBE0',
    textSub: '#C8BFB0', textMuted: '#8A7E6E', accentText: '#7FA8B8',
    headerBg: '#1A1612', navBg: '#1A1612',
  } : {
    bg: '#F6F4EE', card: '#FFFFFF', cardBorder: '#E8E2D5', text: '#16110A',
    textSub: '#3D3528', textMuted: '#7A6F5C', accentText: '#1E5470',
    headerBg: '#FFFFFF', navBg: '#FFFFFF',
  }
  const pageStyle = { minHeight: '100vh', background: 'transparent', color: C.text, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: user ? '72px' : '0', overflowX: 'hidden', width: '100%' }
  const inner = { maxWidth: '640px', margin: '0 auto', padding: '20px 16px', width: '100%', boxSizing: 'border-box' }

  function RatingBadge({ email, small = false }) {
    const r = allRatings[email]; if (!r) return null
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: small ? '11px' : '12px', color: '#F59E0B', fontWeight: '600' }}>★ {r.avg} <span style={{ color: '#7A6F5C', fontWeight: '400' }}>({r.count})</span></span>
  }

  function Avatar({ email, size = 48 }) {
    const name = getUsername(email)
    return <div style={{ width: size, height: size, borderRadius: '50%', background: '#1E5470', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.38, fontWeight: '700', flexShrink: 0 }}>{name ? name[0].toUpperCase() : '?'}</div>
  }

  const SideDecor = () => {
    const m1 = 'rgba(168,208,232,0.28)', m2 = 'rgba(80,148,188,0.44)', m3 = 'rgba(14,127,168,0.60)'
    const snow = 'rgba(242,252,255,0.92)'
    const moon = 'rgba(255,248,210,0.92)'
    return (
      <>
        <div className="side-decor side-decor-left" />
        <div className="side-decor side-decor-right" />
      </>
    )
  }

  const Header = ({ transparent = false } = {}) => (
    <>
      <div className="app-header" style={{ background: transparent ? 'transparent' : C.headerBg, borderBottom: transparent ? 'none' : `1px solid ${C.cardBorder}`, boxShadow: transparent ? 'none' : '0 1px 12px rgba(14,127,168,0.08)', padding: '0 16px', position: 'sticky', top: 0, zIndex: 20, width: '100%' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div onClick={() => setPage(user ? 'home' : 'landing')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <img src="/logo1.svg" alt="Offrit" style={{ height: 44, width: 'auto', borderRadius: 8, display: 'block' }} />
          </div>
          {user && (
            <div className="header-desktop-nav">
              <button className={`header-nav-btn${['home','want'].includes(page) ? ' active' : ''}`} onClick={() => { setPage('home'); setSelectedWant(null) }}>Browse</button>
              <button className={`header-nav-btn`} onClick={() => setPage('post')}>Post</button>
              <button className={`header-nav-btn${page === 'mylistings' ? ' active' : ''}`} onClick={() => setPage('mylistings')}>Profile</button>
              <button className={`header-nav-btn${['inbox','messages'].includes(page) ? ' active' : ''}`} onClick={() => setPage('inbox')}>
                Messages{unreadMessages > 0 ? ` (${unreadMessages})` : ''}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setDark(d => !d)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: transparent ? 'rgba(255,255,255,0.8)' : C.textMuted, display: 'flex', alignItems: 'center' }} title={dark ? 'Light mode' : 'Dark mode'}>
              {dark
                ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              }
            </button>
            {user && (
              <button onClick={() => setShowNotifications(n => !n)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: transparent ? 'rgba(255,255,255,0.8)' : C.textMuted, display: 'flex', alignItems: 'center', position: 'relative' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                {notifications.length > 0 && <span style={{ position: 'absolute', top: '4px', right: '4px', background: '#9B3232', color: '#fff', fontSize: '9px', fontWeight: '700', minWidth: '14px', height: '14px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{notifications.length}</span>}
              </button>
            )}
            {!user && page === 'landing' && <button className="btn btn-primary" onClick={() => setPage('login')} style={{ fontSize: '13px', padding: '8px 18px' }}>Log in</button>}
            {navStack.length > 0 && (page === 'want' || page === 'messages' || page === 'profile' || page === 'settings') && (
              <button className="btn" onClick={goBack}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
            )}
            {user && !['want','messages','profile','settings'].includes(page) && <button className="btn" onClick={handleLogout} style={{ fontSize: '12px' }}>Log out</button>}
          </div>
        </div>
      </div>
      {showNotifications && (
        <div className="notification-panel" style={{ position: 'fixed', top: '56px', left: 0, right: 0, zIndex: 19, padding: '0 16px' }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: '16px', padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: C.text }}>Notifications</span>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {notifications.length > 0 && <span onClick={markAllNotificationsRead} style={{ fontSize: '12px', color: '#1E5470', cursor: 'pointer', fontWeight: '500' }}>Mark all read</span>}
                  <span onClick={() => setShowNotifications(false)} style={{ fontSize: '20px', color: C.textMuted, cursor: 'pointer', lineHeight: 1 }}>×</span>
                </div>
              </div>
              {notifications.length === 0 && <p style={{ fontSize: '13px', color: C.textMuted, textAlign: 'center', padding: '12px 0' }}>No new notifications</p>}
              {notifications.map((n, i) => (
                <div key={n.id} onClick={() => openNotificationWant(n)} style={{ padding: '10px 0', borderTop: i === 0 ? `1px solid ${C.cardBorder}` : `1px solid ${C.cardBorder}`, cursor: 'pointer' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: C.text, marginBottom: '2px' }}>{n.title}</p>
                  <p style={{ fontSize: '12px', color: C.textSub }}>{n.body}</p>
                  <p style={{ fontSize: '11px', color: C.textMuted, marginTop: '3px' }}>{timeAgo(n.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )

  const BottomNav = () => {
    if (!user) return null
    return (
      <div className="bottom-nav-bar" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.navBg, borderTop: `1px solid ${C.cardBorder}`, zIndex: 10, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button className={`nav-btn${['home','want'].includes(page) ? ' active' : ''}`} onClick={() => { setPage('home'); setSelectedWant(null) }}>
          <svg fill="none" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span className="nav-label">Browse</span>
        </button>
        <button className="nav-btn" onClick={() => setPage('post')}>
          <div className="post-pill">+</div>
          <span className="nav-label">Post</span>
        </button>
        <button className={`nav-btn${page === 'mylistings' ? ' active' : ''}`} onClick={() => setPage('mylistings')} style={{ position: 'relative' }}>
          <svg fill="none" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {myNewOffers > 0 && <span style={{ position: 'absolute', top: '8px', right: 'calc(50% - 20px)', background: '#9B3232', color: '#fff', fontSize: '9px', fontWeight: '700', minWidth: '16px', height: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{myNewOffers}</span>}
          <span className="nav-label">Profile</span>
        </button>
        <button className={`nav-btn${['inbox','messages'].includes(page) ? ' active' : ''}`} onClick={() => setPage('inbox')} style={{ position: 'relative' }}>
          <svg fill="none" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          {unreadMessages > 0 && <span style={{ position: 'absolute', top: '8px', right: 'calc(50% - 20px)', background: '#9B3232', color: '#fff', fontSize: '9px', fontWeight: '700', minWidth: '16px', height: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unreadMessages}</span>}
          <span className="nav-label">Messages</span>
        </button>
      </div>
    )
  }

  const WantCard = ({ want, index = 0, noAnimate = false }) => {
    const hasImages = want.images && want.images.length > 0
    const username = getUsername(want.user_email)
    const SWATCH = { Electronics:'#D8E8F0','Sport & Outdoors':'#D4EAD8',Vehicles:'#E0DAD4',Furniture:'#EAE0D4',Clothing:'#EED4D8',Tools:'#EDE4D0',Music:'#E4D4EE',Other:'#E8E4DC' }
    const swatchBg = dark ? '#2A2218' : (want.listing_type === 'service' ? '#F5EBDF' : (SWATCH[want.category] || '#E8E4DC'))
    const swatchLetter = (want.category || want.listing_type || 'O')[0].toUpperCase()
    return (
      <div className={noAnimate ? 'card card-hover' : `card card-hover reveal delay-${(index % 3) + 1}`} onClick={() => openWant(want)} style={{ marginBottom: '8px', opacity: want.status === 'filled' ? 0.55 : 1, overflow: 'hidden', cursor: 'pointer', display: 'flex', minHeight: 100 }}>
        {/* Left thumb */}
        <div style={{ width: 88, flexShrink: 0, position: 'relative', overflow: 'hidden', borderRadius: '10px 0 0 10px', alignSelf: 'stretch' }}>
          {hasImages ? (
            <>
              <img src={want.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }} />
              {want.images.length > 1 && <div style={{ position: 'absolute', bottom: 5, right: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '1px 5px', fontSize: 9, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>+{want.images.length - 1}</div>}
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', background: swatchBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 30, color: dark ? '#8A7E6E' : '#9B8E7C', lineHeight: 1, fontStyle: 'italic' }}>{swatchLetter}</span>
            </div>
          )}
          {want.listing_type === 'service' && want.status !== 'filled' && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(160,82,45,0.85)', padding: '3px 0', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 600, color: '#fff', letterSpacing: '0.06em' }}>SVC</div>
          )}
        </div>
        {/* Right content */}
        <div style={{ flex: 1, padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: C.text, margin: 0, lineHeight: '1.3', textDecoration: want.status === 'filled' ? 'line-through' : 'none', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{titleCase(want.title)}</h3>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              {want.budget && <div style={{ fontFamily: "'Fraunces', serif", fontSize: '20px', fontWeight: '500', color: dark ? '#7FA8B8' : '#1E5470', lineHeight: 1 }}>{want.budget}</div>}
              <button onClick={e => toggleWishlist(e, want.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', display: 'block', marginLeft: 'auto' }}>
                <svg width="13" height="13" fill={wishlists.includes(want.id) ? '#9B3232' : 'none'} stroke={wishlists.includes(want.id) ? '#9B3232' : '#C0B9AE'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              </button>
            </div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1.4, flex: 1, marginBottom: 8 }}>
            {want.status === 'filled'
              ? <span style={{ color: '#9B3232', fontWeight: 600 }}>Filled · {new Date(want.updated_at || want.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</span>
              : <span style={{ color: '#7A6F5C' }}>{[want.location, want.listing_type === 'service' ? (want.estimated_hours || null) : (want.condition && !['any','unknown'].includes(want.condition.toLowerCase()) ? want.condition : null), want.category, timeAgo(want.created_at)].filter(Boolean).join(' · ')}</span>
            }
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.cardBorder}`, paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: '11px', color: offerCounts[want.id] ? '#3F6F4E' : '#7A6F5C', fontWeight: offerCounts[want.id] ? 600 : 400 }}>
                {offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers yet'}
              </span>
              {offerCounts[want.id] >= 3 && want.status !== 'filled' && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: 600, color: '#A86A1A', letterSpacing: '0.05em', textTransform: 'uppercase' }}>· Hot</span>}
            </div>
            {want.status !== 'filled' && <span style={{ fontSize: '11px', fontWeight: 600, color: dark ? '#7FA8B8' : '#1E5470' }}>Offer →</span>}
          </div>
        </div>
      </div>
    )
  }

  const FeaturedCard = ({ want }) => (
    <div onClick={() => openWant(want)} className="card-hover" style={{ flexShrink: 0, width: '172px', background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}>
      <div style={{ position: 'relative', width: '100%', height: '110px' }}>
        {want.images?.[0]
          ? <img src={want.images[0]} alt="" style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '110px', background: dark ? '#1E3A5F' : '#EAF0F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" fill="none" stroke="#1E5470" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ opacity: 0.4 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(15,32,48,0.45) 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '7px', right: '7px', background: '#3F6F4E', color: '#fff', fontSize: '10px', fontWeight: '700', borderRadius: '20px', padding: '2px 8px', letterSpacing: '0.01em' }}>
          {offerCounts[want.id]} offer{offerCounts[want.id] !== 1 ? 's' : ''}
        </div>
        <div style={{ position: 'absolute', bottom: '7px', left: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{want.location}</div>
      </div>
      <div style={{ padding: '9px 11px 11px' }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: C.text, lineHeight: '1.35', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: 0 }}>{want.title}</p>
      </div>
    </div>
  )

  const FeaturedSection = () => featuredWants.length === 0 ? null : (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: C.text }}>Most wanted</span>
        <span style={{ fontSize: '11px', color: C.textMuted }}>top {featuredWants.length}</span>
      </div>
      <div ref={setupScrollDrag} style={{ display: 'flex', gap: '10px', overflowX: 'scroll', WebkitOverflowScrolling: 'touch', paddingBottom: '6px', scrollbarWidth: 'none', msOverflowStyle: 'none', marginLeft: '-2px' }}>
        {featuredWants.map(w => <Fragment key={w.id}>{FeaturedCard({ want: w })}</Fragment>)}
      </div>
    </div>
  )

  const SearchFilters = () => {
    const sortLabels = { newest: 'NEWEST', oldest: 'OLDEST', 'most-offers': 'TOP', 'budget-high': 'HIGH $', 'budget-low': 'LOW $' }
    const locationLabel = nearMe ? 'NEAR ME' : (filterLocation || 'NZ-WIDE')
    const hasActiveFilters = filterMaxBudget || filterSort !== 'newest' || filterLocation || nearMe
    return (
      <div style={{ marginBottom: '16px' }} className="fade-up">
        <input
          placeholder={filterType === 'service' ? 'Search jobs…' : 'Search listings…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && search.trim()) saveSearch(search.trim()) }}
          style={{ marginBottom: recentSearches.length > 0 ? '6px' : '8px' }}
        />
        {recentSearches.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {recentSearches.map(s => (
              <div key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px 4px 12px', background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '20px', fontSize: '12px' }}>
                <span onClick={() => { setSearch(s); saveSearch(s) }} style={{ color: C.textSub, cursor: 'pointer' }}>{s}</span>
                <span onClick={e => { e.stopPropagation(); removeRecentSearch(s) }} style={{ color: C.textMuted, fontSize: '16px', lineHeight: '1', cursor: 'pointer', marginLeft: '2px' }}>×</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <button className="filter-toolbar-chip" onClick={() => { setShowBudgetDropdown(v => !v); setShowSortDropdown(false) }}>
            BUDGET <span>· {filterMaxBudget ? `≤$${filterMaxBudget}` : 'ANY'} ▾</span>
          </button>
          <button className="filter-toolbar-chip" onClick={() => { setShowSortDropdown(v => !v); setShowBudgetDropdown(false) }}>
            SORT <span>· {sortLabels[filterSort] || 'NEWEST'} ▾</span>
          </button>
          <button className="filter-toolbar-chip" onClick={() => { setShowLocationPicker(true); setShowBudgetDropdown(false); setShowSortDropdown(false) }}>
            📍 <span>{locationLabel} ▾</span>
          </button>
          {hasActiveFilters && (
            <button onClick={() => { setFilterMaxBudget(''); setFilterSort('newest'); setFilterLocation(''); setNearMe(false); setUserCity(null) }} style={{ background: 'transparent', border: 'none', padding: '8px 4px', color: dark ? C.accentText : '#1E5470', cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, letterSpacing: '0.04em' }}>Reset</button>
          )}
        </div>
        {showBudgetDropdown && (
          <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="Max budget e.g. 500" value={filterMaxBudget} onChange={e => setFilterMaxBudget(e.target.value)} style={{ flex: 1 }} autoFocus onBlur={() => setShowBudgetDropdown(false)} />
          </div>
        )}
        {showSortDropdown && (
          <div style={{ marginBottom: 8 }}>
            <select value={filterSort} onChange={e => { setFilterSort(e.target.value); setShowSortDropdown(false) }} style={{ width: '100%' }} autoFocus onBlur={() => setShowSortDropdown(false)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="most-offers">Most offers</option>
              <option value="budget-high">Budget: high–low</option>
              <option value="budget-low">Budget: low–high</option>
            </select>
          </div>
        )}
        <div className="filter-divider" />
        <div ref={setupScrollDrag} className="chips-row">
          <span className={`filter-chip ${!filterType && !filterCategory ? 'active' : ''}`} onClick={() => { setFilterType(''); setFilterCategory('') }}>All</span>
          <span className={`filter-chip ${filterType === 'item' && !filterCategory ? 'active' : ''}`} onClick={() => { setFilterType(filterType === 'item' ? '' : 'item'); setFilterCategory('') }}>Items</span>
          <span className={`filter-chip ${filterType === 'service' && !filterCategory ? 'active' : ''}`} onClick={() => { setFilterType(filterType === 'service' ? '' : 'service'); setFilterCategory('') }}>Services</span>
          {(filterType === 'service' ? serviceCategories : filterType === 'item' ? categories : [...categories, ...serviceCategories.filter(c => !categories.includes(c))]).map(c => <span key={c} className={`filter-chip ${filterCategory === c ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === c ? '' : c)}>{c}</span>)}
        </div>
      </div>
    )
  }

  const ImageUploader = () => (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageSelect} />
      {imagePreviews.length === 0 ? (
        <div className="img-upload-area" onClick={() => fileInputRef.current.click()}>
          <svg width="28" height="28" fill="none" stroke="#8FA5B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ marginBottom: '8px' }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <p style={{ fontSize: '13px', color: '#7A6F5C', margin: 0 }}>Add photos <span style={{ color: '#1E5470', fontWeight: '600' }}>Browse</span></p>
          <p style={{ fontSize: '11px', color: '#B0C4D4', marginTop: '4px' }}>Up to 4 images</p>
        </div>
      ) : (
        <div className="img-gallery">
          {imagePreviews.map((src, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={src} className="img-thumb" alt="" />
              <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#DC2626', border: 'none', color: '#fff', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
            </div>
          ))}
          {imagePreviews.length < 4 && <div onClick={() => fileInputRef.current.click()} style={{ width: '80px', height: '80px', border: '2px dashed #C8DCE8', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#F5F9FC' }}><span style={{ fontSize: '22px', color: '#8FA5B8' }}>+</span></div>}
        </div>
      )}
    </div>
  )

  const Lightbox = () => {
    if (!lightboxImg) return null
    return <div className="img-lightbox" onClick={() => setLightboxImg(null)}><img src={lightboxImg} alt="" /></div>
  }

  const CounterModal = () => {
    if (!counterModal) return null
    return (
      <div className="modal-overlay" onClick={() => setCounterModal(null)}>
        <div className="modal" style={{ background: C.card }} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px', color: C.text }}>Counter offer</h3>
          <p style={{ fontSize: '13px', color: C.textMuted, marginBottom: '16px' }}>Suggest a different price to the seller</p>
          <input placeholder="Your counter price — e.g. $180" value={counterPrice} onChange={e => setCounterPrice(e.target.value)} style={{ marginBottom: '10px' }} />
          <textarea placeholder="Note (optional)" value={counterNote} onChange={e => setCounterNote(e.target.value)} rows={2} style={{ marginBottom: '16px', resize: 'none' }} />
          <button className="btn btn-primary" onClick={() => submitCounter(counterModal.id)} disabled={!counterPrice || submittingCounter} style={{ width: '100%', padding: '13px', marginBottom: '8px' }}>
            {submittingCounter ? 'Sending…' : 'Send counter'}
          </button>
          <button className="btn" onClick={() => setCounterModal(null)} style={{ width: '100%', padding: '12px' }}>Cancel</button>
        </div>
      </div>
    )
  }

  const ReportModal = () => {
    if (!reportModal) return null
    return (
      <div className="modal-overlay" onClick={() => { setReportModal(null); setReportReason(''); setReportDetails('') }}>
        <div className="modal" style={{ background: C.card, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px', color: C.text }}>Report listing</h3>
          <p style={{ fontSize: '13px', color: C.textMuted, marginBottom: '16px' }}>Why are you reporting "{reportModal.title}"?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {reportReasons.map(r => (
              <div key={r} onClick={() => setReportReason(r)} style={{ padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${reportReason === r ? '#1E5470' : C.cardBorder}`, background: reportReason === r ? (dark ? 'rgba(30,84,112,0.18)' : '#EAF0F4') : C.card, cursor: 'pointer', fontSize: '14px', color: reportReason === r ? '#1E5470' : C.text, fontWeight: reportReason === r ? '600' : '400' }}>
                {r}
              </div>
            ))}
          </div>
          <textarea placeholder="Additional details (optional but helpful)" value={reportDetails} onChange={e => setReportDetails(e.target.value)} rows={2} style={{ marginBottom: '12px', resize: 'none' }} maxLength={500} />
          <div style={{ background: dark ? '#0A1E35' : '#F0F4F8', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: C.textMuted, lineHeight: 1.6 }}>
            Reports are reviewed within 48 hours. If the content violates our Terms of Service it will be removed. Serious threats or illegal content are referred to NZ Police and the Department of Internal Affairs.
          </div>
          <button className="btn btn-primary" onClick={submitReport} disabled={!reportReason || submittingReport} style={{ width: '100%', padding: '13px' }}>
            {submittingReport ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </div>
    )
  }

  const EditModal = () => {
    if (!editModal) return null
    return (
      <div className="modal-overlay" onClick={() => setEditModal(null)}>
        <div className="modal" style={{ background: C.card, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px', color: C.text }}>Edit listing</h3>
          <p style={{ fontSize: '13px', color: C.textMuted, marginBottom: '12px' }}>Update your listing details</p>
          <div style={{ display: 'flex', gap: '0', marginBottom: '14px', border: `1.5px solid ${C.cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
            <button onClick={() => setEditListingType('item')} style={{ flex: 1, padding: '9px', background: editListingType === 'item' ? '#1E5470' : C.card, color: editListingType === 'item' ? '#fff' : C.textSub, border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: "'Inter', system-ui, sans-serif" }}>Item</button>
            <button onClick={() => setEditListingType('service')} style={{ flex: 1, padding: '9px', background: editListingType === 'service' ? '#A0522D' : C.card, color: editListingType === 'service' ? '#fff' : C.textSub, border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: "'Inter', system-ui, sans-serif", borderLeft: `1px solid ${C.cardBorder}` }}>Service</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            <input placeholder="Title" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            <textarea placeholder="Description (optional)" value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} style={{ resize: 'none' }} />
            <input placeholder={editListingType === 'service' ? 'Budget — e.g. $50 cash' : 'Max budget — e.g. $300'} value={editBudget} onChange={e => setEditBudget(e.target.value)} />
            <select value={editLocation} onChange={e => setEditLocation(e.target.value)}>
              <option value="">Location</option>
              {locations.map(l => <option key={l}>{l}</option>)}
            </select>
            <select value={editCategory} onChange={e => setEditCategory(e.target.value)}>
              <option value="">Category</option>
              {(editListingType === 'service' ? serviceCategories : categories).map(c => <option key={c}>{c}</option>)}
            </select>
            {editListingType === 'service' ? (
              <input placeholder="Estimated time — e.g. 2 hours, half day" value={editEstimatedHours} onChange={e => setEditEstimatedHours(e.target.value)} />
            ) : (
              <select value={editCondition} onChange={e => setEditCondition(e.target.value)}>
                <option value="">Condition (optional)</option>
                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <div onClick={() => setEditNegotiable(n => !n)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: C.text }}>
              <div style={{ width: '20px', height: '20px', flexShrink: 0, borderRadius: '5px', border: `2px solid ${editNegotiable ? '#1E5470' : '#E8E2D5'}`, background: editNegotiable ? '#1E5470' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                {editNegotiable && <svg width="11" height="11" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              Flexible budget
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveEditWant} disabled={!editTitle.trim() || savingEdit} style={{ width: '100%', padding: '13px', marginBottom: '8px' }}>
            {savingEdit ? 'Saving…' : 'Save changes'}
          </button>
          <button className="btn" onClick={() => setEditModal(null)} style={{ width: '100%', padding: '12px' }}>Cancel</button>
        </div>
      </div>
    )
  }

  const LocationPicker = () => {
    if (!showLocationPicker) return null
    return (
      <div className="modal-overlay" onClick={() => setShowLocationPicker(false)}>
        <div className="modal" style={{ background: C.card, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: C.text }}>Choose location</h3>
            <button onClick={() => setShowLocationPicker(false)} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: C.textMuted }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => { activateNearMe(); setShowLocationPicker(false) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: '12px', border: `1.5px solid ${nearMe ? '#1E5470' : C.cardBorder}`, background: nearMe ? (dark ? 'rgba(30,84,112,0.15)' : '#EAF0F4') : C.card, cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: nearMe ? '#1E5470' : C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
              📍 Near me
              {nearMe && <svg width="14" height="14" fill="none" stroke="#1E5470" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
            <button
              onClick={() => { setFilterLocation(''); setNearMe(false); setUserCity(null); setShowLocationPicker(false) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: '12px', border: `1.5px solid ${!filterLocation && !nearMe ? '#1E5470' : C.cardBorder}`, background: !filterLocation && !nearMe ? (dark ? 'rgba(30,84,112,0.15)' : '#EAF0F4') : C.card, cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: !filterLocation && !nearMe ? '#1E5470' : C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
              All of New Zealand
              {!filterLocation && !nearMe && <svg width="14" height="14" fill="none" stroke="#1E5470" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
            {locations.map(l => (
              <button key={l}
                onClick={() => { setFilterLocation(l); setNearMe(false); setUserCity(null); setShowLocationPicker(false) }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: '12px', border: `1.5px solid ${filterLocation === l && !nearMe ? '#1E5470' : C.cardBorder}`, background: filterLocation === l && !nearMe ? (dark ? 'rgba(30,84,112,0.15)' : '#EAF0F4') : C.card, cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: filterLocation === l && !nearMe ? '#1E5470' : C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
                {l}
                {filterLocation === l && !nearMe && <svg width="14" height="14" fill="none" stroke="#1E5470" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const DealRatingModal = () => {
    if (!dealRatingModal) return null
    const username = getUsername(dealRatingModal.email)
    return (
      <div className="modal-overlay" onClick={() => { setDealRatingModal(null); setDealRatingScore(0) }}>
        <div className="modal" style={{ background: C.card }} onClick={e => e.stopPropagation()}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1E5470', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: '700', margin: '0 auto 14px' }}>
              {username?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: C.text, marginBottom: '6px' }}>Deal confirmed!</div>
            <p style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.5 }}>How was your experience with <strong>@{username}</strong>?</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '22px' }}>
            {StarRating({ score: dealRatingScore, onSelect: setDealRatingScore, size: 34 })}
          </div>
          <button className="btn btn-primary" onClick={submitDealRating} disabled={!dealRatingScore || submittingDealRating} style={{ width: '100%', padding: '13px', marginBottom: '8px', fontSize: '14px' }}>
            {submittingDealRating ? 'Submitting…' : 'Submit rating'}
          </button>
          <button className="btn" onClick={() => { setDealRatingModal(null); setDealRatingScore(0) }} style={{ width: '100%', padding: '12px', fontSize: '13px' }}>Skip for now</button>
        </div>
      </div>
    )
  }

  // LEGAL PAGES
  if (page === 'terms' || page === 'privacy') {
    const isTerms = page === 'terms'
    const sections = isTerms ? [
      { title: '1. Who we are', body: 'Offrit is a New Zealand online marketplace where buyers post what they want and sellers make offers. We connect buyers and sellers — we are not a party to any transaction.' },
      { title: '2. Eligibility', body: 'You must be 18 years or older to use Offrit. By creating an account you confirm you are at least 18. Accounts found to belong to minors will be terminated.' },
      { title: '3. Your account', body: 'You are responsible for keeping your login credentials secure and for all activity under your account. Notify us immediately at support@offrit.com if you suspect unauthorised access.' },
      { title: '4. What you can post', body: 'Listings must be accurate and honest. You must not post anything misleading, offensive, harmful, or illegal. Offrit reserves the right to remove any listing at any time without notice.' },
      { title: '5. Prohibited items and services', body: 'The following are strictly prohibited: illegal drugs and controlled substances; firearms, ammunition, and weapons (unless lawfully traded); prescription-only medicines; stolen or counterfeit goods; intellectual property you do not own; adult or sexual services; content that is objectionable under NZ law; any good or service whose sale or advertisement is illegal in New Zealand.' },
      { title: '6. Licensed trades', body: 'Electrical, gas fitting, and plumbing work in New Zealand must be carried out by licensed tradespeople under the Electricity Act 1992, Gas Act 1992, and Plumbers, Gasfitters, and Drainlayers Act 2006. Posting a want for such work is permitted; however you must hire a licensed professional to complete it.' },
      { title: '7. Offrit is a connector, not a supplier', body: 'Offrit does not sell goods or provide services. All transactions occur directly between buyers and sellers off-platform. Offrit is not liable for the quality, safety, legality, or delivery of any goods or services listed. The Consumer Guarantees Act 1993 obligations rest with the individual seller, not Offrit.' },
      { title: '8. Payments', body: 'Offrit does not process payments. All payment arrangements are made directly between buyers and sellers. Offrit is not responsible for any payment disputes.' },
      { title: '9. Tax obligations', body: 'Sellers are solely responsible for their own income tax, GST, and any other tax obligations arising from transactions facilitated through Offrit. Offrit may be required under NZ law to report seller information to Inland Revenue.' },
      { title: '10. Harmful content', body: 'Offrit complies with the Harmful Digital Communications Act 2015. To report harmful content, use the Report button on any listing or email support@offrit.com. We review reports within 48 hours. Objectionable content as defined by the Films, Videos, and Publications Classification Act 1993 will be removed immediately and referred to the Department of Internal Affairs and/or NZ Police.' },
      { title: '11. Limitation of liability', body: 'To the fullest extent permitted by New Zealand law, Offrit\'s liability for any claim arising from your use of the platform is limited to NZ$100. Offrit is not liable for indirect, incidental, or consequential damages.' },
      { title: '12. Governing law', body: 'These Terms are governed by the laws of New Zealand. Any disputes will be resolved under New Zealand jurisdiction.' },
      { title: '13. Changes to these terms', body: 'We may update these Terms from time to time. Continued use of Offrit after changes are posted constitutes acceptance of the updated Terms.' },
      { title: '14. Contact', body: 'Questions about these Terms? Email us at support@offrit.com.' },
    ] : [
      { title: '1. Who we are', body: 'Offrit Limited ("Offrit", "we", "us") operates the Offrit marketplace at offrit.com. We are the "agency" responsible for your personal information under the New Zealand Privacy Act 2020.' },
      { title: '2. What we collect', body: 'We collect: your email address and password (for your account); a username and optional bio (for your public profile); your city or region (to match you with local listings); listing content including text, images, and budget; messages sent via our platform; device and usage data (browser type, pages visited) via our hosting provider.' },
      { title: '3. Why we collect it', body: 'We use your information to: operate your account and the marketplace; display your public profile to other users; match you with relevant listings; send you notifications you have opted into; meet our legal obligations including tax reporting to Inland Revenue under NZ platform economy rules.' },
      { title: '4. Who we share it with', body: 'We share your information with: Supabase Inc. (our database and authentication provider, hosted in the United States); other users, to the extent you make it public (username, bio, listings, ratings). We do not sell your personal information. We may disclose your information to law enforcement or government agencies if required by law.' },
      { title: '5. Overseas storage', body: 'Your data is stored with Supabase Inc. in the United States. Supabase maintains SOC 2 Type II certification. By using Offrit you consent to this transfer under Information Privacy Principle 12 of the Privacy Act 2020.' },
      { title: '6. IRD number', body: 'If you provide your IRD number in Settings, it is stored securely and used solely for the purpose of meeting Offrit\'s Digital Platform Information (DPI) reporting obligations to Inland Revenue under the Tax Administration Act 1994. It is never displayed publicly.' },
      { title: '7. How long we keep it', body: 'Account data is retained for as long as your account is active. Deleted listings are removed from public view immediately but may be retained in backups for up to 90 days. You may request deletion of your account and associated data at any time by emailing support@offrit.com.' },
      { title: '8. Your rights', body: 'Under the Privacy Act 2020 you have the right to: access the personal information we hold about you; request correction of inaccurate information; ask us to delete your information (subject to legal retention obligations). To exercise these rights, email privacy@offrit.com. We will respond within 20 working days.' },
      { title: '9. Security', body: 'We take reasonable steps to protect your information, including encrypted storage, access controls, and row-level security on our database. If a breach occurs that is reasonably likely to cause you serious harm, we will notify you and the Office of the Privacy Commissioner as required by law.' },
      { title: '10. Privacy Officer', body: 'Our Privacy Officer can be contacted at privacy@offrit.com. This is the correct contact for all privacy-related requests.' },
      { title: '11. Updates', body: 'We may update this policy from time to time. The date at the bottom of this page reflects the most recent update. Continued use of Offrit after an update constitutes acceptance of the revised policy.' },
      { title: '12. Complaints', body: 'If you believe we have breached the Privacy Act 2020, you may complain to the Office of the Privacy Commissioner at privacy.org.nz.' },
    ]
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        {Header({ transparent: false })}
        <div style={{ ...inner, paddingBottom: '40px' }}>
          <button className="btn" onClick={goBack} style={{ marginBottom: '20px', fontSize: '13px' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: C.text, marginBottom: '6px' }}>
            {isTerms ? 'Terms of Service' : 'Privacy Policy'}
          </h1>
          <p style={{ fontSize: '12px', color: C.textMuted, marginBottom: '28px' }}>Last updated April 2025 · Offrit NZ</p>
          {sections.map((s, i) => (
            <div key={i} style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: C.text, marginBottom: '6px' }}>{s.title}</h3>
              <p style={{ fontSize: '14px', color: C.textSub, lineHeight: '1.7' }}>{s.body}</p>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.cardBorder}`, paddingTop: '20px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <span onClick={() => setPage('terms')} style={{ fontSize: '13px', color: isTerms ? C.accentText : C.textMuted, cursor: 'pointer', fontWeight: isTerms ? '600' : '400' }}>Terms of Service</span>
            <span style={{ fontSize: '13px', color: C.cardBorder }}>·</span>
            <span onClick={() => setPage('privacy')} style={{ fontSize: '13px', color: !isTerms ? C.accentText : C.textMuted, cursor: 'pointer', fontWeight: !isTerms ? '600' : '400' }}>Privacy Policy</span>
          </div>
        </div>
      </div>
    )
  }

  // LANDING PAGE
  if (page === 'landing') {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', color: C.text, fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden', position: 'relative', width: '100%' }}>
        <style>{styles}</style>
        <div style={{ position: 'relative', width: '100%' }}>
          {Header()}
          <div className="hero" style={{ width: '100%', boxSizing: 'border-box' }}>
            <div className="hero-content">
              <div className="hero-headline gsap-h1">Tell us what<br />you need.</div>
              <p className="hero-sub gsap-h2">Post once. Sellers across NZ come to you with offers.</p>
              <div className="gsap-h3" style={{ marginBottom: '40px' }}>
                <button className="btn-primary btn btn-hero" onClick={() => setPage('signup')} style={{ padding: '18px 48px', fontSize: '17px', borderRadius: '12px', fontWeight: '700', letterSpacing: '-0.2px' }}>Post what you need</button>
                <button onClick={() => setPage('login')} style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>or browse listings ↓</button>
              </div>
            </div>
            <svg viewBox="0 0 1440 56" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '56px', marginTop: '40px', marginBottom: '-1px' }}>
              <path d="M0,28 C240,56 480,0 720,28 C960,56 1200,0 1440,28 L1440,56 L0,56 Z" fill={C.card}/>
            </svg>
          </div>
        </div>

        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 0' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: '600', color: C.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Live right now</div>
          {loading ? SkeletonCard({ hasImage: true }) : wants[0] ? WantCard({ want: wants[0], index: 0, noAnimate: true }) : null}
        </div>

        <div style={{ padding: '36px 16px 8px', maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }} className="reveal">
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.2px', color: C.textMuted, marginBottom: '8px' }}>Simple by design</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: C.text, lineHeight: 1.2 }}>How it works</div>
          </div>
          {[
            {
              num: '01',
              icon: <svg width="22" height="22" fill="none" stroke="#1E5470" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>,
              title: 'Post what you want',
              desc: 'Describe what you need and your budget. Takes less than a minute.',
              delay: 'delay-1'
            },
            {
              num: '02',
              icon: <svg width="22" height="22" fill="none" stroke="#1E5470" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>,
              title: 'Receive offers',
              desc: 'Sellers nearby send you their best deals. No cold searching required.',
              delay: 'delay-2'
            },
            {
              num: '03',
              icon: <svg width="22" height="22" fill="none" stroke="#1E5470" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
              title: 'Choose the best one',
              desc: 'Compare offers, message the seller, and close on your terms.',
              delay: 'delay-3'
            }
          ].map(({ num, icon, title, desc, delay }) => (
            <div key={num} className={`gsap-reveal`} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '20px 22px', background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: '16px', marginBottom: '10px', boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: dark ? 'rgba(30,84,112,0.10)' : '#EAF0F4', border: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: C.text }}>{title}</div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#1E5470', background: 'rgba(30,84,112,0.1)', borderRadius: '6px', padding: '2px 6px', letterSpacing: '0.5px' }}>{num}</div>
                </div>
                <div style={{ fontSize: '13px', color: C.textMuted, lineHeight: 1.55 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '32px 16px 8px', maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }} className="reveal">
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.2px', color: C.textMuted, marginBottom: '8px' }}>The smarter way to buy</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: C.text, lineHeight: 1.2 }}>Why use Offrit?</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '8px' }}>
            {[
              { icon: <svg width="20" height="20" fill="none" stroke="#1E5470" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>, title: 'No more searching', desc: 'Stop scrolling listings that don\'t match. Post once, done.' },
              { icon: <svg width="20" height="20" fill="none" stroke="#0E9A6E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>, title: 'Better deals', desc: 'Sellers compete for your business. You pick the best.' },
              { icon: <svg width="20" height="20" fill="none" stroke="#A0522D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>, title: 'Local & fast', desc: 'Connect with sellers near you across every city in New Zealand.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="gsap-reveal card" style={{ padding: '18px 14px', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: dark ? 'rgba(30,84,112,0.12)' : '#EAF0F4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>{icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: C.text, marginBottom: '5px', lineHeight: 1.3 }}>{title}</div>
                <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px 16px 24px', width: '100%', boxSizing: 'border-box' }}>
          {FeaturedSection()}
          <div className="gsap-reveal" onClick={() => { setFilterType('service'); setPage('browse') }} style={{ background: '#A0522D', borderRadius: '12px', padding: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '5px' }}>New on Offrit</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '5px' }}>Cashies &amp; Services</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.45' }}>Lawn mowing, cleaning, removals &amp; more. Post a job, get offers from locals.</div>
            </div>
            <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>Browse →</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: C.text }}>See what people want</span>
            {wants.length > 0 && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#7A6F5C', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{wants.length} live</span>}
          </div>
          {loading ? [1,2,3].map(i => <SkeletonCard key={i} hasImage={i !== 2} />) : wants.slice(0, 6).map((want, i) => <Fragment key={want.id}>{WantCard({ want, index: i, noAnimate: true })}</Fragment>)}
          {wants.length > 6 && <button className="btn" onClick={() => setPage('browse')} style={{ width: '100%', padding: '13px', marginTop: '4px', fontSize: '14px' }}>View all {wants.length} listings →</button>}
        </div>

        <div style={{ background: '#16110A', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '28px', fontStyle: 'italic', color: '#F6F4EE', marginBottom: '10px', lineHeight: 1.2 }}>Ready to get offers?</div>
          <p style={{ fontSize: '14px', color: 'rgba(246,244,238,0.65)', marginBottom: '24px', lineHeight: 1.6 }}>Post what you need — free, no account required to browse.</p>
          <button onClick={() => setPage('signup')} style={{ background: '#F6F4EE', color: '#16110A', border: 'none', padding: '15px 36px', fontSize: '15px', fontWeight: '700', borderRadius: '8px', cursor: 'pointer', letterSpacing: '-0.2px' }}>Post your first want →</button>
        </div>

        <div style={{ borderTop: `1px solid ${C.cardBorder}`, padding: '20px 16px', display: 'flex', justifyContent: 'center', gap: '20px', background: C.card }}>
          <span onClick={() => setPage('terms')} style={{ fontSize: '12px', color: C.textMuted, cursor: 'pointer' }}>Terms of Service</span>
          <span style={{ fontSize: '12px', color: C.cardBorder }}>·</span>
          <span onClick={() => setPage('privacy')} style={{ fontSize: '12px', color: C.textMuted, cursor: 'pointer' }}>Privacy Policy</span>
          <span style={{ fontSize: '12px', color: C.cardBorder }}>·</span>
          <span style={{ fontSize: '12px', color: C.textMuted }}>© 2025 Offrit NZ</span>
        </div>
      </div>
    )
  }

  // AUTH PAGE
  if (page === 'login' || page === 'signup') {
    const mode = page
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        {Header()}
        <div style={inner}>
          <div className="card fade-up" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '6px', color: C.text }}>
              {mode === 'login' ? 'Welcome back' : 'Join Offrit'}
            </h2>
            <p style={{ fontSize: '13px', color: C.textMuted, marginBottom: '24px' }}>
              {mode === 'login' ? 'Log in to post and manage your listings' : 'Create an account and start getting offers'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {mode === 'signup' && <input placeholder="Username e.g. johndoe" value={username} onChange={e => setUsername(e.target.value)} maxLength={30} />}
              <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" />
              <input placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} type="password" />
              {mode === 'signup' && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: dark ? '#0A1E35' : '#F5F3EE', borderRadius: '10px', border: `1.5px solid ${agreedToTerms ? '#1E5470' : C.cardBorder}` }}>
                  <div onClick={() => setAgreedToTerms(v => !v)} style={{ width: '18px', height: '18px', flexShrink: 0, borderRadius: '5px', border: `2px solid ${agreedToTerms ? '#1E5470' : '#E8E2D5'}`, background: agreedToTerms ? '#1E5470' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '1px', transition: 'all 0.15s' }}>
                    {agreedToTerms && <svg width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.55, cursor: 'pointer' }} onClick={() => setAgreedToTerms(v => !v)}>
                    I am 18 or over and agree to the{' '}
                    <span onClick={e => { e.stopPropagation(); setPage('terms') }} style={{ color: '#1E5470', fontWeight: '600', cursor: 'pointer' }}>Terms of Service</span>
                    {' '}and{' '}
                    <span onClick={e => { e.stopPropagation(); setPage('privacy') }} style={{ color: '#1E5470', fontWeight: '600', cursor: 'pointer' }}>Privacy Policy</span>
                  </span>
                </div>
              )}
            </div>
            {mode === 'login' && (
              <p style={{ fontSize: '12px', textAlign: 'right', marginBottom: '14px', marginTop: '-8px' }}>
                {resetSent
                  ? <span style={{ color: '#0E9A6E' }}>Reset email sent — check your inbox</span>
                  : <span onClick={sendPasswordReset} style={{ color: '#1E5470', cursor: 'pointer', fontWeight: '500' }}>Forgot password?</span>
                }
              </p>
            )}
            {authError && <p style={{ fontSize: '13px', color: authError.includes('Check') ? '#0E9A6E' : '#DC2626', marginBottom: '14px', fontWeight: '500' }}>{authError}</p>}
            <button className="btn btn-primary" onClick={handleAuth} disabled={authLoading} style={{ width: '100%', padding: '14px', fontSize: '14px', marginBottom: '16px' }}>
              {authLoading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
            <p style={{ fontSize: '13px', color: C.textMuted, textAlign: 'center' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span onClick={() => { setPage(mode === 'login' ? 'signup' : 'login'); setAuthError(''); setResetSent(false); setAgreedToTerms(false) }} style={{ color: '#1E5470', fontWeight: '600', cursor: 'pointer' }}>
                {mode === 'login' ? 'Sign up free' : 'Log in'}
              </span>
            </p>
          </div>
          <div style={{ textAlign: 'center', marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <span onClick={() => setPage('terms')} style={{ fontSize: '12px', color: C.textMuted, cursor: 'pointer' }}>Terms of Service</span>
            <span style={{ fontSize: '12px', color: C.cardBorder }}>·</span>
            <span onClick={() => setPage('privacy')} style={{ fontSize: '12px', color: C.textMuted, cursor: 'pointer' }}>Privacy Policy</span>
          </div>
        </div>
      </div>
    )
  }

  // BROWSE PAGE (logged out)
  if (page === 'browse') {
    return (
      <div style={{ ...pageStyle, paddingBottom: 0 }}>
        <style>{styles}</style>
        {Header()}
        <div style={inner}>
          {SearchFilters()}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>Listings</span>
            <span style={{ fontSize: '12px', color: C.textMuted }}>{filteredWants.length} result{filteredWants.length !== 1 ? 's' : ''}</span>
          </div>
          {loading ? [1,2,3].map(i => <SkeletonCard key={i} hasImage={i !== 2} />) : filteredWants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 20px 40px' }}>
              <svg width="40" height="40" fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ marginBottom: '14px', opacity: 0.6 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <p style={{ fontSize: '15px', fontWeight: '600', color: C.text, marginBottom: '6px' }}>Nothing here yet</p>
              <p style={{ fontSize: '13px', color: C.textMuted, lineHeight: '1.55' }}>Try a different location, category, or clear your filters</p>
            </div>
          ) : filteredWants.map((want, i) => <Fragment key={want.id}>{WantCard({ want, index: i })}</Fragment>)}
          <div style={{ background: '#16110A', borderRadius: '12px', padding: '24px', textAlign: 'center', marginTop: '8px', marginBottom: '20px' }}>
            <p style={{ color: '#fff', fontWeight: '600', fontSize: '15px', marginBottom: '6px' }}>Want to post a listing?</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '16px' }}>Sign up free and let sellers come to you</p>
            <button onClick={() => setPage('signup')} style={{ background: '#F6F4EE', color: '#16110A', border: 'none', fontWeight: '600', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Sign up free</button>
          </div>
        </div>
      </div>
    )
  }

  // PROFILE PAGE
  if (page === 'profile' && profileEmail) {
    const r = allRatings[profileEmail]
    const isOwnProfile = user?.email === profileEmail
    const alreadyRated = profileRatings.some(r => r.rater_email === user?.email)
    const profileUsername = getUsername(profileEmail)
    const joinDate = viewedProfile?.created_at ? new Date(viewedProfile.created_at).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' }) : null
    const totalDeals = viewedProfile?.total_deals || 0
    const ProfileListingCard = ({ want, i }) => (
      <div key={want.id} className={`card card-hover reveal delay-${(i % 3) + 1}`} onClick={() => openWant(want)} style={{ padding: '14px 18px', marginBottom: '8px', overflow: 'hidden', opacity: want.status === 'filled' ? 0.6 : 1 }}>
        <div style={{ height: '3px', background: want.listing_type === 'service' ? '#A0522D' : '#1E5470', borderRadius: '2px', marginBottom: '10px', marginLeft: '-18px', marginRight: '-18px', marginTop: '-14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: '600', color: C.text, flex: 1, paddingRight: '10px' }}>{want.title}</p>
          {(want.status === 'filled' || want.listing_type === 'service') && (
            <span className={`badge ${want.status === 'filled' ? 'badge-filled' : 'badge-service'}`}>{want.status === 'filled' ? 'Filled' : 'Service'}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
          {want.budget && <span className="tag" style={{ color: C.textSub }}><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{marginRight:'3px'}}><circle cx="12" cy="12" r="9"/><path d="M14.5 9H10a2 2 0 000 4h4a2 2 0 010 4H9.5M12 7v2m0 8v2"/></svg>{want.budget}</span>}
          {want.location && <span className="tag" style={{ color: C.textSub }}><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{marginRight:'3px'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>{want.location}</span>}
          {offerCounts[want.id] > 0 && <span className="tag" style={{ color: '#3F6F4E', fontWeight: '600' }}>{offerCounts[want.id]} offer{offerCounts[want.id] !== 1 ? 's' : ''}</span>}
        </div>
      </div>
    )
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        {Header()}
        <div style={{ background: '#16110A', padding: '28px 20px 56px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#1E5470', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: '700', margin: '0 auto 12px', border: '3px solid rgba(255,255,255,0.15)' }}>
              {profileUsername ? profileUsername[0].toUpperCase() : '?'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff', marginBottom: '2px' }}>@{profileUsername}</div>
            {joinDate && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>Member since {joinDate}</div>}
            {r ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '20px', padding: '5px 14px' }}>
                <span style={{ color: '#FCD34D', fontSize: '13px' }}>★</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#FCD34D' }}>{r.avg}</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>({r.count} review{r.count !== 1 ? 's' : ''})</span>
              </div>
            ) : <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>No ratings yet</span>}
          </div>
        </div>
        <div style={{ ...inner, marginTop: '-28px' }}>
          <div className="card fade-up" style={{ marginBottom: '14px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {[{ value: profileWants.length, label: 'Listings' }, { value: totalDeals, label: 'Deals done' }, { value: r?.count || 0, label: 'Reviews' }].map(({ value, label }, i) => (
                <div key={i} style={{ padding: '18px 12px', textAlign: 'center', borderRight: i < 2 ? `1px solid ${C.cardBorder}` : 'none' }}>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#1E5470', lineHeight: 1, marginBottom: '4px' }}>{value}</div>
                  <div style={{ fontSize: '11px', color: C.textMuted, fontWeight: '500' }}>{label}</div>
                </div>
              ))}
            </div>
            {profileResponseRate !== null && (
              <div style={{ borderTop: `1px solid ${C.cardBorder}`, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="13" height="13" fill="none" stroke={profileResponseRate >= 80 ? '#0E9A6E' : '#8FA5B8'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize: '12px', color: C.textSub }}>Responds to <strong style={{ color: C.text }}>{profileResponseRate}%</strong> of offers</span>
                {profileResponseRate >= 80 && (
                  <span style={{ marginLeft: 'auto', fontSize: '10px', background: dark ? 'rgba(14,154,110,0.15)' : '#EDFAF4', color: '#0E9A6E', border: '1px solid #A7EDD4', borderRadius: '20px', padding: '2px 9px', fontWeight: '700' }}>Active</span>
                )}
                {profileResponseRate < 40 && (
                  <span style={{ marginLeft: 'auto', fontSize: '10px', background: dark ? 'rgba(217,119,6,0.15)' : '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', borderRadius: '20px', padding: '2px 9px', fontWeight: '700' }}>Slow</span>
                )}
              </div>
            )}
            {(viewedProfile?.bio || isOwnProfile) && (
              <>
                <div style={{ height: '1px', background: C.cardBorder }} />
                <div style={{ padding: '14px 18px' }}>
                  {isOwnProfile ? (
                    editingBio ? (
                      <div>
                        <textarea value={bioText} onChange={e => setBioText(e.target.value)} placeholder="Tell buyers about yourself…" rows={3} style={{ marginBottom: '8px', resize: 'none' }} maxLength={500} />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-primary" onClick={saveBio} disabled={savingBio} style={{ fontSize: '12px', padding: '6px 14px' }}>{savingBio ? 'Saving…' : 'Save'}</button>
                          <button className="btn" onClick={() => { setEditingBio(false); setBioText(viewedProfile?.bio || '') }} style={{ fontSize: '12px', padding: '6px 14px' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <p style={{ fontSize: '13px', color: viewedProfile?.bio ? C.textSub : C.textMuted, flex: 1, lineHeight: '1.5', fontStyle: viewedProfile?.bio ? 'normal' : 'italic' }}>{viewedProfile?.bio || 'Add a bio…'}</p>
                        <button onClick={() => setEditingBio(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E5470', fontSize: '12px', flexShrink: 0, fontWeight: '500' }}>Edit</button>
                      </div>
                    )
                  ) : (
                    <p style={{ fontSize: '13px', color: C.textSub, lineHeight: '1.5' }}>{viewedProfile.bio}</p>
                  )}
                </div>
              </>
            )}
          </div>

          {user && !isOwnProfile && !alreadyRated && (
            <div className="card fade-up" style={{ padding: '20px', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: C.text, marginBottom: '12px' }}>Leave a rating</h3>
              <div style={{ marginBottom: '12px' }}><StarRating score={ratingScore} onSelect={setRatingScore} size={28} /></div>
              <textarea placeholder="Add a comment (optional)" value={ratingComment} onChange={e => setRatingComment(e.target.value)} rows={2} style={{ marginBottom: '12px', resize: 'none' }} />
              <button className="btn btn-primary" onClick={() => submitRating(profileEmail)} disabled={!ratingScore || submittingRating} style={{ width: '100%', padding: '11px' }}>
                {submittingRating ? 'Submitting…' : 'Submit rating'}
              </button>
            </div>
          )}
          {alreadyRated && !isOwnProfile && (
            <div style={{ background: dark ? '#0A2A1A' : '#EDFAF4', border: '1.5px solid #A7EDD4', borderRadius: '12px', padding: '12px 16px', marginBottom: '14px', fontSize: '13px', color: '#0E9A6E', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              You've rated this user
            </div>
          )}

          {profileRatings.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: C.text, marginBottom: '10px' }}>Reviews ({profileRatings.length})</div>
              {profileRatings.map((r, i) => (
                <div key={r.id} className={`card reveal delay-${(i % 3) + 1}`} style={{ padding: '14px 18px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: r.comment ? '8px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {Avatar({ email: r.rater_email, size: 28 })}
                      <span style={{ fontSize: '12px', color: C.textSub, fontWeight: '600' }}>@{getUsername(r.rater_email)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <StarRating score={r.score} readonly size={13} />
                      <span style={{ fontSize: '11px', color: C.textMuted }}>{timeAgo(r.created_at)}</span>
                    </div>
                  </div>
                  {r.comment && <p style={{ fontSize: '13px', color: C.textSub, lineHeight: '1.5' }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          )}

          {profileWants.length > 0 ? (
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: C.text, marginBottom: '10px' }}>Listings ({profileWants.length})</div>
              {profileWants.map((want, i) => <ProfileListingCard key={want.id} want={want} i={i} />)}
            </div>
          ) : (
            <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: C.textMuted }}>No listings yet</p>
            </div>
          )}
        </div>
        {BottomNav()}
      </div>
    )
  }

  // MESSAGES PAGE
  if (page === 'messages' && activeThread) {
    const isOwner = activeThread.want.user_id === user?.id
    const otherEmail = isOwner ? activeThread.offer.seller_email : activeThread.want.user_email
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        {Header()}
        <div style={inner}>
          <div className="card fade-up" style={{ marginBottom: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
              {Avatar({ email: otherEmail, size: 36 })}
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openProfile(otherEmail)}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>@{getUsername(otherEmail)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{RatingBadge({ email: otherEmail, small: true })}<span style={{ fontSize: '11px', color: '#8FA5B8' }}>Re: {activeThread.want.title}</span></div>
              </div>
              {activeThread.offer.price && <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E5470' }}>{activeThread.offer.price}</span>}
            </div>
            {activeThread.want.status === 'filled' && (
              <div style={{ padding: '10px 16px', background: dark ? 'rgba(14,154,110,0.1)' : '#EDFAF4', borderBottom: `1px solid ${dark ? 'rgba(167,237,212,0.2)' : '#A7EDD4'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <svg width="13" height="13" fill="none" stroke="#0E9A6E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ fontSize: '12px', color: '#0E9A6E', fontWeight: '500' }}>Deal done — how was @{getUsername(otherEmail)}?</span>
                </div>
                <button onClick={() => setDealRatingModal({ email: otherEmail, wantTitle: activeThread.want.title })} className="btn btn-green" style={{ fontSize: '11px', padding: '5px 12px', flexShrink: 0 }}>Rate them</button>
              </div>
            )}
            <div className="msg-thread">
              {messages.length === 0 && <p style={{ fontSize: '13px', color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>No messages yet — say hello!</p>}
              {messages.map(m => (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender_email === user.email ? 'flex-end' : 'flex-start' }}>
                  <div className={`msg-bubble ${m.sender_email === user.email ? 'msg-mine' : 'msg-theirs'}`}>{m.message}</div>
                  <span style={{ fontSize: '10px', color: '#B0C4D4', margin: '2px 4px 6px' }}>{timeAgo(m.created_at)}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.cardBorder}`, display: 'flex', gap: '8px' }}>
              <input placeholder="Type a message…" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={sendMessage} disabled={!newMessage.trim() || sendingMessage} style={{ flexShrink: 0, padding: '10px 16px' }}>Send</button>
            </div>
          </div>
        </div>
        {BottomNav()}
      </div>
    )
  }

  // INBOX PAGE
  if (page === 'inbox') {
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        {Header()}
        <div style={inner}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }} className="fade-up">
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: C.text }}>Messages</h2>
            <span style={{ fontSize: '12px', color: C.textMuted }}>{myInbox.length} thread{myInbox.length !== 1 ? 's' : ''}</span>
          </div>
          {myInbox.length === 0 && <div className="card fade-up" style={{ padding: '48px 24px', textAlign: 'center' }}><p style={{ fontSize: '15px', color: '#4A6278', marginBottom: '6px' }}>No messages yet</p><p style={{ fontSize: '13px', color: '#8FA5B8' }}>When you message a seller or buyer, threads appear here</p></div>}
          {myInbox.map((thread, i) => {
            const want = wants.find(w => w.id === thread.want_id)
            const offer = { id: thread.offer_id, seller_email: thread.offers?.seller_email, price: thread.offers?.price }
            if (!want) return null
            const otherEmail = want.user_id === user.id ? offer.seller_email : want.user_email
            return (
              <div key={thread.offer_id} className={`card card-hover reveal delay-${(i % 3) + 1}`} style={{ padding: '14px 18px', marginBottom: '10px' }} onClick={() => openThread(offer, want)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {Avatar({ email: otherEmail, size: 40 })}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>@{getUsername(otherEmail)}</p>
                      <span style={{ fontSize: '11px', color: C.textMuted }}>{timeAgo(thread.created_at)}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: C.textMuted, marginBottom: '2px' }}>Re: {want.title}</p>
                    <p style={{ fontSize: '12px', color: C.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.message}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {BottomNav()}
      </div>
    )
  }

  // WANT DETAIL PAGE
  if (page === 'want' && selectedWant) {
    const hasImages = selectedWant.images && selectedWant.images.length > 0
    const isOwner = user && user.id === selectedWant.user_id
    const acceptedOffer = offers.find(o => o.status === 'accepted')
    const isService = selectedWant.listing_type === 'service'
    const accentColor = isService ? '#A0522D' : '#1E5470'
    const accentBg = isService ? '#F5EBDF' : '#EAF0F4'
    const accentBorder = isService ? '#DDD6FE' : '#B8DCEE'
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        {Header()}
        {Lightbox()}
        {ReportModal()}
        {CounterModal()}
        {EditModal()}
        {DealRatingModal()}
        {toast && <div className={`toast toast-${toast.type || 'default'}`}><span>{toast.msg}</span><button className="toast-close" onClick={() => setToast(null)}>✕</button></div>}
        <div style={inner}>
          <div className="card fade-up" style={{ marginBottom: '14px', overflow: 'hidden' }}>
            {hasImages && <div className="img-gallery-full" style={{ padding: '14px 14px 0' }}>{selectedWant.images.map((url, i) => <img key={i} src={url} alt="" onClick={() => setLightboxImg(url)} />)}</div>}
            <div style={{ padding: '20px 22px 22px' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#7A6F5C', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                {[isService ? 'Service' : selectedWant.category, selectedWant.listing_type !== 'service' && selectedWant.condition && selectedWant.condition !== 'Any' ? selectedWant.condition : null, selectedWant.location, selectedWant.status === 'filled' ? 'Filled' : null].filter(Boolean).join(' · ')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px' }}>
                <h2 style={{ fontSize: '26px', fontWeight: '400', color: C.text, lineHeight: '1.2', fontFamily: "'Fraunces', serif", flex: 1 }}>{selectedWant.title}</h2>
                {selectedWant.budget && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: '36px', fontWeight: '400', color: dark ? '#5B9EC0' : '#1E5470', lineHeight: 1 }}>{selectedWant.budget}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: '500', color: '#7A6F5C', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '3px' }}>Budget{selectedWant.negotiable ? ' · Flex' : ' · Firm'}</div>
                  </div>
                )}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#7A6F5C', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {selectedWant.views > 5 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>{selectedWant.views}</span>}
                {selectedWant.listing_type === 'service' && selectedWant.estimated_hours && <span>{selectedWant.estimated_hours}</span>}
                <span>{timeAgo(selectedWant.created_at)}</span>
              </div>
              {selectedWant.description && <p style={{ fontSize: '14px', color: C.textSub, lineHeight: '1.65', marginBottom: '16px' }}>{selectedWant.description}</p>}
              <div style={{ height: '1px', background: C.cardBorder, margin: '4px 0 14px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => openProfile(selectedWant.user_email)}>
                  {Avatar({ email: selectedWant.user_email, size: 28 })}
                  <div>
                    <span style={{ fontSize: '13px', color: accentColor, fontWeight: '600' }}>@{getUsername(selectedWant.user_email)}</span>
                    {(() => {
                      const r = allRatings[selectedWant.user_email]
                      const parts = [r ? `★ ${r.avg}` : null, r?.count ? `${r.count} deals` : null, `Posted ${timeAgo(selectedWant.created_at)}`].filter(Boolean)
                      return <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#7A6F5C', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '2px' }}>{parts.join(' · ')}</div>
                    })()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={e => toggleWishlist(e, selectedWant.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}>
                    <svg width="20" height="20" fill={wishlists.includes(selectedWant.id) ? '#DC2626' : 'none'} stroke={wishlists.includes(selectedWant.id) ? '#DC2626' : C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                  </button>
                  <button className="btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => shareWant(selectedWant)}><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share</button>
                  {user && !isOwner && <button className="btn btn-red" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setReportModal(selectedWant)}>Report</button>}
                </div>
              </div>
              {isOwner && (
                <>
                  <div style={{ height: '1px', background: C.cardBorder, margin: '14px 0' }} />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn" onClick={() => openEditModal(selectedWant)} style={{ fontSize: '12px' }}><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</button>
                    {selectedWant.status !== 'filled' && <button className="btn btn-green" onClick={() => markFilled(selectedWant.id)}><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Mark as filled</button>}
                    <button className="btn btn-red" onClick={() => { deleteWant(selectedWant.id); setPage('home') }}>Delete</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {acceptedOffer && (
            <div style={{ background: dark ? '#0A2A1A' : '#EDFAF4', border: '1.5px solid #A7EDD4', borderRadius: '14px', padding: '16px 18px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', background: '#0E9A6E', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#0E9A6E', marginBottom: '2px' }}>Offer accepted</p>
                <p style={{ fontSize: '12px', color: dark ? '#6EE7B7' : '#065F46' }}>@{getUsername(acceptedOffer.seller_email)}{acceptedOffer.price ? ` · ${acceptedOffer.price}` : ''}</p>
              </div>
            </div>
          )}

          {user && selectedWant.status !== 'filled' && !isOwner ? (
            <div className="card fade-up" style={{ padding: '22px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: offerCounts[selectedWant.id] > 0 ? '10px' : '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: C.text }}>Make an offer</h3>
                </div>
                {offerCounts[selectedWant.id] > 0 && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: '500', color: '#A86A1A', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {(() => {
                      const prices = offers.map(o => parseFloat((o.price || '').replace(/[^0-9.]/g, ''))).filter(n => n > 0)
                      const best = prices.length ? Math.min(...prices) : null
                      const bestStr = best ? offers.find(o => parseFloat((o.price || '').replace(/[^0-9.]/g, '')) === best)?.price : null
                      return `${offerCounts[selectedWant.id]} in${bestStr ? ` · Best ${bestStr}` : ''}`
                    })()}
                  </span>
                )}
              </div>
              {offerCounts[selectedWant.id] >= 2 && (
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '14px', paddingBottom: '14px', borderBottom: `1px solid ${C.cardBorder}` }}>
                  {offerCounts[selectedWant.id]} sellers have already offered — make yours stand out.
                </div>
              )}
              <input placeholder={isService ? 'Your price — e.g. $80/hr or $150 flat' : 'Your price — e.g. $250'} value={offerPrice} onChange={e => setOfferPrice(e.target.value)} style={{ marginBottom: '10px' }} />
              <textarea placeholder={isService ? 'Your experience, availability, tools or equipment…' : 'Describe what you have — condition, photos, pickup…'} value={offerMessage} onChange={e => setOfferMessage(e.target.value)} rows={3} style={{ marginBottom: '14px', resize: 'vertical' }} maxLength={2000} />
              <button className="btn btn-primary" onClick={submitOffer} disabled={!offerMessage || submittingOffer} style={{ width: '100%', padding: '13px', fontSize: '14px', background: isService ? '#A0522D' : undefined, borderColor: isService ? '#A0522D' : undefined }}>
                {submittingOffer ? 'Sending…' : 'Send my offer →'}
              </button>
            </div>
          ) : !user ? (
            <div style={{ background: dark ? '#1A1208' : '#F5EBDF', border: `1px solid ${dark ? '#3D2A14' : '#E8D5BE'}`, borderRadius: '12px', padding: '16px 18px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}>
              <span style={{ fontSize: '13px', color: dark ? '#C8A882' : '#3D3528' }}>Have something that matches? Make an offer.</span>
              <button className="btn btn-primary" onClick={() => setPage('login')} style={{ fontSize: '12px', padding: '7px 14px', whiteSpace: 'nowrap' }}>Log in</button>
            </div>
          ) : selectedWant.status === 'filled' && !acceptedOffer ? (
            <div style={{ background: dark ? '#1A2030' : '#EDF2F7', borderRadius: '12px', padding: '14px 18px', marginBottom: '14px', fontSize: '13px', color: C.textMuted, textAlign: 'center' }}>This listing has been filled</div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: C.text }}>Offers</span>
            {offers.length > 0 && <span style={{ background: '#0E9A6E', color: '#fff', fontSize: '11px', fontWeight: '700', borderRadius: '20px', padding: '3px 11px' }}>{offers.length} offer{offers.length !== 1 ? 's' : ''}</span>}
          </div>

          {offers.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '36px 20px', marginBottom: '10px' }}>
              <svg width="32" height="32" fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ marginBottom: '10px', opacity: 0.4 }}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
              <p style={{ fontSize: '14px', fontWeight: '600', color: C.text, marginBottom: '4px' }}>No offers yet</p>
              <p style={{ fontSize: '13px', color: C.textMuted, marginBottom: !user ? '16px' : '0' }}>Be the first seller to reach out</p>
              {!user && <button className="btn btn-primary" onClick={() => setPage('login')} style={{ fontSize: '13px', padding: '10px 24px' }}>Make an offer →</button>}
            </div>
          )}

          {(() => {
            const parsePrice = p => parseFloat((p || '').replace(/[^0-9.]/g, '')) || Infinity
            const activeOffers = offers.filter(o => !isOfferExpired(o) && !['declined'].includes(o.status))
            const sortedOffers = [...offers].sort((a, b) => {
              const aActive = activeOffers.includes(a), bActive = activeOffers.includes(b)
              if (aActive !== bActive) return aActive ? -1 : 1
              return parsePrice(a.price) - parsePrice(b.price)
            })
            const bestOfferId = isOwner && activeOffers.length >= 2 && activeOffers[0]?.price ? activeOffers.sort((a,b) => parsePrice(a.price) - parsePrice(b.price))[0].id : null
            return sortedOffers.map((offer, i) => {
            const expired = isOfferExpired(offer)
            const timeLeft = offerTimeLeft(offer)
            const isAccepted = offer.status === 'accepted'
            const isDeclined = offer.status === 'declined'
            const isBest = offer.id === bestOfferId
            return (
              <div key={offer.id} className={`card reveal delay-${(i % 3) + 1}`} style={{ marginBottom: '10px', overflow: 'hidden', opacity: expired ? 0.65 : 1, border: isBest ? '1.5px solid #A7EDD4' : isAccepted ? '1.5px solid #A7EDD4' : undefined }}>
                {isBest && !isAccepted && !isDeclined && (
                  <div style={{ padding: '5px 16px', background: dark ? '#0A2A1A' : '#EDFAF4', borderBottom: '1px solid #A7EDD4', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="11" height="11" fill="#0E9A6E" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E9A6E' }}>Best price</span>
                  </div>
                )}
                {(isAccepted || isDeclined || (timeLeft && !expired) || expired) && (
                  <div style={{ padding: '6px 16px', background: isAccepted ? (dark ? '#0A2A1A' : '#EDFAF4') : isDeclined ? (dark ? '#1A0A0A' : '#FEF2F2') : expired ? (dark ? '#1A1A2A' : '#EDF2F7') : (dark ? '#1A1200' : '#FFFBEB'), borderBottom: `1px solid ${isAccepted ? '#A7EDD4' : isDeclined ? '#FECACA' : expired ? C.cardBorder : '#FDE68A'}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isAccepted && <><svg width="11" height="11" fill="none" stroke="#0E9A6E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg><span style={{ fontSize: '11px', fontWeight: '700', color: '#0E9A6E' }}>Accepted</span></>}
                    {isDeclined && <span style={{ fontSize: '11px', fontWeight: '700', color: '#DC2626' }}>Declined</span>}
                    {expired && !isAccepted && !isDeclined && <span style={{ fontSize: '11px', fontWeight: '600', color: C.textMuted }}>Expired</span>}
                    {timeLeft && !expired && !isAccepted && !isDeclined && <span style={{ fontSize: '11px', fontWeight: '600', color: '#D97706' }}>{timeLeft}</span>}
                  </div>
                )}
                <div style={{ padding: '14px 18px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    {isOwner ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => openProfile(offer.seller_email)}>
                        {Avatar({ email: offer.seller_email, size: 32 })}
                        <div>
                          <p style={{ fontSize: '13px', color: accentColor, fontWeight: '600', marginBottom: '1px' }}>@{getUsername(offer.seller_email)}</p>
                          {RatingBadge({ email: offer.seller_email, small: true })}
                        </div>
                      </div>
                    ) : <span style={{ fontSize: '12px', color: C.textMuted }}>Your offer</span>}
                    {offer.price && <span style={{ fontSize: '20px', fontWeight: '800', color: accentColor, letterSpacing: '-0.3px' }}>{offer.price}</span>}
                  </div>
                  <p style={{ fontSize: '13px', color: C.textSub, lineHeight: '1.6', marginBottom: '10px' }}>{offer.message}</p>
                  {offer.counter_status === 'pending' && (
                    <div style={{ background: dark ? '#2A1A00' : '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                      <p style={{ fontSize: '12px', fontWeight: '700', color: '#D97706', marginBottom: offer.counter_message ? '4px' : '0' }}>Counter: {offer.counter_price}</p>
                      {offer.counter_message && <p style={{ fontSize: '12px', color: '#92400E', marginBottom: offer.seller_email === user?.email ? '8px' : '0' }}>{offer.counter_message}</p>}
                      {offer.seller_email === user?.email && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-green" style={{ fontSize: '11px', padding: '5px 12px' }} onClick={() => respondToCounter(offer.id, true)}>Accept counter</button>
                          <button className="btn btn-red" style={{ fontSize: '11px', padding: '5px 12px' }} onClick={() => respondToCounter(offer.id, false)}>Decline</button>
                        </div>
                      )}
                      {isOwner && <p style={{ fontSize: '11px', color: '#D97706', marginTop: '2px' }}>Awaiting seller response</p>}
                    </div>
                  )}
                  {offer.counter_status === 'accepted' && <div style={{ background: dark ? '#0A2A1A' : '#EDFAF4', border: '1px solid #A7EDD4', borderRadius: '10px', padding: '8px 12px', marginBottom: '10px' }}><p style={{ fontSize: '12px', fontWeight: '700', color: '#0E9A6E' }}>Counter {offer.counter_price} — accepted</p></div>}
                  {offer.counter_status === 'declined' && <div style={{ background: dark ? '#2A0A0A' : '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '8px 12px', marginBottom: '10px' }}><p style={{ fontSize: '12px', fontWeight: '700', color: '#DC2626' }}>Counter declined</p></div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: C.textMuted }}>{timeAgo(offer.created_at)}</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {!expired && isOwner && selectedWant.status !== 'filled' && !['accepted','declined'].includes(offer.status) && !offer.counter_status && (
                        <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setCounterModal(offer)}>Counter</button>
                      )}
                      {!expired && isOwner && selectedWant.status !== 'filled' && !['accepted','declined'].includes(offer.status) && (
                        <button className="btn btn-red" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => declineOffer(offer.id)}>Decline</button>
                      )}
                      {!expired && isOwner && selectedWant.status !== 'filled' && !['accepted','declined'].includes(offer.status) && (
                        <button className="btn btn-green" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => acceptOffer(offer.id, selectedWant.id)}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Accept</button>
                      )}
                      {user && (isOwner || offer.seller_email === user.email) && (
                        <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => openThread(offer, selectedWant)}><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>Message</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
          })()}
        </div>

        {similarWants.length > 0 && (
          <div style={{ padding: '0 0 8px' }}>
            <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>More in {selectedWant.category}</span>
              <span style={{ fontSize: '12px', color: C.textMuted }}>{similarWants.length} listing{similarWants.length !== 1 ? 's' : ''}</span>
            </div>
            <div ref={el => el && setupScrollDrag(el)} style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '2px 16px 16px', scrollbarWidth: 'none', cursor: 'grab' }}>
              {similarWants.map(w => (
                <div key={w.id} onClick={() => openWant(w)} className="card card-hover" style={{ flexShrink: 0, width: '200px', overflow: 'hidden', cursor: 'pointer' }}>
                  {w.images?.[0] ? (
                    <img src={w.images[0]} alt="" style={{ width: '100%', height: '110px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ height: '110px', background: w.listing_type === 'service' ? 'rgba(160,82,45,0.08)' : '#EAF0F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="28" height="28" fill="none" stroke={w.listing_type === 'service' ? '#A0522D' : '#1E5470'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>{w.listing_type === 'service' ? <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></> : <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>}</svg>
                    </div>
                  )}
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: C.text, lineHeight: 1.3, marginBottom: '5px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{w.title}</p>
                    {w.budget && <span style={{ fontSize: '11px', fontWeight: '700', color: '#1E5470' }}>{w.budget}</span>}
                    {w.location && <p style={{ fontSize: '11px', color: C.textMuted, marginTop: '2px' }}>📍 {w.location}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {BottomNav()}
      </div>
    )
  }

  // POST PAGE
  if (page === 'post') {
    const postAccent = listingType === 'service' ? '#A0522D' : '#1E5470'
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        {Header()}
        <div style={inner}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '24px', fontStyle: 'italic', color: C.text, lineHeight: 1.25, marginBottom: '4px' }}>
              {listingType === 'service' ? 'Post a job' : 'Post a want'}
            </div>
            <p style={{ fontSize: '13px', color: C.textMuted }}>Tell sellers what you need — they'll come to you with offers.</p>
          </div>
          <div style={{ display: 'inline-flex', border: `1.5px solid ${C.cardBorder}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '18px' }}>
            <button onClick={() => { setListingType('item'); setCategory(''); setEstimatedHours('') }} style={{ padding: '7px 18px', background: listingType === 'item' ? '#16110A' : 'transparent', color: listingType === 'item' ? '#F6F4EE' : C.textSub, border: 'none', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.15s' }}>Buy item</button>
            <button onClick={() => { setListingType('service'); setCategory(''); setCondition('') }} style={{ padding: '7px 18px', background: listingType === 'service' ? '#A0522D' : 'transparent', color: listingType === 'service' ? '#F6F4EE' : C.textSub, border: 'none', borderLeft: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.15s' }}>Hire service</button>
          </div>

          <div className="card fade-up" style={{ padding: '20px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>What do you need?</div>
              <span style={{ fontSize: '11px', color: title.length > 90 ? '#D97706' : C.textMuted }}>{title.length}/120</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input placeholder={listingType === 'service' ? 'e.g. Lawns mowed — small Ponsonby section' : 'e.g. Road bike under $300, any colour'} value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
              <textarea placeholder={listingType === 'service' ? 'Describe the job — location, access, tools needed…' : 'More details — brand, size, specs, what condition you\'d accept (optional)'} value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ resize: 'vertical' }} maxLength={2000} />
            </div>
          </div>

          <div className="card reveal delay-1" style={{ padding: '20px', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Budget & location</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input placeholder={listingType === 'service' ? 'Budget — e.g. $50 cash, up to $200' : 'Max budget — e.g. $300'} value={budget} onChange={e => setBudget(e.target.value)} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <select value={location} onChange={e => setLocation(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Your city</option>
                  {locations.map(l => <option key={l}>{l}</option>)}
                </select>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Category</option>
                  {(listingType === 'service' ? serviceCategories : categories).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              {listingType === 'service'
                ? <input placeholder="Estimated time — e.g. 2 hours, half day" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} />
                : <select value={condition} onChange={e => setCondition(e.target.value)}><option value="">Condition (optional)</option>{conditions.map(c => <option key={c} value={c}>{c}</option>)}</select>
              }
              {listingType === 'service' && LICENSED_TRADE_CATS.has(category) && (
                <div style={{ background: dark ? '#2A1A00' : '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: dark ? '#FCD34D' : '#92400E', lineHeight: 1.5 }}>
                  <strong>NZ licensing reminder:</strong> {category} work must be carried out by a licensed tradesperson. Ensure any seller you hire holds the required licence.
                </div>
              )}
              <div onClick={() => setNegotiable(n => !n)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 12px', borderRadius: '10px', border: `1.5px solid ${negotiable ? postAccent : C.cardBorder}`, background: negotiable ? (dark ? `rgba(${listingType === 'service' ? '124,58,237' : '14,127,168'},0.1)` : listingType === 'service' ? '#F5F3FF' : '#EAF0F4') : 'transparent', transition: 'all 0.15s' }}>
                <div style={{ width: '18px', height: '18px', flexShrink: 0, borderRadius: '5px', border: `2px solid ${negotiable ? postAccent : '#C8DCE8'}`, background: negotiable ? postAccent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                  {negotiable && <svg width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{ fontSize: '13px', color: negotiable ? postAccent : C.text, fontWeight: negotiable ? '600' : '400' }}>Flexible budget</span>
              </div>
            </div>
          </div>

          <div className="card reveal delay-2" style={{ padding: '20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Photos (optional)</div>
            {ImageUploader()}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '24px' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: '600', color: '#7A6F5C', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Free · NZ-wide</div>
            <button className="btn btn-primary" onClick={postWant} disabled={!title || posting} style={{ padding: '12px 28px', fontSize: '14px', background: listingType === 'service' ? '#A0522D' : '#16110A', borderColor: listingType === 'service' ? '#A0522D' : '#16110A' }}>
              {uploadingImages ? 'Uploading…' : posting ? 'Posting…' : 'Post listing →'}
            </button>
          </div>
        </div>
        {BottomNav()}
      </div>
    )
  }

  // MY LISTINGS PAGE
  if (page === 'mylistings') {
    const fmtCountdown = (expiresAt) => {
      if (!expiresAt) return null
      const ms = new Date(expiresAt).getTime() - now
      if (ms <= 0) return null
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      return h > 0 ? `${h}h ${m}m left` : `${m}m left`
    }
    const offerStatusBadge = (offer) => {
      if (offer.status === 'accepted') return { label: 'Accepted', bg: '#EDFAF4', color: '#0E9A6E' }
      if (offer.status === 'declined') return { label: 'Declined', bg: '#FEF2F2', color: '#DC2626' }
      if (offer.wants?.status === 'filled') return { label: 'Listing sold', bg: '#EDF2F7', color: '#8FA5B8' }
      if (offer.expires_at && new Date(offer.expires_at).getTime() <= now) return { label: 'Expired', bg: '#EDF2F7', color: '#8FA5B8' }
      const countdown = fmtCountdown(offer.expires_at)
      return { label: countdown ? `Pending · ${countdown}` : 'Pending', bg: dark ? '#0A3060' : '#EAF0F4', color: '#1E5470' }
    }
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        {Header()}
        {EditModal()}
        <div style={inner}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }} className="fade-up">
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: C.text }}>Profile</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#1E5470', cursor: 'pointer', fontWeight: '500' }} onClick={() => openProfile(user.email)}>My public page →</span>
              <button onClick={() => { scrollPos.current[page] = window.scrollY; setNavStack(prev => [...prev, { page, selectedWant, profileEmail, activeThread }]); setSettingsUsername(myProfile?.username || getUsername(user.email)); setPage('settings'); window.scrollTo(0, 0) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                <svg width="18" height="18" fill="none" stroke={C.textSub} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0', marginBottom: '20px', border: `1.5px solid ${C.cardBorder}`, borderRadius: '12px', overflow: 'hidden' }} className="fade-up">
            <button onClick={() => setMineTab('listings')} style={{ flex: 1, padding: '10px', background: mineTab === 'listings' ? '#1E5470' : C.card, color: mineTab === 'listings' ? '#fff' : C.textSub, border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500', fontFamily: "'Inter', system-ui, sans-serif" }}>Listings ({myWants.length})</button>
            <button onClick={() => setMineTab('offers')} style={{ flex: 1, padding: '10px', background: mineTab === 'offers' ? '#1E5470' : C.card, color: mineTab === 'offers' ? '#fff' : C.textSub, border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500', fontFamily: "'Inter', system-ui, sans-serif", borderLeft: `1px solid ${C.cardBorder}`, borderRight: `1px solid ${C.cardBorder}` }}>Offers ({myOffers.length})</button>
            <button onClick={() => setMineTab('saved')} style={{ flex: 1, padding: '10px', background: mineTab === 'saved' ? '#1E5470' : C.card, color: mineTab === 'saved' ? '#fff' : C.textSub, border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500', fontFamily: "'Inter', system-ui, sans-serif" }}>Saved ({savedWants.length})</button>
          </div>

          {mineTab === 'listings' && (
            <div>
              {myWants.length === 0 && (
                <div className="card fade-up" style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '15px', color: '#4A6278', marginBottom: '6px' }}>No listings yet</p>
                  <p style={{ fontSize: '13px', color: '#8FA5B8', marginBottom: '24px' }}>Tap + to post your first listing</p>
                  <button className="btn btn-primary" onClick={() => setPage('post')} style={{ padding: '10px 24px' }}>Post something</button>
                </div>
              )}
              {myWants.map((want, i) => (
                <div key={want.id} className={`card reveal delay-${(i % 3) + 1}`} style={{ padding: '18px 20px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', flex: 1, paddingRight: '14px', color: '#0F2030', lineHeight: '1.4', textAlign: 'left' }}>{want.title}</h3>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {want.bumped_at && want.status !== 'filled' && (Date.now() - new Date(want.bumped_at)) < 24*60*60*1000 && (
                        <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '20px', fontWeight: '700', background: dark ? '#2A1A0A' : '#F5EBDF', color: '#A0522D', border: '1px solid #D4B8A0' }}>↑ Bumped</span>
                      )}
                      <span style={{ background: want.status === 'filled' ? '#EDF2F7' : offerCounts[want.id] ? '#EDFAF4' : '#EDF2F7', color: want.status === 'filled' ? '#8FA5B8' : offerCounts[want.id] ? '#0E9A6E' : '#8FA5B8', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>
                        {want.status === 'filled' ? 'Filled' : offerCounts[want.id] ? `${offerCounts[want.id]} offer${offerCounts[want.id] !== 1 ? 's' : ''}` : 'No offers'}
                      </span>
                    </div>
                  </div>
                  {want.description && <p style={{ fontSize: '13px', color: '#4A6278', marginBottom: '10px', lineHeight: '1.5' }}>{want.description}</p>}
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {want.budget && <span className="tag"><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{marginRight:'3px'}}><circle cx="12" cy="12" r="9"/><path d="M14.5 9H10a2 2 0 000 4h4a2 2 0 010 4H9.5M12 7v2m0 8v2"/></svg>{want.budget}</span>}
                    {want.location && <span className="tag"><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{marginRight:'3px'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>{want.location}</span>}
                    {want.category && <span className="tag">{want.category}</span>}
                  </div>
                  {want.images && want.images.length > 0 && (
                    <div className="img-gallery" style={{ marginBottom: '14px' }}>
                      {want.images.slice(0, 3).map((url, i) => <img key={i} src={url} className="img-thumb" alt="" />)}
                      {want.images.length > 3 && <div style={{ width: '80px', height: '80px', borderRadius: '10px', background: '#EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#8FA5B8', fontWeight: '600' }}>+{want.images.length - 3}</div>}
                    </div>
                  )}
                  <div className="divider" style={{ marginBottom: '14px' }} />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn" onClick={() => openWant(want)} style={{ fontSize: '12px' }}>View offers →</button>
                    <button className="btn" onClick={() => openEditModal(want)} style={{ fontSize: '12px' }}>
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    {want.status !== 'filled' && <button className="btn btn-green" onClick={() => markFilled(want.id)} style={{ fontSize: '12px' }}><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Mark filled</button>}
                    {want.status !== 'filled' && <button className="btn" onClick={() => bumpListing(want.id)} style={{ fontSize: '12px', borderColor: '#D4B8A0', color: '#A0522D', background: dark ? '#2A1A0A' : '#F5EBDF' }}>↑ Bump</button>}
                    <button className="btn btn-red" onClick={() => deleteWant(want.id)} style={{ fontSize: '12px' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {mineTab === 'offers' && (
            <div>
              {loadingMyOffers && [1,2,3].map(i => <SkeletonCard key={i} hasImage={i !== 2} />)}
              {!loadingMyOffers && myOffers.length === 0 && (
                <div className="card fade-up" style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '15px', color: C.textSub, marginBottom: '6px' }}>No offers made yet</p>
                  <p style={{ fontSize: '13px', color: C.textMuted }}>Browse listings and make your first offer</p>
                </div>
              )}
              {myOffers.map((offer, i) => {
                const badge = offerStatusBadge(offer)
                return (
                  <div key={offer.id} className={`card reveal delay-${(i % 3) + 1}`} style={{ padding: '16px 18px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: '600', flex: 1, paddingRight: '12px', color: C.text, lineHeight: '1.4', textAlign: 'left', cursor: 'pointer' }} onClick={() => { const w = wants.find(w => w.id === offer.want_id); if (w) openWant(w) }}>{offer.wants?.title || 'Listing removed'}</h3>
                      <span style={{ background: badge.bg, color: badge.color, fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', flexShrink: 0, whiteSpace: 'nowrap' }}>{badge.label}</span>
                    </div>
                    {offer.price && <p style={{ fontSize: '13px', color: '#1E5470', fontWeight: '600', marginBottom: '4px' }}>${offer.price}</p>}
                    {offer.message && <p style={{ fontSize: '13px', color: C.textSub, lineHeight: '1.5', marginBottom: '0' }}>{offer.message}</p>}
                    {offer.counter_price && (
                      <div style={{ marginTop: '8px', padding: '8px 12px', background: dark ? '#0A3060' : '#FFF8E6', border: `1px solid ${dark ? '#2A4060' : '#FFD47A'}`, borderRadius: '8px', fontSize: '12px', color: dark ? '#FFD47A' : '#B45309' }}>
                        Counter-offer: ${offer.counter_price}{offer.counter_message ? ` — ${offer.counter_message}` : ''}
                      </div>
                    )}
                    {!['accepted','declined'].includes(offer.status) && offer.wants?.status !== 'filled' && !(offer.expires_at && new Date(offer.expires_at).getTime() <= now) && (
                      <div style={{ marginTop: '10px' }}>
                        <button className="btn btn-red" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={() => withdrawOffer(offer.id)}>Withdraw offer</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {mineTab === 'saved' && (
            <div>
              {savedWants.length === 0 ? (
                <div className="card fade-up" style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '15px', color: C.textSub, marginBottom: '6px' }}>No saved listings yet</p>
                  <p style={{ fontSize: '13px', color: C.textMuted }}>Tap the heart on any listing to save it</p>
                </div>
              ) : savedWants.map((want, i) => <Fragment key={want.id}>{WantCard({ want, index: i })}</Fragment>)}
            </div>
          )}
        </div>
        {BottomNav()}
      </div>
    )
  }

  if (page === 'settings') {
    const saveIrd = async () => {
      const val = settingsIrd.trim()
      if (!val || !/^\d{8,9}$/.test(val)) { showToast('IRD number must be 8 or 9 digits'); return }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
      const token = sessionRef.current?.access_token
      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ ird_number: val })
      })
      if (res.ok) showToast('IRD number saved', 'success')
      else showToast('Failed to save — please try again')
    }

    const saveUsername = async () => {
      const newName = settingsUsername.trim().toLowerCase().replace(/\s+/g, '_')
      if (!newName || newName === (myProfile?.username || getUsername(user.email))) return
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
      const token = sessionRef.current?.access_token
      const headers = { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      try {
        const checkRes = await fetch(`${supabaseUrl}/rest/v1/profiles?username=eq.${encodeURIComponent(newName)}&id=neq.${user.id}&select=id`, { headers })
        const existing = await checkRes.json()
        if (existing.length > 0) { showToast('Username already taken'); return }
        const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
          method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ username: newName })
        })
        if (!res.ok) throw new Error(res.status)
        setMyProfile(prev => ({ ...prev, username: newName }))
        setProfiles(prev => ({ ...prev, [user.email]: newName }))
        showToast('Username updated!', 'success')
      } catch (err) {
        console.error('[saveUsername]', err)
        showToast('Failed to update username')
      }
    }
    return (
      <div style={pageStyle}>
        <style>{styles}</style>
        {Header()}
        <div style={inner}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: C.text, marginBottom: '24px' }} className="fade-up">Settings</h2>
          <div className="card fade-up" style={{ padding: '20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</p>
            <p style={{ fontSize: '14px', color: C.textSub }}>{user.email}</p>
          </div>
          <div className="card reveal delay-1" style={{ padding: '20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: C.textMuted, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Username</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input value={settingsUsername} onChange={e => setSettingsUsername(e.target.value)} placeholder="Choose a username" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && saveUsername()} />
              <button className="btn btn-primary" onClick={saveUsername} style={{ fontSize: '13px', padding: '0 16px' }}>Save</button>
            </div>
          </div>
          <div className="card reveal delay-1" style={{ padding: '20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IRD Number</p>
            <p style={{ fontSize: '12px', color: C.textMuted, marginBottom: '10px' }}>Required for NZ tax reporting. Never shown publicly.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input value={settingsIrd} onChange={e => setSettingsIrd(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder={myProfile?.ird_number ? '••••••••' : 'e.g. 123456789'} style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={saveIrd} style={{ fontSize: '13px', padding: '0 16px', flexShrink: 0 }}>Save</button>
            </div>
          </div>
          <div className="card reveal delay-2" style={{ padding: '20px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: '600', color: C.text, marginBottom: '2px' }}>Dark mode</p>
                <p style={{ fontSize: '12px', color: C.textMuted }}>Easy on the eyes at night</p>
              </div>
              <button onClick={() => setDark(d => !d)} style={{ width: '44px', height: '24px', borderRadius: '12px', background: dark ? '#1E5470' : C.cardBorder, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: '3px', left: dark ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '9px', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          </div>
          <div className="card reveal delay-3" style={{ padding: '20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Keyword Alerts</p>
            <p style={{ fontSize: '12px', color: C.textMuted, marginBottom: '12px' }}>As a seller, get notified the moment a buyer posts a want matching what you offer. Set your keywords once, get matched automatically.</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)} placeholder="e.g. iPhone, bicycle…" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && addKeyword()} maxLength={60} />
              <button className="btn btn-primary" onClick={addKeyword} disabled={!newKeyword.trim()} style={{ fontSize: '13px', padding: '0 16px', flexShrink: 0 }}>Add</button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {myKeywords.length === 0 && <p style={{ fontSize: '12px', color: C.textMuted, fontStyle: 'italic' }}>No keywords yet</p>}
              {myKeywords.map(kw => (
                <div key={kw.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 8px 5px 12px', background: dark ? '#0A3060' : '#EAF0F4', border: `1px solid ${dark ? '#1E3A5F' : '#B8DFF2'}`, borderRadius: '20px', fontSize: '12px', color: C.accentText }}>
                  {kw.keyword}
                  <button onClick={() => removeKeyword(kw.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: '16px', padding: '0', lineHeight: '1', display: 'flex', alignItems: 'center' }}>×</button>
                </div>
              ))}
            </div>
          </div>
          <div className="card fade-up" style={{ padding: '20px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: C.text }}>Push notifications</div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>Get alerted for offers and messages</div>
              </div>
              {pushEnabled ? (
                <span style={{ fontSize: '11px', background: dark ? 'rgba(14,154,110,0.15)' : '#EDFAF4', color: '#0E9A6E', border: '1px solid #A7EDD4', borderRadius: '20px', padding: '3px 10px', fontWeight: '700' }}>On</span>
              ) : (
                <button className="btn btn-primary" onClick={subscribeToPush} style={{ fontSize: '12px', padding: '7px 16px' }}>Enable</button>
              )}
            </div>
          </div>
          <div className="card fade-up" style={{ padding: '20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Refer a friend</p>
            <p style={{ fontSize: '12px', color: C.textMuted, marginBottom: '12px' }}>Share your link — earn bragging rights when friends join</p>
            {myProfile?.referral_code ? (
              <>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ flex: 1, background: dark ? '#0A192F' : '#F0F5FA', border: `1.5px solid ${C.cardBorder}`, borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: C.accentText, fontWeight: '600', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    offrit.com?ref={myProfile.referral_code}
                  </div>
                  <button className="btn btn-primary" style={{ flexShrink: 0, fontSize: '12px', padding: '10px 14px' }}
                    onClick={() => { navigator.clipboard.writeText(`https://offrit.com?ref=${myProfile.referral_code}`); showToast('Link copied!') }}>
                    Copy
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '22px', fontWeight: '800', color: C.accentText }}>{referralCount}</span>
                  <span style={{ fontSize: '13px', color: C.textSub }}>{referralCount === 1 ? 'person joined' : 'people joined'} via your link</span>
                </div>
              </>
            ) : (
              <p style={{ fontSize: '13px', color: C.textMuted, fontStyle: 'italic' }}>Your referral link will appear here after you confirm your email.</p>
            )}
          </div>
          <div className="card fade-up" style={{ padding: '20px', marginBottom: '12px' }}>
            <button className="btn btn-red" onClick={handleLogout} style={{ width: '100%', padding: '12px' }}>Log out</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', paddingBottom: '16px' }}>
            <span onClick={() => setPage('terms')} style={{ fontSize: '12px', color: C.textMuted, cursor: 'pointer' }}>Terms of Service</span>
            <span style={{ fontSize: '12px', color: C.cardBorder }}>·</span>
            <span onClick={() => setPage('privacy')} style={{ fontSize: '12px', color: C.textMuted, cursor: 'pointer' }}>Privacy Policy</span>
          </div>
        </div>
        {BottomNav()}
      </div>
    )
  }

  // HOME (logged in)
  const hour = new Date().getHours()
  const greetWord = 'Welcome'
  const displayName = myProfile?.username || user?.email?.split('@')[0] || ''
  const todayStr = new Date().toDateString()
  const todayCount = wants.filter(w => new Date(w.created_at).toDateString() === todayStr).length
  const tickerWants = wants.slice(0, 12)
  return (
    <div style={pageStyle} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <style>{styles}</style>
      {Header()}
      {toast && <div className={`toast toast-${toast.type || 'default'}`}><span>{toast.msg}</span><button className="toast-close" onClick={() => setToast(null)}>✕</button></div>}
      {DealRatingModal()}
      {reportModal && ReportModal()}
      {showLocationPicker && LocationPicker()}
      {pullDistance > 20 && (
        <div className="pull-indicator" style={{ opacity: pullDistance / 80 }}>
          {pullDistance > 60 ? '↓ Release to refresh' : '↓ Pull to refresh'}
        </div>
      )}
      {refreshing && <div className="pull-indicator">Refreshing…</div>}

      {(!user || page === 'landing') && tickerWants.length >= 4 && (
        <div className="ticker-strip" style={{ background: C.card, borderBottom: `1px solid ${C.cardBorder}`, paddingTop: '8px', paddingBottom: '8px' }}>
          <div className="ticker-track">
            {[...tickerWants, ...tickerWants].map((w, i) => {
              const mins = Math.floor((Date.now() - new Date(w.created_at)) / 60000)
              const age = mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`
              return (
                <div key={i} className="ticker-item" onClick={() => openWant(w)} style={{ color: C.textSub }}>
                  <span className="live-dot" />
                  <span style={{ color: C.text, fontWeight: '500' }}>{w.title}</span>
                  <span style={{ color: C.textMuted, fontSize: '11px' }}>· {w.location} · {age}</span>
                  <span className="ticker-sep">·</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="greeting-bar">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: '0.12em', color: '#7A6F5C', marginBottom: 4, textTransform: 'uppercase' }}>
              Hi, {displayName ? (displayName.slice(0, 10).toUpperCase() + (displayName.length > 10 ? '…' : '')) : 'THERE'}
            </div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 400, letterSpacing: '-0.5px', color: dark ? C.text : '#16110A', margin: 0, lineHeight: 1.15 }}>
              Browse wants
            </h1>
          </div>
          {myNewOffers > 0 && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div onClick={() => setShowOffersMenu(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#16110A', color: '#fff', borderRadius: '20px', padding: '5px 11px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                {myNewOffers} new offer{myNewOffers !== 1 ? 's' : ''}
                <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
              </div>
              {showOffersMenu && (
                <>
                  <div onClick={() => setShowOffersMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: '14px', boxShadow: '0 8px 24px rgba(15,32,48,0.14)', padding: '6px', zIndex: 99, minWidth: '170px' }}>
                    <button onClick={() => { markAllOffersRead() }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '9px', border: 'none', background: 'transparent', color: C.text, fontSize: '13px', fontWeight: '500', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? '#1a3a5c' : '#F5F3EE'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <svg width="14" height="14" fill="none" stroke="#3F6F4E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                      Mark all as read
                    </button>
                    <button onClick={() => { setShowOffersMenu(false); setPage('mylistings') }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '9px', border: 'none', background: 'transparent', color: C.text, fontSize: '13px', fontWeight: '500', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? '#1a3a5c' : '#F5F3EE'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <svg width="14" height="14" fill="none" stroke={C.accentText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                      View listings
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={inner}>
        {notifications.length > 0 && (
          <div className="home-alert" onClick={() => setShowNotifications(true)} style={{ background: dark ? 'rgba(30,84,112,0.12)' : '#EAF0F4', border: `1.5px solid ${dark ? 'rgba(30,84,112,0.3)' : '#C9D7E0'}` }}>
            <div style={{ width: '34px', height: '34px', background: '#1E5470', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>{notifications.length} new notification{notifications.length !== 1 ? 's' : ''}</div>
              <div style={{ fontSize: '11px', color: C.textMuted }}>Tap to view</div>
            </div>
            <svg width="14" height="14" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        )}

        {SearchFilters()}
        {FeaturedSection()}

        {user && myKeywords.length === 0 && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: '0.12em', color: '#7A6F5C', marginBottom: 4, textTransform: 'uppercase' }}>Seller Nudge</div>
              <div style={{ fontSize: 13, color: dark ? C.textSub : '#3D3528' }}>Get notified when buyers post matching wants.</div>
            </div>
            <a href="#" onClick={e => { e.preventDefault(); setPage('settings') }} style={{ fontSize: 13, color: dark ? C.accentText : '#1E5470', whiteSpace: 'nowrap', textDecoration: 'none' }}>Set up alerts →</a>
          </div>
        )}

        {myWants.length === 0 && !loading && (
          <div onClick={() => setPage('post')} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: C.card, border: `1.5px dashed ${C.accentText}`, borderRadius: '14px', padding: '14px 18px', marginBottom: '16px', cursor: 'pointer' }}>
            <div style={{ width: '34px', height: '34px', background: '#16110A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>Post your first want</div>
              <div style={{ fontSize: '12px', color: C.textMuted }}>Tell sellers what you need and receive offers</div>
            </div>
            <svg width="14" height="14" fill="none" stroke={C.accentText} strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: C.text }}>Listings</span>
          <span style={{ fontSize: '12px', color: C.textMuted }}>{filteredWants.length} result{filteredWants.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? [1,2,3].map(i => <SkeletonCard key={i} hasImage={i !== 2} />) : filteredWants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 20px 40px' }}>
            <svg width="40" height="40" fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ marginBottom: '14px', opacity: 0.6 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p style={{ fontSize: '15px', fontWeight: '600', color: C.text, marginBottom: '6px' }}>Nothing here yet</p>
            <p style={{ fontSize: '13px', color: C.textMuted, lineHeight: '1.55' }}>Try a different location, category, or clear your filters</p>
          </div>
        ) : filteredWants.map((want, i) => <Fragment key={want.id}>{WantCard({ want, index: i })}</Fragment>)}
        {!loading && hasMoreWants && !search && !filterLocation && !filterCategory && !filterMaxBudget && !filterType && !nearMe && (
          <button className="btn" onClick={() => fetchWants(wants.length, true)} disabled={loadingMore} style={{ width: '100%', padding: '13px', marginTop: '4px', fontSize: '14px' }}>
            {loadingMore ? 'Loading…' : 'Load more listings'}
          </button>
        )}
      </div>
      {BottomNav()}
    </div>
  )
}

export default App