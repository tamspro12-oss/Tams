import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/hooks/useAgency";
import { Building2, Mail, FileText, LogOut, User, Eye, ExternalLink, Maximize2, Minimize2, Trash2, MessageSquare, Shield, RefreshCw, Smartphone, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeSettings } from "@/components/ThemeSettings";
import { SessionActivity } from "@/components/SessionActivity";
import { ExportManager } from "@/components/ExportManager";
import { StorageQuotaMeter } from "@/components/StorageQuotaMeter";
import { ManualLocalBackup } from "@/components/ManualLocalBackup";
import { usePolicyAcknowledgment } from "@/hooks/usePolicyAcknowledgment";
import { GmailAppPasswordGuide } from "@/components/GmailAppPasswordGuide";
import { EmailCleanupSettings } from "@/components/EmailCleanupSettings";
import { ReminderMessageTemplates } from "@/components/ReminderMessageTemplates";
import { BookingTemplateDesigner } from "@/components/BookingTemplateDesigner";
import { AdminAccountInfo } from "@/components/AdminAccountInfo";
import { ChangePasswordSection } from "@/components/ChangePasswordSection";
import { SubUserManagement } from "@/components/SubUserManagement";
import { versionManager } from "@/lib/versionManager";
import { forceRefresh, isIOSPWA } from "@/lib/forceRefresh";

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [agencyName, setAgencyName] = useState("");
  const [agencyPhone, setAgencyPhone] = useState("");
  const [agencyEmail, setAgencyEmail] = useState("");
  const [agencyEmailPassword, setAgencyEmailPassword] = useState("");
  
  const [isSavingAgency, setIsSavingAgency] = useState(false);
  
  // Invoice Template State
  const [invoiceLogo, setInvoiceLogo] = useState<string>("");
  const [invoiceAgencyName, setInvoiceAgencyName] = useState("");
  const [invoicePhone, setInvoicePhone] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [invoiceAddress, setInvoiceAddress] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [invoiceLayout, setInvoiceLayout] = useState("standard");
  const [invoiceThemeColor, setInvoiceThemeColor] = useState("#1e40af");
  const [showPreview, setShowPreview] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTemplateView, setActiveTemplateView] = useState<'branding' | 'invoice' | 'booking' | 'reminder'>('branding');
  
  // Version and update state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  
  const { data: agency } = useAgency();
  const { acknowledgment, currentVersions } = usePolicyAcknowledgment();
  const { user } = useAuth();

  useEffect(() => {
    loadInvoiceTemplate();
    setLastCheckTime(versionManager.getLastCheckTime());
  }, []);

  useEffect(() => {
    if (agency?.name) {
      setAgencyName(agency.name);
    }
    if (agency?.phone_number) {
      setAgencyPhone(agency.phone_number);
    }
    if (agency?.email) {
      setAgencyEmail(agency.email);
    }
    // SMTP password is no longer readable via a plain table select.
    // Main (non sub-user) accounts fetch it through a protected server function.
    if (agency?.id) {
      supabase
        .rpc("get_agency_smtp_password")
        .then(({ data }) => {
          if (typeof data === "string" && data) setAgencyEmailPassword(data);
        });
    }
  }, [agency]);


  const loadInvoiceTemplate = () => {
    try {
      const template = localStorage.getItem("invoice_template");
      if (template) {
        const data = JSON.parse(template);
        setInvoiceLogo(data.logo || "");
        setInvoiceAgencyName(data.agencyName || "");
        setInvoicePhone(data.phone || "");
        setInvoiceEmail(data.email || "");
        setInvoiceAddress(data.address || "");
        setInvoicePrefix(data.prefix || "INV");
        setInvoiceLayout(data.layout || "standard");
        setInvoiceThemeColor(data.themeColor || "#1e40af");
      }
    } catch (error) {
      console.error("Failed to load invoice template:", error);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Logo size must be less than 2MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setInvoiceLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveInvoiceTemplate = () => {
    if (!invoiceAgencyName.trim()) {
      toast({
        title: "Error",
        description: "Agency name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSavingTemplate(true);
    try {
      const template = {
        logo: invoiceLogo,
        agencyName: invoiceAgencyName,
        phone: invoicePhone,
        email: invoiceEmail,
        address: invoiceAddress,
        prefix: invoicePrefix,
        layout: invoiceLayout,
        themeColor: invoiceThemeColor,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem("invoice_template", JSON.stringify(template));

      toast({
        title: "Success",
        description: "Invoice template saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save invoice template",
        variant: "destructive",
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };


  const handleSaveAgencyInfo = async () => {
    if (!agency?.id || !agencyName.trim()) return;
    
    if (agencyEmail && !agencyEmailPassword) {
      toast({
        title: "Error",
        description: "Gmail App Password is required when email is provided",
        variant: "destructive",
      });
      return;
    }

    if (agencyEmailPassword && agencyEmailPassword.length !== 16) {
      toast({
        title: "Error",
        description: "Gmail App Password must be exactly 16 characters",
        variant: "destructive",
      });
      return;
    }
    
    setIsSavingAgency(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({ 
          name: agencyName,
          phone_number: agencyPhone || null,
          email: agencyEmail || null,
          email_password: agencyEmailPassword || null
        })
        .eq("id", agency.id);

      if (error) throw error;

      // NOTE: SMTP credentials are stored server-side in the agencies table
      // and fetched by the send-email edge function using the caller's JWT.
      // We intentionally do NOT cache the Gmail App Password in localStorage
      // to avoid persistent plaintext exposure to any script on the origin.

      // Invalidate agency query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["agency"] });

      toast({
        title: "Success",
        description: "Agency information updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update agency information",
        variant: "destructive",
      });
    } finally {
      setIsSavingAgency(false);
    }
  };

  const handleLogout = async () => {
    const { sessionManager } = await import("@/lib/sessionManager");
    sessionManager.endSession();
    
    await supabase.auth.signOut({ scope: 'local' });
    
    toast({
      title: "Logged out",
      description: "Session ended successfully",
    });
    
    navigate("/auth");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const result = await versionManager.checkVersionAPI();
      setLastCheckTime(new Date());
      
      if (result.hasUpdate) {
        toast({
          title: "Update Available!",
          description: `Version ${result.latestVersion} is ready. Please update your app.`,
        });
      } else {
        toast({
          title: "You're Up to Date",
          description: `Running latest version ${result.currentVersion}`,
        });
      }
    } catch (error) {
      toast({
        title: "Check Failed",
        description: "Unable to check for updates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleForceRefresh = async () => {
    setIsForceRefreshing(true);
    try {
      if (isIOSPWA()) {
        toast({
          title: "Updating iOS App",
          description: "Clearing caches... Please close and reopen the app after this completes.",
          duration: 4000,
        });
      } else {
        toast({
          title: "Refreshing App",
          description: "Clearing all caches and reloading...",
          duration: 2000,
        });
      }
      
      await forceRefresh();
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Please try closing and reopening the app manually.",
        variant: "destructive",
      });
      setIsForceRefreshing(false);
    }
  };

  const formatLastCheck = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <>
      <div className={cn("settings-container space-y-4 sm:space-y-6", isFullScreen && "fixed inset-0 z-50 bg-background overflow-auto p-4 sm:p-6")}>
        <div className="settings-header flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your account, templates, and preferences</p>
          </div>
          <Button
            onClick={() => setIsFullScreen(!isFullScreen)}
            variant="outline"
            size="lg"
            className="gap-2 hidden md:inline-flex"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            {isFullScreen ? "Exit Full Screen" : "Full Screen"}
          </Button>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="templates" className="gap-1.5">
              <Building2 className="w-4 h-4 hidden sm:inline" />
              Agency Branding
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-1.5">
              <User className="w-4 h-4 hidden sm:inline" />
              Account
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-1.5">
              <Building2 className="w-4 h-4 hidden sm:inline" />
              Storage & Backup
            </TabsTrigger>
          </TabsList>

          {/* ========== ACCOUNT TAB ========== */}
          <TabsContent value="account" className="space-y-6">
            {/* Admin Account Info Section */}
            <AdminAccountInfo />

            {/* Sub User Management */}
            <SubUserManagement />

            {/* Security - Change Password */}
            <ChangePasswordSection />

            {/* App Appearance */}
            <ThemeSettings />

            {/* Legal & Privacy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Legal & Privacy
                </CardTitle>
                <CardDescription>Review our policies and your agreement status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/privacy')}
                    className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-medium">Privacy Policy</p>
                        <p className="text-xs text-muted-foreground">How we handle your data</p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </button>

                  <button
                    onClick={() => navigate('/terms')}
                    className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-medium">Terms of Service</p>
                        <p className="text-xs text-muted-foreground">Terms and conditions</p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {acknowledgment && (
                  <div className="pt-3 border-t">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Policy Accepted</p>
                        <p className="text-xs">
                          Accepted on {new Date(acknowledgment.acknowledged_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs mt-1">
                          Version: {currentVersions.privacy}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Support & Help */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Support & Help
                </CardTitle>
                <CardDescription>
                  Get help with the Travel Agency Management App
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Email: tamspro12@gmail.com</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      For technical support and feature requests
                    </p>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium">TAMS Team: +923190846768</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      WhatsApp support available
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* App Version & Updates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  App Version & Updates
                </CardTitle>
                <CardDescription>Check for updates and manage app version</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Version</p>
                    <p className="text-2xl font-bold">{versionManager.getCurrentVersion()}</p>
                  </div>
                  {isIOSPWA() && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full">
                      <Smartphone className="w-3 h-3 text-blue-500" />
                      <span className="text-xs font-medium text-blue-500">iOS PWA</span>
                    </div>
                  )}
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>Last checked: <span className="font-medium">{formatLastCheck(lastCheckTime)}</span></p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleCheckForUpdates}
                    disabled={isCheckingUpdate}
                    className="gap-2 flex-1"
                    variant="outline"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                    {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                  </Button>
                  
                  <Button
                    onClick={handleForceRefresh}
                    disabled={isForceRefreshing}
                    className="gap-2 flex-1"
                    variant="default"
                  >
                    <RefreshCw className={`w-4 h-4 ${isForceRefreshing ? 'animate-spin' : ''}`} />
                    {isForceRefreshing ? 'Refreshing...' : 'Force Refresh App'}
                  </Button>
                </div>

                {isIOSPWA() && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                      <strong>iOS PWA Note:</strong> After forcing a refresh, you may need to close the app completely and reopen it from your home screen for updates to fully apply.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TEMPLATES TAB ========== */}
          <TabsContent value="templates" className="space-y-6">
            {/* Template Type Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${activeTemplateView === 'branding' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setActiveTemplateView('branding')}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="w-5 h-5" />
                    Agency Branding
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Configure agency name, contact details & email
                  </p>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${activeTemplateView === 'invoice' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setActiveTemplateView('invoice')}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5" />
                    Invoice Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Design professional invoice templates for billing
                  </p>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${activeTemplateView === 'booking' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setActiveTemplateView('booking')}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5" />
                    Booking Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Customize booking confirmation documents
                  </p>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${activeTemplateView === 'reminder' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setActiveTemplateView('reminder')}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="w-5 h-5" />
                    Reminder Messages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Edit reminder message templates for clients
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Agency Branding */}
            {activeTemplateView === 'branding' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Agency Branding & Configuration
                  </CardTitle>
                  <CardDescription>
                    Manage your agency information, contact details, and email configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Building2 className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold">Basic Information</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="agency-name">Agency Name *</Label>
                        <Input
                          id="agency-name"
                          value={agencyName}
                          onChange={(e) => setAgencyName(e.target.value)}
                          placeholder="e.g., My Travel Agency"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="agency-phone">WhatsApp Business Number</Label>
                        <Input
                          id="agency-phone"
                          type="tel"
                          value={agencyPhone}
                          onChange={(e) => setAgencyPhone(e.target.value)}
                          placeholder="e.g., +923001234567"
                        />
                        <p className="text-xs text-muted-foreground">
                          Used for WhatsApp integrations and client communications
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Email Configuration Section */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 pb-2">
                        <Mail className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold">Email Configuration</h3>
                      </div>
                      <GmailAppPasswordGuide />
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      Configure your Gmail account to send booking confirmations, invoices, and reminders to clients
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="agency-email">Agency Gmail Email *</Label>
                        <Input
                          id="agency-email"
                          type="email"
                          value={agencyEmail}
                          onChange={(e) => setAgencyEmail(e.target.value)}
                          placeholder="youragency@gmail.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          The Gmail address that will send emails
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="agency-email-password">Gmail App Password *</Label>
                        <Input
                          id="agency-email-password"
                          type="password"
                          value={agencyEmailPassword}
                          onChange={(e) => setAgencyEmailPassword(e.target.value)}
                          placeholder="16-character app password"
                          maxLength={16}
                        />
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-amber-600 dark:text-amber-400">⚠️ Important:</span> Type manually, character by character
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 border-t">
                    <Button 
                      onClick={handleSaveAgencyInfo}
                      disabled={isSavingAgency || !agencyName.trim()}
                      className="w-full sm:w-auto"
                      size="lg"
                    >
                      {isSavingAgency ? "Saving..." : "Save Agency Branding"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invoice Template Designer */}
            {activeTemplateView === 'invoice' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Invoice Template Designer
                  </CardTitle>
                  <CardDescription>
                    Customize your invoice template for professional billing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label htmlFor="invoice-logo">Agency Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      id="invoice-logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Max size: 2MB. Recommended: 200x80px
                    </p>
                  </div>
                  {invoiceLogo && (
                    <div className="w-24 h-24 border rounded-lg p-2 flex items-center justify-center bg-muted">
                      <img
                        src={invoiceLogo}
                        alt="Logo preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Agency Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice-agency-name">Agency Name *</Label>
                  <Input
                    id="invoice-agency-name"
                    value={invoiceAgencyName}
                    onChange={(e) => setInvoiceAgencyName(e.target.value)}
                    placeholder="Your Agency Name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="invoice-phone">Phone Number</Label>
                  <Input
                    id="invoice-phone"
                    value={invoicePhone}
                    onChange={(e) => setInvoicePhone(e.target.value)}
                    placeholder="+92 300 1234567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice-email">Email</Label>
                  <Input
                    id="invoice-email"
                    type="email"
                    value={invoiceEmail}
                    onChange={(e) => setInvoiceEmail(e.target.value)}
                    placeholder="info@agency.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice-prefix">Invoice Prefix</Label>
                  <Input
                    id="invoice-prefix"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                    placeholder="INV"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-address">Address</Label>
                <Textarea
                  id="invoice-address"
                  value={invoiceAddress}
                  onChange={(e) => setInvoiceAddress(e.target.value)}
                  placeholder="Enter your complete business address"
                  rows={3}
                />
              </div>

              {/* Layout and Theme */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice-layout">Layout Style</Label>
                  <Select value={invoiceLayout} onValueChange={setInvoiceLayout}>
                    <SelectTrigger id="invoice-layout">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="left-logo">Left Logo</SelectItem>
                      <SelectItem value="center-title">Center Title</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice-theme-color">Theme Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="invoice-theme-color"
                      type="color"
                      value={invoiceThemeColor}
                      onChange={(e) => setInvoiceThemeColor(e.target.value)}
                      className="w-20 h-10 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={invoiceThemeColor}
                      onChange={(e) => setInvoiceThemeColor(e.target.value)}
                      placeholder="#1e40af"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={handleSaveInvoiceTemplate}
                  disabled={isSavingTemplate || !invoiceAgencyName.trim()}
                >
                  {isSavingTemplate ? "Saving..." : "Save Template"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </Button>
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="border rounded-lg p-6 bg-background space-y-4">
                  <h3 className="font-semibold text-lg mb-4">Invoice Preview</h3>
                  <div 
                    className="border-2 rounded-lg p-8 bg-card"
                    style={{ borderColor: invoiceThemeColor }}
                  >
                    {/* Header based on layout */}
                    {invoiceLayout === "center-title" ? (
                      <div className="text-center mb-6 space-y-4">
                        {invoiceLogo && (
                          <img
                            src={invoiceLogo}
                            alt="Logo"
                            className="h-16 mx-auto object-contain"
                          />
                        )}
                        <h2 
                          className="text-2xl font-bold"
                          style={{ color: invoiceThemeColor }}
                        >
                          {invoiceAgencyName || "Your Agency Name"}
                        </h2>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {invoicePhone && <p>{invoicePhone}</p>}
                          {invoiceEmail && <p>{invoiceEmail}</p>}
                          {invoiceAddress && <p>{invoiceAddress}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start mb-6">
                        <div className="space-y-2">
                          {invoiceLogo && (
                            <img
                              src={invoiceLogo}
                              alt="Logo"
                              className="h-16 object-contain mb-2"
                            />
                          )}
                          <h2 
                            className="text-xl font-bold"
                            style={{ color: invoiceThemeColor }}
                          >
                            {invoiceAgencyName || "Your Agency Name"}
                          </h2>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {invoicePhone && <p>{invoicePhone}</p>}
                            {invoiceEmail && <p>{invoiceEmail}</p>}
                            {invoiceAddress && <p className="max-w-xs">{invoiceAddress}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <h3 
                            className="text-2xl font-bold mb-2"
                            style={{ color: invoiceThemeColor }}
                          >
                            INVOICE
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {invoicePrefix}-2025-001
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date().toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Sample Invoice Content */}
                    <div className="border-t pt-4 space-y-3">
                      <div className="text-sm">
                        <p className="font-semibold mb-1">Bill To:</p>
                        <p className="text-muted-foreground">Sample Client Name</p>
                      </div>
                      
                      <div className="mt-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr 
                              className="border-b"
                              style={{ borderColor: invoiceThemeColor + "40" }}
                            >
                              <th className="text-left py-2">Description</th>
                              <th className="text-right py-2">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="py-2">Umrah Package - Standard</td>
                              <td className="text-right py-2">Rs 150,000</td>
                            </tr>
                            <tr>
                              <td className="py-2 font-semibold">Total</td>
                              <td 
                                className="text-right py-2 font-bold text-lg"
                                style={{ color: invoiceThemeColor }}
                              >
                                Rs 150,000
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
            )}

            {/* Booking Template Designer */}
            {activeTemplateView === 'booking' && (
              <BookingTemplateDesigner />
            )}

            {/* Reminder Message Templates */}
            {activeTemplateView === 'reminder' && (
              <ReminderMessageTemplates />
            )}
          </TabsContent>

          {/* ========== STORAGE & BACKUP TAB ========== */}
          <TabsContent value="storage" className="space-y-6">
            <div className="space-y-6 pb-4">
              <div className="p-3 md:p-0">
                <StorageQuotaMeter />
              </div>
              <div className="p-3 md:p-0">
                <ManualLocalBackup />
              </div>
              <div className="p-3 md:p-0">
                <EmailCleanupSettings />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
