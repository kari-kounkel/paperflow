import { useState } from 'react'
import { supabase } from './supabase'

const C = {
  bg: '#140E09', card: '#1E1510', gold: '#D4943A', goldDim: 'rgba(212,148,58,0.18)',
  w: '#E8D5B5', g: '#9C8B78', border: 'rgba(232,213,181,0.08)', red: '#B84233', green: '#7BA67A'
}

export default function Auth({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [mode, setMode] = useState('login')

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true); setErr('')
    const { error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password: pass })
      : await supabase.auth.signUp({ email, password: pass })
    if (error) setErr(error.message)
    else if (mode === 'signup') setErr('Check your email to confirm, then log in.')
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <form onSubmit={handle} style={{ background: C.card, padding: 40, borderRadius: 16, border: `1px solid ${C.border}`, width: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>📄</div>
          <h1 style={{ color: C.gold, fontSize: 24, margin: 0, fontWeight: 700 }}>PaperFlow</h1>
          <p style={{ color: C.g, fontSize: 12, margin: '4px 0 0', fontFamily: "'DM Mono', monospace" }}>CARES Workflows • Document Brain</p>
        </div>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
          style={{ width: '100%', padding: '10px 14px', marginBottom: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        <input value={pass} onChange={e => setPass(e.target.value)} placeholder="Password" type="password"
          style={{ width: '100%', padding: '10px 14px', marginBottom: 16, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        {err && <p style={{ color: err.includes('Check') ? C.green : C.red, fontSize: 12, marginBottom: 10 }}>{err}</p>}
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: '12px 0', background: C.gold, color: '#140E09', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 10 }}>
          {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
        <p onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          style={{ textAlign: 'center', color: C.g, fontSize: 12, cursor: 'pointer', margin: 0 }}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have one? Log in'}
        </p>
      </form>
    </div>
  )
}
