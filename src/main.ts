import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MachineGame } from './MachineGame';

const root = document.querySelector<HTMLElement>('#root');
if (!root) throw new Error('Root container not found');

createRoot(root).render(createElement(MachineGame));
