import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { MailOpen, Trash2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function ToastHistoryBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: toasts = [] } = useQuery({
    queryKey: ['toastHistory'],
    queryFn: () => base44.entities.ToastNotification.list("-timestamp", 100),
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = toasts.filter(t => !t.read);
      await Promise.all(
        unread.map(toast => 
          base44.entities.ToastNotification.update(toast.id, { read: true })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toastHistory'] });
    },
  });

  const deleteToastMutation = useMutation({
    mutationFn: (id) => base44.entities.ToastNotification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toastHistory'] });
    },
  });

  const unreadCount = toasts.filter(t => !t.read).length;

  const getTypeColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-amber-600 bg-amber-50';
      case 'loading': return 'text-blue-600 bg-blue-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <MailOpen className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-slate-900">Toast History</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              className="text-xs"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {toasts.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <MailOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No toast notifications yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    toast.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(toast.type)}`}>
                          {toast.type}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(toast.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 break-words">{toast.message}</p>
                    </div>
                    <button
                      onClick={() => deleteToastMutation.mutate(toast.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}