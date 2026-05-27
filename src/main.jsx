import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx';
import MapEmbedApp from './map/MapEmbedApp.jsx';
import './styles.css';

const Root = window.location.pathname.startsWith('/embed/') ? MapEmbedApp : App;

createRoot(document.getElementById('root')).render(<AppErrorBoundary><Root /></AppErrorBoundary>);
