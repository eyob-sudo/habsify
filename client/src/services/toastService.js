import { toast as sonnerToast } from 'sonner'

export function success(message) {
  sonnerToast.success(message)
}

export function error(message) {
  sonnerToast.error(message)
}

export function info(message) {
  sonnerToast.info(message)
}

export function loading(message) {
  const toastId = sonnerToast.loading(message)
  return {
    dismiss: () => sonnerToast.dismiss(toastId)
  }
}

export function dismissAll() {
  sonnerToast.dismiss()
}

export default {
  success,
  error,
  info,
  loading,
  dismissAll
}
