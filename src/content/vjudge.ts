import './ui.css';
import { startVjudge } from './vjudge-controller';

// La página padre lee el iframe mismo origen y monta una sola barra fuera de ?l.
if (window === window.top) startVjudge();
