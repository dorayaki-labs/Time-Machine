import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
// Noto Sans JP is not imported here: it is self-hosted from public/fonts and
// declared with @font-face in styles/variables.css, so it always loads, even
// offline and in browsers without any Japanese system fonts.
import './styles/variables.css';
import './styles/global.css';
import './styles/navigation.css';
import './styles/cards.css';
import './styles/pages.css';
import './styles/settings.css';
import './styles/studio.css';
import './styles/responsive.css';
import './styles/backend.css';
import App from './App.jsx';
import { ThemeProvider, applySavedThemeToDocument } from '@/hooks/useTheme.jsx';
import { AppSettingsProvider } from '@/hooks/useAppSettings.jsx';

// The saved theme's full token set (custom colours, density, radius, …) goes
// on the document before the first render — the inline script in index.html
// already handled the base palette and background, so nothing flashes.
applySavedThemeToDocument();

// Diagnostics: the build marker makes "is the deployed bundle actually the
// newest one?" answerable at a glance — a cached stale bundle after a deploy
// looks exactly like a bug that "came back". The global handlers give every
// unhandled rejection a recognizable console prefix instead of letting it
// vanish into the default browser noise.
console.info(`Time Machine UI · build ${import.meta.env.VITE_BUILD_ID ?? 'development'}`);
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Time Machine] unhandled promise rejection:', event.reason);
});
window.addEventListener('error', (event) => {
  if (event.error) console.error('[Time Machine] uncaught error:', event.error);
});

// The router must know the deploy prefix — import.meta.env.BASE_URL is
// "/time-machine/" on GitHub Pages project sites. Without it, every URL
// (including the site root) falls through to the 404 page.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AppSettingsProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'}>
          <App />
        </BrowserRouter>
      </AppSettingsProvider>
    </ThemeProvider>
  </StrictMode>,
);
