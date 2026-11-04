import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginScreen } from '@/features/auth/LoginScreen.tsx'
import { HomeScreen } from '@/features/home/HomeScreen.tsx'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
