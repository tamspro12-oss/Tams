import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plane,
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  Clock,
  MessageSquare,
} from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <SeoHead title="Contact TAMS Pro - Get in Touch" description="Contact the TAMS Pro team for support, sales, or partnership inquiries. We help travel agencies run smoother every day." path="/contact" jsonLd={{"@context": "https://schema.org", "@type": "Organization", "name": "TAMS Pro", "url": "https://imkaantams.online", "contactPoint": {"@type": "ContactPoint", "contactType": "customer support", "email": "support@tamspro.online", "availableLanguage": ["English"]}}} />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md">
              <Plane className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <span className="block font-bold text-lg">TAMS PRO</span>
              <p className="text-xs text-muted-foreground hidden sm:block">Travel Agency Management</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="gap-2">
                Login
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4 mr-2 text-primary" />
            Get in Touch
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Contact Us
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Ready to transform your travel agency operations? Reach out to us for account setup, 
            support, or any questions.
          </p>
        </div>
      </section>

      {/* Contact Options */}
      <section className="container px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Email */}
          <Card className="text-center">
            <CardHeader>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Email Us</CardTitle>
              <CardDescription>For general inquiries and support</CardDescription>
            </CardHeader>
            <CardContent>
              <a 
                href="mailto:tamspro12@gmail.com" 
                className="text-primary hover:underline font-medium"
              >
                tamspro12@gmail.com
              </a>
              <p className="text-sm text-muted-foreground mt-2">
                We typically respond within 24 hours
              </p>
            </CardContent>
          </Card>

          {/* Phone */}
          <Card className="text-center">
            <CardHeader>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>WhatsApp</CardTitle>
              <CardDescription>Quick support via messaging</CardDescription>
            </CardHeader>
            <CardContent>
              <a 
                href="https://wa.me/923190846768" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Chat on WhatsApp
              </a>
              <p className="text-sm text-muted-foreground mt-2">
                Available during business hours
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Account Request */}
      <section className="bg-muted/30 border-y">
        <div className="container px-4 md:px-8 py-16">
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Request Account Access</CardTitle>
                <CardDescription>
                  TAMS PRO uses admin-controlled access for security. Contact us to set up your agency account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      New Agency Setup
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Get your agency account created with your preferred subscription plan. 
                      We'll provide your login credentials securely.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Support & Questions
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Have questions about features, pricing, or technical requirements? 
                      We're here to help.
                    </p>
                  </div>
                </div>

                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Sign up now or contact us for enterprise solutions.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Link to="/signup">
                      <Button size="lg" className="gap-2 px-8">
                        <Mail className="h-5 w-5" />
                        Sign Up Free
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Already have account */}
      <section className="container px-4 md:px-8 py-16">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold">Already Have an Account?</h2>
          <p className="text-muted-foreground">
            If you already have TAMS PRO credentials, you can log in directly.
          </p>
          <Link to="/login">
            <Button variant="outline" size="lg" className="gap-2 px-8">
              Go to Login
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container px-4 md:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Plane className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">TAMS PRO</span>
            </div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} TAMS Pro</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
