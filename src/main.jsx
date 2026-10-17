import { createRoot } from 'react-dom/client'
import './index.css'
// Before App: detection must read ?lang/?country/?currency before socketClient strips them
import './i18n/index.js'
import App from './App.jsx'

// StrictMode désactivé : PixiJS (WebGL) ne survit pas au double-montage dev
createRoot(document.getElementById('root')).render(<App />)
