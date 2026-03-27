import { Notyf } from "notyf"
import "notyf/notyf.min.css"

const notyf = new Notyf({
  duration: 4000,
  position: { x: "right", y: "top" },
  dismissible: true,
  types: [
    {
      type: "loading",
      background: "#64748b",
      duration: 0,        // infinite
      dismissible: false,
      icon: false
    },
    {
      type: "info",
      background: "#2563eb",
      icon: false
    }
  ]
})

export function success(msg) {
  return notyf.success(msg)
}

export function error(msg) {
  return notyf.error(msg)
}

export function info(msg) {
  return notyf.open({ type: "info", message: msg })
}

// ✅ return notification instance (NOT id)
export function loading(msg = "Loading...") {
  return notyf.open({
    type: "loading",
    message: msg
  })
}

// ✅ dismiss specific toast
export function dismiss(notification) {
  notyf.dismiss(notification)
}

export function dismissAll() {
  notyf.dismissAll()
}

export default { success, error, info, loading, dismiss, dismissAll }
