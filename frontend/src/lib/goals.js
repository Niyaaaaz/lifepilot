const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isPersistedGoalId(value) {
  return uuidPattern.test(value || '')
}

export function toGoalRequest(plan) {
  return {
    title: plan.title,
    description: plan.description || '',
    current: plan.current || '',
    outcome: plan.outcome || '',
    durationAmount: Number(plan.durationAmount),
    durationUnit: plan.durationUnit,
    durationDays: Number(plan.durationDays),
    startDate: plan.startDate,
    targetDate: plan.targetDate || null,
    status: plan.status || 'active',
    category: plan.category || '',
    hoursPerDay: Number(plan.hoursPerDay || 0),
    preferredDays: plan.preferredDays || [],
    availableStartTime: plan.availableStartTime || null,
    availableEndTime: plan.availableEndTime || null,
    skills: plan.skills || '',
    resources: plan.resources || '',
    limitations: plan.limitations || '',
    style: plan.style || '',
    budget: plan.budget || '',
    instructions: plan.instructions || '',
    resourceGuidance: plan.resourceGuidance || '',
    challengeGuidance: plan.challengeGuidance || '',
    estimatedHours: Number(plan.estimatedHours || 0),
    daysNeeded: Number(plan.daysNeeded || 0),
    phases: (plan.phases || []).map((phase) => ({
      ...(isPersistedGoalId(phase.id) ? { id: phase.id } : {}),
      weekNumber: Number(phase.weekNumber),
      monthNumber: Number(phase.monthNumber) || Math.ceil(Number(phase.weekNumber) / 4),
      monthKey: phase.monthKey || '',
      monthLabel: phase.monthLabel || '',
      name: phase.name,
      objective: phase.objective || '',
      completionCriteria: phase.completionCriteria || '',
      startDate: phase.startDate || null,
      endDate: phase.endDate || null,
      tasks: (phase.tasks || []).map((task) => ({
        ...(isPersistedGoalId(task.id) ? { id: task.id } : {}),
        scheduleKey: task.scheduleKey || task.sourceKey || `custom-${phase.weekNumber}-${task.id}`,
        title: task.title,
        detail: task.detail || '',
        priority: task.priority || 'Normal',
        minutes: Number(task.minutes),
        status: task.completed ? 'Completed' : (task.status || 'Not Started'),
        completed: Boolean(task.completed),
        completedAt: task.completedAt || null,
        notes: task.notes || '',
        scheduledDate: task.scheduledDate || null,
        startTime: task.startTime || null,
        endTime: task.endTime || null,
        isGoalRepetition: Boolean(task.isGoalRepetition),
        completionHistory: Array.isArray(task.completionHistory)
          ? task.completionHistory.map((completion) => ({
            completedAt: completion.completedAt || null,
            notes: completion.notes || '',
          }))
          : [],
      })),
    })),
    milestones: (plan.milestones || []).map((milestone) => ({
      ...(isPersistedGoalId(milestone.id) ? { id: milestone.id } : {}),
      monthKey: milestone.monthKey || '',
      title: milestone.title,
      outcome: milestone.outcome || '',
      date: milestone.date || null,
    })),
  }
}
