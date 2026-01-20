import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, AlertCircle, CheckCircle, Info, XCircle, Filter, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Logs() {
  const [user, setUser] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [hideAccountDeletion, setHideAccountDeletion] = useState(true);
  const [fetchingEbayConditions, setFetchingEbayConditions] = useState(false);
  const [ebayConditionsResult, setEbayConditionsResult] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['systemLogs'],
    queryFn: async () => {
      const companyId = user.data?.company_id || user.company_id;
      // If system admin (role admin and no company_id), use backend function to see all logs
      if (user.role === 'admin' && !companyId) {
        const result = await base44.functions.invoke('getAllLogs');
        return result.data.logs || [];
      }
      // Otherwise (Tenant Admin), use entity list with RLS
      return await base44.entities.Log.list("-timestamp", 500);
    },
    enabled: !!user && (user.role === 'admin' || !!(user.data?.company_id || user.company_id)),
  });

  const companyId = user?.data?.company_id || user?.company_id;

  if (!user || (user.role !== 'admin' && !companyId)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">You do not have permission to view logs.</p>
        </Card>
      </div>
    );
  }

  // Get unique categories and levels
  const categories = [...new Set(logs.map(log => log.category).filter(Boolean))];
  const levels = [...new Set(logs.map(log => log.level).filter(Boolean))];

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;
    const matchesLevel = levelFilter === "all" || log.level === levelLevel;
    const matchesSearch = !searchTerm || 
      log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Check for account deletion notifications
    const isAccountDeletion = 
      log.message?.toLowerCase().includes("account deletion") ||
      log.message?.includes('"metadata":{"topic":"MARKETPLACE_ACCOUNT_DELETION"') ||
      (log.details && JSON.stringify(log.details).includes('"metadata":{"topic":"MARKETPLACE_ACCOUNT_DELETION"')) ||
      (log.category === "ebay_webhook" && log.message?.includes("Received POST notification") && 
       log.details?.bodyPreview?.includes("MARKETPLACE_ACCOUNT_DELETION"));
    
    const showAccountDeletion = !hideAccountDeletion || !isAccountDeletion;
    return matchesCategory && matchesLevel && matchesSearch && showAccountDeletion;
  });

  const getLevelIcon = (level) => {
    switch (level) {
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'info': return <Info className="w-4 h-4 text-blue-600" />;
      default: return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'success': return 'bg-green-100 text-green-800 border-green-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const fetchEbayConditionPolicies = async () => {
    setFetchingEbayConditions(true);
    try {
      const result = await base44.functions.invoke('getEbayConditionPolicies');
      setEbayConditionsResult(result.data);
      toast.success('eBay condition policies fetched');
    } catch (error) {
      toast.error('Failed to fetch eBay condition policies');
      setEbayConditionsResult({ error: error.message });
    } finally {
      setFetchingEbayConditions(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-8 h-8 text-slate-800" />
          <h1 className="text-3xl font-bold text-slate-900">System Logs</h1>
        </div>

        {/* eBay Condition Policies Section */}
        <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">eBay Condition Policies (Category 31387)</h2>
            <Button 
              onClick={fetchEbayConditionPolicies} 
              disabled={fetchingEbayConditions}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {fetchingEbayConditions ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                'Fetch Conditions from eBay'
              )}
            </Button>
          </div>
          {ebayConditionsResult && (
            <div className="mt-4 p-4 bg-white rounded border border-blue-200">
              <pre className="text-xs overflow-x-auto max-h-96">
                {JSON.stringify(ebayConditionsResult, null, 2)}
              </pre>
            </div>
          )}
        </Card>

        {/* Filters */}
         <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Level</label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {levels.map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Search</label>
              <Input 
                placeholder="Search logs..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input 
              type="checkbox" 
              id="hideAccountDeletion" 
              checked={hideAccountDeletion}
              onChange={(e) => setHideAccountDeletion(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="hideAccountDeletion" className="text-sm text-slate-600 cursor-pointer">
              Hide account deletion notifications
            </label>
          </div>
        </Card>

        {/* Logs List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Logs ({filteredLogs.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
              <p className="text-sm text-slate-500 mt-4">Loading logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No logs found</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="space-y-3">
                {filteredLogs.map((log, idx) => (
                  <div 
                    key={log.id || idx} 
                    className={`p-4 rounded-lg border ${getLevelColor(log.level)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getLevelIcon(log.level)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {log.category || 'general'}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mb-1">
                          {log.message}
                        </p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-900">
                              View details
                            </summary>
                            <pre className="mt-2 p-2 bg-slate-900 text-slate-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>
      </div>
    </div>
  );
}