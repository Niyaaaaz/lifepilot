import { useState } from 'react'
import './AccountPage.css'
import { ThemeSelect } from './ThemeContext'
import { useTheme } from './ThemeState'
import { useAuth } from './AuthState'

const defaultProfile = { name: 'Alex Morgan', username: 'alexmorgan', email: 'alex@example.com', phone: '', dob: '', gender: '', location: '', bio: 'Building a calmer, more consistent life one step at a time.' }
const defaultPreferences = { wake: '06:30', sleep: '23:00', productivity: '3 priority tasks', energy: 'Medium', focus: 'Personal development', theme: 'light', language: 'English', timezone: 'Asia/Kolkata' }
const areas = ['Daily routine', 'Fitness', 'Education', 'Career', 'Personal development', 'Financial learning', 'Time management', 'Goal achievement']

export default function AccountPage() {
  const { resolvedTheme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const dark = resolvedTheme === 'dark'
  const setDark = (value) => setTheme(value ? 'dark' : 'light')
  const [profile, setProfile] = useState(load('lifepilot-profile', defaultProfile))
  const [preferences, setPreferences] = useState(load('lifepilot-preferences', defaultPreferences))
  const [selectedAreas, setSelectedAreas] = useState(load('lifepilot-focus', ['Daily routine']))
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const notify = (text) => { setNotice(text); window.setTimeout(() => setNotice(''), 2600) }
  const signOut = async () => {
    try {
      await logout()
      window.location.hash = 'landing'
    } catch (error) {
      notify(error.message || 'Could not sign out. Please try again.')
    }
  }
  const update = (key, value) => setProfile({ ...profile, [key]: value })
  const updatePreference = (key, value) => setPreferences({ ...preferences, [key]: value })
  const save = () => {
    if (!profile.name.trim() || !profile.username.trim() || !/^\S+@\S+\.\S+$/.test(profile.email)) return notify('Enter a valid name, username, and email.')
    localStorage.setItem('lifepilot-profile', JSON.stringify(profile))
    localStorage.setItem('lifepilot-preferences', JSON.stringify(preferences))
    localStorage.setItem('lifepilot-focus', JSON.stringify(selectedAreas))
    setEditing(false)
    notify('Your account details have been updated successfully.')
  }
  return (
    <div className={`account-shell ${dark ? 'dark' : 'light'}`}>
      <AccountSidebar dark={dark} setDark={setDark} />
      <main className="account-main">
        <header className="account-topbar">
          <span>LifePilot <b>/</b> Account · {user?.email}</span>
          <div><button onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? '☼' : '☾'}</button><button onClick={signOut}>Sign out</button></div>
        </header>
        <div className="account-content">
          <section className="account-profile-header">
            <div className="large-avatar">AM</div>
            <div>
              <span className="account-kicker">YOUR ACCOUNT</span>
              <h1>Welcome back, Alex</h1>
              <p>Manage your personal information and LifePilot preferences.</p>
              <div className="account-meta"><span>{profile.email}</span><span>Member since September 2026</span><b>Active account</b></div>
            </div>
            <button className="account-primary" onClick={() => setEditing(!editing)}>{editing ? 'Editing profile' : 'Edit Profile'}</button>
          </section>

          <div className="account-grid">
            <section className="account-card">
              <Heading eyebrow="PROFILE" title="Personal Information" text="Keep your profile details current. Email changes require verification." />
              <div className="account-form-grid">
                {[['name', 'Full name'], ['username', 'Username'], ['email', 'Email address'], ['phone', 'Phone number'], ['dob', 'Date of birth'], ['gender', 'Gender, optional'], ['location', 'Location, optional']].map(([key, label]) => (
                  <label key={key}>{label}<input disabled={!editing || key === 'email'} value={profile[key]} onChange={(event) => update(key, event.target.value)} placeholder={label} /></label>
                ))}
              </div>
              <label>Short personal bio<textarea disabled={!editing} value={profile.bio} onChange={(event) => update('bio', event.target.value)} /></label>
              <div className="account-form-actions"><button className="account-secondary" onClick={() => setEditing(false)}>Cancel</button><button className="account-primary" onClick={save}>Save Changes</button></div>
            </section>
            <section className="account-card">
              <Heading eyebrow="YOUR MOMENTUM" title="Account statistics" text="Your personal activity will appear here as you build your practice." />
              <div className="account-stat-grid">{[['0 days', 'Current streak'], ['0', 'Completed tasks'], ['0', 'Completed goals'], ['0 XP', 'Total XP'], ['Level 1', 'Current level'], ['0', 'Active goals'], ['0', 'Saved schedules']].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
              <small className="empty-note">Complete your first task to start building your history.</small>
            </section>
          </div>

          <section className="account-card preferences-card">
            <Heading eyebrow="CONNECTED TO YOUR INSTRUCTORS" title="My Preferences" text="These preferences guide the Daily Instructor when it prepares your schedule." />
            <div className="account-form-grid preferences-grid">
              <Field label="Preferred wake-up time" value={preferences.wake} type="time" onChange={(value) => updatePreference('wake', value)} />
              <Field label="Preferred sleep time" value={preferences.sleep} type="time" onChange={(value) => updatePreference('sleep', value)} />
              <Select label="Daily productivity goal" value={preferences.productivity} options={['1 priority task', '3 priority tasks', '5 priority tasks']} onChange={(value) => updatePreference('productivity', value)} />
              <Select label="Energy level" value={preferences.energy} options={['Low', 'Medium', 'High']} onChange={(value) => updatePreference('energy', value)} />
              <Select label="Main focus area" value={preferences.focus} options={areas} onChange={(value) => updatePreference('focus', value)} />
              <Select label="Theme" value={preferences.theme} options={['system', 'light', 'dark']} onChange={(value) => updatePreference('theme', value)} />
              <Select label="Language" value={preferences.language} options={['English', 'Hindi']} onChange={(value) => updatePreference('language', value)} />
              <Select label="Time zone" value={preferences.timezone} options={['Asia/Kolkata', 'UTC', 'America/New_York']} onChange={(value) => updatePreference('timezone', value)} />
            </div>
            <strong className="focus-label">LifePilot focus areas</strong>
            <div className="focus-pills">{areas.map((area) => <button className={selectedAreas.includes(area) ? 'selected' : ''} key={area} onClick={() => setSelectedAreas(selectedAreas.includes(area) ? selectedAreas.filter((item) => item !== area) : [...selectedAreas, area])}>{selectedAreas.includes(area) ? '✓ ' : ''}{area}</button>)}</div>
          </section>

          <div className="account-grid">
            <section className="account-card">
              <Heading eyebrow="HOW LIFE PILOT SPEAKS" title="AI Instructor Preferences" text="Choose how your instructor communicates." />
              {['Friendly', 'Motivational', 'Direct', 'Calm', 'Detailed', 'Short and simple'].map((item) => <button className={`preference-pill ${item === 'Friendly' ? 'selected' : ''}`} key={item}>{item}</button>)}
              <Toggle label="Suggest breaks" checked /><Toggle label="Suggest moving unfinished tasks" checked /><Toggle label="Ask follow-up questions" checked /><Toggle label="Provide daily motivation" checked />
            </section>
            <section className="account-card">
              <Heading eyebrow="STAY IN THE LOOP" title="Notifications" text="Choose when LifePilot checks in." />
              {['Daily schedule reminders', 'Task deadline reminders', 'Goal progress reminders', 'Evening review reminders', 'Weekly progress summary', 'Email notifications', 'In-app notifications'].map((item) => <Toggle key={item} label={item} checked />)}
            </section>
          </div>

          <div className="account-grid">
            <section className="account-card">
              <Heading eyebrow="PROTECT YOUR ACCOUNT" title="Security and Login" text="Sensitive actions require authenticated backend access." />
              <Action title="Change password" text="Use a strong password you do not reuse elsewhere." button="Change" onClick={() => notify('Password changes require authenticated account access.')} />
              <Action title="Two-factor authentication" text="Add another layer of protection." button="Enable" onClick={() => notify('Two-factor setup is ready for backend authentication.')} />
              <Action title="Active sessions" text="Review signed-in devices." button="View" onClick={() => notify('No session data is available in this local preview.')} />
            </section>
            <section className="account-card">
              <Heading eyebrow="YOUR CONTROL" title="Privacy" text="You decide how your profile and AI personalization are used." />
              <Toggle label="Profile visibility" checked={false} /><Toggle label="AI personalization" checked />
              <Action title="Download my data" text="Export your profile and activity records." button="Export" onClick={() => notify('Data export queued.')} />
              <Action title="Delete account" text="Deletion is permanent and cannot be undone." button="Delete" danger onClick={() => setDeleteOpen(true)} />
            </section>
          </div>
          <div className="account-actions">
            <button className="account-secondary" onClick={() => { setPreferences(defaultPreferences); notify('Preferences reset.') }}>Reset preferences</button>
            <button className="account-secondary" onClick={() => notify('Account export queued.')}>Export account data</button>
            <button className="account-danger" onClick={() => setDeleteOpen(true)}>Delete account</button>
            <button className="account-primary" onClick={save}>Save all changes</button>
          </div>
        </div>
      </main>
      {notice && <div className="account-toast">✓ {notice}</div>}
      {deleteOpen && <div className="account-modal-backdrop"><div className="account-modal"><button className="account-modal-close" onClick={() => setDeleteOpen(false)}>×</button><span className="account-kicker">PERMANENT ACTION</span><h2>Delete your account?</h2><p>This permanently removes your account and connected LifePilot data.</p><div className="modal-actions"><button className="account-secondary" onClick={() => setDeleteOpen(false)}>Keep account</button><button className="account-danger" onClick={() => { setDeleteOpen(false); notify('Deletion requires verified authentication.') }}>Delete permanently</button></div></div></div>}
    </div>
  )
}

function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }
function Heading({ eyebrow, title, text }) { return <div className="account-card-heading"><span>{eyebrow}</span><h2>{title}</h2><p>{text}</p></div> }
function Field({ label, value, type = 'text', onChange }) { return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function Select({ label, value, options, onChange }) { if (label === 'Theme') return <ThemeSelect />; return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label> }
function Toggle({ label, checked }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" defaultChecked={checked} /><i></i></label> }
function Action({ title, text, button, onClick, danger }) { return <div className="account-action-row"><div><strong>{title}</strong><small>{text}</small></div><button className={danger ? 'danger-link' : ''} onClick={onClick}>{button}</button></div> }
function AccountSidebar({ dark, setDark }) {
  const items = [['daily', '✦', 'Daily Instructor'], ['goals', '◎', 'Goals'], ['gaming', '🎮', 'Brain Training'], ['account', '●', 'Account']]
  return <aside className="account-sidebar"><div className="account-brand"><span>✦</span><strong>Life<span>Pilot</span></strong></div><span className="account-side-label">YOUR SPACE</span><nav>{items.map(([id, icon, label]) => <button className={id === 'account' ? 'active' : ''} key={id} onClick={() => { window.location.hash = id }}><i>{icon}</i>{label}{id === 'account' && <b>→</b>}</button>)}</nav><div className="account-sidebar-bottom"><div className="mini-account-user"><span>AM</span><div><strong>Alex Morgan</strong><small>Account</small></div></div><button onClick={() => setDark(!dark)}>Toggle {dark ? 'light' : 'dark'} mode</button><button onClick={() => { window.location.hash = '' }}>← Back to LifePilot</button></div></aside>
}
