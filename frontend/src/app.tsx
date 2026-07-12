import { Analytics } from '@vercel/analytics/react'
import Home from './pages/home'

export default function App() {
  return (
    <>
      <Home />
      <Analytics />
    </>
  )
}
