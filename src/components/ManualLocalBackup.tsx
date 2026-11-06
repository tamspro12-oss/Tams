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

export function ManualLocalBackup() {
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual Backup (Local)</CardTitle>
          <CardDescription>
            Save a backup of your TAMS data to your computer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Folder selection is not supported on this browser.
              </AlertDescription>
            </Alert>
          )}

          {selectedFolder && (
            <div className="text-sm text-muted-foreground">
              Selected folder: <span className="font-medium">{folderName}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleChooseFolder}
              variant="outline"
              disabled={!isSupported || isBackingUp}
              className="gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              Choose Folder
            </Button>

            <Button
              onClick={handleBackupNow}
              disabled={!selectedFolder || isBackingUp || !isSupported}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {isBackingUp ? "Backing Up..." : "Backup Now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto Backup (Optional)</CardTitle>
          <CardDescription>
            Automatically save a backup file to your selected folder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="auto-backup"
              checked={autoBackupEnabled}
              onCheckedChange={handleAutoBackupToggle}
              disabled={!isSupported}
            />
            <label
              htmlFor="auto-backup"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Enable Auto Backup
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Backup Frequency</label>
            <Select
              value={autoBackupFrequency}
              onValueChange={handleFrequencyChange}
              disabled={!autoBackupEnabled || !isSupported}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Next Backup:
              </span>
              <span className="font-medium">
                {nextBackupDate && autoBackupEnabled
                  ? format(new Date(nextBackupDate), 'PPP')
                  : 'Not scheduled'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Last Backup:
              </span>
              <span className="font-medium">
                {lastBackupDate
                  ? format(new Date(lastBackupDate), 'PPP')
                  : 'Never'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
