import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, User, Mail, Phone, Package, Send, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RequestAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestAccessDialog({ open, onOpenChange }: RequestAccessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    agencyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    plan: "",
    message: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.agencyName.trim()) {
      toast.error("Agency name is required");
      return;
    }
    if (!formData.contactPerson.trim()) {
      toast.error("Contact person name is required");
      return;
    }
    if (!formData.email.trim()) {
      toast.error("Email address is required");
      return;
    }
    if (!formData.phone.trim()) {
      toast.error("Phone/WhatsApp number is required");
      return;
    }
    if (!formData.plan) {
      toast.error("Please select a plan");
      return;
    }

    setLoading(true);

    try {
      // Build the mailto link with all form data
      const subject = encodeURIComponent(`TAMS PRO Account Request - ${formData.agencyName}`);
      const body = encodeURIComponent(
        `New Account Request

Agency Name: ${formData.agencyName}
Contact Person: ${formData.contactPerson}
Email: ${formData.email}
Phone/WhatsApp: ${formData.phone}
Selected Plan: ${formData.plan}

Additional Message:
${formData.message || "No additional message"}

---
Sent from TAMS PRO Request Access Form`
      );

      // Open email client with pre-filled data
      window.location.href = `mailto:tamspro12@gmail.com?subject=${subject}&body=${body}`;

      // Show success state
      setTimeout(() => {
        setLoading(false);
        setSubmitted(true);
      }, 500);

    } catch (error) {
      setLoading(false);
      toast.error("Failed to submit request. Please try again.");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form after dialog closes
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        agencyName: "",
        contactPerson: "",
        email: "",
        phone: "",
        plan: "",
        message: "",
      });
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-y-auto">
        {submitted ? (
          // Success State
          <div className="py-8 text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary">
                Request Submitted!
              </h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Your email client should have opened with your request. Please send the email to complete your request.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>Our team will review your request and get back to you within <strong>24-48 hours</strong>.</p>
            </div>
            <Button onClick={handleClose} className="w-full max-w-xs">
              Close
            </Button>
          </div>
        ) : (
          // Form State
          <>
            <DialogHeader className="pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">
                    Request Account Access
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Fill in your details to request a TAMS PRO account
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5 pt-4">
              {/* Agency Name */}
              <div className="space-y-2">
                <Label htmlFor="agencyName" className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Agency Name *
                </Label>
                <Input
                  id="agencyName"
                  placeholder="Your Travel Agency Name"
                  value={formData.agencyName}
                  onChange={(e) => handleInputChange("agencyName", e.target.value)}
                  className="h-11"
                />
              </div>

              {/* Contact Person */}
              <div className="space-y-2">
                <Label htmlFor="contactPerson" className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Contact Person Name *
                </Label>
                <Input
                  id="contactPerson"
                  placeholder="Full Name"
                  value={formData.contactPerson}
                  onChange={(e) => handleInputChange("contactPerson", e.target.value)}
                  className="h-11"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="h-11"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  WhatsApp / Phone Number *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+92 300 1234567"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="h-11"
                />
              </div>

              {/* Plan Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  Select Plan *
                </Label>
                <Select
                  value={formData.plan}
                  onValueChange={(value) => handleInputChange("plan", value)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Choose your preferred plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="14 Day Free Trial">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">14 Day Free Trial</span>
                        <span className="text-muted-foreground text-xs">- Try all features</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Monthly">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Monthly</span>
                        <span className="text-muted-foreground text-xs">- 32 days access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Yearly">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Yearly</span>
                        <span className="text-muted-foreground text-xs">- Best value</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Message */}
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium">
                  Additional Message (Optional)
                </Label>
                <Textarea
                  id="message"
                  placeholder="Any specific requirements or questions..."
                  value={formData.message}
                  onChange={(e) => handleInputChange("message", e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Request
                  </>
                )}
              </Button>

              {/* Info Note */}
              <p className="text-xs text-muted-foreground text-center pt-2">
                Your request will be reviewed by our team. We'll contact you within 24-48 hours.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
