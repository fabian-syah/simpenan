import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ShareView } from './components/Share/ShareView.tsx'

const path = window.location.pathname;
const isShare = path.startsWith('/share');
const rawShareId = isShare ? path.replace(/^\/share\/?/, '').split('/')[0].split('?')[0].trim() : null;
const shareId = rawShareId && rawShareId.length > 0 ? rawShareId : null;

createRoot(document.getElementById('root')!).render(
  <>
    {isShare && shareId ? <ShareView fileId={shareId} /> : <App />}
  </>
)
