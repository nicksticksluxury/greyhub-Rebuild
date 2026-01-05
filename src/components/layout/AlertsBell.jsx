import React, { useState, useEffect } from "react";
import { Bell, X, ExternalLink, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function AlertsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Poll for alerts every minute
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      try {
        return await base44.entities.Alert.list("-created_date", 50);
      } catch (error) {
        console.error("Failed to fetch alerts:", error);
        return [];
      }
    },
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const unreadCount = alerts.filter(a => !a.read).length;

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Alert.update(id, { read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = alerts.filter(a => !a.read);
      // Execute in parallel chunks if many
      const promises = unread.map(a => base44.entities.Alert.update(a.id, { read: true }));
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (id) => base44.entities.Alert.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });



  const handleAlertClick = (alert) => {
    if (!alert.read) {
        markReadMutation.mutate(alert.id);
    }
    if (alert.link) {
        if (alert.link.startsWith('http')) {
            window.open(alert.link, '_blank');
        } else {
            navigate(createPageUrl(alert.link));
        }
        setIsOpen(false);
    }
  };

  const getIconColor = (type) => {
    switch (type) {
        case 'error': return 'text-red-500 bg-red-50';
        case 'warning': return 'text-amber-500 bg-amber-50';
        case 'success': return 'text-green-500 bg-green-50';
        default: return 'text-blue-500 bg-blue-50';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 rounded-full">
          <Bell className="w-5 h-5 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h4 className="font-semibold text-slate-900">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-auto py-1 px-2"
                onClick={() => markAllReadMutation.mutate()}
            >
                Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
            {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
                    <Bell className="w-8 h-8 mb-2 opacity-20" />
                    No notifications
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {alerts.map(alert => (
                        <div 
                            key={alert.id} 
                            className={`p-4 hover:bg-slate-50 transition-colors relative group ${alert.read ? 'opacity-60' : 'bg-blue-50/30'}`}
                        >
                            <div className="flex gap-3">
                                <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${
                                    alert.type === 'error' ? 'bg-red-500' : 
                                    alert.type === 'warning' ? 'bg-amber-500' : 
                                    alert.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                                }`} />
                                <div className="flex-1 space-y-1 cursor-pointer" onClick={() => handleAlertClick(alert)}>
                                    <p className={`text-sm font-medium leading-none ${!alert.read ? 'text-slate-900' : 'text-slate-600'}`}>
                                        {alert.title}
                                    </p>
                                    <p className="text-xs text-slate-500 line-clamp-2">
                                        {alert.message}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                        {format(new Date(alert.created_date), 'MMM d, h:mm a')}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 absolute top-2 right-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteAlertMutation.mutate(alert.id);
                                    }}
                                >
                                    <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                                </Button>
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