import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plane, ArrowLeft, Smartphone, Monitor, Apple, Chrome, Share, Plus, MoreVertical, Download, Menu, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { SeoHead } from "@/components/SeoHead";

type DeviceType = "iphone" | "android" | "desktop";

function detectDevice(): DeviceType {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iphone";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export default function Install() {
  const [activeTab, setActiveTab] = useState<DeviceType>("desktop");
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();

  useEffect(() => {
    setActiveTab(detectDevice());
  }, []);

  const handleInstallClick = async () => {
    if (canInstall) {
      await triggerInstall();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SeoHead title="Install TAMS Pro App - iPhone, Android & Desktop" description="Step-by-step guide to install the TAMS Pro travel agency app on iPhone, Android or desktop for faster, offline-ready access." path="/install" />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md">
              <Plane className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <span className="block font-bold text-lg">TAMS</span>
              <p className="text-xs text-muted-foreground">Travel Agency Management</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/auth">
              <Button variant="outline" size="sm" className="gap-2">
                Login
              </Button>
            </Link>
            <Link to="/">
              <Button variant="default" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to App
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">
            Install Guide
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Install TAMS on Your Device
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get the full app experience with offline access, faster loading, and native-like features. 
            Choose your device below for step-by-step instructions.
          </p>

          {/* Quick Install Button for supported browsers */}
          {canInstall && !isInstalled && (
            <div className="mt-6">
              <Button size="lg" onClick={handleInstallClick} className="gap-2 shadow-lg">
                <Download className="w-5 h-5" />
                Install Now (One Click)
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Your browser supports instant installation!
              </p>
            </div>
          )}

          {isInstalled && (
            <div className="mt-6">
              <Badge variant="default" className="text-base px-4 py-2 bg-green-500/10 text-green-600 border-green-500/20">
                ✓ TAMS is already installed on this device
              </Badge>
            </div>
          )}
        </div>

        {/* Device Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DeviceType)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 h-auto p-1">
            <TabsTrigger value="iphone" className="flex flex-col gap-1 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Apple className="w-5 h-5" />
              <span className="text-xs sm:text-sm">iPhone/iPad</span>
            </TabsTrigger>
            <TabsTrigger value="android" className="flex flex-col gap-1 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Smartphone className="w-5 h-5" />
              <span className="text-xs sm:text-sm">Android</span>
            </TabsTrigger>
            <TabsTrigger value="desktop" className="flex flex-col gap-1 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Monitor className="w-5 h-5" />
              <span className="text-xs sm:text-sm">Desktop</span>
            </TabsTrigger>
          </TabsList>

          {/* iPhone Instructions */}
          <TabsContent value="iphone" className="space-y-6">
            <Card className="border-2 border-primary/20">
              <CardHeader className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Apple className="w-6 h-6" />
                  Install on iPhone or iPad
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Using Safari Browser (Required)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    ⚠️ Important: You must use Safari browser on iOS to install the app. 
                    Chrome or other browsers don't support PWA installation on iOS.
                  </p>
                </div>

                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Open TAMS in Safari</h3>
                    <p className="text-muted-foreground mb-3">
                      Navigate to <code className="bg-muted px-2 py-1 rounded text-sm">tamspro.online</code> in Safari browser.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
                      <Chrome className="w-8 h-8 text-blue-500" />
                      <span className="text-sm">Make sure you're using Safari, not Chrome or other browsers</span>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Tap the Share Button</h3>
                    <p className="text-muted-foreground mb-3">
                      Look for the Share icon at the bottom of your screen (or top on iPad).
                    </p>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Share className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium">Tap this Share button in Safari</span>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Select "Add to Home Screen"</h3>
                    <p className="text-muted-foreground mb-3">
                      Scroll down in the share menu and tap "Add to Home Screen".
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-background border rounded-lg flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">Add to Home Screen</span>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    4
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Tap "Add" to Confirm</h3>
                    <p className="text-muted-foreground mb-3">
                      You can rename the app if you want, then tap "Add" in the top right corner.
                    </p>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                        ✓ Done! TAMS will appear on your home screen like any other app.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Android Instructions */}
          <TabsContent value="android" className="space-y-6">
            <Card className="border-2 border-primary/20">
              <CardHeader className="bg-gradient-to-r from-green-600 to-green-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-6 h-6" />
                  Install on Android
                </CardTitle>
                <CardDescription className="text-green-100">
                  Using Chrome Browser (Recommended)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Open TAMS in Chrome</h3>
                    <p className="text-muted-foreground mb-3">
                      Navigate to <code className="bg-muted px-2 py-1 rounded text-sm">tamspro.online</code> in Chrome browser.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
                      <Chrome className="w-8 h-8 text-blue-500" />
                      <span className="text-sm">Chrome works best for Android PWA installation</span>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Tap the Menu Button</h3>
                    <p className="text-muted-foreground mb-3">
                      Look for the three dots (⋮) in the top right corner of Chrome.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-background border rounded-lg flex items-center justify-center">
                        <MoreVertical className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">Tap the three-dot menu</span>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Select "Install App" or "Add to Home Screen"</h3>
                    <p className="text-muted-foreground mb-3">
                      You might see "Install app" banner at the bottom, or find it in the menu.
                    </p>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Download className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-medium">Install app / Add to Home screen</span>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    4
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Confirm Installation</h3>
                    <p className="text-muted-foreground mb-3">
                      Tap "Install" in the confirmation dialog.
                    </p>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                        ✓ Done! TAMS will be installed and appear in your app drawer.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Alternative */}
                <div className="bg-muted/30 rounded-lg p-4 mt-4">
                  <h4 className="font-medium mb-2">💡 Quick Tip</h4>
                  <p className="text-sm text-muted-foreground">
                    Some Android phones show an "Install" banner at the bottom of the screen automatically. 
                    Just tap it for instant installation!
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Desktop Instructions */}
          <TabsContent value="desktop" className="space-y-6">
            <Card className="border-2 border-primary/20">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="w-6 h-6" />
                  Install on Desktop
                </CardTitle>
                <CardDescription className="text-blue-100">
                  Using Chrome, Edge, or Brave Browser
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Quick Install */}
                {canInstall && !isInstalled && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 text-center">
                    <h3 className="font-semibold text-lg mb-3">🎉 Quick Install Available!</h3>
                    <p className="text-muted-foreground mb-4">
                      Your browser supports one-click installation.
                    </p>
                    <Button size="lg" onClick={handleInstallClick} className="gap-2">
                      <Download className="w-5 h-5" />
                      Install TAMS Now
                    </Button>
                  </div>
                )}

                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Open TAMS in Your Browser</h3>
                    <p className="text-muted-foreground mb-3">
                      Navigate to <code className="bg-muted px-2 py-1 rounded text-sm">tamspro.online</code> in Chrome, Edge, or Brave.
                    </p>
                    <div className="flex gap-3">
                      <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2 flex-1">
                        <Chrome className="w-6 h-6 text-blue-500" />
                        <span className="text-sm">Chrome</span>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2 flex-1">
                        <Monitor className="w-6 h-6 text-blue-600" />
                        <span className="text-sm">Edge</span>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2 flex-1">
                        <ExternalLink className="w-6 h-6 text-orange-500" />
                        <span className="text-sm">Brave</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Look for Install Icon or Menu</h3>
                    <p className="text-muted-foreground mb-3">
                      Look for an install icon in the address bar, or click the menu (⋮).
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm mb-2">In Chrome/Edge, look for:</p>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li>• Install icon (⊕) in the address bar</li>
                        <li>• Menu → "Install TAMS..."</li>
                        <li>• Menu → "More tools" → "Create shortcut..."</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Click "Install" in Dialog</h3>
                    <p className="text-muted-foreground mb-3">
                      A confirmation dialog will appear. Click "Install" to continue.
                    </p>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                        ✓ Done! TAMS will open in its own window like a native app.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    ⚠️ Note: Firefox and Safari on Mac don't fully support PWA installation. 
                    Use Chrome, Edge, or Brave for the best experience.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Benefits Section */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-6">Why Install TAMS?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Native App Feel</h3>
              <p className="text-sm text-muted-foreground">
                Fullscreen experience without browser UI clutter
              </p>
            </Card>
            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Faster Loading</h3>
              <p className="text-sm text-muted-foreground">
                Assets are cached for instant startup
              </p>
            </Card>
            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Menu className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Easy Access</h3>
              <p className="text-sm text-muted-foreground">
                Launch from home screen or taskbar
              </p>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} TAMS Pro - Travel Agency Management System</p>
        <div className="flex gap-4 justify-center mt-2">
          <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
