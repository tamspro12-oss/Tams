import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useViewMode } from "@/contexts/ViewModeContext";

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const { viewMode, setViewMode } = useViewMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          App Appearance
        </CardTitle>
        <CardDescription>
          Choose theme and layout preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Color Theme</Label>
          <RadioGroup value={theme} onValueChange={setTheme}>
            <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="light" id="light" />
              <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer flex-1">
                <Sun className="h-4 w-4" />
                Light
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="dark" id="dark" />
              <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer flex-1">
                <Moon className="h-4 w-4" />
                Dark
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        {/* View Mode Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Layout View</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Choose between desktop or mobile layout
          </p>
          <RadioGroup value={viewMode} onValueChange={(value) => setViewMode(value as 'desktop' | 'mobile')}>
            <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="desktop" id="view-desktop" />
              <Label htmlFor="view-desktop" className="flex items-center gap-2 cursor-pointer flex-1">
                <Monitor className="h-4 w-4" />
                Desktop View
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="mobile" id="view-mobile" />
              <Label htmlFor="view-mobile" className="flex items-center gap-2 cursor-pointer flex-1">
                <Smartphone className="h-4 w-4" />
                Mobile View
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
