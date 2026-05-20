import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'

function AuthenticatedApp() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  return <Dashboard session={session} onLogout={() => setSession(null)} />
}

function App() {
  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true' || import.meta.env.VITE_BYPASS_AUTH === '1'

  if (bypassAuth) {
    return (
      <Dashboard
        session={{
          user: {
            id: '00000000-0000-0000-0000-000000000000',
            email: import.meta.env.VITE_TEST_EMAIL || 'test@example.com',
          },
        }}
        onLogout={() => {}}
      />
    )
  }

  return <AuthenticatedApp />
}

export default App
