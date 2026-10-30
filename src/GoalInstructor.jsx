import { useEffect, useMemo, useState } from 'react'
import './GoalInstructor.css'
import { apiRequest } from './lib/api'
import { isPersistedGoalId, toGoalRequest } from './lib/goals'

const DAILY_STORAGE_KEY = 'lifepilot-daily-plan'
const STORAGE_KEY = 'lifepilot-goal-plans-v1'
const categories = [
  'Education and Study', 'Coding and Programming', 'Career and Job Placement', 'Fitness and Gym',
  'Weight Management and Nutrition', 'Business and Entrepreneurship', 'Personal Finance and Budgeting',
  'Reading and Learning', 'Productivity and Time Management', 'Personal Development',
  'Communication and Language Learning', 'Creative Skills', 'Project Development',
  'Competitive Exams and Certifications', 'Daily Habits and Routines', 'Other Goals',
]
const inferredCategories = {
  coding: 'Coding and Programming',
  business: 'Business and Entrepreneurship',
  fitness: 'Fitness and Gym',
  finance: 'Personal Finance and Budgeting',
  study: 'Education and Study',
  language: 'Communication and Language Learning',
  habit: 'Daily Habits and Routines',
  career: 'Career and Job Placement',
  creative: 'Creative Skills',
  general: 'Other Goals',
}
const blankGoal = {
  goal: '', current: '', outcome: '', hoursPerDay: '', preferredDays: [], availableStartTime: '', availableEndTime: '',
  durationAmount: '', durationUnit: 'days', category: '', targetDate: '', skills: '', resources: '', limitations: '', style: '',
  budget: '', instructions: '',
}
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const durationDaysPerUnit = { days: 1, weeks: 7, months: 30.4375, years: 365.25 }
const effortGuidance = {
  coding: { weeks: 6, minutes: 180 },
  business: { weeks: 12, minutes: 180 },
  fitness: { weeks: 8, minutes: 120 },
  finance: { weeks: 3, minutes: 60 },
  study: { weeks: 4, minutes: 120 },
  language: { weeks: 8, minutes: 120 },
  habit: { weeks: 2, minutes: 30 },
  career: { weeks: 6, minutes: 180 },
  creative: { weeks: 4, minutes: 90 },
  general: { weeks: 4, minutes: 90 },
}
const planGuidance = {
  coding: { resources: 'Use the official documentation for the language and tools you choose, plus one small project-based reference. Avoid collecting more tutorials than you can apply.', challenges: 'Common obstacles: expanding scope and switching learning resources. Keep the first deliverable small and use one primary reference at a time.' },
  business: { resources: 'Use primary customer conversations, current public market information, and quotes from actual suppliers. Verify local legal and tax requirements with qualified sources.', challenges: 'Common obstacles: assuming demand and underestimating costs. Test the smallest offer first and revisit assumptions with evidence.' },
  fitness: { resources: 'Use guidance from a qualified trainer or clinician when appropriate, and a simple activity log. Adapt activities to your health, equipment, and current ability.', challenges: 'Common obstacles: doing too much too soon and disruptions to routine. Progress gradually, build in recovery, and scale down rather than abandoning the plan.' },
  study: { resources: 'Use the course syllabus, official exam outline, or trusted reference materials for the subject. Prioritize practice questions and recall over gathering extra materials.', challenges: 'Common obstacles: passive rereading and unclear weak areas. Use short retrieval practice and let practice results guide the next topic.' },
  finance: { resources: 'Use verified statements and current figures from your own accounts; consult a qualified financial or tax professional for complex decisions.', challenges: 'Common obstacles: estimates based on incomplete records and plans that are too restrictive. Track actuals, use conservative estimates, and adjust in small steps.' },
  language: { resources: 'Use a trusted dictionary or course, authentic listening or reading material at a suitable level, and conversation practice when available.', challenges: 'Common obstacles: focusing on recognition without using the language. Include short speaking or writing practice and review mistakes without expecting fluency on a fixed timeline.' },
  habit: { resources: 'Use a simple, private habit log and reliable reminders or environmental cues that fit your routine. Keep the smallest version easy to repeat.', challenges: 'Common obstacles: all-or-nothing expectations and missed days. Plan a fallback version and return at the next cue without trying to compensate.' },
  career: { resources: 'Use current job descriptions, employer career pages, and feedback from trusted peers or mentors. Verify role requirements and application details directly.', challenges: 'Common obstacles: applying too broadly and polishing materials without getting feedback. Focus on a specific role family and ask for review of concrete examples.' },
  creative: { resources: 'Use a small set of references, relevant technique guides, and thoughtful peer feedback. Credit inspirations and create original work rather than copying examples.', challenges: 'Common obstacles: endless preparation and perfectionism. Set a small scope, make a rough draft early, and define what “finished enough” means.' },
  general: { resources: 'Choose one credible resource that directly supports the next action, such as official guidance, a relevant reference, or input from a qualified person. Verify recommendations for your context.', challenges: 'Common obstacles: an unclear next step or unexpected constraints. Revisit your success criteria regularly and break blocked tasks into a smaller action.' },
}
const extendedPhases = {
  coding: { name: 'Maintain and extend the project', objective: 'Use feedback and actual use to choose the next useful improvement.', tasks: ['Review how the finished project performs in realistic use.', 'Choose one improvement based on a specific user need or observed issue.', 'Document what you learned and identify the next skill to develop.'] },
  business: { name: 'Review and grow responsibly', objective: 'Use verified results to decide whether and how to continue.', tasks: ['Compare actual customer response and costs with your launch assumptions.', 'Identify operational or compliance questions to resolve before expanding.', 'Choose a measured next step, or revise the offer based on evidence.'] },
  fitness: { name: 'Maintain a sustainable routine', objective: 'Keep a routine that supports consistency and appropriate recovery.', tasks: ['Review how the routine fits your schedule and recovery needs.', 'Choose a manageable next training cycle based on your experience.', 'Set a future check-in and adapt for changes in comfort or health.'] },
  finance: { name: 'Review and adjust the approach', objective: 'Use verified results to revise the plan carefully.', tasks: ['Compare actual figures against the plan using current records.', 'Adjust targets to reflect changing obligations and priorities.', 'Set a review date and seek qualified advice for complex decisions.'] },
  study: { name: 'Retain and apply the learning', objective: 'Strengthen retention and use the knowledge in a new context.', tasks: ['Schedule spaced review of the most important topics.', 'Apply the material in a new exercise or realistic situation.', 'Choose a follow-on topic based on your current gaps.'] },
  language: { name: 'Use the skill in new situations', objective: 'Extend practice to realistic contexts and maintain the habit.', tasks: ['Use the skill in a new real-world conversation or task.', 'Review misunderstandings and practice the specific gaps.', 'Set a light ongoing routine that fits your life.'] },
  habit: { name: 'Adapt the routine over time', objective: 'Keep the routine useful when circumstances change.', tasks: ['Identify which cues and fallback options are working.', 'Adjust the routine for an upcoming schedule change.', 'Choose a date to review whether the habit still serves your goal.'] },
  career: { name: 'Continue professional development', objective: 'Use outcomes and feedback to choose the next career step.', tasks: ['Review responses and feedback from your recent applications or conversations.', 'Strengthen one skill or evidence gap identified through that feedback.', 'Set a next-step target and update your materials as your experience changes.'] },
  creative: { name: 'Continue the creative practice', objective: 'Build on the completed work without losing a sustainable pace.', tasks: ['Reflect on the strongest part of the finished piece and what you learned.', 'Choose a new small creative exercise that explores one technique.', 'Set a manageable practice rhythm and share work when you are ready.'] },
  general: { name: 'Review and sustain progress', objective: 'Decide what to maintain, improve, or pursue next.', tasks: ['Review the result against your success criteria.', 'Identify one useful next step based on what you learned.', 'Choose a sustainable check-in date and adjust your approach.'] },
}

const roadmapTemplates = {
  coding: [
    { name: 'Define your build target', objective: 'Turn the goal into a testable software outcome.', tasks: ['Write a one-paragraph product brief and define who it serves.', 'List the smallest useful feature set and choose a first deliverable.', 'Check your current setup and identify one skill gap to address.'] },
    { name: 'Build the foundation', objective: 'Learn only the concepts needed for the first working version.', tasks: ['Work through one focused concept and take brief notes.', 'Apply the concept in a small standalone exercise.', 'Review what is still unclear and adjust the next session.'] },
    { name: 'Ship a working increment', objective: 'Build, test, and improve a real project slice.', tasks: ['Implement one end-to-end feature for the project.', 'Test the feature and record bugs or edge cases.', 'Review the increment and choose the next highest-value improvement.'] },
    { name: 'Polish and demonstrate', objective: 'Prepare a reliable result that can be shared or evaluated.', tasks: ['Improve usability, documentation, and error handling.', 'Run a final review against your success criteria.', 'Publish or present the result and note the next learning goal.'] },
  ],
  business: [
    { name: 'Explore the problem and market', objective: 'Ground the business idea in customer evidence.', tasks: ['Describe the intended customer and problem in plain language.', 'Compare existing alternatives and note how customers currently solve it.', 'Talk with potential customers and record evidence without assuming demand.'] },
    { name: 'Test a small offer', objective: 'Validate interest before committing major time or money.', tasks: ['Draft a simple offer and what it includes.', 'Ask potential customers for specific feedback or a low-cost trial.', 'Summarize what people would pay for and what remains uncertain.'] },
    { name: 'Plan costs and operations', objective: 'Understand practical setup, costs, and constraints.', tasks: ['List one-time and ongoing costs using quotes or research.', 'Map suppliers, delivery, and basic operating steps.', 'Build a conservative budget and identify compliance questions to verify.'] },
    { name: 'Prepare a measured launch', objective: 'Launch a small, measurable test and learn from it.', tasks: ['Set a limited launch scope and success measures.', 'Prepare the offer, customer communication, and fulfillment checklist.', 'Review results and decide whether to iterate, pause, or expand.'] },
  ],
  fitness: [
    { name: 'Set a safe, realistic baseline', objective: 'Define a sustainable outcome and understand your starting point.', tasks: ['Write the outcome you want and a practical way to measure it.', 'Record your current routine, available equipment, and schedule.', 'Choose a manageable starting activity; seek qualified advice for health concerns.'] },
    { name: 'Build a repeatable routine', objective: 'Establish a modest weekly pattern with recovery.', tasks: ['Schedule a short, appropriate training session.', 'Include recovery or rest appropriate to your current routine.', 'Review energy, comfort, and consistency before adding difficulty.'] },
    { name: 'Progress gradually', objective: 'Adjust one variable at a time based on how the routine feels.', tasks: ['Repeat the routine and log what you completed.', 'Make a small progression only if the previous work felt manageable.', 'Plan rest and adapt sessions around discomfort or schedule changes.'] },
    { name: 'Review and sustain', objective: 'Keep what works and plan the next realistic cycle.', tasks: ['Compare your current routine with the outcome you defined.', 'Identify the easiest habit to keep in a busy week.', 'Set the next review point and revise the routine as needed.'] },
  ],
  study: [
    { name: 'Map the material', objective: 'Break the learning outcome into topics and checkpoints.', tasks: ['List the topics or competencies needed for the outcome.', 'Check your current knowledge with a short practice task.', 'Prioritize the topics that need the most attention.'] },
    { name: 'Learn and practice', objective: 'Use focused learning followed by retrieval practice.', tasks: ['Study one small topic using a resource you already trust.', 'Close the material and recall the main ideas from memory.', 'Complete a few practice questions and review mistakes.'] },
    { name: 'Apply and review', objective: 'Connect knowledge to realistic tasks or exam-style practice.', tasks: ['Complete a longer exercise or applied project.', 'Review errors and revisit only the weak areas.', 'Take a short checkpoint and update your topic priorities.'] },
    { name: 'Consolidate the result', objective: 'Check the outcome and plan any remaining practice.', tasks: ['Complete a timed or realistic final practice task.', 'Compare your result with the success criteria.', 'Schedule light review and decide what to improve next.'] },
  ],
  finance: [
    { name: 'Understand the current picture', objective: 'Collect accurate information before choosing a change.', tasks: ['List relevant income, recurring expenses, and obligations.', 'Review recent transactions and identify categories to verify.', 'Write a specific, measurable financial outcome.'] },
    { name: 'Choose a workable approach', objective: 'Create a draft plan that reflects real constraints.', tasks: ['Set practical spending or saving categories based on observed data.', 'Identify one small change that is realistic to maintain.', 'Check assumptions and seek qualified advice for complex decisions.'] },
    { name: 'Track and adjust', objective: 'Compare the plan with actual results and revise it.', tasks: ['Record actual amounts against the plan.', 'Review any differences without treating estimates as guarantees.', 'Adjust one category or habit for the next review period.'] },
    { name: 'Review the outcome', objective: 'Assess progress and choose a sustainable next step.', tasks: ['Compare the current position with your defined outcome.', 'Document which changes were workable and which were not.', 'Set a new review date and update the plan based on verified figures.'] },
  ],
  language: [
    { name: 'Choose a practical target', objective: 'Describe a real-world situation where you want to use the skill.', tasks: ['Choose one situation and list the phrases or skills it requires.', 'Check your current level with a short listening, speaking, or writing task.', 'Pick a manageable practice resource or materials you already have.'] },
    { name: 'Build core practice', objective: 'Practice small amounts consistently across useful skills.', tasks: ['Practice a short set of vocabulary or core phrases.', 'Listen, read, or watch a short piece and summarize it.', 'Speak or write a brief response and note one correction.'] },
    { name: 'Use it in context', objective: 'Apply the skill in a realistic conversation or task.', tasks: ['Complete a role-play or practical communication exercise.', 'Review unclear phrases and practice them again.', 'Ask for feedback or compare against a reliable reference.'] },
    { name: 'Check and continue', objective: 'Review progress against the situation you chose.', tasks: ['Repeat the initial check with a new but similar task.', 'Record what is easier and what still needs practice.', 'Choose the next real-world situation to work toward.'] },
  ],
  habit: [
    { name: 'Make the habit easy to start', objective: 'Choose a small action and link it to a reliable cue.', tasks: ['Define the smallest version of the habit you can do on a busy day.', 'Choose a time, place, or existing routine as its cue.', 'Remove one practical barrier before the first attempt.'] },
    { name: 'Practice and observe', objective: 'Repeat the action and notice what helps or blocks it.', tasks: ['Try the small habit and record whether it happened.', 'Notice the cue and environment that made it easier.', 'Adjust the action size if it feels difficult to repeat.'] },
    { name: 'Strengthen consistency', objective: 'Build a flexible routine without relying on perfect days.', tasks: ['Repeat the habit at the chosen cue.', 'Plan a fallback version for a disrupted day.', 'Review what interfered and make one small adjustment.'] },
    { name: 'Review and maintain', objective: 'Keep a sustainable version and set a future check-in.', tasks: ['Review the record and identify a realistic consistency pattern.', 'Decide whether to maintain, simplify, or gently expand the habit.', 'Set a date to review the routine again.'] },
  ],
  career: [
    { name: 'Choose a clear internship target', objective: 'Understand the internship role, its application requirements, and your current evidence.', tasks: ['Choose a target internship role and review current listings and their requirements.', 'Compare required skills with your experience; list evidence and gaps.', 'Select the most important skills or application requirements to address first.'] },
    { name: 'Build relevant skills and evidence', objective: 'Create concrete examples that demonstrate internship-ready skills.', tasks: ['Practice one priority skill using a short role-relevant exercise.', 'Build or document a small work sample that demonstrates the skill.', 'Ask a trusted peer, instructor, or mentor for specific feedback.'] },
    { name: 'Prepare resume and interviews', objective: 'Prepare accurate application materials and practice communicating your experience.', tasks: ['Tailor your resume to a specific internship description using accurate examples.', 'Prepare concise examples of your projects, learning, and contributions.', 'Practice common interview questions and refine answers from feedback.'] },
    { name: 'Apply and follow up', objective: 'Submit thoughtful applications and learn from each response.', tasks: ['Identify suitable openings and verify each deadline and application requirement.', 'Submit a tailored application and record its status and follow-up date.', 'Review responses and feedback; choose a concrete next improvement.'] },
  ],
  creative: [
    { name: 'Define a small finished piece', objective: 'Choose a creative outcome small enough to complete and review.', tasks: ['Describe the intended audience, format, and purpose of the piece.', 'Collect a few references that inform the direction without copying them.', 'Set a simple constraint such as length, materials, or scope.'] },
    { name: 'Explore and make a draft', objective: 'Create a first version through focused practice.', tasks: ['Practice one technique needed for the planned piece.', 'Create a rough draft or prototype without polishing every detail.', 'Note what is working and what needs another attempt.'] },
    { name: 'Revise with feedback', objective: 'Improve the work against your stated purpose.', tasks: ['Review the draft against the audience and purpose you chose.', 'Ask a relevant person for specific, actionable feedback.', 'Revise the parts with the clearest improvement opportunity.'] },
    { name: 'Finish and reflect', objective: 'Complete, share, and learn from a finished version.', tasks: ['Polish and finish the work within the scope you set.', 'Share or archive the finished piece in a suitable way.', 'Record what you learned and choose a next creative challenge.'] },
  ],
  general: [
    { name: 'Clarify the outcome', objective: 'Turn the goal into a concrete result you can recognize.', tasks: ['Describe what success will look like in observable terms.', 'Identify your current starting point and what is already available.', 'List the most important unknowns or constraints to check.'] },
    { name: 'Prepare the first steps', objective: 'Choose a low-risk first action and gather what it needs.', tasks: ['Break the outcome into a few smaller checkpoints.', 'Choose one practical first action that fits your available time.', 'Gather a relevant resource or ask a knowledgeable person for input.'] },
    { name: 'Make and review progress', objective: 'Complete small actions and adapt based on what you learn.', tasks: ['Work on the next action and record what was completed.', 'Review obstacles and revise the next action to fit reality.', 'Check progress against the outcome and update priorities.'] },
    { name: 'Validate and continue', objective: 'Assess whether the intended outcome was reached.', tasks: ['Compare the result with your original success criteria.', 'Resolve any remaining gaps with a specific next action.', 'Capture lessons learned and set a follow-up review.'] },
  ],
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseDuration(text) {
  const match = text.match(/\b(?:in|within|over|for|by)?\s*(\d+(?:\.\d+)?)\s*(days?|weeks?|months?|years?)\b/i)
  if (!match) return null
  const unit = match[2].toLocaleLowerCase().replace(/s$/, '')
  return { amount: match[1], unit: `${unit}s` }
}

function dateKey(date) {
  return date.toISOString().slice(0, 10)
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDuration(start, amount, unit) {
  const millisecondsPerDay = 86400000
  if (unit === 'days' || unit === 'weeks') {
    const factor = unit === 'weeks' ? 7 : 1
    return new Date(start.getTime() + amount * factor * millisecondsPerDay)
  }
  const wholeUnits = Math.trunc(amount)
  const fraction = amount - wholeUnits
  const date = new Date(start)
  const originalDay = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + wholeUnits * (unit === 'years' ? 12 : 1))
  const lastDayOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(originalDay, lastDayOfMonth))
  const fractionalDays = fraction * (unit === 'years' ? 365.25 : 30.4375)
  return new Date(date.getTime() + fractionalDays * millisecondsPerDay)
}

function formatPlanDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, options)
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function detectTemplate(form) {
  const text = `${form.category} ${form.goal}`.toLocaleLowerCase()
  if (/business|entrepreneur|coffee|startup|launch|market/.test(text)) return 'business'
  if (/fitness|gym|muscle|weight|nutrition|run|workout/.test(text)) return 'fitness'
  if (/budget|finance|saving|debt|money|financial/.test(text)) return 'finance'
  if (/career|internship|job|employment|interview|promotion|resume|cv/.test(text)) return 'career'
  if (/coding|program|software|developer|full.stack|project development|javascript|python|html|css|website|web app/.test(text)) return 'coding'
  if (/creative|art|music|writing|design|photography/.test(text)) return 'creative'
  if (/language|communication|speak|conversation/.test(text)) return 'language'
  if (/habit|routine|productivity|time management/.test(text)) return 'habit'
  if (/study|education|exam|certification|learn|reading/.test(text)) return 'study'
  return 'general'
}

function generatePlan(form, otherPlans = [], personalTasks = []) {
  const templateKey = detectTemplate(form)
  const template = [...roadmapTemplates[templateKey], extendedPhases[templateKey]]
  const start = new Date(`${form.planStartDate || localDateKey()}T00:00:00Z`)
  const durationUnit = form.durationUnit || 'days'
  const requestedEnd = addDuration(start, Number(form.durationAmount), durationUnit)
  const requestedDays = Math.max(1, Math.ceil((requestedEnd.getTime() - start.getTime()) / 86400000))
  const targetDate = form.targetDate || dateKey(new Date(start.getTime() + (requestedDays - 1) * 86400000))
  const durationDays = Math.max(1, Math.ceil((new Date(`${targetDate}T00:00:00Z`).getTime() - start.getTime()) / 86400000) + 1)
  const weeks = Math.ceil(durationDays / 7)
  const preferredDays = form.preferredDays?.map(Number) || []
  const availableMinutesPerTaskDay = Number(form.hoursPerDay) * 60
  const slotStart = form.availableStartTime
  const slotEnd = form.availableEndTime
  const startMinute = timeToMinutes(slotStart)
  const endMinute = timeToMinutes(slotEnd)
  const slotMinutes = Math.max(0, endMinute - startMinute)
  const taskMinutes = Math.max(1, Math.min(60, availableMinutesPerTaskDay, slotMinutes))
  const occupiedSlots = new Map()
  otherPlans.filter((plan) => plan.status !== 'paused' && plan.status !== 'completed').forEach((plan) => plan.phases.forEach((phase) => phase.tasks.forEach((task) => {
    if (!task.scheduledDate || !task.startTime || !task.endTime) return
    const slots = occupiedSlots.get(task.scheduledDate) || []
    slots.push({ start: timeToMinutes(task.startTime), end: timeToMinutes(task.endTime) })
    occupiedSlots.set(task.scheduledDate, slots)
  })))
  personalTasks.forEach((task) => {
    if (task.status === 'Completed' || !task.date || !task.startTime) return
    const slots = occupiedSlots.get(task.date) || []
    const start = timeToMinutes(task.startTime)
    slots.push({ start, end: task.endTime ? timeToMinutes(task.endTime) : start + Number(task.minutes || 0) })
    occupiedSlots.set(task.date, slots)
  })
  const actions = template.flatMap((phase) => phase.tasks.map((title) => ({ title, objective: phase.objective })))
  const phases = Array.from({ length: weeks }, (_, weekIndex) => {
    const weekStart = new Date(start.getTime() + weekIndex * 7 * 86400000)
    const weekEnd = new Date(Math.min(start.getTime() + (weekIndex + 1) * 7 * 86400000 - 86400000, new Date(`${targetDate}T00:00:00Z`).getTime()))
    const stage = template[Math.min(template.length - 1, Math.floor(weekIndex * template.length / weeks))]
    const monthIndex = Math.floor(weekIndex * 7 / durationDaysPerUnit.months)
    const daysThisWeek = Math.min(7, durationDays - weekIndex * 7)
    const availableDateEntries = Array.from({ length: daysThisWeek }, (_, dayIndex) => (
      new Date(weekStart.getTime() + dayIndex * 86400000)
    )).filter((date) => preferredDays.includes(date.getUTCDay()))
    const tasks = availableDateEntries.map((date, taskIndex) => {
      const taskIndexOverall = weekIndex * preferredDays.length + taskIndex
      const actionIndex = Math.min(actions.length - 1, Math.floor(taskIndexOverall * actions.length / Math.max(1, weeks * preferredDays.length)))
      const action = actions[actionIndex]
      const taskKey = `week-${weekIndex + 1}-weekday-${date.getUTCDay()}`
      const taskDate = dateKey(date)
      const daySlots = occupiedSlots.get(taskDate) || []
      let taskStart = startMinute
      while (taskStart + taskMinutes <= endMinute && daySlots.some((slot) => taskStart < slot.end && taskStart + taskMinutes > slot.start)) {
        const overlappingSlots = daySlots.filter((slot) => taskStart < slot.end && taskStart + taskMinutes > slot.start)
        taskStart = Math.min(...overlappingSlots.map((slot) => slot.end))
      }
      const hasAvailableSlot = taskStart + taskMinutes <= endMinute
      const taskEnd = hasAvailableSlot ? taskStart + taskMinutes : null
      if (hasAvailableSlot) {
        daySlots.push({ start: taskStart, end: taskEnd })
        occupiedSlots.set(taskDate, daySlots)
      }
      return {
        id: createId(),
        scheduleKey: taskKey,
        title: action.title,
        detail: `${action.objective} Apply this to "${form.goal.trim()}" from your starting point: ${form.current.trim()}. Desired result: ${form.outcome.trim()}. ${form.resources ? `Use the resources you have available: ${form.resources.trim()}.` : ''} ${form.limitations ? `Keep in mind: ${form.limitations.trim()}.` : ''} ${form.style ? `Preferred approach: ${form.style.trim()}.` : ''}`,
        priority: taskIndex === 0 ? 'High' : 'Normal',
        minutes: taskMinutes,
        startTime: hasAvailableSlot ? minutesToTime(taskStart) : '',
        endTime: hasAvailableSlot ? minutesToTime(taskEnd) : '',
        scheduledDate: taskDate,
        completed: false,
        status: 'Not Started',
        notes: '',
        scheduleConflict: !hasAvailableSlot,
      }
    })
    return {
      id: createId(),
      name: `Week ${weekIndex + 1} · ${stage.name}`,
      objective: stage.objective,
      weekNumber: weekIndex + 1,
      monthNumber: monthIndex + 1,
      monthKey: `month-${monthIndex + 1}`,
      monthLabel: `Month ${monthIndex + 1} · ${weekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
      startDate: dateKey(weekStart),
      endDate: dateKey(weekEnd),
      weeks: 1,
      tasks,
      completionCriteria: stage.objective,
    }
  })
  const tasks = phases.flatMap((phase) => phase.tasks)
  const estimatedHours = tasks.reduce((total, task) => total + task.minutes, 0) / 60
  const daysNeeded = Math.max(1, Math.ceil(estimatedHours * 60 / Math.max(availableMinutesPerTaskDay, 1) / preferredDays.length * 7))
  const milestones = [...new Set(phases.map((phase) => phase.monthKey))].map((monthKey, index) => {
    const monthPhases = phases.filter((phase) => phase.monthKey === monthKey)
    const lastPhase = monthPhases.at(-1)
    return {
      id: createId(),
      monthKey,
      title: `Month ${index + 1} milestone`,
      outcome: lastPhase.objective,
      date: lastPhase.endDate,
    }
  })
  return {
    id: createId(),
    title: form.goal.trim(),
    description: form.outcome.trim(),
    outcome: form.outcome.trim(),
    current: form.current.trim(),
    category: form.category || inferredCategories[templateKey],
    startDate: dateKey(start),
    targetDate,
    durationAmount: form.targetDate ? durationDays : Number(form.durationAmount),
    durationUnit: form.targetDate ? 'days' : durationUnit,
    durationDays,
    hoursPerDay: Number(form.hoursPerDay),
    preferredDays,
    availableStartTime: slotStart,
    availableEndTime: slotEnd,
    skills: form.skills.trim(),
    resources: form.resources.trim(),
    limitations: form.limitations.trim(),
    style: form.style.trim(),
    budget: form.budget.trim(),
    instructions: form.instructions.trim(),
    resourceGuidance: planGuidance[templateKey].resources,
    challengeGuidance: planGuidance[templateKey].challenges,
    status: 'active',
    createdAt: new Date().toISOString(),
    phases,
    milestones,
    estimatedHours,
    daysNeeded,
  }
}

function getPlanFormValues(plan) {
  return {
    goal: plan.title || '',
    current: plan.current || '',
    outcome: plan.outcome || plan.description || '',
    planStartDate: plan.startDate || localDateKey(),
    hoursPerDay: plan.hoursPerDay ? String(plan.hoursPerDay) : '',
    preferredDays: plan.preferredDays || [],
    availableStartTime: plan.availableStartTime || '',
    availableEndTime: plan.availableEndTime || '',
    durationAmount: plan.durationAmount ? String(plan.durationAmount) : '',
    durationUnit: plan.durationUnit || 'days',
    category: plan.category || '',
    targetDate: '',
    skills: plan.skills || '',
    resources: plan.resources || '',
    limitations: plan.limitations || '',
    style: plan.style || '',
    budget: plan.budget || '',
    instructions: plan.instructions || '',
  }
}

function preserveCompletedTasks(previous, regenerated) {
  const previousTasks = new Map(previous.phases.flatMap((phase) => phase.tasks).map((task) => [task.scheduleKey || task.title, task]))
  regenerated.phases = regenerated.phases.map((phase) => ({
    ...phase,
    tasks: phase.tasks.map((task) => {
      const oldTask = previousTasks.get(task.scheduleKey || task.title)
      return oldTask?.completed || oldTask?.status === 'Completed' ? {
        ...task,
        ...oldTask,
        scheduleKey: task.scheduleKey,
        completed: true,
        status: 'Completed',
      } : oldTask ? {
        ...task,
        completed: false,
        status: oldTask.status || task.status,
        notes: oldTask.notes || '',
      } : task
    }),
  }))
  regenerated.id = previous.id
  regenerated.createdAt = previous.createdAt
  regenerated.status = previous.status
  return regenerated
}

function getCompletedTaskBlocks(plan) {
  return plan.phases.flatMap((phase) => phase.tasks)
    .filter((task) => (task.completed || task.status === 'Completed') && task.scheduledDate && task.startTime && task.endTime)
    .map((task) => ({ date: task.scheduledDate, startTime: task.startTime, endTime: task.endTime, status: 'Completed' }))
}

function loadLegacyPlans() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (!value) return []
    const plans = JSON.parse(value)
    if (!Array.isArray(plans)) throw new Error('Legacy saved goals are not a list.')
    return plans.filter((plan) => plan && typeof plan.id === 'string' && Array.isArray(plan.phases))
  } catch (error) {
    console.error('Unable to read legacy browser goals for optional import.', error)
    return []
  }
}

function loadPersonalTaskBlocks() {
  try {
    const stored = window.localStorage.getItem(DAILY_STORAGE_KEY)
    if (!stored) return { tasks: [], error: '' }
    const tasks = JSON.parse(stored)
    if (!Array.isArray(tasks)) throw new Error('Saved daily tasks have an unexpected format.')
    return {
      tasks: tasks.filter((task) => task && (task.source === 'personal' || String(task.id).startsWith('personal-'))),
      error: '',
    }
  } catch (error) {
    console.error('Unable to check personal tasks while creating a goal schedule.', error)
    return { tasks: [], error: 'Personal schedule data could not be checked for time conflicts; review the new plan before relying on its times.' }
  }
}

export default function GoalInstructor() {
  const [plans, setPlans] = useState([])
  const [legacyPlans, setLegacyPlans] = useState([])
  const [storageError, setStorageError] = useState('')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('active')
  const [notice, setNotice] = useState('')
  const retryLoad = () => {
    setStorageError('')
    setLoading(true)
    setReloadCount((value) => value + 1)
  }
  useEffect(() => {
    let active = true
    apiRequest('/goals')
      .then(({ goals }) => {
        if (active) {
          setPlans(goals)
          setLegacyPlans(loadLegacyPlans())
          setStorageError('')
        }
      })
      .catch((error) => {
        if (active) setStorageError(error.message || 'Your goals could not be loaded. Please try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [reloadCount])
  const selectedPlan = plans.find((plan) => plan.id === selectedId)
  const filteredPlans = useMemo(() => plans.filter((plan) => (
    (statusFilter === 'all' || plan.status === statusFilter)
    && (categoryFilter === 'All' || plan.category === categoryFilter)
    && (!query.trim() || `${plan.title} ${plan.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  )), [plans, statusFilter, categoryFilter, query])
  const persistPlan = async (plan) => {
    setStorageError('')
    const isNew = !isPersistedGoalId(plan.id)
    try {
      const { goal } = await apiRequest(isNew ? '/goals' : `/goals/${encodeURIComponent(plan.id)}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify(toGoalRequest(plan)),
      })
      setPlans((current) => isNew
        ? [...current, goal]
        : current.map((item) => item.id === goal.id ? goal : item))
      return goal
    } catch (error) {
      setStorageError(error.message || 'The goal could not be saved. Please try again.')
      return null
    }
  }
  const pendingLegacyPlans = legacyPlans.filter((legacy) => !plans.some((plan) => plan.legacyId === legacy.id))
  const importLegacyPlans = async () => {
    if (!pendingLegacyPlans.length || importing) return
    const accepted = window.confirm(
      `Import ${pendingLegacyPlans.length} saved goal${pendingLegacyPlans.length === 1 ? '' : 's'} from this browser into your signed-in account? Only continue if these goals belong to you.`,
    )
    if (!accepted) return
    setImporting(true)
    setStorageError('')
    let importedCount = 0
    try {
      for (const legacy of pendingLegacyPlans) {
        const request = { ...toGoalRequest(legacy), legacyId: legacy.id }
        const { goal } = await apiRequest('/goals', {
          method: 'POST',
          body: JSON.stringify(request),
        })
        setPlans((current) => current.some((item) => item.id === goal.id) ? current : [...current, goal])
        importedCount += 1
      }
      setNotice(`${importedCount} saved goal${importedCount === 1 ? '' : 's'} imported into your account. The browser copy was retained as a backup.`)
    } catch (error) {
      setStorageError(error.message || 'Some browser goals could not be imported. Imported goals remain saved; retry to continue.')
    } finally {
      setImporting(false)
    }
  }
  const createPlan = async (form) => {
    const personal = loadPersonalTaskBlocks()
    const next = generatePlan(form, plans, personal.tasks)
    const saved = await persistPlan(next)
    if (!saved) return
    setSelectedId(saved.id)
    setFormOpen(false)
    setEditingPlanId(null)
    setNotice(personal.error || 'A category-guided starter roadmap has been created. It is not AI-generated.')
  }
  const updatePlan = (updated) => persistPlan(updated)
  const updateTask = (plan, phaseId, taskId, transform) => {
    const updated = { ...plan, phases: plan.phases.map((phase) => phase.id === phaseId ? { ...phase, tasks: phase.tasks.map((task) => task.id === taskId ? transform(task) : task) } : phase) }
    updatePlan(updated)
  }
  const toggleTask = (plan, phaseId, taskId) => updateTask(plan, phaseId, taskId, (task) => {
    const completed = !task.completed
    const completionHistory = Array.isArray(task.completionHistory)
      ? task.completionHistory
      : (task.completedAt ? [{ completedAt: task.completedAt }] : [])
    const nextHistory = completed ? [...completionHistory, { completedAt: new Date().toISOString() }] : completionHistory
    return {
      ...task,
      completed,
      status: completed ? 'Completed' : 'Not Started',
      completedAt: nextHistory.at(-1)?.completedAt || '',
      completionHistory: nextHistory,
      completionCount: nextHistory.length,
    }
  })
  const removePlan = async (plan) => {
    if (!window.confirm(`Permanently delete "${plan.title}" and its roadmap data from your LifePilot account?`)) return
    setStorageError('')
    try {
      await apiRequest(`/goals/${encodeURIComponent(plan.id)}`, { method: 'DELETE' })
      setPlans((current) => current.filter((item) => item.id !== plan.id))
    } catch (error) {
      setStorageError(error.message || 'The goal could not be deleted. Please try again.')
      return
    }
    setSelectedId(null)
  }
  const revisePlan = async (plan) => {
    if (!plan.hoursPerDay || !plan.preferredDays?.length || !plan.availableStartTime || !plan.availableEndTime) {
      setNotice('Add your available hours, preferred days, and time window in Edit goal details before rebuilding this legacy schedule.')
      return
    }
    if (!window.confirm('Rebuild the complete starter schedule using this goal’s duration and time availability? Completed tasks in matching weeks will be kept.')) return
    const personal = loadPersonalTaskBlocks()
    const generated = preserveCompletedTasks(plan, generatePlan(getPlanFormValues(plan), plans.filter((item) => item.id !== plan.id), [...personal.tasks, ...getCompletedTaskBlocks(plan)]))
    const saved = await updatePlan(generated)
    if (!saved) return
    setNotice(personal.error || 'The full schedule was rebuilt for the saved duration. Completed tasks in matching weeks were kept; no AI service was used.')
  }
  const openNew = () => { setEditingPlanId(null); setFormOpen(true) }
  const openEdit = (plan) => { setEditingPlanId(plan.id); setFormOpen(true) }
  const saveEditedPlan = async (form) => {
    const plan = plans.find((item) => item.id === editingPlanId)
    if (!plan) return
    const personal = loadPersonalTaskBlocks()
    const saved = await updatePlan(preserveCompletedTasks(plan, generatePlan(form, plans.filter((item) => item.id !== plan.id), [...personal.tasks, ...getCompletedTaskBlocks(plan)])))
    if (!saved) return
    setFormOpen(false)
    setEditingPlanId(null)
    setNotice(personal.error || 'Goal details were updated and the schedule was rebuilt. Completed tasks and their original dates were kept; review future times and any overdue work.')
  }

  if (formOpen) {
    const editingPlan = plans.find((plan) => plan.id === editingPlanId)
    return <GoalPlanForm initial={editingPlan} requestError={storageError} onCancel={() => { setFormOpen(false); setEditingPlanId(null) }} onSubmit={editingPlan ? saveEditedPlan : createPlan} />
  }
  if (selectedPlan) {
    return <GoalPlanDetail
      plan={selectedPlan}
      notice={notice}
      onClearNotice={() => setNotice('')}
      onBack={() => setSelectedId(null)}
      onEdit={() => openEdit(selectedPlan)}
      onUpdate={updatePlan}
      onToggleTask={toggleTask}
      allPlans={plans}
      onRemove={() => removePlan(selectedPlan)}
      onRegenerate={() => revisePlan(selectedPlan)}
      storageError={storageError}
    />
  }

  const stateFilters = [['active', 'Active'], ['paused', 'Paused'], ['completed', 'Completed'], ['all', 'All plans']]
  const categoryCounts = categories.filter((category) => plans.some((plan) => plan.category === category))
  return (
    <section className="goal-instructor">
      <header className="goal-page-heading">
        <div><span className="page-eyebrow">YOUR DIRECTION</span><h1>Goal Instructor</h1><p>Turn any goal into an actionable plan, then track your progress one step at a time.</p></div>
        <button className="primary-action" type="button" onClick={openNew}>＋ Create New Plan</button>
      </header>
      <div className="goal-ai-note"><span>✦</span><p><strong>Transparent planning:</strong> no AI service is configured in this project. New plans use category-guided starter roadmaps saved to your account—not AI-generated advice.</p></div>
      {storageError && <p className="goal-storage-error" role="alert">{storageError}</p>}
      {notice && <p className="goal-success" role="status">{notice}</p>}
      {loading && <p className="goal-loading" role="status">Loading your saved goals…</p>}
      {storageError && !loading && <button className="secondary-action" type="button" onClick={retryLoad}>Retry loading goals</button>}
      {!loading && pendingLegacyPlans.length > 0 && <div className="goal-import-note"><p><strong>{pendingLegacyPlans.length} browser-saved goal{pendingLegacyPlans.length === 1 ? '' : 's'} found.</strong> They are not account-scoped, so import them only if they belong to you.</p><button className="secondary-action" type="button" disabled={importing} onClick={importLegacyPlans}>{importing ? 'Importing goals…' : 'Import goals from this browser'}</button></div>}

      <div className="goal-controls">
        <label className="goal-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your plans..." aria-label="Search plans" /></label>
        <label className="goal-category-select"><span className="sr-only">Filter by category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All</option>{categoryCounts.map((category) => <option key={category}>{category}</option>)}</select></label>
      </div>
      <nav className="goal-status-tabs" aria-label="Filter plans by status">{stateFilters.map(([value, label]) => <button key={value} type="button" className={statusFilter === value ? 'active' : ''} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label} <span>{value === 'all' ? plans.length : plans.filter((plan) => plan.status === value).length}</span></button>)}</nav>
      {loading ? null : filteredPlans.length ? (
        <section className="goal-plan-grid" aria-label="My plans">
          {filteredPlans.map((plan) => <GoalPlanCard key={plan.id} plan={plan} onOpen={() => { setSelectedId(plan.id); setNotice('') }} />)}
        </section>
      ) : storageError ? (
        <div className="goal-empty"><span>!</span><h2>Your saved goals are unavailable</h2><p>Check your connection and sign-in session, then retry. Your saved server data has not been changed.</p><button className="secondary-action" type="button" onClick={retryLoad}>Retry</button></div>
      ) : (
        <div className="goal-empty"><span>◎</span><h2>{plans.length ? 'No plans match these filters' : 'Start with a goal that matters to you'}</h2><p>{plans.length ? 'Try another status, category, or search term.' : 'Describe any personal or professional goal in your own words. You do not need to choose a category.'}</p>{plans.length ? <button className="secondary-action" type="button" onClick={() => { setQuery(''); setCategoryFilter('All'); setStatusFilter('all') }}>Clear filters</button> : <button className="primary-action" type="button" onClick={openNew}>＋ Create New Plan</button>}</div>
      )}
    </section>
  )
}

function calculateProgress(plan) {
  const tasks = plan.phases.flatMap((phase) => phase.tasks)
  return tasks.length ? Math.round(tasks.filter((task) => task.completed).length / tasks.length * 100) : 0
}

function getTimelineConcerns(plan) {
  const guidance = effortGuidance[detectTemplate(plan)]
  const availableMinutesPerWeek = Number(plan.hoursPerDay || 0) * 60 * (plan.preferredDays?.length || 0)
  const concerns = []
  if (plan.durationDays / 7 < guidance.weeks) {
    concerns.push(`This is a short timeframe for a ${detectTemplate(plan)} goal. Keep the requested duration, but consider narrowing the outcome or choosing a smaller first milestone.`)
  }
  if (availableMinutesPerWeek < guidance.minutes) {
    concerns.push(`Your available time is below a rough planning baseline for this type of goal. Consider increasing weekly time or reducing the amount of work in scope; the target duration remains unchanged.`)
  }
  return concerns
}

function GoalPlanCard({ plan, onOpen }) {
  const tasks = plan.phases.flatMap((phase) => phase.tasks)
  const completed = tasks.filter((task) => task.completed).length
  const progress = calculateProgress(plan)
  const currentPhase = plan.phases.find((phase) => phase.tasks.some((task) => !task.completed)) || plan.phases.at(-1)
  return (
    <article className={`goal-plan-card ${plan.status}`}>
      <div className="goal-plan-card-top"><span className="goal-plan-category">{plan.category}</span><span className={`goal-plan-status ${plan.status}`}>{plan.status}</span></div>
      <h2>{plan.title}</h2><p>{plan.description}</p>
      <div className="goal-plan-progress-label"><span>Completed tasks</span><strong>{progress}%</strong></div>
      <div className="goal-plan-progress"><i style={{ width: `${progress}%` }} /></div>
      <div className="goal-plan-card-meta"><span>{completed}/{tasks.length} tasks</span><span>{plan.durationAmount ? `${plan.durationAmount} ${plan.durationUnit}` : currentPhase?.name || 'No duration set'}</span></div>
      <button className="continue-button" type="button" onClick={onOpen}>Open plan <span>→</span></button>
    </article>
  )
}

function GoalPlanDetail({ plan, notice, onClearNotice, onBack, onEdit, onUpdate, onToggleTask, allPlans, onRemove, onRegenerate, storageError }) {
  const [renderTime] = useState(() => Date.now())
  const [taskEditor, setTaskEditor] = useState(null)
  const [taskDraft, setTaskDraft] = useState({ title: '', detail: '', minutes: 1, priority: 'Normal', scheduledDate: '', startTime: '', endTime: '', notes: '' })
  const [taskError, setTaskError] = useState('')
  const allTasks = plan.phases.flatMap((phase) => phase.tasks)
  const progress = calculateProgress(plan)
  const currentPhase = plan.phases.find((phase) => phase.tasks.some((task) => !task.completed))
  const completedCount = allTasks.filter((task) => task.completed).length
  const remainingMinutes = allTasks.filter((task) => !task.completed).reduce((sum, task) => sum + Number(task.minutes || 0), 0)
  const deadlineDays = plan.targetDate
    ? Math.max(0, Math.floor((new Date(`${plan.targetDate}T00:00:00Z`).getTime() - new Date(`${localDateKey(new Date(renderTime))}T00:00:00Z`).getTime()) / 86400000) + 1)
    : null
  const weekdaysRemaining = deadlineDays === null ? 0 : (
    Math.floor(deadlineDays / 7) * (plan.preferredDays?.length || 0)
    + Array.from({ length: deadlineDays % 7 }, (_, index) => (
      (new Date(`${localDateKey(new Date(renderTime))}T00:00:00Z`).getUTCDay() + index) % 7
    )).filter((day) => plan.preferredDays?.includes(day)).length
  )
  const availableMinutesBeforeDeadline = weekdaysRemaining * Number(plan.hoursPerDay || 0) * 60
  const deadlineWarning = deadlineDays !== null && remainingMinutes > 0 && (
    plan.targetDate < localDateKey(new Date(renderTime)) || remainingMinutes > availableMinutesBeforeDeadline
  )
  const timelineConcerns = plan.durationDays ? getTimelineConcerns(plan) : []
  const phasesByMonth = plan.phases.reduce((groups, phase) => {
    const key = phase.monthKey || 'unscheduled'
    if (!groups[key]) groups[key] = { label: phase.monthLabel || 'Roadmap', phases: [] }
    groups[key].phases.push(phase)
    return groups
  }, {})
  const monthlyMilestones = Object.entries(phasesByMonth).map(([monthKey, month]) => {
    const monthTasks = month.phases.flatMap((phase) => phase.tasks)
    const date = month.phases.at(-1).endDate
    const completed = monthTasks.length > 0 && monthTasks.every((task) => task.completed)
    const overdue = !completed && date && new Date(`${date}T23:59:59`) < new Date(renderTime)
    return {
      monthKey,
      label: month.label,
      completed,
      overdue,
      date,
      outcome: month.phases.at(-1).completionCriteria,
    }
  })
  const savePlan = async (next) => {
    return Boolean(await onUpdate(next))
  }
  const openTaskEditor = (phase, task = null) => {
    setTaskDraft(task ? { ...task, startTime: task.startTime || plan.availableStartTime || '' } : { title: '', detail: '', minutes: 30, priority: 'Normal', scheduledDate: phase.startDate || '', startTime: plan.availableStartTime || '', endTime: '', notes: '' })
    setTaskError('')
    setTaskEditor({ phaseId: phase.id, taskId: task?.id || null })
  }
  const saveTask = async (event) => {
    event.preventDefault()
    if (!taskDraft.title.trim()) return
    const minutes = Number(taskDraft.minutes)
    const taskStart = taskDraft.startTime ? timeToMinutes(taskDraft.startTime) : null
    if (!Number.isFinite(minutes) || minutes <= 0) return setTaskError('Enter an estimated duration greater than zero.')
    if (taskStart === null) return setTaskError('Choose a start time for this roadmap task.')
    if (taskStart + minutes >= 1440) return setTaskError('The task must end before midnight.')
    const taskDate = taskDraft.scheduledDate || plan.phases.find((phase) => phase.id === taskEditor.phaseId)?.startDate || ''
    const existingTasks = allPlans.flatMap((item) => item.phases.flatMap((phase) => phase.tasks))
    const hasOverlap = existingTasks.some((item) => {
      if (item.id === taskEditor.taskId || item.scheduledDate !== taskDate || !item.startTime) return false
      const otherStart = timeToMinutes(item.startTime)
      const otherEnd = item.endTime ? timeToMinutes(item.endTime) : otherStart + Number(item.minutes || 0)
      return taskStart < otherEnd && taskStart + minutes > otherStart
    })
    if (hasOverlap) return setTaskError('That time overlaps another roadmap task. Choose a different time.')
    const availableStart = plan.availableStartTime ? timeToMinutes(plan.availableStartTime) : null
    const availableEnd = plan.availableEndTime ? timeToMinutes(plan.availableEndTime) : null
    if ((availableStart !== null && taskStart < availableStart) || (availableEnd !== null && taskStart + minutes > availableEnd)) {
      return setTaskError(`Keep the task within this goal’s availability window (${plan.availableStartTime}–${plan.availableEndTime}).`)
    }
    const phases = plan.phases.map((phase) => {
      if (phase.id !== taskEditor.phaseId) return phase
      const oldTask = taskEditor.taskId ? phase.tasks.find((item) => item.id === taskEditor.taskId) : null
      const task = {
        ...taskDraft,
        id: taskEditor.taskId || createId(),
        title: taskDraft.title.trim(),
        detail: taskDraft.detail.trim(),
        minutes,
        scheduledDate: taskDate,
        endTime: minutesToTime(taskStart + minutes),
        completed: oldTask?.completed || false,
        status: oldTask?.status || 'Not Started',
        scheduleConflict: false,
      }
      return { ...phase, tasks: taskEditor.taskId ? phase.tasks.map((item) => item.id === task.id ? task : item) : [...phase.tasks, task] }
    })
    if (await savePlan({ ...plan, phases })) setTaskEditor(null)
  }
  const deleteTask = async (phase, task) => {
    if (!window.confirm(`Delete the task "${task.title}"?`)) return
    await savePlan({ ...plan, phases: plan.phases.map((item) => item.id === phase.id ? { ...item, tasks: item.tasks.filter((entry) => entry.id !== task.id) } : item) })
  }
  const markStatus = async (status) => savePlan({ ...plan, status, ...(status === 'completed' ? { completedAt: new Date().toISOString() } : { completedAt: '' }) })
  return (
    <section className="goal-instructor">
      <button className="goal-back" type="button" onClick={onBack}>← My Plans</button>
      <header className="goal-detail-heading">
        <div><span className="page-eyebrow">{plan.category.toUpperCase()} · {plan.status.toUpperCase()}</span><h1>{plan.title}</h1><p>{plan.description}</p></div>
        <div className="goal-detail-actions"><button className="secondary-action" type="button" onClick={onEdit}>Edit goal</button><button className="secondary-action" type="button" onClick={onRegenerate}>Rebuild starter roadmap</button></div>
      </header>
      {notice && <p className="goal-success" role="status" onClick={onClearNotice}>{notice}</p>}
      {storageError && <p className="goal-storage-error" role="alert">{storageError}</p>}
      {deadlineWarning && <p className="goal-warning" role="status">The remaining estimated work ({(remainingMinutes / 60).toFixed(1)} hours) exceeds your available time before the requested target date. The schedule keeps your chosen deadline; consider adjusting availability, reducing scope, or choosing a later date.</p>}
      {timelineConcerns.map((concern) => <p className="goal-warning" role="status" key={concern}>{concern}</p>)}
      <section className="goal-overview-grid">
        <article className="goal-overview-card"><span>ACTUAL TASK PROGRESS</span><strong>{progress}%</strong><div className="goal-plan-progress"><i style={{ width: `${progress}%` }} /></div><small>{completedCount} of {allTasks.length} tasks completed</small></article>
        <article className="goal-overview-card"><span>CURRENT PHASE</span><strong className="goal-current-phase">{currentPhase?.name || 'All phases complete'}</strong><small>{plan.phases.length} phases in this roadmap</small></article>
        <article className="goal-overview-card"><span>ESTIMATED WORK REMAINING</span><strong>{Math.floor(remainingMinutes / 60)}h {remainingMinutes % 60}m</strong><small>Based on task estimates, not measured time</small></article>
        <article className="goal-overview-card"><span>USER-CHOSEN DURATION</span><strong className="goal-current-phase">{plan.durationAmount ? `${plan.durationAmount} ${plan.durationUnit}` : 'Legacy plan'}</strong><small>{plan.startDate && plan.targetDate ? `${formatPlanDate(plan.startDate)} – ${formatPlanDate(plan.targetDate)}` : 'Set duration in Edit goal'}</small></article>
      </section>
      <section className="goal-assessment panel"><div><span className="panel-kicker">STARTING ASSESSMENT</span><p><strong>Current situation:</strong> {plan.current}</p><p><strong>Skills / experience:</strong> {plan.skills || 'Not provided; roadmap starts with a baseline check.'}</p><p><strong>Resources available:</strong> {plan.resources || 'Not provided; identify suitable resources as part of the first phase.'}</p><p><strong>Constraints:</strong> {plan.limitations || 'No specific constraints provided.'}</p><p><strong>Available time:</strong> {plan.hoursPerDay} hours/day, {plan.preferredDays?.map((day) => weekdays[day]).join(', ') || 'days not set'} ({plan.availableStartTime}–{plan.availableEndTime})</p>{plan.budget && <p><strong>Budget:</strong> {plan.budget}</p>}{plan.style && <p><strong>Preferred style:</strong> {plan.style}</p>}</div><div><span className="panel-kicker">SUCCESS OUTCOME</span><p>{plan.outcome}</p><span className="panel-kicker">PLANNING ASSUMPTION</span><p>This locally generated starter plan uses your provided goal details and category template. Validate task order, estimates, and high-impact decisions for your situation.</p></div></section>
      <section className="goal-recommendations"><article><span className="panel-kicker">RESOURCES TO CONSIDER</span><p>{plan.resourceGuidance || planGuidance[detectTemplate(plan)].resources}</p></article><article><span className="panel-kicker">LIKELY CHALLENGES & ADJUSTMENTS</span><p>{plan.challengeGuidance || planGuidance[detectTemplate(plan)].challenges}</p></article></section>
      <p className="goal-pacing-note">Estimated roadmap pacing is based on your stated time availability and task estimates. Daily Instructor uses the dated tasks below to build today’s schedule. Completed tasks update this roadmap automatically.</p>
      {plan.instructions && <p className="goal-additional-instructions"><strong>Additional instructions:</strong> {plan.instructions}</p>}
      <section className="goal-roadmap">
        <div className="goal-roadmap-heading"><div><span className="section-kicker">COMPLETE USER-DEFINED SCHEDULE</span><h2>{plan.phases.length} weekly plans · {plan.durationAmount || plan.durationDays} {plan.durationUnit || 'days'}</h2></div><div className="goal-detail-actions">{plan.status !== 'paused' && plan.status !== 'completed' && <button className="secondary-action" type="button" onClick={() => markStatus('paused')}>Pause plan</button>}{plan.status === 'paused' && <button className="secondary-action" type="button" onClick={() => markStatus('active')}>Resume plan</button>}{plan.status !== 'completed' && <button className="primary-action" type="button" onClick={() => markStatus('completed')}>Mark plan complete</button>}{plan.status === 'completed' && <button className="secondary-action" type="button" onClick={() => markStatus('active')}>Reopen plan</button>}</div></div>
        <section className="goal-milestones" aria-label="Plan milestones"><h3>Milestones</h3>{monthlyMilestones.map((milestone, index) => <article className={milestone.completed ? 'complete' : ''} key={milestone.monthKey}><span>{milestone.completed ? '✓' : String(index + 1).padStart(2, '0')}</span><div><strong>{milestone.label} · {milestone.completed ? 'Complete' : milestone.overdue ? 'Overdue' : 'Upcoming'}</strong><p>{milestone.outcome}</p><small>Target: {milestone.date ? formatPlanDate(milestone.date) : 'To be scheduled'}</small></div></article>)}</section>
        {Object.entries(phasesByMonth).map(([monthKey, month]) => <section className="goal-month" key={monthKey}><h3>{month.label}</h3>{month.phases.map((phase, phaseIndex) => {
          const phaseComplete = phase.tasks.length > 0 && phase.tasks.every((task) => task.completed)
          return <article className="goal-phase" key={phase.id}>
            <header><span className={`goal-phase-number ${phaseComplete ? 'complete' : ''}`}>{phaseComplete ? '✓' : String(phase.weekNumber || phaseIndex + 1).padStart(2, '0')}</span><div><h4>{phase.name}</h4><p>{phase.startDate && phase.endDate ? `${formatPlanDate(phase.startDate, { month: 'short', day: 'numeric' })} – ${formatPlanDate(phase.endDate, { month: 'short', day: 'numeric' })} · ` : ''}{phase.objective}</p></div></header>
            <div className="goal-phase-criteria"><strong>Completion criteria:</strong> {phase.completionCriteria}</div>
            <div className="goal-task-list">{phase.tasks.map((task) => (
              <article className={`goal-task ${task.completed ? 'completed' : ''}`} key={task.id}>
                <label className="goal-task-check"><input type="checkbox" checked={task.completed} onChange={() => onToggleTask(plan, phase.id, task.id)} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`} /><span></span></label>
                <div className="goal-task-copy"><strong>{task.title}</strong><p>{task.detail}</p><div><span>{task.minutes} min</span><span>Scheduled {task.scheduledDate ? formatPlanDate(task.scheduledDate) : 'date not set'}</span>{task.startTime && <span>{task.startTime}–{task.endTime}</span>}<span className={task.priority === 'High' ? 'priority-high' : ''}>{task.priority} priority</span>{task.scheduleConflict && <span className="goal-warning">Needs time slot</span>}</div></div>
                <div className="goal-task-actions"><button type="button" onClick={() => openTaskEditor(phase, task)}>Edit</button><button type="button" onClick={() => deleteTask(phase, task)}>Delete</button></div>
              </article>
            ))}</div>
            <button className="goal-add-task" type="button" onClick={() => openTaskEditor(phase)}>＋ Add task to this phase</button>
          </article>
        })}</section>)}
      </section>
      <div className="goal-bottom-actions"><button className="danger-action" type="button" onClick={onRemove}>Delete plan</button><span>Marking a plan complete changes its status; tasks remain unchanged until you update them.</span></div>
      {taskEditor && <div className="goal-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTaskEditor(null) }}><form className="goal-modal" onSubmit={saveTask}><button className="goal-modal-close" type="button" onClick={() => setTaskEditor(null)} aria-label="Close task form">×</button><span className="page-eyebrow">ROADMAP ACTION</span><h2>{taskEditor.taskId ? 'Edit task' : 'Add task'}</h2><label>Task title<input autoFocus maxLength="120" value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} required /></label><label>Details<textarea maxLength="260" value={taskDraft.detail} onChange={(event) => setTaskDraft({ ...taskDraft, detail: event.target.value })} /></label><div className="goal-task-form-row"><label>Estimated minutes<input type="number" min="1" value={taskDraft.minutes} onChange={(event) => setTaskDraft({ ...taskDraft, minutes: event.target.value })} /></label><label>Priority<select value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value })}><option>High</option><option>Normal</option><option>Low</option></select></label></div><label>Reschedule to<input type="date" value={taskDraft.scheduledDate || ''} onChange={(event) => setTaskDraft({ ...taskDraft, scheduledDate: event.target.value })} /></label><div className="goal-task-form-row"><label>Start time<input type="time" value={taskDraft.startTime || ''} onChange={(event) => setTaskDraft({ ...taskDraft, startTime: event.target.value })} /></label><label>Notes<input value={taskDraft.notes || ''} onChange={(event) => setTaskDraft({ ...taskDraft, notes: event.target.value })} /></label></div>{taskError && <p className="goal-form-error" role="alert">{taskError}</p>}<div className="goal-modal-actions"><button type="button" className="secondary-action" onClick={() => setTaskEditor(null)}>Cancel</button><button className="primary-action" type="submit">Save task</button></div></form></div>}
    </section>
  )
}

function GoalPlanForm({ initial, requestError, onCancel, onSubmit }) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [form, setForm] = useState(initial ? getPlanFormValues(initial) : { ...blankGoal })
  const [durationSource, setDurationSource] = useState(initial ? 'manual' : 'unset')
  const [errors, setErrors] = useState({})
  const [generating, setGenerating] = useState(false)
  const update = (key, value) => {
    const detected = key === 'goal' ? parseDuration(value) : null
    if (key === 'goal') {
      if (detected) setDurationSource('goal')
      else if (durationSource === 'goal') setDurationSource('unset')
    } else if (key === 'durationAmount' || key === 'durationUnit') {
      setDurationSource('manual')
    }
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'goal') {
        if (detected) {
          next.durationAmount = detected.amount
          next.durationUnit = detected.unit
        } else if (durationSource === 'goal') {
          next.durationAmount = ''
        }
      }
      return next
    })
    setErrors((current) => ({
      ...current,
      [key]: '',
      ...(key === 'availableStartTime' || key === 'availableEndTime' ? { availableEndTime: '' } : {}),
    }))
  }
  const submit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.goal.trim()) nextErrors.goal = 'Describe what you want to achieve.'
    if (!form.current.trim()) nextErrors.current = 'Describe your current level or situation.'
    if (!form.outcome.trim()) nextErrors.outcome = 'Describe the result you want.'
    if (!Number.isFinite(Number(form.hoursPerDay)) || Number(form.hoursPerDay) <= 0 || Number(form.hoursPerDay) > 24) nextErrors.hoursPerDay = 'Enter available hours per day, greater than zero and no more than 24.'
    if (!form.preferredDays.length) nextErrors.preferredDays = 'Choose at least one preferred day.'
    if (!form.availableStartTime || !form.availableEndTime || timeToMinutes(form.availableEndTime) <= timeToMinutes(form.availableStartTime)) nextErrors.availableEndTime = 'Choose an end time after the start time.'
    if (!form.targetDate && (!Number.isFinite(Number(form.durationAmount)) || Number(form.durationAmount) <= 0)) nextErrors.durationAmount = 'Enter how long you want to work on this goal, or choose a target date.'
    if (form.targetDate && Number.isNaN(Date.parse(form.targetDate))) nextErrors.targetDate = 'Choose a valid date.'
    else if (form.targetDate && form.targetDate < today) nextErrors.targetDate = 'Choose a date that is today or later.'
    if (form.preferredDays.length && (!form.targetDate || !Number.isNaN(Date.parse(form.targetDate)))) {
      const start = new Date(`${localDateKey()}T00:00:00Z`)
      const requestedDays = form.targetDate
        ? Math.ceil((new Date(`${form.targetDate}T00:00:00Z`).getTime() - start.getTime()) / 86400000) + 1
        : Math.ceil((addDuration(start, Number(form.durationAmount), form.durationUnit).getTime() - start.getTime()) / 86400000)
      const weekdaysToCheck = Array.from({ length: Math.min(7, requestedDays) }, (_, index) => (start.getUTCDay() + index) % 7)
      if (!weekdaysToCheck.some((day) => form.preferredDays.includes(day))) nextErrors.preferredDays = 'No selected workday falls within this plan duration. Choose another day or a longer duration.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setGenerating(true)
    window.setTimeout(async () => {
      try {
        await onSubmit(form)
      } finally {
        setGenerating(false)
      }
    }, 350)
  }
  return (
    <section className="goal-instructor goal-form-page">
      <button className="goal-back" type="button" onClick={onCancel}>← Cancel</button>
      <header className="goal-form-heading"><span className="page-eyebrow">{initial ? 'REFINE YOUR GOAL' : 'BUILD YOUR NEXT CHAPTER'}</span><h1>{initial ? 'Edit goal details' : 'Create a new plan'}</h1><p>Describe the goal in your own words. Your duration sets the schedule’s full length—there is no preset plan duration.</p></header>
      <div className="goal-ai-note"><span>✦</span><p>This project has no AI service configured. We’ll create a category-guided local roadmap for the exact duration you specify and clearly label it as a starter plan.</p></div>
      {requestError && <p className="goal-storage-error" role="alert">{requestError}</p>}
      <form className="goal-create-form" onSubmit={submit}>
        <div className="goal-form-section"><h2>Start with your goal</h2>
          <label>What do you want to achieve?<textarea autoFocus maxLength="500" rows="3" value={form.goal} onChange={(event) => update('goal', event.target.value)} placeholder="e.g. I want to get an internship in 45 days..." aria-invalid={Boolean(errors.goal)} />{errors.goal && <span role="alert">{errors.goal}</span>}</label>
          <div className="goal-form-two"><label>Current level or situation<textarea maxLength="500" rows="2" value={form.current} onChange={(event) => update('current', event.target.value)} placeholder="What is your starting point?" aria-invalid={Boolean(errors.current)} />{errors.current && <span role="alert">{errors.current}</span>}</label><label>What result do you want?<textarea maxLength="500" rows="2" value={form.outcome} onChange={(event) => update('outcome', event.target.value)} placeholder="Describe a result you can recognize..." aria-invalid={Boolean(errors.outcome)} />{errors.outcome && <span role="alert">{errors.outcome}</span>}</label></div>
          <div className="goal-form-three goal-duration-row"><label>Plan duration<input type="number" step="any" value={form.durationAmount} onChange={(event) => update('durationAmount', event.target.value)} placeholder="e.g. 45" aria-label="Plan duration amount" aria-invalid={Boolean(errors.durationAmount)} />{errors.durationAmount && <span role="alert">{errors.durationAmount}</span>}</label><label>Duration unit<select value={form.durationUnit} onChange={(event) => update('durationUnit', event.target.value)} aria-label="Duration unit"><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option><option value="years">Years</option></select></label><label>Target date <small>Optional; if set, it determines the schedule length</small><input type="date" min={today} value={form.targetDate} onChange={(event) => update('targetDate', event.target.value)} aria-invalid={Boolean(errors.targetDate)} />{errors.targetDate && <span role="alert">{errors.targetDate}</span>}</label></div>
          <div className="goal-form-section"><h3>When can you work on this goal?</h3>
            <label>Available hours per day<input type="number" min="0.01" max="24" step="any" value={form.hoursPerDay} onChange={(event) => update('hoursPerDay', event.target.value)} placeholder="e.g. 1.5" aria-invalid={Boolean(errors.hoursPerDay)} required />{errors.hoursPerDay && <span role="alert">{errors.hoursPerDay}</span>}</label>
            <fieldset className="goal-weekday-picker"><legend>Preferred days</legend>{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={form.preferredDays.includes(index)} onChange={(event) => update('preferredDays', event.target.checked ? [...form.preferredDays, index].sort() : form.preferredDays.filter((value) => value !== index))} />{day}</label>)}</fieldset>
            {errors.preferredDays && <span role="alert">{errors.preferredDays}</span>}
            <div className="goal-form-two"><label>Available from<input type="time" value={form.availableStartTime} onChange={(event) => update('availableStartTime', event.target.value)} aria-invalid={Boolean(errors.availableEndTime)} required /></label><label>Available until<input type="time" value={form.availableEndTime} onChange={(event) => update('availableEndTime', event.target.value)} aria-invalid={Boolean(errors.availableEndTime)} required />{errors.availableEndTime && <span role="alert">{errors.availableEndTime}</span>}</label></div>
          </div>
          <p className="goal-duration-help">If your goal description includes a duration such as “in 2 months,” we’ll fill it in for you. Otherwise, enter your preferred duration or target date—LifePilot won’t guess one.</p>
        </div>
        <details className="goal-optional-fields"><summary>Optional context to personalize your starter plan</summary><div className="goal-form-section">
          <label>Goal category <small>Optional</small><select value={form.category} onChange={(event) => update('category', event.target.value)}><option value="">No category — describe it instead</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <div className="goal-form-two"><label>Current skills or experience<textarea maxLength="400" value={form.skills} onChange={(event) => update('skills', event.target.value)} /></label><label>Available resources<textarea maxLength="400" value={form.resources} onChange={(event) => update('resources', event.target.value)} placeholder="Tools, materials, support..." /></label></div>
          <div className="goal-form-two"><label>Challenges or limitations<textarea maxLength="400" value={form.limitations} onChange={(event) => update('limitations', event.target.value)} /></label><label>Preferred working or learning style<input maxLength="180" value={form.style} onChange={(event) => update('style', event.target.value)} placeholder="Hands-on, short sessions, visual..." /></label></div>
          <div className="goal-form-two"><label>Budget, if relevant<input maxLength="180" value={form.budget} onChange={(event) => update('budget', event.target.value)} placeholder="Optional; use your own currency" /></label><label>Additional instructions<textarea maxLength="400" value={form.instructions} onChange={(event) => update('instructions', event.target.value)} placeholder="Any other context to consider?" /></label></div>
        </div></details>
        <p className="goal-caution">Plans are estimates, not guarantees. For medical, nutrition, financial, or other high-impact decisions, consult a qualified professional.</p>
        <div className="goal-form-actions"><button className="secondary-action" type="button" onClick={onCancel}>Cancel</button><button className="primary-action" type="submit" disabled={generating}>{generating ? 'Preparing local plan…' : initial ? 'Save goal details' : 'Create Starter Plan ↗'}</button></div>
      </form>
    </section>
  )
}
