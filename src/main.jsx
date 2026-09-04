import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode désactivé : PixiJS (WebGL) ne survit pas au double-montage dev
createRoot(document.getElementById('root')).render(<App />)
