import { useEffect, useMemo, useState } from 'react'
import './TimetableCreator.css'
import { apiRequest } from './lib/api'

const todayKey = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const freshPreferences = () => ({
  wakeTime: '',
  sleepTime: '',
  collegeWork: [],
  fitness: [],
  fixedCommitments: [],
  mealTimes: [],
  studyHours: '',
  codingHours: '',
  businessHours: '',
  personalHours: '',
  breakDuration: 15,
  availableFreeTime: '',
  dailyGoals: [],
  priorityTasks: [],
  style: 'Balanced',
  customActivities: [],
})

const minutesBetween = (start, end) => {
  if (!start || !end) return 30
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  return Math.max(1, endHour * 60 + endMinute - startHour * 60 - startMinute)
}

const readableTime = (time) => {
  if (!time) return 'Flexible'
  const [hours, minutes] = time.split(':').map(Number)
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}

const datesFor = (start, days) => Array.from({ length: days }, (_, offset) => {
  const date = new Date(`${start}T12:00:00`)
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
})

export default function TimetableCreator() {
  const [range, setRange] = useState('daily')
  const [startDate, setStartDate] = useState(todayKey)
  const [preferences, setPreferences] = useState(freshPreferences)
  const [records, setRecords] = useState([])
  const [timetable, setTimetable] = useState(null)
  const [tasks, setTasks] = useState([])
  const [view, setView] = useState('timeline')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [instruction, setInstruction] = useState('')
  const [drafts, setDrafts] = useState({})
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState({
    date: todayKey(), activity: '', startTime: '09:00', endTime: '09:30',
    category: 'Personal', priority: 'Normal', description: '', dailyTaskId: '',
  })

  const recordId = timetable?.id || ''
  useEffect(() => {
    let active = true
    apiRequest('/timetable')
      .then(({ timetables }) => {
        if (!active) return
        setRecords(timetables)
        const selected = timetables[0] || null
        setTimetable(selected)
        if (selected) {
          setRange(selected.durationDays === 7 ? 'weekly' : 'daily')
          setStartDate(selected.startDate.slice(0, 10))
          setPreferences(selected.generationInput || freshPreferences())
        }
      })
      .catch((loadError) => { if (active) setError(loadError.message || 'Saved timetables could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const end = datesFor(startDate, range === 'weekly' ? 7 : 1).at(-1)
    let active = true
    apiRequest(`/tasks?from=${encodeURIComponent(startDate)}&to=${encodeURIComponent(end)}`)
      .then(({ tasks: result }) => { if (active) setTasks(result) })
      .catch(() => { if (active) setTasks([]) })
    return () => { active = false }
  }, [startDate, range, recordId])

  const visibleDates = useMemo(() => timetable
    ? datesFor(timetable.startDate.slice(0, 10), timetable.durationDays)
    : datesFor(startDate, range === 'weekly' ? 7 : 1), [timetable, startDate, range])
  const activities = timetable?.activities || []
  const completedCount = activities.filter((activity) => activity.status === 'Completed').length
  const progress = activities.length ? Math.round(completedCount / activities.length * 100) : 0
  const linkableTasks = tasks.filter((task) => task.status !== 'Completed')

  const updatePreference = (key, value) => setPreferences((current) => ({ ...current, [key]: value }))
  const updateCommitment = (key, index, field, value) => setPreferences((current) => ({
    ...current,
    [key]: current[key].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }))
  const addCommitment = (key, category) => setPreferences((current) => ({
    ...current,
    [key]: [...current[key], { activity: '', startTime: '09:00', endTime: '10:00', category, description: '' }],
  }))
  const removeCommitment = (key, index) => setPreferences((current) => ({
    ...current,
    [key]: current[key].filter((_, itemIndex) => itemIndex !== index),
  }))
  const addCustomActivity = () => updatePreference('customActivities', [
    ...preferences.customActivities,
    { activity: '', minutes: 45, category: 'Personal', description: '', priority: 'Normal' },
  ])
  const updateCustomActivity = (index, field, value) => updatePreference('customActivities',
    preferences.customActivities.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  const removeCustomActivity = (index) => updatePreference('customActivities',
    preferences.customActivities.filter((_, itemIndex) => itemIndex !== index))

  const generate = async () => {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const body = {
        range,
        startDate,
        preferences: {
          ...preferences,
          studyHours: preferences.studyHours === '' ? undefined : Number(preferences.studyHours),
          codingHours: preferences.codingHours === '' ? undefined : Number(preferences.codingHours),
          businessHours: preferences.businessHours === '' ? undefined : Number(preferences.businessHours),
          personalHours: preferences.personalHours === '' ? undefined : Number(preferences.personalHours),
          dailyGoals: Array.isArray(preferences.dailyGoals) ? preferences.dailyGoals : splitLines(preferences.dailyGoals),
          priorityTasks: Array.isArray(preferences.priorityTasks) ? preferences.priorityTasks : splitLines(preferences.priorityTasks),
          collegeWork: preferences.collegeWork.filter((item) => item.activity.trim()),
          fitness: preferences.fitness.filter((item) => item.activity.trim()),
          fixedCommitments: preferences.fixedCommitments.filter((item) => item.activity.trim()),
          mealTimes: preferences.mealTimes.filter((item) => item.activity.trim()),
          customActivities: preferences.customActivities.filter((item) => item.activity.trim()),
        },
      }
      const result = await apiRequest('/timetable/generate', { method: 'POST', body: JSON.stringify(body) })
      if (result.clarificationQuestions?.length) {
        setNotice(`A little more detail would help: ${result.clarificationQuestions.join(' ')}`)
        return
      }
      setTimetable(result.timetable)
      setRecords((current) => [result.timetable, ...current.filter((item) => item.id !== result.timetable.id)])
      setNotice('Your AI-generated timetable is saved to your account.')
      setTasks((current) => current)
    } catch (generateError) {
      setError(generateError.message || 'The timetable could not be generated.')
    } finally {
      setWorking(false)
    }
  }

  const saveActivities = async (nextActivities, successMessage = 'Timetable updated.') => {
    if (!timetable) return
    setWorking(true)
    setError('')
    try {
      const { timetable: saved } = await apiRequest(`/timetable/${encodeURIComponent(timetable.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ activities: nextActivities }),
      })
      setTimetable(saved)
      setRecords((current) => current.map((item) => item.id === saved.id ? saved : item))
      setDrafts({})
      setNotice(successMessage)
    } catch (saveError) {
      setError(saveError.message || 'The timetable changes could not be saved.')
    } finally {
      setWorking(false)
    }
  }

  const adjust = async (event) => {
    event.preventDefault()
    if (!timetable || !instruction.trim()) return
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(`/timetable/${encodeURIComponent(timetable.id)}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ instruction: instruction.trim() }),
      })
      if (result.clarificationQuestions?.length) {
        setNotice(`Please clarify: ${result.clarificationQuestions.join(' ')}`)
        return
      }
      setTimetable(result.timetable)
      setRecords((current) => current.map((item) => item.id === result.timetable.id ? result.timetable : item))
      setInstruction('')
      setNotice('Your timetable was adjusted and saved.')
    } catch (adjustError) {
      setError(adjustError.message || 'The timetable could not be adjusted.')
    } finally {
      setWorking(false)
    }
  }

  const addManualActivity = async (event) => {
    event.preventDefault()
    if (!timetable || !manual.activity.trim()) return
    const activity = {
      id: crypto.randomUUID(),
      date: manual.date,
      activity: manual.activity.trim(),
      startTime: manual.startTime,
      endTime: manual.endTime,
      minutes: minutesBetween(manual.startTime, manual.endTime),
      priority: manual.priority,
      category: manual.category.trim() || 'Personal',
      description: manual.description.trim(),
      relatedGoalId: tasks.find((task) => task.id === manual.dailyTaskId)?.goalId || null,
      dailyTaskId: manual.dailyTaskId || null,
      status: 'Planned',
      fixed: false,
    }
    await saveActivities([...activities, activity], 'Activity added to your timetable.')
    setManualOpen(false)
    setManual((current) => ({ ...current, activity: '', description: '', dailyTaskId: '' }))
  }

  const selectTimetable = async (id) => {
    if (!id) return setTimetable(null)
    try {
      const { timetable: saved } = await apiRequest(`/timetable/${encodeURIComponent(id)}`)
      setTimetable(saved)
      setRange(saved.durationDays === 7 ? 'weekly' : 'daily')
      setStartDate(saved.startDate.slice(0, 10))
      setPreferences(saved.generationInput || freshPreferences())
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'This saved timetable could not be opened.')
    }
  }

  const deleteCurrent = async () => {
    if (!timetable || !window.confirm('Delete this saved timetable? Linked Daily Instructor tasks will remain in your account.')) return
    setWorking(true)
    try {
      await apiRequest(`/timetable/${encodeURIComponent(timetable.id)}`, { method: 'DELETE' })
      const remaining = records.filter((item) => item.id !== timetable.id)
      setRecords(remaining)
      setTimetable(remaining[0] || null)
      setNotice('Saved timetable deleted. Daily Instructor tasks were preserved.')
    } catch (deleteError) {
      setError(deleteError.message || 'The timetable could not be deleted.')
    } finally {
      setWorking(false)
    }
  }

  const updateDraft = (activity, field, value) => {
    setDrafts((current) => {
      const previous = current[activity.id] || { ...activity }
      const next = { ...previous, [field]: value }
      if (field === 'startTime' || field === 'endTime') next.minutes = minutesBetween(next.startTime, next.endTime)
      return { ...current, [activity.id]: next }
    })
  }

  return <section className="timetable-page">
    <header className="timetable-heading">
      <div><span className="page-eyebrow">PERSONALIZED TIME ALLOCATION</span><h1>AI Timetable Creator</h1><p>Turn your commitments, priorities, and goals into a workable day or week.</p></div>
      {timetable && <div className="timetable-progress"><strong>{progress}%</strong><span>{completedCount} of {activities.length} complete</span><i><b style={{ width: `${progress}%` }} /></i></div>}
    </header>

    {error && <div className="timetable-alert" role="alert">{error}</div>}
    {notice && <div className="timetable-notice" role="status">{notice}</div>}

    <div className="timetable-toolbar">
      <label>Previous timetables<select value={timetable?.id || ''} onChange={(event) => { void selectTimetable(event.target.value) }}><option value="">Create a new timetable…</option>{records.map((item) => <option value={item.id} key={item.id}>{item.durationDays === 7 ? 'Week' : 'Day'} · {item.startDate.slice(0, 10)}</option>)}</select></label>
      {timetable && <button className="tt-button tt-danger" type="button" disabled={working} onClick={() => { void deleteCurrent() }}>Delete saved timetable</button>}
    </div>

    {!timetable && <section className="tt-panel tt-generator">
      <div className="tt-panel-heading"><div><span className="section-kicker">PLAN AHEAD</span><h2>Build your schedule</h2><p>Share what matters. Leave anything blank and add as many custom activities as you need.</p></div></div>
      <div className="tt-form-grid">
        <label>Timetable range<select value={range} onChange={(event) => setRange(event.target.value)}><option value="daily">One day</option><option value="weekly">One week</option></select></label>
        <label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>Wake-up time<input type="time" value={preferences.wakeTime} onChange={(event) => updatePreference('wakeTime', event.target.value)} /></label>
        <label>Sleep time<input type="time" value={preferences.sleepTime} onChange={(event) => updatePreference('sleepTime', event.target.value)} /></label>
        <label>Study hours / day<input type="number" min="0" max="16" step=".5" value={preferences.studyHours} onChange={(event) => updatePreference('studyHours', event.target.value)} /></label>
        <label>Coding hours / day<input type="number" min="0" max="16" step=".5" value={preferences.codingHours} onChange={(event) => updatePreference('codingHours', event.target.value)} /></label>
        <label>Business hours / day<input type="number" min="0" max="16" step=".5" value={preferences.businessHours} onChange={(event) => updatePreference('businessHours', event.target.value)} /></label>
        <label>Personal activity hours / day<input type="number" min="0" max="16" step=".5" value={preferences.personalHours} onChange={(event) => updatePreference('personalHours', event.target.value)} /></label>
        <label>Break duration (minutes)<input type="number" min="5" max="90" value={preferences.breakDuration} onChange={(event) => updatePreference('breakDuration', Number(event.target.value))} /></label>
        <label>Timetable style<select value={preferences.style} onChange={(event) => updatePreference('style', event.target.value)}>{['Balanced', 'Focused', 'Flexible', 'Light'].map((style) => <option key={style}>{style}</option>)}</select></label>
      </div>

      <CommitmentEditor title="College / work hours" items={preferences.collegeWork} onAdd={() => addCommitment('collegeWork', 'Work')} onChange={(index, field, value) => updateCommitment('collegeWork', index, field, value)} onRemove={(index) => removeCommitment('collegeWork', index)} />
      <CommitmentEditor title="Gym / fitness" items={preferences.fitness} onAdd={() => addCommitment('fitness', 'Fitness')} onChange={(index, field, value) => updateCommitment('fitness', index, field, value)} onRemove={(index) => removeCommitment('fitness', index)} />
      <CommitmentEditor title="Prayer / fixed commitments" items={preferences.fixedCommitments} onAdd={() => addCommitment('fixedCommitments', 'Commitment')} onChange={(index, field, value) => updateCommitment('fixedCommitments', index, field, value)} onRemove={(index) => removeCommitment('fixedCommitments', index)} />
      <CommitmentEditor title="Meal times" items={preferences.mealTimes} onAdd={() => addCommitment('mealTimes', 'Meals')} onChange={(index, field, value) => updateCommitment('mealTimes', index, field, value)} onRemove={(index) => removeCommitment('mealTimes', index)} />

      <div className="tt-textarea-grid">
        <label>Available free time<textarea rows="3" placeholder="For example: Tuesday afternoon is open; keep evenings flexible." value={preferences.availableFreeTime} onChange={(event) => updatePreference('availableFreeTime', event.target.value)} /></label>
        <label>Daily goals<textarea rows="3" placeholder="One goal per line" value={formatLines(preferences.dailyGoals)} onChange={(event) => updatePreference('dailyGoals', splitLines(event.target.value))} /></label>
        <label>Priority tasks<textarea rows="3" placeholder="One priority per line" value={formatLines(preferences.priorityTasks)} onChange={(event) => updatePreference('priorityTasks', splitLines(event.target.value))} /></label>
      </div>

      <section className="tt-custom-list"><div className="tt-subheading"><div><span className="section-kicker">YOUR OWN ACTIVITIES</span><h3>Custom activities</h3></div><button className="tt-button" type="button" onClick={addCustomActivity}>＋ Add activity</button></div>
        {preferences.customActivities.map((activity, index) => <div className="tt-custom-row" key={`custom-${index}`}>
          <input aria-label="Custom activity name" placeholder="Activity name" value={activity.activity} onChange={(event) => updateCustomActivity(index, 'activity', event.target.value)} />
          <input aria-label="Custom activity duration in minutes" type="number" min="5" max="1440" value={activity.minutes || 45} onChange={(event) => updateCustomActivity(index, 'minutes', Number(event.target.value))} />
          <input aria-label="Custom activity category" placeholder="Category" value={activity.category} onChange={(event) => updateCustomActivity(index, 'category', event.target.value)} />
          <select aria-label="Custom activity priority" value={activity.priority} onChange={(event) => updateCustomActivity(index, 'priority', event.target.value)}>{['High', 'Normal', 'Low'].map((priority) => <option key={priority}>{priority}</option>)}</select>
          <button type="button" className="tt-icon-button" aria-label="Remove custom activity" onClick={() => removeCustomActivity(index)}>×</button>
        </div>)}
      </section>
      <button className="tt-button tt-primary" type="button" disabled={working} onClick={() => { void generate() }}>{working ? 'Creating with AI…' : `✦ Generate ${range} timetable`}</button>
      <p className="tt-provider-note">AI generation uses your server-configured OpenAI connection. Your provider key stays on the backend.</p>
    </section>}

    {loading && <p className="tt-muted" role="status">Loading your saved timetables…</p>}
    {timetable && <div className="tt-workspace">
      <div className="tt-view-toolbar">
        <div><span className="section-kicker">{timetable.durationDays === 7 ? 'WEEKLY TIMETABLE' : 'DAILY TIMETABLE'}</span><h2>{new Date(`${timetable.startDate.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}{timetable.durationDays === 7 ? ` – ${new Date(`${visibleDates.at(-1)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</h2></div>
        <div className="tt-view-tabs" role="group" aria-label="Timetable view">{['timeline', 'calendar'].map((mode) => <button key={mode} type="button" className={view === mode ? 'active' : ''} onClick={() => setView(mode)}>{mode === 'timeline' ? 'Timeline' : 'Calendar'}</button>)}</div>
      </div>
      <form className="tt-adjust-form" onSubmit={(event) => { void adjust(event) }}><span>✦</span><input aria-label="Describe a timetable adjustment" placeholder="Ask AI to adjust this timetable… e.g. Move coding to the evening." value={instruction} onChange={(event) => setInstruction(event.target.value)} /><button className="tt-button tt-primary" type="submit" disabled={working || !instruction.trim()}>{working ? 'Adjusting…' : 'Adjust with AI'}</button></form>
      <div className="tt-action-row"><span>{activities.length} activities · {timetable.generationMetadata?.provider === 'openai' ? 'AI generated' : 'Saved timetable'}</span><div><button className="tt-button" type="button" disabled={working} onClick={() => { setManual((current) => ({ ...current, date: visibleDates[0] })); setManualOpen((value) => !value) }}>＋ Add activity</button><button className="tt-button tt-primary" type="button" disabled={working} onClick={() => { setTimetable(null); setStartDate(timetable.startDate.slice(0, 10)); setRange(timetable.durationDays === 7 ? 'weekly' : 'daily'); setPreferences(timetable.generationInput || freshPreferences()) }}>↻ Regenerate</button></div></div>
      {manualOpen && <form className="tt-manual-form" onSubmit={(event) => { void addManualActivity(event) }}>
        <label>Activity<input required maxLength="180" value={manual.activity} onChange={(event) => setManual({ ...manual, activity: event.target.value })} /></label>
        <label>Date<select value={manual.date} onChange={(event) => setManual({ ...manual, date: event.target.value })}>{visibleDates.map((date) => <option key={date} value={date}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</option>)}</select></label>
        <label>Start<input type="time" value={manual.startTime} onChange={(event) => setManual({ ...manual, startTime: event.target.value })} /></label>
        <label>End<input type="time" value={manual.endTime} onChange={(event) => setManual({ ...manual, endTime: event.target.value })} /></label>
        <label>Category<input value={manual.category} onChange={(event) => setManual({ ...manual, category: event.target.value })} /></label>
        <label>Priority<select value={manual.priority} onChange={(event) => setManual({ ...manual, priority: event.target.value })}>{['High', 'Normal', 'Low'].map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        <label>Link Daily Instructor task<select value={manual.dailyTaskId} onChange={(event) => setManual({ ...manual, dailyTaskId: event.target.value })}><option value="">No linked task</option>{linkableTasks.map((task) => <option key={task.id} value={task.id}>{task.activity}</option>)}</select></label>
        <label className="tt-span-two">Description<input value={manual.description} onChange={(event) => setManual({ ...manual, description: event.target.value })} /></label>
        <button className="tt-button tt-primary" type="submit" disabled={working}>Save activity</button><button className="tt-button" type="button" onClick={() => setManualOpen(false)}>Cancel</button>
      </form>}
      {view === 'calendar'
        ? <div className={`tt-calendar ${timetable.durationDays === 1 ? 'single-day' : ''}`}>{visibleDates.map((date) => <DayColumn key={date} date={date} activities={activities.filter((activity) => activity.date === date)} drafts={drafts} updateDraft={updateDraft} saveActivities={saveActivities} allActivities={activities} working={working} />)}</div>
        : <div className="tt-timeline">{visibleDates.map((date) => <DayTimeline key={date} date={date} activities={activities.filter((activity) => activity.date === date)} drafts={drafts} updateDraft={updateDraft} saveActivities={saveActivities} allActivities={activities} working={working} />)}</div>}
      {!activities.length && <div className="tt-empty">No activities saved in this timetable yet.</div>}
      <button className="tt-button tt-new" type="button" onClick={() => { setTimetable(null); setPreferences(freshPreferences()) }}>＋ Create another timetable</button>
    </div>}
    {!loading && !records.length && !timetable && <p className="tt-muted">Previous timetables will appear here after you generate and save one.</p>}
  </section>
}

function CommitmentEditor({ title, items, onAdd, onChange, onRemove }) {
  return <section className="tt-commitments"><div className="tt-subheading"><h3>{title}</h3><button className="tt-text-button" type="button" onClick={onAdd}>＋ Add time</button></div>
    {items.map((item, index) => <div className="tt-commitment-row" key={`${title}-${index}`}>
      <input aria-label={`${title} activity`} placeholder="Name" value={item.activity} onChange={(event) => onChange(index, 'activity', event.target.value)} />
      <input aria-label={`${title} start time`} type="time" value={item.startTime} onChange={(event) => onChange(index, 'startTime', event.target.value)} />
      <input aria-label={`${title} end time`} type="time" value={item.endTime} onChange={(event) => onChange(index, 'endTime', event.target.value)} />
      <button type="button" className="tt-icon-button" aria-label={`Remove ${title} time`} onClick={() => onRemove(index)}>×</button>
    </div>)}
  </section>
}

function DayTimeline({ date, activities, ...props }) {
  return <section className="tt-day-timeline"><h3>{dateLabel(date)}</h3>{activities.length
    ? [...activities].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((activity) => <ActivityCard key={activity.id} activity={activity} {...props} />)
    : <p className="tt-day-empty">No activities for this day.</p>}</section>
}

function DayColumn({ date, activities, ...props }) {
  return <section className="tt-day-column"><header><strong>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</strong><span>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></header>
    {[...activities].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((activity) => <ActivityCard compact key={activity.id} activity={activity} {...props} />)}
    {!activities.length && <p className="tt-day-empty">Open</p>}
  </section>
}

function ActivityCard({ activity, drafts, updateDraft, saveActivities, allActivities, working, compact = false }) {
  const current = drafts[activity.id] || activity
  const changed = Boolean(drafts[activity.id])
  const patch = (updates) => saveActivities(allActivities.map((item) => item.id === activity.id ? { ...current, ...updates } : item))
  const remove = () => saveActivities(allActivities.filter((item) => item.id !== activity.id), 'Activity removed.')
  return <article className={`tt-activity-card ${compact ? 'compact' : ''} ${activity.status === 'Completed' ? 'is-completed' : ''} ${activity.status === 'Skipped' ? 'is-skipped' : ''}`} data-category={activity.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
    <div className="tt-activity-time"><strong>{readableTime(activity.startTime)}</strong><span>{readableTime(activity.endTime)} · {activity.minutes} min</span></div>
    <div className="tt-activity-content">
      <div className="tt-activity-title"><span className="tt-category">{activity.category}</span><span className={`tt-priority ${activity.priority.toLowerCase()}`}>{activity.priority}</span>{activity.dailyTaskId && <span className="tt-linked">Daily task</span>}</div>
      <strong>{activity.activity}</strong>
      {!compact && activity.description && <p>{activity.description}</p>}
      <small>{activity.relatedGoalId ? 'Linked to a Goal Instructor goal' : activity.fixed ? 'Fixed commitment' : 'Timetable activity'}</small>
      {changed && <div className="tt-edit-fields">
        <input aria-label={`Edit ${activity.activity} name`} value={current.activity} onChange={(event) => updateDraft(activity, 'activity', event.target.value)} />
        <input aria-label={`Edit ${activity.activity} date`} type="date" value={current.date} onChange={(event) => updateDraft(activity, 'date', event.target.value)} />
        <input aria-label={`Edit ${activity.activity} start time`} type="time" value={current.startTime} onChange={(event) => updateDraft(activity, 'startTime', event.target.value)} />
        <input aria-label={`Edit ${activity.activity} end time`} type="time" value={current.endTime} onChange={(event) => updateDraft(activity, 'endTime', event.target.value)} />
        <input aria-label={`Edit ${activity.activity} category`} value={current.category} onChange={(event) => updateDraft(activity, 'category', event.target.value)} />
        <input aria-label={`Edit ${activity.activity} description`} value={current.description} onChange={(event) => updateDraft(activity, 'description', event.target.value)} />
        <select aria-label={`Edit ${activity.activity} priority`} value={current.priority} onChange={(event) => updateDraft(activity, 'priority', event.target.value)}>{['High', 'Normal', 'Low'].map((item) => <option key={item}>{item}</option>)}</select>
      </div>}
    </div>
    <div className="tt-activity-actions">
      {activity.status !== 'Completed' && <button type="button" onClick={() => changed ? patch(current) : updateDraft(activity, 'activity', activity.activity)}>{changed ? 'Save edit' : 'Edit'}</button>}
      {activity.status === 'Planned' && <button type="button" onClick={() => patch({ status: 'Completed' })}>Complete</button>}
      {activity.status === 'Planned' && <button type="button" onClick={() => patch({ status: 'Skipped' })}>Skip</button>}
      {activity.status === 'Skipped' && <button type="button" onClick={() => patch({ status: 'Planned' })}>Restore</button>}
      {activity.status !== 'Completed' && !activity.dailyTaskId && <button type="button" disabled={working} onClick={() => { void remove() }}>Delete</button>}
      {activity.status === 'Completed' && <span className="tt-done-badge">✓ Completed</span>}
    </div>
  </article>
}

function dateLabel(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function splitLines(value) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

function formatLines(value) {
  return Array.isArray(value) ? value.join('\n') : value || ''
}
