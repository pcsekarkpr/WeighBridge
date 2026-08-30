import React from 'react';
import { createRoot } from 'react-dom/client';
import WeighForm from './renderer/components/WeighForm.jsx';
import './index.css'; // Ensures your Tailwind styles apply

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <WeighForm />
  </React.StrictMode>
);