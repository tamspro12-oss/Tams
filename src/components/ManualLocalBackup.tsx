import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen, Download, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, addDays, addWeeks, addMonths } from "date-fns";

interface ManualLocalBackupProps {
  quotaCard?: React.ReactNode;
}

export function ManualLocalBackup({ quotaCard }: ManualLocalBackupProps = {}) {
  const { toast } = useToast();
  const { data: agency } = useAgency();
  const [selectedFolder, setSelectedFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [folderName, setFolderName] = useState<string>("");
  
  // Auto-backup state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupFrequency, setAutoBackupFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [nextBackupDate, setNextBackupDate] = useState<string | null>(null);

  // Check if File System Access API is supported
  const isSupported = 'showDirectoryPicker' in window;

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedFolderName = localStorage.getItem('backupFolderName');
    if (savedFolderName) {
      setFolderName(savedFolderName);
    }
    
    const savedAutoBackupEnabled = localStorage.getItem('autoBackupEnabled') === 'true';
    const savedAutoBackupFrequency = localStorage.getItem('autoBackupFrequency') as 'daily' | 'weekly' | 'monthly' || 'weekly';
    const savedLastBackupDate = localStorage.getItem('lastBackupDate');
    
    setAutoBackupEnabled(savedAutoBackupEnabled);
    setAutoBackupFrequency(savedAutoBackupFrequency);
    setLastBackupDate(savedLastBackupDate);
    
    if (savedLastBackupDate) {
      const next = calculateNextBackupDate(new Date(savedLastBackupDate), savedAutoBackupFrequency);
      setNextBackupDate(next.toISOString());
    }
  }, []);

  // Auto-backup check on mount and when online
  useEffect(() => {
    if (!autoBackupEnabled || !selectedFolder) return;
    
    const checkAndRunAutoBackup = async () => {
      if (!nextBackupDate) return;
      
      const now = new Date();
      const nextDate = new Date(nextBackupDate);
      
      if (now >= nextDate) {
        await performBackup(true);
      }
    };
    
    checkAndRunAutoBackup();
    
    // Listen for online event
    window.addEventListener('online', checkAndRunAutoBackup);
    return () => window.removeEventListener('online', checkAndRunAutoBackup);
  }, [autoBackupEnabled, selectedFolder, nextBackupDate]);

  const calculateNextBackupDate = (fromDate: Date, frequency: 'daily' | 'weekly' | 'monthly'): Date => {
    switch (frequency) {
      case 'daily':
        return addDays(fromDate, 1);
      case 'weekly':
        return addWeeks(fromDate, 1);
      case 'monthly':
        return addMonths(fromDate, 1);
      default:
        return addWeeks(fromDate, 1);
    }
  };

  const handleChooseFolder = async () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Folder selection is not supported on this browser.",
        variant: "destructive",
      });
      return;
    }

    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      setSelectedFolder(dirHandle);
      setFolderName(dirHandle.name);
      
      // Save to localStorage for persistence
      localStorage.setItem('backupFolderName', dirHandle.name);
      
      toast({
        title: "Folder Selected",
        description: `Backup folder: ${dirHandle.name}`,
      });
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast({
          title: "Error",
          description: "Failed to select folder",
          variant: "destructive",
        });
      }
    }
  };

  const performBackup = async (isAutoBackup: boolean = false) => {
    if (!selectedFolder) {
      if (!isAutoBackup) {
        toast({
          title: "No Folder Selected",
          description: "Please select a folder first.",
          variant: "destructive",
        });
      }
      return;
    }

    if (!agency?.id) {
      toast({
        title: "Error",
        description: "Agency information not found",
        variant: "destructive",
      });
      return;
    }

    setIsBackingUp(true);

    try {
      // Fetch all data from Supabase
      const [clientsRes, bookingsRes, expensesRes, vendorsRes, queriesRes] = await Promise.all([
        supabase.from("clients").select("*").eq("agency_id", agency.id),
        supabase.from("bookings").select("*").eq("agency_id", agency.id),
        supabase.from("expenses").select("*").eq("agency_id", agency.id),
        supabase.from("vendors").select("*").eq("agency_id", agency.id),
        supabase.from("queries").select("*").eq("agency_id", agency.id),
      ]);

      // Create backup object
      const backupData = {
        version: "3.1.0",
        timestamp: new Date().toISOString(),
        agencyId: agency.id,
        agencyName: agency.name,
        data: {
          clients: clientsRes.data || [],
          bookings: bookingsRes.data || [],
          expenses: expensesRes.data || [],
          vendors: vendorsRes.data || [],
          queries: queriesRes.data || [],
        },
        metadata: {
          clientCount: clientsRes.data?.length || 0,
          bookingCount: bookingsRes.data?.length || 0,
          expenseCount: expensesRes.data?.length || 0,
          vendorCount: vendorsRes.data?.length || 0,
          queryCount: queriesRes.data?.length || 0,
        },
        settings: {
          agencyName: agency.name,
          agencyPhone: agency.phone_number,
          agencyEmail: agency.email,
        },
      };

      // Create file name
      const fileName = `tams-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      // Create JSON content
      const content = JSON.stringify(backupData, null, 2);
      
      // Write to selected folder using File System Access API
      const fileHandle = await selectedFolder.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // Update last backup timestamp
      const now = new Date();
      const nowISO = now.toISOString();
      localStorage.setItem('lastBackupDate', nowISO);
      setLastBackupDate(nowISO);

      // Calculate and set next backup date
      const next = calculateNextBackupDate(now, autoBackupFrequency);
      setNextBackupDate(next.toISOString());

      if (!isAutoBackup) {
        toast({
          title: "Backup Successful",
          description: `Backup saved to ${folderName}/${fileName}`,
        });
      }
    } catch (error: any) {
      console.error("Backup error:", error);
      if (!isAutoBackup) {
        toast({
          title: "Backup Failed",
          description: error.message || "Failed to create backup",
          variant: "destructive",
        });
      }
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleBackupNow = async () => {
    await performBackup(false);
  };

  const handleAutoBackupToggle = (checked: boolean) => {
    if (checked && !selectedFolder) {
      toast({
        title: "No Folder Selected",
        description: "Please choose a folder before enabling Auto Backup.",
        variant: "destructive",
      });
      return;
    }

    setAutoBackupEnabled(checked);
    localStorage.setItem('autoBackupEnabled', String(checked));

    if (checked) {
      // Calculate first backup date
      const now = new Date();
      const next = calculateNextBackupDate(now, autoBackupFrequency);
      setNextBackupDate(next.toISOString());
      
      toast({
        title: "Auto Backup Enabled",
        description: `Next backup: ${format(next, 'PPP')}`,
      });
    } else {
      toast({
        title: "Auto Backup Disabled",
        description: "Automatic backups have been turned off.",
      });
    }
  };

  const handleFrequencyChange = (value: 'daily' | 'weekly' | 'monthly') => {
    setAutoBackupFrequency(value);
    localStorage.setItem('autoBackupFrequency', value);

    // Recalculate next backup date
    if (lastBackupDate) {
      const next = calculateNextBackupDate(new Date(lastBackupDate), value);
      setNextBackupDate(next.toISOString());
    }
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Storage Usage Card & Manual Backup Card side by side - exactly same size */}
      <div className={quotaCard ? "grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch" : ""}>
        {quotaCard}
        <Card className="h-full flex flex-col justify-between">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Download className="h-4.5 w-4.5 text-primary" />
              Manual Backup (Local)
            </CardTitle>
            <CardDescription className="text-xs">
              Save a complete offline backup of your agency data to your local machine.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3 flex-1 flex flex-col justify-between">
            {!isSupported && (
              <Alert variant="destructive" className="py-2 text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">
                  Folder selection is not supported on this browser.
                </AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5 border">
              <div className="font-medium text-foreground mb-0.5">Destination Directory:</div>
              {selectedFolder ? (
                <span className="font-semibold text-primary truncate block">{folderName}</span>
              ) : (
                <span className="text-muted-foreground italic">No destination folder selected yet</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <Button
                onClick={handleChooseFolder}
                variant="outline"
                size="sm"
                disabled={!isSupported || isBackingUp}
                className="h-9 text-xs rounded-lg gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Choose Folder
              </Button>

              <Button
                onClick={handleBackupNow}
                size="sm"
                disabled={!selectedFolder || isBackingUp || !isSupported}
                className="h-9 text-xs rounded-lg gap-1.5 font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                {isBackingUp ? "Backing Up..." : "Backup Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Auto Backup Card - full width below, options in a horizontal row */}
      <Card className="w-full">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-primary" />
                Auto Backup (Optional)
              </CardTitle>
              <CardDescription className="text-xs">
                Automatically save periodic backups to your designated local folder whenever online.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-backup"
                checked={autoBackupEnabled}
                onCheckedChange={handleAutoBackupToggle}
                disabled={!isSupported}
              />
              <label
                htmlFor="auto-backup"
                className="text-xs font-semibold cursor-pointer select-none"
              >
                Enable Auto Backup
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
            {/* Backup frequency selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Backup Frequency:
              </span>
              <Select
                value={autoBackupFrequency}
                onValueChange={handleFrequencyChange}
                disabled={!autoBackupEnabled || !isSupported}
              >
                <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily" className="text-xs">Daily</SelectItem>
                  <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                  <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Next Backup */}
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="text-muted-foreground">Next Backup:</span>
              <span className="font-semibold text-foreground">
                {nextBackupDate && autoBackupEnabled
                  ? format(new Date(nextBackupDate), 'PP')
                  : 'Not scheduled'}
              </span>
            </div>

            {/* Last Backup */}
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-muted-foreground">Last Backup:</span>
              <span className="font-semibold text-foreground">
                {lastBackupDate
                  ? format(new Date(lastBackupDate), 'PP')
                  : 'Never'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
