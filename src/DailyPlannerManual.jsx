import { useEffect, useMemo, useState } from 'react'
import './DailyPlanner.css'
import { apiRequest } from './lib/api'
const statuses = ['Not Started', 'In Progress', 'Completed']

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function timeToMinutes(value) {
  if (!value) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function formatTime(value) {
  if (!value) return 'Needs a time'
  const [hours, minutes] = value.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`
}

function getCompletionHistory(task) {
  if (Array.isArray(task.completionHistory) && task.completionHistory.length) return task.completionHistory
  if (task.completed || task.status === 'Completed' || task.completedAt) return [{ completedAt: task.completedAt || null }]
  return []
}

function overlaps(task, tasks) {
  const start = timeToMinutes(task.startTime)
  if (start === null) return false
  const end = start + Number(task.minutes)
  return tasks.some((other) => {
    if (other.id === task.id || other.date !== task.date || !other.startTime) return false
    const otherStart = timeToMinutes(other.startTime)
    const otherEnd = otherStart + Number(other.minutes || 0)
    return start < otherEnd && end > otherStart
  })
}

export default function DailyPlannerManual({ notify }) {
  const [tasks, setTasks] = useState([])
  const [storageError, setStorageError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadCount, setReloadCount] = useState(0)
  const [filter, setFilter] = useState('All')
  const [selectedDate, setSelectedDate] = useState(localDateKey)
  const [editingTask, setEditingTask] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const today = selectedDate
  const from = localDateKey(new Date(new Date(`${today}T12:00:00`).getTime() - 365 * 86400000))
  const to = localDateKey(new Date(new Date(`${today}T12:00:00`).getTime() + 7 * 86400000))

  const refreshTasks = () => {
    setStorageError('')
    setLoading(true)
    setReloadCount((value) => value + 1)
  }
  useEffect(() => {
    let active = true
    apiRequest(`/daily/tasks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(({ tasks: loadedTasks }) => {
        if (active) {
          setTasks(loadedTasks.map((task) => ({
            ...task,
            minutes: Number(task.minutes) || 30,
            status: statuses.includes(task.status) ? task.status : 'Not Started',
            completionHistory: getCompletionHistory(task),
            completionCount: Number(task.completionCount) || getCompletionHistory(task).length,
          })))
          setStorageError('')
        }
      })
      .catch((error) => {
        if (active) setStorageError(error.message || 'Daily tasks could not be loaded. Please try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [from, to, reloadCount])

  const goalTasks = useMemo(() => tasks.filter((task) => task.source === 'goal'), [tasks])
  const todayTasks = useMemo(() => tasks.filter((task) => task.date === today).sort((a, b) => (
    (timeToMinutes(a.startTime) ?? 1440) - (timeToMinutes(b.startTime) ?? 1440)
  )), [tasks, today])
  const upcomingTasks = useMemo(() => tasks.filter((task) => task.date > today && task.date <= to).sort((a, b) => (
    `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)
  )), [tasks, today, to])
  const missedTasks = useMemo(() => tasks.filter((task) => task.date && task.date < today && task.status !== 'Completed').sort((a, b) => b.date.localeCompare(a.date)), [tasks, today])
  const completed = todayTasks.filter((item) => item.status === 'Completed').length
  const progress = todayTasks.length ? Math.round(completed / todayTasks.length * 100) : 0
  const next = todayTasks.find((item) => item.status !== 'Completed')
  const filtered = useMemo(() => {
    if (filter === 'Missed') return missedTasks
    return filter === 'All' ? todayTasks : todayTasks.filter((item) => item.status === filter)
  }, [filter, missedTasks, todayTasks])

  const persistTask = async (task) => {
    try {
      const { task: saved } = await task()
      setTasks((current) => current.some((item) => item.id === saved.id)
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved])
      setStorageError('')
      return saved
    } catch (error) {
      setStorageError(error.message || 'The task could not be saved. Please try again.')
      return null
    }
  }

  const saveTask = async (draft) => {
    const existing = editingTask
      ? tasks.find((task) => task.id === editingTask.id && task.source === editingTask.source)
      : null
    const updatedTask = {
      ...existing,
      ...draft,
      date: draft.date || today,
      minutes: Number(draft.minutes),
      activity: draft.activity.trim(),
      description: draft.description.trim(),
      notes: draft.notes.trim(),
      status: existing?.status || 'Not Started',
    }
    if (overlaps(updatedTask, tasks)) {
      setNotice('That time overlaps another scheduled task. Choose a different time.')
      return
    }
    const taskBody = {
      activity: updatedTask.activity,
      description: updatedTask.description,
      category: updatedTask.category,
      priority: updatedTask.priority,
      date: updatedTask.date,
      startTime: updatedTask.startTime,
      minutes: updatedTask.minutes,
      notes: updatedTask.notes,
    }
    const saved = await persistTask(() => apiRequest(
      existing ? `/daily/tasks/${encodeURIComponent(existing.id)}` : '/daily/tasks',
      { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(taskBody) },
    ))
    if (!saved) return
    setEditingTask(null)
    setModalOpen(false)
    setNotice(existing ? 'Task updated.' : 'Personal task added.')
  }

  const updateStatus = async (task, status) => {
    if (task.status === status) return
    return persistTask(() => apiRequest(`/daily/tasks/${encodeURIComponent(task.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }))
  }

  const retake = async (task) => {
    if (task.status !== 'Completed' || task.retakeInProgress) return
    const saved = await persistTask(() => apiRequest(`/daily/tasks/${encodeURIComponent(task.id)}/retake`, { method: 'POST' }))
    if (!saved) return
    setNotice(`Retake started: ${task.activity}. It remains Completed while you work on the attempt.`)
  }

  const completeRetake = async (task) => {
    if (task.status !== 'Completed' || !task.retakeInProgress) return
    const saved = await persistTask(() => apiRequest(`/daily/tasks/${encodeURIComponent(task.id)}/retake/complete`, {
      method: 'POST',
      body: JSON.stringify({ notes: task.retakeNote?.trim() || '' }),
    }))
    if (saved) setNotice(`Retake recorded for ${task.activity}. Total completed attempts: ${saved.completionCount}.`)
  }

  const start = async (task) => {
    const saved = await updateStatus(task, 'In Progress')
    if (!saved) return
    setNotice(`Started: ${task.activity}`)
    if (notify) notify('Task started.')
  }

  const openNewTask = () => {
    setEditingTask(null)
    setModalOpen(true)
  }

  const openEditor = (task) => {
    setEditingTask(task)
    setModalOpen(true)
  }

  const deletePersonalTask = async (task) => {
    if (task.source !== 'personal' || !window.confirm(`Delete "${task.activity}"?`)) return
    try {
      await apiRequest(`/daily/tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' })
      setTasks((current) => current.filter((item) => item.id !== task.id))
      setStorageError('')
    } catch (error) {
      setStorageError(error.message || 'The task could not be deleted. Please try again.')
      return
    }
    setEditingTask(null)
    setModalOpen(false)
    setNotice('Personal task deleted.')
  }

  return <div className="daily-dashboard">
    <DashboardHeader date={today} progress={progress} completed={completed} remaining={todayTasks.length - completed} />
    {storageError && <div className="daily-storage-alert" role="alert"><span>{storageError} Your changes are saved on the server when requests succeed.</span><button type="button" onClick={refreshTasks}>Retry</button></div>}
    {notice && <p className="daily-notice" role="status">{notice}</p>}
    {loading && <p className="daily-loading" role="status">Loading your saved schedule…</p>}
    <div className="overview-grid">
      <OverviewCard icon="◔" label={today === localDateKey() ? 'Today’s Progress' : 'Selected Date Progress'} value={`${progress}%`} meta={`${completed} of ${todayTasks.length} scheduled tasks completed`} progress={progress} />
      <OverviewCard icon="◎" label="Goal Tasks Today" value={goalTasks.filter((task) => task.date === today).length} meta="Linked to your saved roadmaps" tone="mint" />
      <OverviewCard icon="↗" label="Upcoming This Week" value={upcomingTasks.length} meta="Tasks from your active roadmaps" tone="violet" />
      <div className="overview-card next-task-card"><div className="overview-card-top"><span className="overview-icon">→</span><span>Next Task</span></div><strong>{next?.activity || 'No tasks scheduled today'}</strong><small>{next ? `${formatTime(next.startTime)} · ${next.minutes} min` : 'Create a goal or add a personal task.'}</small><button className="primary-action" type="button" onClick={() => next && start(next)} disabled={!next}>{next ? 'Start Task →' : 'Plan a task'}</button></div>
    </div>
    <div className="dashboard-columns">
      <div className="dashboard-main">
        <section className="focus-card"><div><span className="planner-kicker">TODAY’S MAIN FOCUS</span><h2>{next?.activity || 'Make a plan for today'}</h2><p>{next?.goalTitle ? `Part of your goal: ${next.goalTitle}.` : next?.description || 'Your daily plan is based on dated tasks in Goal Instructor and personal tasks you add here.'}</p><div className="focus-meta"><span>Priority <b>{next?.priority || '—'}</b></span><span>Estimated <b>{next ? `${next.minutes} min` : '—'}</b></span></div></div><button className="primary-action" type="button" onClick={() => next && start(next)} disabled={!next}>Start focus session ↗</button></section>
        <div className="planner-list-heading"><div><span className="planner-kicker">ROADMAP + PERSONAL TASKS</span><h2>Your Schedule</h2><label className="daily-selected-date">Plan date<input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setFilter('All') }} /></label></div><div className="filter-tabs">{['All', 'Not Started', 'In Progress', 'Completed', 'Missed'].map((item) => <button type="button" className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
        <section className="planner-schedule">
          {!loading && filtered.map((item) => <ScheduleItem key={`${item.source}-${item.id}`} item={item} onStart={() => start(item)} onComplete={() => updateStatus(item, 'Completed')} onRetake={() => retake(item)} onCompleteRetake={(notes) => completeRetake({ ...item, retakeNote: notes })} onEdit={() => openEditor(item)} />)}
          {!loading && !filtered.length && <div className="daily-empty"><strong>{storageError ? 'Your schedule could not be loaded' : filter === 'Missed' ? 'No missed tasks' : todayTasks.length ? 'No tasks match this filter' : 'Nothing scheduled for this date yet'}</strong><p>{storageError ? 'Retry after checking your connection and sign-in session.' : filter === 'Missed' ? 'Unfinished work from earlier dates will appear here. It is never marked complete automatically.' : 'Create a goal in Goal Instructor to generate related tasks, or add a personal task for this date.'}</p>{storageError && <button className="secondary-action" type="button" onClick={refreshTasks}>Retry</button>}</div>}
        </section>
        {upcomingTasks.length > 0 && <section className="upcoming-section"><div className="planner-list-heading"><div><span className="planner-kicker">NEXT 7 DAYS</span><h2>Upcoming Tasks</h2></div></div><section className="planner-schedule">{upcomingTasks.map((item) => <ScheduleItem key={`${item.source}-${item.id}`} item={item} onStart={() => start(item)} onComplete={() => updateStatus(item, 'Completed')} onRetake={() => retake(item)} onCompleteRetake={(notes) => completeRetake({ ...item, retakeNote: notes })} onEdit={() => openEditor(item)} showDate />)}</section></section>}
        {missedTasks.length > 0 && filter !== 'Missed' && <section className="upcoming-section"><div className="planner-list-heading"><div><span className="planner-kicker">NEEDS ATTENTION</span><h2>Unfinished Past Tasks</h2></div></div><section className="planner-schedule">{missedTasks.map((item) => <ScheduleItem key={`${item.source}-${item.id}`} item={item} onStart={() => start(item)} onComplete={() => updateStatus(item, 'Completed')} onRetake={() => retake(item)} onCompleteRetake={(notes) => completeRetake({ ...item, retakeNote: notes })} onEdit={() => openEditor(item)} showDate missed onReschedule={() => openEditor({ ...item, date: today, startTime: '' })} />)}</section></section>}
      </div>
      <aside className="dashboard-assistant planning-tools"><div className="assistant-header"><div className="assistant-avatar">☷</div><div><strong>Planning tools</strong><small>Connected to your goals</small></div></div><div className="assistant-body"><p className="planning-tools-copy">Daily Instructor reads your account’s saved roadmap. Task changes and completion attempts are saved to the backend.</p><div className="assistant-quick"><button type="button" onClick={openNewTask}>＋ Add a personal task</button></div><div className="planning-tools-note"><strong>{todayTasks.length} tasks for this date</strong><span>{completed} completed · {todayTasks.length - completed} remaining</span><span>Schedule and history saved to your account.</span></div></div></aside>
    </div>
    {modalOpen && <TaskModal key={editingTask ? `${editingTask.source}-${editingTask.id}` : 'new-task'} task={editingTask} today={today} onClose={() => { setModalOpen(false); setEditingTask(null) }} onSave={saveTask} onDelete={deletePersonalTask} />}
  </div>
}

function DashboardHeader({ date, progress, completed, remaining }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return <div className="dashboard-heading"><div><span className="planner-kicker">YOUR DAILY PLAN</span><h1>{greeting}</h1><p>Actions for the selected date, connected to your longer-term goals.</p></div><div className="dashboard-date"><strong>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</strong><span>♧</span></div><div className="dashboard-stat-line">{progress}% complete · {completed} finished · {remaining} remaining</div></div>
}

function OverviewCard({ icon, label, value, meta, progress: valueProgress, tone = '' }) {
  return <div className={`overview-card ${tone}`}><div className="overview-card-top"><span className="overview-icon">{icon}</span><span>{label}</span></div><strong>{value}</strong><small>{meta}</small>{valueProgress !== undefined && <div className="overview-progress"><i style={{ width: `${valueProgress}%` }} /></div>}</div>
}

function ScheduleItem({ item, onStart, onComplete, onRetake, onCompleteRetake, onEdit, showDate = false, missed = false, onReschedule }) {
  const [retakeNote, setRetakeNote] = useState('')
  const completionHistory = getCompletionHistory(item)
  return <article className={`planner-item ${item.status.toLowerCase().replace(' ', '-')} ${missed ? 'missed' : ''}`}>
    <div className="planner-time">{showDate ? new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `${formatTime(item.startTime)}${item.endTime ? `–${formatTime(item.endTime)}` : ''}`}<small>{item.minutes} min</small></div>
    <span className="planner-status" aria-label={`Status: ${item.status}`}>{item.status === 'Completed' ? '✓' : item.status === 'In Progress' ? '●' : '○'}</span>
    <div className="planner-item-main"><span>{item.category} · {item.priority}{item.goalTitle ? ` · ${item.goalTitle}` : ' · Personal task'}</span><strong>{item.activity}</strong><small>{item.notes || item.description || (item.scheduleConflict ? 'Choose a time to add this task to today’s schedule.' : 'No notes added')}</small>
      {completionHistory.length > 0 && <details className="task-completion-details"><summary>View History · {completionHistory.length} completed attempt{completionHistory.length === 1 ? '' : 's'}</summary><div><strong>Current status: {item.status}</strong><span>Latest completion: {formatCompletionDate(completionHistory.at(-1).completedAt)}</span><ol>{completionHistory.map((entry, index) => <li key={`${entry.completedAt}-${index}`}>{formatCompletionDate(entry.completedAt)}{entry.notes ? ` — ${entry.notes}` : ''}</li>)}</ol></div></details>}
      {item.retakeInProgress && <label className="retake-note-field">Retake notes (optional)<textarea value={retakeNote} maxLength="500" rows="2" onChange={(event) => setRetakeNote(event.target.value)} placeholder="Add a note about this attempt" /></label>}
    </div>
    <span className="planner-item-state">{missed ? 'Missed' : item.status}</span>
    <button className="item-edit" type="button" onClick={onEdit}>Edit</button>
    <button className={`item-action ${item.status === 'Completed' ? 'retake-task-action' : ''}`} type="button" onClick={missed ? onReschedule : item.status === 'Completed' ? (item.retakeInProgress ? () => onCompleteRetake(retakeNote) : onRetake) : item.status === 'In Progress' ? onComplete : onStart}>{missed ? 'Reschedule' : item.status === 'Completed' ? (item.retakeInProgress ? 'Record Retake Complete' : 'Retake Task') : item.status === 'In Progress' ? 'Complete' : 'Start task'}</button>
  </article>
}

function formatCompletionDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function TaskModal({ task, today, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState({
    activity: task?.activity || '',
    description: task?.description || '',
    category: task?.category || 'Personal',
    priority: task?.priority || 'Normal',
    date: task?.date || today,
    startTime: task?.startTime || '',
    minutes: String(task?.minutes || 30),
    notes: task?.notes || '',
  })
  const [error, setError] = useState('')
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const submit = (event) => {
    event.preventDefault()
    const start = timeToMinutes(draft.startTime)
    const minutes = Number(draft.minutes)
    if (!draft.activity.trim()) return setError('Enter a task title.')
    if (!draft.date || !draft.startTime) return setError('Choose a date and start time so the task has a place in your schedule.')
    if (!Number.isFinite(minutes) || minutes <= 0) return setError('Enter an estimated duration greater than zero.')
    if (start + minutes >= 1440) return setError('The task must end before midnight.')
    onSave({ ...draft, minutes, endTime: minutesToTime(start + minutes) })
  }
  return <div className="daily-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="adjust-panel daily-task-form" onSubmit={submit}>
    <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>×</button><span className="planner-kicker">{task ? 'UPDATE SCHEDULE' : 'ADD PERSONAL TASK'}</span><h2>{task ? 'Adjust this task' : 'Make space for it.'}</h2>
    {task?.goalTitle && <p className="task-goal-link">Linked goal: <strong>{task.goalTitle}</strong></p>}
    <label className="modal-field">Task name<input autoFocus maxLength="160" value={draft.activity} onChange={(event) => update('activity', event.target.value)} placeholder="e.g. Practice interview questions" required /></label>
    <label className="modal-field">Description<textarea maxLength="500" rows="2" value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder="What does this task involve?" /></label>
    <div className="daily-task-fields"><label className="modal-field">Date<input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} required /></label><label className="modal-field">Start time<input type="time" value={draft.startTime} onChange={(event) => update('startTime', event.target.value)} required /></label></div>
    <div className="daily-task-fields"><label className="modal-field">Category<select value={draft.category} onChange={(event) => update('category', event.target.value)} disabled={Boolean(task?.goalTitle)}>{['Work', 'College', 'Learning', 'Exercise', 'Personal', 'Health', 'Other'].map((category) => <option key={category}>{category}</option>)}</select></label><label className="modal-field">Priority<select value={draft.priority} onChange={(event) => update('priority', event.target.value)}><option>High</option><option>Normal</option><option>Low</option></select></label></div>
    <label className="modal-field">Duration (minutes)<input type="number" min="1" step="1" value={draft.minutes} onChange={(event) => update('minutes', event.target.value)} required /></label>
    <label className="modal-field">Notes<textarea maxLength="500" rows="2" value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></label>
    {error && <p className="daily-form-error" role="alert">{error}</p>}
    <div className="daily-task-form-actions">{task?.source === 'personal' && <button className="danger-action" type="button" onClick={() => onDelete(task)}>Delete task</button>}<button className="primary-action full" type="submit">Save task ↗</button></div>
  </form></div>
}
