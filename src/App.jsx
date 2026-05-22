import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'

function AuthenticatedApp() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tgId = params.get('tg_id')
    const token = params.get('token')

    if (tgId && token) {
      validateAuthToken(tgId, token).then((userData) => {
        if (userData) {
          setSession({
            user: {
              id: userData.user_id.toString(),
              email: userData.email || '',
              tg_id: userData.user_id,
            },
          })
          window.history.replaceState({}, document.title, window.location.pathname)
        }
        setLoading(false)
      })
      return
    }

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

async function validateAuthToken(tgId, token) {
  try {
    const { data: edgeData, error: edgeError } = await supabase.functions
      .invoke('verify-telegram-auth', {
        body: { token, tg_id: parseInt(tgId) },
      })

    if (!edgeError && edgeData?.token_hash) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: edgeData.token_hash,
        type: 'magiclink',
      })
      if (!verifyError) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          return {
            user_id: tgId,
            email: edgeData.email,
          }
        }
      }
    }

    const { data, error } = await supabase
      .from('auth_tokens')
      .select('user_id, email, expires_at, used')
      .eq('token', token)
      .eq('user_id', parseInt(tgId))
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    if (data.used) return null

    const now = new Date().toISOString()
    if (data.expires_at < now) return null

    await supabase
      .from('auth_tokens')
      .update({ used: true })
      .eq('token', token)

    return data
  } catch {
    return null
  }
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
