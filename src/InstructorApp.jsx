import { useState } from 'react'
import './InstructorApp.css'
import DailyPlanner from './DailyPlannerManual'
import GamingSession from './GamingSession'
import GoalInstructor from './GoalInstructor'
import { ThemeSelect } from './ThemeContext'
import { useTheme } from './ThemeState'
import { useAuth } from './AuthState'

const nav = [['daily', '✦', 'Daily Instructor'], ['goals', '◎', 'Goal Instructor'], ['gaming', '🎮', 'Brain Training'], ['account', '●', 'Account']]
const updateRoute = (id) => { window.history.pushState({}, '', id ? `#${id}` : window.location.pathname); window.dispatchEvent(new Event('hashchange')) }

function InstructorApp({ initialPage }) {
  const [page, setPage] = useState(nav.some(([id]) => id === initialPage) ? initialPage : 'daily')
  const { resolvedTheme } = useTheme(); const [sidebar, setSidebar] = useState(false); const [profile, setProfile] = useState(false); const [toast, setToast] = useState('')
  const { user, logout } = useAuth()
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2200) }
  const go = (id) => { setPage(id); updateRoute(id); setSidebar(false) }
  const performLogout = async () => {
    try {
      await logout()
      window.location.hash = 'landing'
    } catch (error) {
      notify(error.message || 'Could not sign out. Please try again.')
    }
  }
  const displayName = user?.name || 'LifePilot user'
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <div className={`instructor-shell ${resolvedTheme}`}><aside className={`instructor-sidebar ${sidebar ? 'open' : ''}`}><div className="instructor-brand"><span>✦</span><strong>Life<span>Pilot</span></strong></div><div className="side-label">YOUR INSTRUCTORS</div><nav>{nav.map(([id, icon, label]) => <button className={page === id ? 'active' : ''} key={id} onClick={() => go(id)}><i>{icon}</i>{label}{page === id && <b>→</b>}</button>)}</nav><div className="side-label side-space">YOUR SPACE</div><nav><button onClick={() => go('dashboard')}><i>⌂</i>Dashboard</button><button onClick={() => notify('Achievements are being tallied.')}><i>♨</i>Achievements</button><button onClick={() => notify('Progress analytics are ready in each instructor.')}><i>↗</i>Progress</button><button onClick={() => notify('Settings saved locally.')}><i>⚙</i>Settings</button></nav><div className="sidebar-bottom"><div className="mini-user"><span>{initials}</span><div><strong>{displayName}</strong><small>{user?.email}</small></div><b>•••</b></div><button className="back-link" onClick={performLogout}>Sign out</button></div></aside><main className="instructor-main"><header className="instructor-topbar"><button className="hamburger" onClick={() => setSidebar(!sidebar)}>☰</button><div className="crumb">LifePilot <span>/</span> <strong>{nav.find(([id]) => id === page)?.[2]}</strong></div><div className="top-actions"><ThemeSelect compact /><button className="icon-button" onClick={() => notify('You are all caught up.')}>♧</button><div className="profile-wrap"><button className="profile-button" onClick={() => setProfile(!profile)}><span>{initials}</span><strong>{displayName.split(' ')[0]}</strong><b>⌄</b></button>{profile && <div className="profile-menu"><strong>{displayName}</strong><button onClick={() => go('account')}>Account</button><button onClick={performLogout}>Sign out</button></div>}</div></div></header><div className="instructor-content">{page === 'daily' && <DailyPage notify={notify} />}{page === 'goals' && <GoalInstructor />}{page === 'gaming' && <GamingSession onBackToDashboard={() => go('dashboard')} />}</div></main>{toast && <div className="instructor-toast">✓ <span>{toast}</span></div>}</div>
}

function DailyPage({ notify }) {
  return <DailyPlanner notify={notify} />
  /*
  const [activities, setActivities] = useState(activitiesSeed); const [filter, setFilter] = useState('All'); const [running, setRunning] = useState(false); const [seconds, setSeconds] = useState(0); const [review, setReview] = useState('');
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer) }, [running])
  const visible = filter === 'All' ? activities : activities.filter((item) => item.status === filter)
  const complete = activities.filter((item) => item.status === 'Completed').length; const mark = (id) => { setActivities((items) => items.map((item) => item.id === id ? { ...item, status: 'Completed' } : item)); notify('Activity complete. +25 XP') }
  return <><PageTitle eyebrow="WEDNESDAY · SEPTEMBER 11, 2026" title="Good morning, Alex 👋" subtitle="Let’s make today count." /><div className="title-meta"><span>☼ 68° · New Delhi</span><span className="streak">♨ 12 day streak</span></div><section className="mission-hero"><div className="mission-copy"><span className="pill">✦ NEXT MISSION · 06:30 AM</span><h2>Your next mission<br /><em>is ready.</em></h2><p>Get out of bed, drink water, and complete your morning routine. The first win sets the tone for everything that follows.</p><div className="mission-details"><span>◷ <b>{running ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : '06:30 AM'}</b><small>Start time</small></span><span>✦ <b>+50 XP</b><small>Reward</small></span><span>◒ <b>30 min</b><small>Duration</small></span></div><div className="mission-actions"><button className="primary-action" onClick={() => { setRunning(true); notify('Mission started. You’ve got this.') }}>{running ? 'Mission active' : 'Start Mission'} <span>↗</span></button><button className="secondary-action" onClick={() => { setRunning(false); mark(2) }}>✓ Complete Mission</button></div></div><div className="mission-orbit"><div className="orbit-ring ring-one"></div><div className="orbit-ring ring-two"></div><div className="orbit-center"><span>06:30</span><small>AM</small></div><i className="orbit-star">✦</i></div></section><div className="section-heading"><div><span className="section-kicker">TODAY’S RHYTHM</span><h2>Daily schedule</h2></div><div className="filter-tabs">{['All', 'Completed', 'Upcoming', 'Missed'].map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div><section className="schedule-card">{visible.map((item) => <div className="activity-row" key={item.id}><div className={`activity-mark ${item.status.toLowerCase().replace(' ', '-')}`}>{item.status === 'Completed' ? '✓' : item.status === 'In Progress' ? '●' : '○'}</div><div className="activity-main"><span>{item.category}</span><strong>{item.name}</strong></div><div className="activity-time"><strong>{item.time}</strong><small>{item.duration}</small></div><span className={`status ${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span><button className="row-edit" onClick={() => notify(`Editing ${item.name}.`)}>Edit</button><button className="row-complete" disabled={item.status === 'Completed'} onClick={() => mark(item.id)}>{item.status === 'Completed' ? 'Completed' : 'Mark complete'}</button></div>)}</section><div className="dashboard-grid"><section className="panel message-panel"><span className="panel-kicker">✦ INSTRUCTOR MESSAGE</span><h3>{complete > 1 ? 'You’re building momentum! 🔥' : 'Start with one small win.'}</h3><p>{complete > 1 ? 'Your next activity starts in 20 minutes. Keep the momentum going.' : 'Complete your first mission and give the rest of your day something to build on.'}</p><button className="text-action" onClick={() => notify('Message saved to your notes.')}>Save message ↗</button></section><section className="panel progress-panel"><div className="panel-heading"><div><span className="panel-kicker">YOUR PROGRESS</span><h3>Today at a glance</h3></div><strong>{Math.round(complete / activities.length * 100)}%</strong></div><div className="big-progress"><i style={{ width: `${complete / activities.length * 100}%` }}></i></div><div className="progress-stats"><span><b>{complete}</b>Activities completed</span><span><b>{complete * 25}</b>XP earned</span><span><b>12</b>Current streak</span></div></section></div><section className="panel review-panel"><div><span className="panel-kicker">END OF DAY</span><h2>Evening review</h2><p>A few honest minutes today make tomorrow easier.</p></div><div className="review-fields"><label>How did today feel?<textarea value={review} onChange={(event) => setReview(event.target.value)} placeholder="Write a reflection..." /></label><label>Tomorrow’s priority<input placeholder="One thing that matters most" /></label><button className="primary-action" onClick={() => notify('Review saved. See you tomorrow, Alex.')}>Save Review ↗</button></div></section></>
}

  */
}

export default InstructorApp
