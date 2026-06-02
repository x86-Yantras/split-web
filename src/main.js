// Vite entry. Loads SplitSplit's original window-global modules in dependency
// order (mirrors the old <script> order in SplitSplit.html), then mounts.
// JSX in .jsx files is transpiled by esbuild (React injected via vite.config).
import React from 'react';
import { createRoot } from 'react-dom/client';

// Data + auth layer (UMD modules; each attaches to window). Order matters at
// eval time: domain.js reads window.CCY, store.js reads window.SSDomain.
import './currency.js';
import './data.js';
import './auth.js';
import './domain.js';
import './sheets.js';
import './store.js';

// UI primitives + device chrome.
import './ios-frame.jsx';
import './tweaks-panel.jsx';
import './ui.jsx';
import './screens/Empty.jsx';

// Screens (all attach window.<Name>Screen).
import './screens/SignIn.jsx';
import './screens/Home.jsx';
import './screens/Group.jsx';
import './screens/AddExpense.jsx';
import './screens/Friends.jsx';
import './screens/Friend.jsx';
import './screens/Settle.jsx';
import './screens/Activity.jsx';
import './screens/Profile.jsx';
import './screens/Invite.jsx';
import './screens/Join.jsx';
import './screens/Expense.jsx';
import './app.jsx';

// store.js's useStore hook and any non-JSX file reference a global React.
window.React = React;

const root = createRoot(document.getElementById('root'));
root.render(
  React.createElement(window.IOSDevice, { width: 402, height: 874 },
    React.createElement(window.App))
);
