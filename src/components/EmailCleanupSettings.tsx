import { useState, useEffect, useRef } from 'react';
import { useFormKeyboardNav } from '@/hooks/useFormKeyboardNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Mail, Trash2, AlertCircle, Check } from 'lucide-react';
import { useAgency } from '@/hooks/useAgency';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createRequestId, runBackgroundTask } from '@/lib/atomicSave';
import { runUiAtomicSave } from '@/lib/atomicSaveUi';

export function EmailCleanupSettings() {
  const { data: agency } = useAgency();
  const { isSubUser } = useUserPermissions();
  const queryClient = useQueryClient();
  const [cleanupEnabled, setCleanupEnabled] = useState(false);
  const [cleanupFrequency, setCleanupFrequency] = useState('monthly');
  const [keepDays, setKeepDays] = useState('30');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const requestIdRef = useRef<string>(createRequestId());

  useEffect(() => {
    if (agency) {
      setCleanupEnabled(agency.email_cleanup_enabled || false);
      setCleanupFrequency(agency.email_cleanup_frequency || 'monthly');
      setKeepDays(String(agency.email_cleanup_keep_days || 30));
    }
  }, [agency]);

  const handleSave = async () => {
    if (isSavingRef.current || isSaving || !agency?.id) return;

    await runUiAtomicSave({
      requestIdRef,
      isLockedRef: isSavingRef,
      setIsSubmitting: setIsSaving,
      contextLabel: 'EmailCleanupSettings.handleSave',
      fallbackErrorMessage: 'Failed to save cleanup settings',
      execute: async () => {
        const { error } = await supabase
          .from('agencies')
          .update({
            email_cleanup_enabled: cleanupEnabled,
            email_cleanup_frequency: cleanupFrequency,
            email_cleanup_keep_days: parseInt(keepDays, 10) || 30,
          })
          .eq('id', agency.id);
        if (error) throw error;
        return { ok: true };
      },
      onSuccess: () => {
        toast.success('Email cleanup settings saved');
        runBackgroundTask('EmailCleanupSettings.refresh', () => {
          queryClient.invalidateQueries({ queryKey: ['agency'] });
        });
      },
    });
  };

  const cardRef = useRef<HTMLDivElement>(null);

  useFormKeyboardNav({
    containerRef: cardRef,
    enabled: true,
    autoFocusFirst: false,
    onSave: handleSave,
  });

  if (isSubUser) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-2">
          <p className="text-sm font-semibold">Agency Owner Access Required</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Only the main agency owner can update email cleanup preferences.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card ref={cardRef}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-destructive" />
          Email Log Cleanup
        </CardTitle>
        <CardDescription>
          Automatically delete old email logs to save database space
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Why cleanup email logs?</p>
              <p className="text-xs text-muted-foreground">
                Email logs can accumulate quickly and consume database storage. Automatic cleanup helps maintain optimal performance and reduces costs.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="cleanup-enabled">Enable Automatic Cleanup</Label>
              <p className="text-xs text-muted-foreground">
                Automatically delete old email logs based on schedule
              </p>
            </div>
            <Switch
              id="cleanup-enabled"
              checked={cleanupEnabled}
              onCheckedChange={setCleanupEnabled}
            />
          </div>

          {cleanupEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cleanup-frequency">Cleanup Frequency</Label>
                <Select value={cleanupFrequency} onValueChange={setCleanupFrequency}>
                  <SelectTrigger id="cleanup-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly (Every Sunday)</SelectItem>
                    <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How often the cleanup should run automatically
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keep-days">Keep Logs For</Label>
                <Select value={keepDays} onValueChange={setKeepDays}>
                  <SelectTrigger id="keep-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days (Recommended)</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Email logs older than this will be deleted during cleanup
                </p>
              </div>

              <div className="flex items-start gap-2 p-3 border border-primary/20 rounded-lg bg-primary/5">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Cleanup Preview:</p>
                  <p>
                    Logs will be deleted {cleanupFrequency === 'weekly' ? 'every Sunday' : 'on the 1st of each month'},
                    removing all emails older than {keepDays} days.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <Button
          data-save-button="true"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto"
        >
          {isSaving ? 'Saving...' : 'Save Cleanup Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
