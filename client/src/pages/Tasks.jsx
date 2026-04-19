import React, { useEffect, useMemo, useRef, useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { success as toastSuccess, error as toastError } from '../services/toastService'
import { createTask, deleteTask, listTasks, updateTask } from '../services/tasksService'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../utils/cn'
import { Search, Calendar, Filter, ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle2, Circle, MoreVertical, Edit2, Trash2 } from 'lucide-react'

// PHASE 23: Zod validation mapped to automated form handling
const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  priority: z.enum(['Low', 'Medium', 'High']),
  dueDate: z.string().optional()
})

const priorityOptions = [
  { value: 'High', label: 'High Priority', color: 'bg-red-100 text-red-800' },
  { value: 'Medium', label: 'Medium Priority', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'Low', label: 'Low Priority', color: 'bg-blue-100 text-blue-800' }
]

const orderingOptions = [
  { k: 'due_date', l: 'Due date (earliest first)' },
  { k: '-due_date', l: 'Due date (latest first)' },
  { k: 'priority', l: 'Priority (low → high)' },
  { k: '-priority', l: 'Priority (high → low)' },
  { k: 'created_at', l: 'Created (oldest first)' },
  { k: '-created_at', l: 'Created (newest first)' }
]

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(dateStr) {
  if (!dateStr) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1)
  const startDay = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const days = []
  for (let i = startDay - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i
    days.push({
      date: new Date(year, month - 1, day),
      isCurrentMonth: false
    })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      date: new Date(year, month, day),
      isCurrentMonth: true
    })
  }
  const remaining = 42 - days.length
  for (let day = 1; day <= remaining; day += 1) {
    days.push({
      date: new Date(year, month + 1, day),
      isCurrentMonth: false
    })
  }
  return days
}

function getPriorityStyle(priority) {
  const match = priorityOptions.find((option) => option.value === priority)
  return match?.color ?? 'bg-gray-100 text-gray-700'
}

function formatDueLabel(task) {
  if (task.completed && task.completedAt) {
    return `Completed ${formatRelativeDate(task.completedAt)}`
  }
  if (!task.dueDate) return 'No due date'
  return `Due: ${formatRelativeDate(task.dueDate)}`
}

function formatRelativeDate(dateStr) {
  const date = parseDate(dateStr)
  if (!date) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  const diff = Math.round((date - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff === 7) return 'Next week'
  if (diff > 1 && diff < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Tasks() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [completedFilter, setCompletedFilter] = useState('')
  const [ordering, setOrdering] = useState('due_date')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)

  // React Hook Form for the Task Modal
  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', priority: 'Medium', dueDate: '' }
  })

  const currentPriority = watch('priority')

  const calendarRef = useRef(null)
  const calendarBtnRef = useRef(null)
  const priorityRef = useRef(null)
  const priorityBtnRef = useRef(null)
  const filterRef = useRef(null)
  const filterBtnRef = useRef(null)
  const sortRef = useRef(null)
  const sortBtnRef = useRef(null)

  const today = new Date()
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth())
  const [calendarYear, setCalendarYear] = useState(today.getFullYear())

  // Debouncing Search Input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // PHASE 24: React Query replacing manual loading/state for Tasks Array
  const { data: tasks, isLoading: loading } = useQuery({
    queryKey: ['tasksData', filterDate, priorityFilter, completedFilter, debouncedQuery, ordering],
    queryFn: async () => {
      const data = await listTasks({
        dueDate: filterDate,
        priority: priorityFilter,
        completed: completedFilter,
        search: debouncedQuery,
        ordering
      })
      return Array.isArray(data) ? data : []
    },
    staleTime: 60 * 1000 // 1 minute
  })

  // Mutations for Task CUD Operations (Automated Refresh)
  const saveTaskMutator = useMutation({
    mutationFn: async (payload) => {
      if (editingTask) return updateTask(editingTask.id, payload)
      return createTask(payload)
    },
    onSuccess: () => {
      toastSuccess(`Task ${editingTask ? 'updated' : 'created'} successfully.`)
      queryClient.invalidateQueries({ queryKey: ['tasksData'] })
      handleCloseModal()
    },
    onError: () => toastError('Unable to save task.')
  })

  const toggleTaskMutator = useMutation({
    mutationFn: async ({ id, payload }) => updateTask(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasksData'] }),
    onError: () => toastError('Unable to update task status.')
  })

  const deleteTaskMutator = useMutation({
    mutationFn: async (id) => deleteTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasksData'] })
  })

  useEffect(() => {
    function handleClick(event) {
      if (
        calendarOpen &&
        !calendarRef.current?.contains(event.target) &&
        !calendarBtnRef.current?.contains(event.target)
      ) {
        setCalendarOpen(false)
      }
      if (
        priorityOpen &&
        !priorityRef.current?.contains(event.target) &&
        !priorityBtnRef.current?.contains(event.target)
      ) {
        setPriorityOpen(false)
      }
      if (
        filterOpen &&
        !filterRef.current?.contains(event.target) &&
        !filterBtnRef.current?.contains(event.target)
      ) {
        setFilterOpen(false)
      }
      if (
        sortOpen &&
        !sortRef.current?.contains(event.target) &&
        !sortBtnRef.current?.contains(event.target)
      ) {
        setSortOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [calendarOpen, priorityOpen, filterOpen, sortOpen])

  const filteredTasks = useMemo(() => tasks || [], [tasks])

  const calendarDays = useMemo(
    () => getCalendarDays(calendarYear, calendarMonth),
    [calendarYear, calendarMonth]
  )

  const handleOpenModal = (task = null) => {
    setEditingTask(task)
    if (task) {
      reset({ title: task.title, priority: task.priority || 'Medium', dueDate: task.due_date || task.dueDate || '' })
    } else {
      reset({ title: '', priority: 'Medium', dueDate: '' })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingTask(null)
    reset()
  }

  const onSubmit = (formData) => {
    saveTaskMutator.mutate(formData)
  }

  const handleToggle = (task) => {
    if (task.completed) return
    toggleTaskMutator.mutate({
      id: task.id,
      payload: { completed: true }
    })
  }

  const handleDelete = (id) => {
    deleteTaskMutator.mutate(id)
  }

  // Derived filter/ordering fallbacks
  const displayedTasks = filteredTasks.length > 0 ? filteredTasks : []

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Task Management</h2>
            <p className="text-gray-600">
              Organize, track, and manage your team's tasks with priority levels, status tracking, and assignment
              capabilities.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                    <i className="ri-search-line text-gray-400"></i>
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search tasks..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <button
                      ref={calendarBtnRef}
                      type="button"
                      onClick={() => setCalendarOpen((prev) => !prev)}
                      className="w-10 h-10 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <i className="ri-calendar-line ri-lg"></i>
                    </button>
                    {calendarOpen && (
                      <div
                        ref={calendarRef}
                        className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-30 w-80"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Date(calendarYear, calendarMonth - 1, 1)
                              setCalendarYear(next.getFullYear())
                              setCalendarMonth(next.getMonth())
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
                          >
                            <i className="ri-arrow-left-s-line"></i>
                          </button>
                          <h3 className="font-semibold text-gray-900">
                            {new Date(calendarYear, calendarMonth, 1).toLocaleDateString('en-US', {
                              month: 'long',
                              year: 'numeric'
                            })}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Date(calendarYear, calendarMonth + 1, 1)
                              setCalendarYear(next.getFullYear())
                              setCalendarMonth(next.getMonth())
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
                          >
                            <i className="ri-arrow-right-s-line"></i>
                          </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {weekdayLabels.map((label) => (
                            <div key={label} className="text-xs font-medium text-gray-500 text-center py-2">
                              {label}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {calendarDays.map((day) => {
                            const dateStr = formatDateInput(day.date)
                            const isSelected = filterDate === dateStr
                            return (
                              <button
                                key={dateStr}
                                type="button"
                                onClick={() => {
                                  setFilterDate(dateStr)
                                  setCalendarOpen(false)
                                }}
                                className={`text-xs h-9 rounded-lg transition-colors ${
                                  day.isCurrentMonth ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300'
                                } ${isSelected ? 'bg-primary text-white hover:bg-primary/90' : ''}`}
                              >
                                {day.date.getDate()}
                              </button>
                            )
                          })}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                          <button
                            type="button"
                            onClick={() => setFilterDate(formatDateInput(new Date()))}
                            className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors !rounded-button whitespace-nowrap"
                          >
                            Go to Today
                          </button>
                          {filterDate && (
                            <button
                              type="button"
                              onClick={() => setFilterDate('')}
                              className="w-full border border-gray-200 text-gray-600 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors !rounded-button whitespace-nowrap"
                            >
                              Clear filter
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      ref={filterBtnRef}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFilterOpen((prev) => !prev)
                        setSortOpen(false)
                      }}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 !rounded-button"
                    >
                      <div className="flex items-center gap-2">
                        <i className="ri-filter-3-line"></i>
                        <span>Filter</span>
                      </div>
                    </button>
                    {filterOpen && (
                      <div
                        ref={filterRef}
                        className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30"
                      >
                        <div className="p-2">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Priority</div>
                          {['', 'High', 'Medium', 'Low'].map((value) => (
                            <button
                              key={`priority-${value || 'all'}`}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setPriorityFilter(value)
                                setFilterOpen(false)
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                            >
                              {value ? `${value} Priority` : 'All priorities'}
                            </button>
                          ))}
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Status</div>
                          {[
                            { label: 'All tasks', value: '' },
                            { label: 'Completed', value: 'true' },
                            { label: 'Not completed', value: 'false' }
                          ].map((opt) => (
                            <button
                              key={`status-${opt.value || 'all'}`}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setCompletedFilter(opt.value)
                                setFilterOpen(false)
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      ref={sortBtnRef}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSortOpen((prev) => !prev)
                        setFilterOpen(false)
                      }}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap !rounded-button"
                    >
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-sort-desc"></i></div>
                      <span>Sort by</span>
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-down-s-line"></i></div>
                    </button>
                    {sortOpen && (
                      <div
                        ref={sortRef}
                        className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-30"
                      >
                        <div className="p-2">
                          {orderingOptions.map((opt) => (
                            <button
                              key={opt.k}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setOrdering(opt.k)
                                setSortOpen(false)
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                            >
                              {opt.l}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-12 bg-gray-100 rounded-lg"></div>
                  <div className="h-12 bg-gray-100 rounded-lg"></div>
                  <div className="h-12 bg-gray-100 rounded-lg"></div>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-sm text-gray-500">No tasks found.</div>
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          disabled={task.completed}
                          onChange={() => handleToggle(task)}
                          className={cn("w-5 h-5 text-primary bg-white border-2 border-gray-300 rounded focus:ring-primary focus:ring-2", task.completed ? "cursor-not-allowed opacity-50" : "cursor-pointer")}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-gray-900 select-none">{task.title}</div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityStyle(task.priority)}`}>
                            {task.completed ? 'Completed' : `${task.priority} Priority`}
                          </span>
                          <span className="text-xs text-gray-500">{formatDueLabel(task)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(task)}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-700 transition-all p-2 rounded-lg hover:bg-gray-100"
                        >
                          <i className="ri-pencil-line"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all p-2 rounded-lg hover:bg-red-50"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <div className="fixed right-6 flex flex-col gap-3 z-30 bottom-[75px] md:bottom-6">
        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="w-16 h-16 bg-white hover:bg-white text-primary rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center justify-center group whitespace-nowrap border-2 border-primary/20 hover:border-primary/40 hover:scale-110 active:scale-95"
        >
          <i className="ri-add-line ri-2x group-hover:rotate-180 transition-transform duration-300 font-bold"></i>
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all duration-300">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingTask ? 'Edit Task' : 'Add New Task'}
                </h3>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <i className="ri-close-line text-gray-500"></i>
                </button>
              </div>
            </div>
            <div className="p-6">
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task Title</label>
                  <input
                    type="text"
                    maxLength={500}
                    {...register('title')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    placeholder="Enter task description..."
                    required
                  />
                  {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <div className="relative">
                    <button
                      ref={priorityBtnRef}
                      type="button"
                      onClick={() => setPriorityOpen((prev) => !prev)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm text-left flex items-center justify-between bg-white"
                    >
                      <span>{priorityOptions.find((option) => option.value === currentPriority)?.label}</span>
                      <i className="ri-arrow-down-s-line text-gray-400"></i>
                    </button>
                    {priorityOpen && (
                      <div
                        ref={priorityRef}
                        className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
                      >
                        {priorityOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setValue('priority', option.value)
                              setPriorityOpen(false)
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    {...register('dueDate')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors !rounded-button whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors !rounded-button whitespace-nowrap"
                  >
                    {editingTask ? 'Save Changes' : 'Add Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

