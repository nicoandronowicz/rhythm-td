import { App } from './app/app';
import { tuning } from './config/tuningStore';
import './ui/style.css';

const app = new App();

// Handy for debugging from the console.
Object.assign(window, { rhythmTd: { app, tuning, get world() { return app.session?.world; }, engine: app.engine } });
