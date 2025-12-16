import { base44 } from "@/api/base44Client";
import { toast as sonnerToast } from "sonner";

// Enhanced toast that saves to database
export const toast = {
  success: async (message, options) => {
    const result = sonnerToast.success(message, options);
    await saveToast('success', message);
    return result;
  },
  error: async (message, options) => {
    const result = sonnerToast.error(message, options);
    await saveToast('error', message);
    return result;
  },
  info: async (message, options) => {
    const result = sonnerToast.info(message, options);
    await saveToast('info', message);
    return result;
  },
  warning: async (message, options) => {
    const result = sonnerToast.warning(message, options);
    await saveToast('warning', message);
    return result;
  },
  loading: async (message, options) => {
    const result = sonnerToast.loading(message, options);
    await saveToast('loading', message);
    return result;
  },
};

async function saveToast(type, message) {
  try {
    const user = await base44.auth.me();
    if (user && user.company_id) {
      await base44.entities.ToastNotification.create({
        company_id: user.company_id,
        user_id: user.id,
        timestamp: new Date().toISOString(),
        type,
        message: String(message),
        read: false
      });
    }
  } catch (error) {
    // Silent fail - don't break the app if logging fails
    console.error('Failed to save toast to database:', error);
  }
}

// General logging utility
export const logger = {
  log: async (level, category, message, details = {}) => {
    try {
      const user = await base44.auth.me();
      if (user && user.company_id) {
        await base44.entities.Log.create({
          company_id: user.company_id,
          user_id: user.id,
          timestamp: new Date().toISOString(),
          level,
          category,
          message,
          details
        });
      }
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  },
  
  debug: (category, message, details) => logger.log('debug', category, message, details),
  info: (category, message, details) => logger.log('info', category, message, details),
  warning: (category, message, details) => logger.log('warning', category, message, details),
  error: (category, message, details) => logger.log('error', category, message, details),
  success: (category, message, details) => logger.log('success', category, message, details),
};