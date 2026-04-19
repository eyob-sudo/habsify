import api from './api'

const normalizeTask = (task) => ({
  id: task.id,
  title: task.title,
  priority: task.priority,
  dueDate: task.due_date || '',
  completed: Boolean(task.completed),
  completedAt: task.completed_at || null,
  createdAt: task.created_at || '',
  createdBy: task.created_by
})

export async function listTasks(options = {}) {
  const { dueDate = '', priority = '', completed = '', search = '', ordering = '' } = options || {}
  const params = {}
  if (dueDate) params.due_date = dueDate
  if (priority) params.priority = priority
  if (completed !== '' && completed !== null && completed !== undefined) params.completed = completed
  if (search) params.search = search
  if (ordering) params.ordering = ordering
  const res = await api.get('/api/tasks/', { params })
  const list = Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
  return list.map(normalizeTask)
}

export async function createTask(payload) {
  const res = await api.post('/api/tasks/', {
    title: payload.title,
    priority: payload.priority,
    due_date: payload.dueDate || null,
    completed: Boolean(payload.completed)
  })
  return normalizeTask(res.data)
}

export async function updateTask(id, payload) {
  const submitData = {}
  if (payload.title !== undefined) submitData.title = payload.title;
  if (payload.priority !== undefined) submitData.priority = payload.priority;
  if (payload.dueDate !== undefined) submitData.due_date = payload.dueDate || null;
  if (payload.completed !== undefined) submitData.completed = payload.completed;

  const res = await api.patch(`/api/tasks/${id}/`, submitData)
  return normalizeTask(res.data)
}

export async function deleteTask(id) {
  await api.delete(`/api/tasks/${id}/`)
  return { ok: true }
}
