import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
import './index.css';
import { SettingsProvider } from './state/SettingsProvider';
import { ToastProvider } from './state/ToastProvider';
import { LibraryProvider } from './state/LibraryProvider';
import { WorkspaceProvider } from './state/WorkspaceProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <MotionConfig reducedMotion="user">
        <SettingsProvider>
          <ToastProvider>
            <LibraryProvider>
              <WorkspaceProvider>
                <App />
              </WorkspaceProvider>
            </LibraryProvider>
          </ToastProvider>
        </SettingsProvider>
      </MotionConfig>
    </HashRouter>
  </React.StrictMode>,
);
