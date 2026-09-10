import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ShareView } from './components/Share/ShareView.tsx'

const path = window.location.pathname;
const isShare = path.startsWith('/share/');
const shareId = isShare ? path.split('/share/')[1] : null;

createRoot(document.getElementById('root')!).render(
  <>
    {isShare && shareId ? <ShareView fileId={shareId} /> : <App />}
  </>
)
