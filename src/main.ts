import './reboot/reboot.css';
import { startRebootApp } from './reboot/rebootApp';

void startRebootApp().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<pre style="padding:24px;font:14px/1.5 monospace;color:#721c24;background:#f8d7da">${String(error)}</pre>`;
});
