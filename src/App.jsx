import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// ── Theme ──
const C = {
  bg: '#0a0e17', card: '#111827', cardHover: '#1a2235', gold: '#f0b429',
  goldDim: 'rgba(240,180,41,0.12)', w: '#f1f5f9', g: '#94a3b8', gDark: '#64748b',
  border: 'rgba(255,255,255,0.06)', red: '#ef4444', green: '#34d399',
  greenDim: 'rgba(52,211,153,0.12)', blueDim: 'rgba(96,165,250,0.12)', blue: '#60a5fa',
  purpleDim: 'rgba(167,139,250,0.12)', purple: '#a78bfa'
}

const mono = "'DM Mono', monospace"
const sans = "'DM Sans', sans-serif"

// ── Reusable Components ──
const Btn = ({ children, onClick, gold, ghost, small, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? '4px 10px' : '8px 16px',
    background: gold ? C.gold : ghost ? 'transparent' : C.cardHover,
    color: gold ? '#000' : C.w, border: ghost ? `1px solid ${C.border}` : 'none',
    borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, fontSize: small ? 11 : 13, fontFamily: sans,
    opacity: disabled ? 0.5 : 1, ...style
  }}>{children}</button>
)

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, ...style }}>{children}</div>
)

const Badge = ({ children, color = C.gold, bg = C.goldDim }) => (
  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: bg, color, fontFamily: mono, fontWeight: 500 }}>{children}</span>
)

// ── Note Type Config ──
const NOTE_TYPES = {
  general: { label: '💬 General', color: C.g },
  negotiation: { label: '🤝 Negotiation', color: C.gold },
  question: { label: '❓ Question', color: C.blue },
  proposed_change: { label: '✏️ Proposed Change', color: C.purple }
}

export default function App({ session }) {
  // ── State ──
  const [sections, setSections] = useState([])
  const [notes, setNotes] = useState([])
  const [pushes, setPushes] = useState([])
  const [acks, setAcks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState(null)
  const [tab, setTab] = useState('sections') // sections | pushes | notes
  const [search, setSearch] = useState('')
  const [docFilter, setDocFilter] = useState('all') // all | contract | handbook
  const [showAddSection, setShowAddSection] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [showPush, setShowPush] = useState(false)

  // ── Form state ──
  const [newSection, setNewSection] = useState({ doc_type: 'contract', section_number: '', title: '', body: '', kari_notes: '', category: '' })
  const [newNote, setNewNote] = useState({ author: 'Kari', note: '', note_type: 'general' })
  const [newPush, setNewPush] = useState({ pushed_to: '', push_method: 'email', message: '' })

  // ── Load Data ──
  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [secRes, noteRes, pushRes, ackRes] = await Promise.all([
      supabase.from('contract_sections').select('*').order('sort_order'),
      supabase.from('contract_notes').select('*').order('created_at', { ascending: false }),
      supabase.from('policy_pushes').select('*').order('created_at', { ascending: false }),
      supabase.from('push_acknowledgments').select('*')
    ])
    if (secRes.data) setSections(secRes.data)
    if (noteRes.data) setNotes(noteRes.data)
    if (pushRes.data) setPushes(pushRes.data)
    if (ackRes.data) setAcks(ackRes.data)
    setLoading(false)
  }

  // ── CRUD: Sections ──
  const addSection = async () => {
    const { data, error } = await supabase.from('contract_sections').insert([{
      ...newSection, sort_order: sections.length + 1
    }]).select()
    if (data) { setSections([...sections, ...data]); setShowAddSection(false); setNewSection({ doc_type: 'contract', section_number: '', title: '', body: '', kari_notes: '', category: '' }) }
    if (error) alert(error.message)
  }

  const updateSection = async (id, updates) => {
    const { error } = await supabase.from('contract_sections').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (!error) setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  // ── CRUD: Notes ──
  const addNote = async () => {
    if (!activeSection || !newNote.note.trim()) return
    const { data, error } = await supabase.from('contract_notes').insert([{
      section_id: activeSection.id, ...newNote
    }]).select()
    if (data) { setNotes([...data, ...notes]); setNewNote({ author: 'Kari', note: '', note_type: 'general' }); setShowAddNote(false) }
    if (error) alert(error.message)
  }

  const toggleResolved = async (noteId, current) => {
    const { error } = await supabase.from('contract_notes').update({ resolved: !current }).eq('id', noteId)
    if (!error) setNotes(notes.map(n => n.id === noteId ? { ...n, resolved: !current } : n))
  }

  // ── CRUD: Pushes ──
  const createPush = async () => {
    if (!activeSection) return
    const recipients = newPush.pushed_to.split(',').map(s => s.trim()).filter(Boolean)
    if (!recipients.length) return
    const { data, error } = await supabase.from('policy_pushes').insert([{
      section_id: activeSection.id,
      pushed_by: session.user.email,
      pushed_to: recipients,
      push_method: newPush.push_method,
      message: newPush.message
    }]).select()
    if (data && data[0]) {
      setPushes([...data, ...pushes])
      // Create acknowledgment stubs for each recipient
      const ackInserts = recipients.map(name => ({ push_id: data[0].id, employee_name: name }))
      const { data: ackData } = await supabase.from('push_acknowledgments').insert(ackInserts).select()
      if (ackData) setAcks([...acks, ...ackData])
      setShowPush(false); setNewPush({ pushed_to: '', push_method: 'email', message: '' })
    }
    if (error) alert(error.message)
  }

  const toggleAck = async (ackId, current) => {
    const updates = current
      ? { acknowledged: false, acknowledged_at: null }
      : { acknowledged: true, acknowledged_at: new Date().toISOString() }
    const { error } = await supabase.from('push_acknowledgments').update(updates).eq('id', ackId)
    if (!error) setAcks(acks.map(a => a.id === ackId ? { ...a, ...updates } : a))
  }

  // ── Filters ──
  const filtered = sections.filter(s => {
    if (docFilter !== 'all' && s.doc_type !== docFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return s.title.toLowerCase().includes(q) || s.section_number.toLowerCase().includes(q) || (s.body || '').toLowerCase().includes(q)
    }
    return true
  })

  const sectionNotes = activeSection ? notes.filter(n => n.section_id === activeSection.id) : []
  const sectionPushes = activeSection ? pushes.filter(p => p.section_id === activeSection.id) : []

  // ── Stats ──
  const totalNotes = notes.length
  const openQuestions = notes.filter(n => n.note_type === 'question' && !n.resolved).length
  const totalPushes = pushes.length
  const pendingAcks = acks.filter(a => !a.acknowledged).length

  const logout = async () => { await supabase.auth.signOut() }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontFamily: sans }}>
      Loading PaperFlow...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.w, fontFamily: sans }}>
      {/* ── Header ── */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>📄</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: C.gold, fontWeight: 700 }}>PaperFlow</h1>
            <span style={{ fontSize: 10, color: C.gDark, fontFamily: mono }}>CARES Workflows • Document Brain</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="https://hr.caresmn.com" target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: C.g, textDecoration: 'none', fontFamily: mono }}>← PeopleFlow</a>
          <span style={{ fontSize: 11, color: C.gDark, fontFamily: mono }}>{session.user.email}</span>
          <Btn small ghost onClick={logout}>Sign Out</Btn>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: 16, borderBottom: `1px solid ${C.border}` }}>
        <Badge>{sections.length} sections</Badge>
        <Badge color={C.blue} bg={C.blueDim}>{totalNotes} notes</Badge>
        <Badge color={openQuestions > 0 ? C.red : C.green} bg={openQuestions > 0 ? 'rgba(239,68,68,0.12)' : C.greenDim}>
          {openQuestions} open questions
        </Badge>
        <Badge color={C.purple} bg={C.purpleDim}>{totalPushes} pushes</Badge>
        <Badge color={pendingAcks > 0 ? C.gold : C.green} bg={pendingAcks > 0 ? C.goldDim : C.greenDim}>
          {pendingAcks} pending acks
        </Badge>
      </div>

      {/* ── Main Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', minHeight: 'calc(100vh - 110px)' }}>
        {/* ── Left: Section List ── */}
        <div style={{ borderRight: `1px solid ${C.border}`, padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 110px)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['all', 'contract', 'handbook'].map(f => (
              <Btn key={f} small onClick={() => setDocFilter(f)} gold={docFilter === f} ghost={docFilter !== f}>
                {f === 'all' ? '📋 All' : f === 'contract' ? '📜 Contract' : '📘 Handbook'}
              </Btn>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sections..."
            style={{ width: '100%', padding: '8px 12px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
          <Btn small gold onClick={() => setShowAddSection(true)} style={{ width: '100%', marginBottom: 12 }}>+ Add Section</Btn>

          {filtered.map(s => {
            const sNotes = notes.filter(n => n.section_id === s.id)
            const sQuestions = sNotes.filter(n => n.note_type === 'question' && !n.resolved).length
            return (
              <div key={s.id} onClick={() => { setActiveSection(s); setTab('sections') }}
                style={{
                  padding: '10px 12px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                  background: activeSection?.id === s.id ? C.goldDim : 'transparent',
                  border: `1px solid ${activeSection?.id === s.id ? 'rgba(240,180,41,0.2)' : 'transparent'}`
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 10, color: C.gDark, fontFamily: mono }}>{s.doc_type === 'contract' ? '📜' : '📘'} {s.section_number}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: activeSection?.id === s.id ? C.gold : C.w, marginTop: 2 }}>{s.title}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {sNotes.length > 0 && <Badge color={C.blue} bg={C.blueDim}>{sNotes.length}</Badge>}
                    {sQuestions > 0 && <Badge color={C.red} bg="rgba(239,68,68,0.12)">?{sQuestions}</Badge>}
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <p style={{ color: C.gDark, fontSize: 13, textAlign: 'center', padding: 20 }}>No sections yet. Add your first one.</p>}
        </div>

        {/* ── Right: Detail Panel ── */}
        <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 110px)' }}>
          {!activeSection ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.gDark }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                <p style={{ fontSize: 16 }}>Select a section to view details</p>
                <p style={{ fontSize: 12, fontFamily: mono }}>or add your first one</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[['sections', '📋 Content'], ['notes', `💬 Notes (${sectionNotes.length})`], ['pushes', `📣 Pushes (${sectionPushes.length})`]].map(([t, label]) => (
                  <Btn key={t} onClick={() => setTab(t)} gold={tab === t} ghost={tab !== t}>{label}</Btn>
                ))}
              </div>

              {/* ── Content Tab ── */}
              {tab === 'sections' && (
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <Badge>{activeSection.doc_type}</Badge>
                      <h2 style={{ margin: '8px 0 4px', fontSize: 20, color: C.gold }}>{activeSection.section_number} — {activeSection.title}</h2>
                      {activeSection.category && <span style={{ fontSize: 11, color: C.gDark, fontFamily: mono }}>{activeSection.category}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn small ghost onClick={() => setShowPush(true)}>📣 Push</Btn>
                      <Btn small ghost onClick={() => setShowAddNote(true)}>💬 Note</Btn>
                    </div>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7, color: C.w }}>{activeSection.body}</div>
                  {activeSection.kari_notes && (
                    <div style={{ marginTop: 16, padding: 12, background: C.goldDim, borderRadius: 8, borderLeft: `3px solid ${C.gold}` }}>
                      <span style={{ fontSize: 10, color: C.gold, fontFamily: mono, fontWeight: 600 }}>KARI'S NOTES</span>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: C.w }}>{activeSection.kari_notes}</p>
                    </div>
                  )}
                </Card>
              )}

              {/* ── Notes Tab ── */}
              {tab === 'notes' && (
                <div>
                  <Btn small gold onClick={() => setShowAddNote(true)} style={{ marginBottom: 12 }}>+ Add Note</Btn>
                  {sectionNotes.length === 0 && <p style={{ color: C.gDark, fontSize: 13 }}>No notes on this section yet.</p>}
                  {sectionNotes.map(n => (
                    <Card key={n.id} style={{ marginBottom: 8, opacity: n.resolved ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: NOTE_TYPES[n.note_type]?.color || C.g }}>{NOTE_TYPES[n.note_type]?.label || n.note_type}</span>
                          <span style={{ fontSize: 11, color: C.gDark, fontFamily: mono }}>— {n.author}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: C.gDark, fontFamily: mono }}>{new Date(n.created_at).toLocaleDateString()}</span>
                          <Btn small ghost onClick={() => toggleResolved(n.id, n.resolved)}>{n.resolved ? '↩ Reopen' : '✓ Resolve'}</Btn>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, textDecoration: n.resolved ? 'line-through' : 'none' }}>{n.note}</p>
                    </Card>
                  ))}
                </div>
              )}

              {/* ── Pushes Tab ── */}
              {tab === 'pushes' && (
                <div>
                  <Btn small gold onClick={() => setShowPush(true)} style={{ marginBottom: 12 }}>+ New Push</Btn>
                  {sectionPushes.length === 0 && <p style={{ color: C.gDark, fontSize: 13 }}>No pushes for this section yet.</p>}
                  {sectionPushes.map(p => {
                    const pAcks = acks.filter(a => a.push_id === p.id)
                    const acked = pAcks.filter(a => a.acknowledged).length
                    return (
                      <Card key={p.id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <span style={{ fontSize: 11, color: C.gDark, fontFamily: mono }}>
                              {new Date(p.created_at).toLocaleDateString()} via {p.push_method}
                            </span>
                            <div style={{ fontSize: 12, color: C.g, marginTop: 2 }}>By: {p.pushed_by}</div>
                          </div>
                          <Badge color={acked === pAcks.length ? C.green : C.gold} bg={acked === pAcks.length ? C.greenDim : C.goldDim}>
                            {acked}/{pAcks.length} ack'd
                          </Badge>
                        </div>
                        {p.message && <p style={{ fontSize: 12, color: C.g, margin: '0 0 8px', fontStyle: 'italic' }}>{p.message}</p>}
                        {pAcks.map(a => (
                          <div key={a.id} onClick={() => toggleAck(a.id, a.acknowledged)}
                            style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: a.acknowledged ? C.greenDim : C.bg, borderRadius: 6, marginBottom: 2, cursor: 'pointer' }}>
                            <span style={{ fontSize: 12, color: a.acknowledged ? C.green : C.w }}>
                              {a.acknowledged ? '☑' : '☐'} {a.employee_name}
                            </span>
                            {a.acknowledged_at && <span style={{ fontSize: 10, color: C.gDark, fontFamily: mono }}>{new Date(a.acknowledged_at).toLocaleDateString()}</span>}
                          </div>
                        ))}
                      </Card>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modal: Add Section ── */}
      {showAddSection && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <Card style={{ width: 500, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: C.gold }}>Add Section</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select value={newSection.doc_type} onChange={e => setNewSection({ ...newSection, doc_type: e.target.value })}
                style={{ padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13 }}>
                <option value="contract">📜 Contract</option>
                <option value="handbook">📘 Handbook</option>
              </select>
              <input value={newSection.section_number} onChange={e => setNewSection({ ...newSection, section_number: e.target.value })}
                placeholder="Section # (e.g. 2, 6.1)" style={{ padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13 }} />
            </div>
            <input value={newSection.title} onChange={e => setNewSection({ ...newSection, title: e.target.value })}
              placeholder="Title" style={{ width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
            <input value={newSection.category} onChange={e => setNewSection({ ...newSection, category: e.target.value })}
              placeholder="Category (e.g. Wages, Leave, Discipline)" style={{ width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
            <textarea value={newSection.body} onChange={e => setNewSection({ ...newSection, body: e.target.value })}
              placeholder="Full section text..." rows={8} style={{ width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13, marginBottom: 10, resize: 'vertical', boxSizing: 'border-box' }} />
            <textarea value={newSection.kari_notes} onChange={e => setNewSection({ ...newSection, kari_notes: e.target.value })}
              placeholder="Kari's notes (optional)" rows={3} style={{ width: '100%', padding: '8px 10px', background: C.goldDim, border: `1px solid rgba(240,180,41,0.2)`, borderRadius: 8, color: C.w, fontSize: 13, marginBottom: 16, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn ghost onClick={() => setShowAddSection(false)}>Cancel</Btn>
              <Btn gold onClick={addSection} disabled={!newSection.title || !newSection.body}>Save Section</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal: Add Note ── */}
      {showAddNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <Card style={{ width: 420 }}>
            <h3 style={{ margin: '0 0 16px', color: C.gold }}>Add Note — {activeSection?.title}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select value={newNote.author} onChange={e => setNewNote({ ...newNote, author: e.target.value })}
                style={{ padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13 }}>
                <option>Kari</option><option>Frank</option><option>Desiree</option>
              </select>
              <select value={newNote.note_type} onChange={e => setNewNote({ ...newNote, note_type: e.target.value })}
                style={{ padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13 }}>
                {Object.entries(NOTE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <textarea value={newNote.note} onChange={e => setNewNote({ ...newNote, note: e.target.value })}
              placeholder="Your note..." rows={4} style={{ width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13, marginBottom: 16, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn ghost onClick={() => setShowAddNote(false)}>Cancel</Btn>
              <Btn gold onClick={addNote} disabled={!newNote.note.trim()}>Save Note</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal: Push Policy ── */}
      {showPush && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <Card style={{ width: 420 }}>
            <h3 style={{ margin: '0 0 16px', color: C.gold }}>📣 Push — {activeSection?.title}</h3>
            <input value={newPush.pushed_to} onChange={e => setNewPush({ ...newPush, pushed_to: e.target.value })}
              placeholder="Recipients (comma-separated names)" style={{ width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
            <select value={newPush.push_method} onChange={e => setNewPush({ ...newPush, push_method: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13, marginBottom: 10 }}>
              <option value="email">📧 Email</option><option value="print">🖨 Print</option>
              <option value="in_person">🤝 In Person</option><option value="app">📱 App</option>
            </select>
            <textarea value={newPush.message} onChange={e => setNewPush({ ...newPush, message: e.target.value })}
              placeholder="Message (optional)" rows={3} style={{ width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.w, fontSize: 13, marginBottom: 16, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn ghost onClick={() => setShowPush(false)}>Cancel</Btn>
              <Btn gold onClick={createPush} disabled={!newPush.pushed_to.trim()}>Push It</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
