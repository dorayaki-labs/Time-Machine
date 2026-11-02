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
import './styles/responsive.css';
import './styles/backend.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
