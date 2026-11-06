import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, Mail, Shield, Key, Check, ExternalLink, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function GmailAppPasswordGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="w-4 h-4" />
          How to Create App Password?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Mail className="w-6 h-6 text-primary" />
            How to Create Gmail App Password
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            {/* What is App Password */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    What is a Gmail App Password?
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    An App Password is a 16-character code that allows TAMS to securely send emails on behalf of your Gmail account without exposing your main Gmail password. It's specifically designed for third-party apps like ours.
                  </p>
                </div>
              </div>
            </div>

            {/* Prerequisites */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Prerequisites
              </h3>
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">2-Step Verification Enabled</p>
                    <p className="text-sm text-muted-foreground">
                      App Passwords only work when 2-Step Verification is turned on for your Google account
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Valid Gmail Account</p>
                    <p className="text-sm text-muted-foreground">
                      Must be a personal Gmail or Google Workspace account with admin rights
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step-by-step guide */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                Step-by-Step Guide
              </h3>

              {/* Step 1 */}
              <div className="relative pl-8 pb-6 border-l-2 border-primary/20">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Enable 2-Step Verification</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Go to your <span className="font-medium text-foreground">Google Account Settings</span>
                  </p>
                  <ol className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>Click on <span className="font-medium text-foreground">"Security"</span> in the left sidebar</li>
                    <li>Under <span className="font-medium text-foreground">"Signing in to Google"</span>, find <span className="font-medium text-foreground">"2-Step Verification"</span></li>
                    <li>Click <span className="font-medium text-foreground">"Get Started"</span> and follow the setup instructions</li>
                    <li>Verify your phone number and complete the setup</li>
                  </ol>
                  <a 
                    href="https://myaccount.google.com/signinoptions/two-step-verification" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open 2-Step Verification Settings
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative pl-8 pb-6 border-l-2 border-primary/20">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Generate App Password</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    After enabling 2-Step Verification, go to the App Passwords page
                  </p>
                  <ol className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>Visit <span className="font-medium text-foreground">Google App Passwords</span> page</li>
                    <li>Sign in with your Gmail account if prompted</li>
                    <li>You'll see the App Password generator page</li>
                  </ol>
                  <a 
                    href="https://myaccount.google.com/apppasswords" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open App Passwords Page
                  </a>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative pl-8 pb-6 border-l-2 border-primary/20">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Create New App Password</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Generate a new password specifically for TAMS
                  </p>
                  <ol className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>In the <span className="font-medium text-foreground">"App name"</span> field, type: <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground">TAMS</span></li>
                    <li>Click <span className="font-medium text-foreground">"Create"</span> button</li>
                    <li>Google will generate a <span className="font-medium text-foreground">16-character password</span></li>
                    <li>The password will look like: <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground">abcd efgh ijkl mnop</span></li>
                  </ol>
                </div>
              </div>

              {/* Step 4 */}
              <div className="relative pl-8 pb-6 border-l-2 border-primary/20">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Copy & Paste the Password</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Save the generated password in TAMS
                  </p>
                  <ol className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>Click <span className="font-medium text-foreground">"Copy"</span> to copy the 16-character password</li>
                    <li>Return to TAMS Settings page</li>
                    <li>Paste the password in the <span className="font-medium text-foreground">"Gmail App Password"</span> field above</li>
                    <li>Remove any spaces - paste it as one continuous string</li>
                    <li>Click <span className="font-medium text-foreground">"Save Changes"</span></li>
                  </ol>
                </div>
              </div>

              {/* Step 5 - Final */}
              <div className="relative pl-8">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                  ✓
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg text-green-600 dark:text-green-400">You're All Set!</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    TAMS can now send emails on your behalf. Test it by sending a booking confirmation or invoice to a client.
                  </p>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Important Security Notes
              </h4>
              <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                  <span>Keep your App Password secure - it works like your main password</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                  <span>Never share your App Password with anyone</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                  <span>You can revoke App Passwords anytime from Google account settings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                  <span>If you change your Gmail password, your App Password remains valid</span>
                </li>
              </ul>
            </div>

            {/* Troubleshooting */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Common Issues</h3>
              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <p className="font-medium text-sm mb-1">Can't see App Passwords option?</p>
                  <p className="text-xs text-muted-foreground">
                    Make sure 2-Step Verification is enabled first. App Passwords only appear after 2-Step Verification is active.
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="font-medium text-sm mb-1">Email not sending?</p>
                  <p className="text-xs text-muted-foreground">
                    Verify that you removed all spaces from the App Password and that it's exactly 16 characters long.
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="font-medium text-sm mb-1">Need to revoke access?</p>
                  <p className="text-xs text-muted-foreground">
                    Go back to App Passwords page and delete the "TAMS" password entry. This immediately stops TAMS from sending emails.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
