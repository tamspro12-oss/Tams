import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeoHead } from "@/components/SeoHead";
import { ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <SeoHead title="Privacy Policy - TAMS Pro" description="How TAMS Pro collects, uses, and protects your travel agency data. Read our privacy policy and data handling practices." path="/privacy" />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={() => navigate('/app/settings')}
            size="lg"
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/app/settings')}
            size="sm"
          >
            Go to Settings
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-semibold leading-none tracking-tight">Privacy Policy</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Effective Date: November 25, 2025
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
              <p className="text-muted-foreground">
                Welcome to TAMS Pro, developed by TAMS Pro ("we", "our", "us"). This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our website (https://tamspro.online) and mobile app (PWA).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
              <p className="text-muted-foreground mb-2">We may collect the following information:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Personal info: Name, passport number, phone, email</li>
                <li>Booking details: Flight info, tickets, PNR, service type, payment status</li>
                <li>Vendor information: Name, service type, payment status (stored only in your private database)</li>
                <li>Device/browser info (optional for analytics)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>To provide travel agency management services, bookings, invoices, and client notifications</li>
                <li>To communicate booking updates via email or WhatsApp</li>
                <li>Internal analytics for improving services</li>
                <li>All data is used exclusively for your agency operations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Data Storage & Security</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>All data is stored securely on Supabase cloud storage with enterprise-grade encryption</li>
                <li>Your data is completely isolated - no other user can access your information</li>
                <li>Row-Level Security (RLS) ensures strict data isolation between agencies</li>
                <li>Session management: auto logout, secure tokens, one device at a time</li>
                <li>Regular automated backups for data protection</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Data Sharing & Third Parties</h2>
              <p className="text-muted-foreground font-semibold mb-2">
                We DO NOT share your data with any third parties, vendors, or other users.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Your client, booking, and vendor information remains completely private to your agency</li>
                <li>No external parties have access to your database</li>
                <li>Data may only be disclosed if legally required by law enforcement</li>
                <li>We never sell, rent, or trade your personal information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Subscription Model</h2>
              <p className="text-muted-foreground mb-2">
                TAMS operates on a subscription-based model:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Monthly and yearly subscription plans available</li>
                <li>All your data is stored in secure Supabase cloud storage during active subscription</li>
                <li>Data remains private and isolated to your account only</li>
                <li>You maintain full ownership of your data</li>
                <li>Export functionality available to download your data anytime</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. User Rights</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Access, update, or delete your personal data directly from your account settings</li>
                <li>You can permanently delete your account and all associated data yourself at any time</li>
                <li>Export all your data in JSON format at any time</li>
                <li>Request assistance with data management by contacting tamspro12@gmail.com</li>
                <li>Opt-out of notifications anytime</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Cookies / Tracking</h2>
              <p className="text-muted-foreground">
                Our website may use cookies for essential features and analytics only. No tracking cookies are used for advertising.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Children's Privacy</h2>
              <p className="text-muted-foreground">
                TAMS is not intended for children under 13
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Changes to Policy</h2>
              <p className="text-muted-foreground">
                We may update this policy. Changes will be posted here with the updated effective date. Users will be notified of significant changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Contact</h2>
              <p className="text-muted-foreground">
                Questions or concerns? Contact us at:{" "}
                <a href="mailto:tamspro12@gmail.com" className="text-primary hover:underline">
                  tamspro12@gmail.com
                </a>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
