import { useEffect, useState } from 'react'
import './AccountPage.css'
import { apiRequest } from './lib/api'
import { ThemeSelect } from './ThemeContext'
import { useTheme } from './ThemeState'
import { useAuth } from './AuthState'

const defaultProfile = { name: '', username: '', email: '', phone: '', dob: '', gender: '', location: '', bio: '' }
const defaultPreferences = { wake: '06:30', sleep: '23:00', productivity: '3 priority tasks', energy: 'Medium', focus: 'Personal development', theme: 'light', language: 'English', timezone: 'Asia/Kolkata' }
const areas = ['Daily routine', 'Fitness', 'Education', 'Career', 'Personal development', 'Financial learning', 'Time management', 'Goal achievement']
const instructorStyles = ['Friendly', 'Motivational', 'Direct', 'Calm', 'Detailed', 'Short and simple']
const defaultControls = {
  instructorStyle: 'Friendly',
  instructor: { suggestBreaks: true, moveUnfinishedTasks: true, askFollowUpQuestions: true, dailyMotivation: true },
  notifications: {
    scheduleReminders: true,
    taskDeadlineReminders: true,
    goalProgressReminders: true,
    eveningReviewReminders: true,
    weeklySummary: true,
    emailNotifications: true,
    inAppNotifications: true,
  },
  privacy: { profileVisibility: false, aiPersonalization: true },
}
const notificationItems = [
  ['scheduleReminders', 'Daily schedule reminders'],
  ['taskDeadlineReminders', 'Task deadline reminders'],
  ['goalProgressReminders', 'Goal progress reminders'],
  ['eveningReviewReminders', 'Evening review reminders'],
  ['weeklySummary', 'Weekly progress summary'],
  ['emailNotifications', 'Email notifications'],
  ['inAppNotifications', 'In-app notifications'],
]

export default function AccountPage() {
  const { resolvedTheme, theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const dark = resolvedTheme === 'dark'
  const setDark = (value) => setTheme(value ? 'dark' : 'light')
  const [profile, setProfile] = useState(defaultProfile)
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [selectedAreas, setSelectedAreas] = useState(['Daily routine'])
  const [controls, setControls] = useState(defaultControls)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const notify = (text) => { setNotice(text); window.setTimeout(() => setNotice(''), 2600) }
  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/users/me'), apiRequest('/preferences')])
      .then(([accountResult, preferenceResult]) => {
        if (!active) return
        const details = accountResult.profileDetails || {}
        const saved = preferenceResult.preferences
        const settings = saved.settings || {}
        setProfile({
          ...defaultProfile,
          ...details,
          name: accountResult.user.name || '',
          email: accountResult.user.email || '',
        })
        setPreferences({
          ...defaultPreferences,
          ...settings,
          language: saved.preferredLanguage || settings.language || defaultPreferences.language,
          timezone: saved.timezone || defaultPreferences.timezone,
          wake: saved.wakeTime || settings.wake || defaultPreferences.wake,
          sleep: saved.sleepTime || settings.sleep || defaultPreferences.sleep,
          theme: saved.theme || defaultPreferences.theme,
        })
        setSelectedAreas(settings.selectedAreas || ['Daily routine'])
        setControls({
          instructorStyle: settings.instructorStyle || defaultControls.instructorStyle,
          instructor: { ...defaultControls.instructor, ...settings.instructor },
          notifications: { ...defaultControls.notifications, ...settings.notifications },
          privacy: { ...defaultControls.privacy, ...settings.privacy },
        })
        setTheme(saved.theme || 'system')
      })
      .catch((error) => {
        if (active) notify(`Could not load your account settings: ${error.message}`)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [setTheme])
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
  const updateControl = (group, key, value) => setControls((current) => ({
    ...current,
    [group]: { ...current[group], [key]: value },
  }))
  const save = async () => {
    if (!profile.name.trim()) return notify('Enter a valid name.')
    setSaving(true)
    try {
      await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profile.name.trim(),
          profileDetails: {
            username: profile.username,
            phone: profile.phone,
            dob: profile.dob,
            gender: profile.gender,
            location: profile.location,
            bio: profile.bio,
          },
        }),
      })
      await apiRequest('/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          theme,
          timezone: preferences.timezone,
          preferredLanguage: preferences.language,
          notificationsEnabled: Object.values(controls.notifications).some(Boolean),
          wakeTime: preferences.wake,
          sleepTime: preferences.sleep,
          settings: {
            wake: preferences.wake,
            sleep: preferences.sleep,
            productivity: preferences.productivity,
            energy: preferences.energy,
            focus: preferences.focus,
            language: preferences.language,
            selectedAreas,
            instructorStyle: controls.instructorStyle,
            instructor: controls.instructor,
            notifications: controls.notifications,
            privacy: controls.privacy,
          },
        }),
      })
      setEditing(false)
      notify('Your account details and preferences have been saved.')
    } catch (error) {
      notify(`Could not save your account settings: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className={`account-shell ${dark ? 'dark' : 'light'}`}>
      <AccountSidebar dark={dark} setDark={setDark} name={profile.name} />
      <main className="account-main">
        <header className="account-topbar">
          <span>LifePilot <b>/</b> Account · {profile.email || user?.email}</span>
          <div><button onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? '☼' : '☾'}</button><button onClick={signOut}>Sign out</button></div>
        </header>
        <div className="account-content">
          <section className="account-profile-header">
            <div className="large-avatar">{initials(profile.name)}</div>
            <div>
              <span className="account-kicker">YOUR ACCOUNT</span>
              <h1>Welcome back, {profile.name || user?.name || 'there'}</h1>
              <p>Manage your personal information and LifePilot preferences.</p>
              <div className="account-meta"><span>{profile.email}</span><span>{loading ? 'Loading account…' : 'LifePilot member'}</span><b>Active account</b></div>
            </div>
            <button className="account-primary" disabled={loading || saving} onClick={() => setEditing(!editing)}>{editing ? 'Editing profile' : 'Edit Profile'}</button>
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
              <div className="account-form-actions"><button className="account-secondary" disabled={saving} onClick={() => setEditing(false)}>Cancel</button><button className="account-primary" disabled={loading || saving} onClick={() => { void save() }}>{saving ? 'Saving…' : 'Save Changes'}</button></div>
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
              {instructorStyles.map((item) => <button className={`preference-pill ${controls.instructorStyle === item ? 'selected' : ''}`} key={item} onClick={() => setControls((current) => ({ ...current, instructorStyle: item }))}>{item}</button>)}
              <Toggle label="Suggest breaks" checked={controls.instructor.suggestBreaks} onChange={(value) => updateControl('instructor', 'suggestBreaks', value)} />
              <Toggle label="Suggest moving unfinished tasks" checked={controls.instructor.moveUnfinishedTasks} onChange={(value) => updateControl('instructor', 'moveUnfinishedTasks', value)} />
              <Toggle label="Ask follow-up questions" checked={controls.instructor.askFollowUpQuestions} onChange={(value) => updateControl('instructor', 'askFollowUpQuestions', value)} />
              <Toggle label="Provide daily motivation" checked={controls.instructor.dailyMotivation} onChange={(value) => updateControl('instructor', 'dailyMotivation', value)} />
            </section>
            <section className="account-card">
              <Heading eyebrow="STAY IN THE LOOP" title="Notifications" text="Choose when LifePilot checks in." />
              {notificationItems.map(([key, label]) => <Toggle key={key} label={label} checked={controls.notifications[key]} onChange={(value) => updateControl('notifications', key, value)} />)}
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
              <Toggle label="Profile visibility" checked={controls.privacy.profileVisibility} onChange={(value) => updateControl('privacy', 'profileVisibility', value)} />
              <Toggle label="AI personalization" checked={controls.privacy.aiPersonalization} onChange={(value) => updateControl('privacy', 'aiPersonalization', value)} />
              <Action title="Download my data" text="Export your profile and activity records." button="Export" onClick={() => notify('Data export queued.')} />
              <Action title="Delete account" text="Deletion is permanent and cannot be undone." button="Delete" danger onClick={() => setDeleteOpen(true)} />
            </section>
          </div>
          <div className="account-actions">
            <button className="account-secondary" onClick={() => { setPreferences(defaultPreferences); setTheme(defaultPreferences.theme); setSelectedAreas(['Daily routine']); setControls(defaultControls); notify('Preferences reset. Save changes to keep this update.') }}>Reset preferences</button>
            <button className="account-secondary" onClick={() => notify('Account export queued.')}>Export account data</button>
            <button className="account-danger" onClick={() => setDeleteOpen(true)}>Delete account</button>
            <button className="account-primary" disabled={loading || saving} onClick={() => { void save() }}>{saving ? 'Saving…' : 'Save all changes'}</button>
          </div>
        </div>
      </main>
      {notice && <div className="account-toast">✓ {notice}</div>}
      {deleteOpen && <div className="account-modal-backdrop"><div className="account-modal"><button className="account-modal-close" onClick={() => setDeleteOpen(false)}>×</button><span className="account-kicker">PERMANENT ACTION</span><h2>Delete your account?</h2><p>This permanently removes your account and connected LifePilot data.</p><div className="modal-actions"><button className="account-secondary" onClick={() => setDeleteOpen(false)}>Keep account</button><button className="account-danger" onClick={() => { setDeleteOpen(false); notify('Deletion requires verified authentication.') }}>Delete permanently</button></div></div></div>}
    </div>
  )
}

function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'LP' }
function Heading({ eyebrow, title, text }) { return <div className="account-card-heading"><span>{eyebrow}</span><h2>{title}</h2><p>{text}</p></div> }
function Field({ label, value, type = 'text', onChange }) { return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function Select({ label, value, options, onChange }) { if (label === 'Theme') return <ThemeSelect />; return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label> }
function Toggle({ label, checked, onChange }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i></i></label> }
function Action({ title, text, button, onClick, danger }) { return <div className="account-action-row"><div><strong>{title}</strong><small>{text}</small></div><button className={danger ? 'danger-link' : ''} onClick={onClick}>{button}</button></div> }
function AccountSidebar({ dark, setDark, name }) {
  const items = [['daily', '✦', 'Daily Instructor'], ['goals', '◎', 'Goals'], ['gaming', '🎮', 'Brain Training'], ['account', '●', 'Account']]
  return <aside className="account-sidebar"><div className="account-brand"><span>✦</span><strong>Life<span>Pilot</span></strong></div><span className="account-side-label">YOUR SPACE</span><nav>{items.map(([id, icon, label]) => <button className={id === 'account' ? 'active' : ''} key={id} onClick={() => { window.location.hash = id }}><i>{icon}</i>{label}{id === 'account' && <b>→</b>}</button>)}</nav><div className="account-sidebar-bottom"><div className="mini-account-user"><span>{initials(name)}</span><div><strong>{name || 'LifePilot member'}</strong><small>Account</small></div></div><button onClick={() => setDark(!dark)}>Toggle {dark ? 'light' : 'dark'} mode</button><button onClick={() => { window.location.hash = '' }}>← Back to LifePilot</button></div></aside>
}
