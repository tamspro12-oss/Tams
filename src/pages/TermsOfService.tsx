import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeoHead } from "@/components/SeoHead";
import { ArrowLeft, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <SeoHead title="Terms of Service - TAMS Pro" description="Terms and conditions for using TAMS Pro travel agency management software. Review acceptable use and license terms." path="/terms" />
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
              <Scale className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-semibold leading-none tracking-tight">Terms of Service</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Effective Date: November 25, 2025
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using TAMS, you agree to these Terms of Service. TAMS is developed by TAMS Developers as a subscription-based travel agency management solution.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Subscription Model</h2>
              <p className="text-muted-foreground mb-2">
                TAMS operates on a subscription-based model:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Monthly and yearly subscription plans are available</li>
                <li>All data is securely stored in Supabase cloud storage during active subscription</li>
                <li>Your data is completely private and isolated - accessible only by you</li>
                <li>No other users, third parties, or vendors have access to your data</li>
                <li>Subscription fees are non-refundable except as required by law</li>
                <li>You may cancel your subscription at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Data Ownership & Privacy</h2>
              <p className="text-muted-foreground font-semibold mb-2">
                Your data remains your property at all times.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>All client, booking, vendor, and payment data belongs exclusively to you</li>
                <li>Your data is isolated with Row-Level Security (RLS) - no other user can access it</li>
                <li>We do NOT share, sell, or rent your data to any third parties</li>
                <li>You can export your data in JSON format at any time</li>
                <li>Upon account deletion, all your data is permanently removed</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. User Responsibilities</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Provide accurate personal and booking information</li>
                <li>Do not use TAMS for any illegal purposes</li>
                <li>Maintain the confidentiality of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Payments & Refunds</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Subscription payments are processed securely</li>
                <li>Payment status for your clients is managed within the system (Paid / Pending)</li>
                <li>Refunds handled case by case; contact support</li>
                <li>You are responsible for ensuring payment accuracy</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Service Availability</h2>
              <p className="text-muted-foreground">
                We strive to maintain 24/7 service availability but cannot guarantee uninterrupted access. Scheduled maintenance will be communicated in advance when possible.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>TAMS and TAMS Developers are not liable for indirect or incidental losses</li>
                <li>We ensure reasonable effort to protect your data and services</li>
                <li>We are not responsible for third-party service failures</li>
                <li>Maximum liability limited to subscription fees paid</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Data Backup</h2>
              <p className="text-muted-foreground">
                While we maintain automated cloud backups, you are responsible for maintaining your own backup copies of critical data. We recommend using the export features regularly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Intellectual Property</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>TAMS Pro content, design, and branding are owned by TAMS Pro</li>
                <li>Users may not copy, modify, or redistribute without permission</li>
                <li>Your uploaded data remains your property</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Account Termination</h2>
              <p className="text-muted-foreground mb-2">
                We reserve the right to suspend or terminate accounts that violate these terms.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>You can delete your own account and all data directly from account settings at any time</li>
                <li>Account deletion is permanent and cannot be undone</li>
                <li>All your data is completely removed upon deletion</li>
                <li>For assistance, contact tamspro12@gmail.com</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Governing Law</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>These Terms are governed by the laws of Pakistan</li>
                <li>Any disputes will be resolved under Pakistani jurisdiction</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may update these Terms. Users will be notified of changes via the app or website. Continued use after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Contact</h2>
              <p className="text-muted-foreground">
                For questions or support:{" "}
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
