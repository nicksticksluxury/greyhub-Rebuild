import { toast as sonnerToast } from "sonner";
import { base44 } from "@/api/base44Client";

async function saveToastNotification(type, message) {
  try {
    const user = await base44.auth.me();
    if (user && user.company_id) {
      await base44.entities.ToastNotification.create({
        company_id: user.company_id,
        user_id: user.id,
        timestamp: new Date().toISOString(),
        type,
        message,
        read: false,
      });
    }
  } catch (error) {
    // Silently fail - don't break the app if toast saving fails
    console.error("Failed to save toast notification:", error);
  }
}

export const toast = {
  success: (message, options) => {
    saveToastNotification('success', message);
    return sonnerToast.success(message, options);
  },
  error: (message, options) => {
    saveToastNotification('error', message);
    return sonnerToast.error(message, options);
  },
  info: (message, options) => {
    saveToastNotification('info', message);
    return sonnerToast.info(message, options);
  },
  warning: (message, options) => {
    saveToastNotification('warning', message);
    return sonnerToast.warning(message, options);
  },
  loading: (message, options) => {
    saveToastNotification('loading', message);
    return sonnerToast.loading(message, options);
  },
  promise: sonnerToast.promise,
  custom: sonnerToast.custom,
  message: (message, options) => {
    saveToastNotification('info', message);
    return sonnerToast.message(message, options);
  },
  dismiss: sonnerToast.dismiss,
};