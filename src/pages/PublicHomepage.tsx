import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { BRANDING } from "@/lib/brandingConstants";
import { ScrollAnimation } from "@/hooks/useScrollAnimation";
import {
  Plane,
  Calendar,
  Users,
  Receipt,
  BarChart3,
  Shield,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const features = [
  { icon: Calendar, title: "Bookings" },
  { icon: Users, title: "B2B Agents" },
  { icon: Plane, title: "Vendors" },
  { icon: Receipt, title: "Expenses" },
  { icon: BarChart3, title: "Reports" },
];

export default function PublicHomepage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <SeoHead title="TAMS Pro - Travel Agency Management System" description="All-in-one travel agency software for bookings, vendors, invoices, expenses and reports. Built for travel agencies worldwide." path="/" jsonLd={[{"@context": "https://schema.org", "@type": "Organization", "name": "TAMS Pro", "url": "https://imkaantams.online", "logo": "https://imkaantams.online/icons/tams-icon-512.png"}, {"@context": "https://schema.org", "@type": "WebSite", "name": "TAMS Pro", "url": "https://imkaantams.online"}]} />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md">
              <Plane className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <span className="block font-bold text-lg">TAMS PRO</span>
              <p className="text-xs text-muted-foreground hidden sm:block">Travel Agency Management System</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/signup">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                Sign Up
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

      <main>
      {/* Hero Section with Animated Gradient */}
      <section className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        </div>
        
        <div className="container px-4 md:px-8 py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <ScrollAnimation animation="fade-up">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
                Travel Agency Management System
              </h1>
            </ScrollAnimation>
            
            <ScrollAnimation animation="fade-up" delay={100}>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Manage bookings, vendors, invoices & reports in one secure platform.
              </p>
            </ScrollAnimation>

            <ScrollAnimation animation="fade-up" delay={200}>
              <div className="flex items-center justify-center gap-4 pt-4">
                <Link to="/login">
                  <Button 
                    size="lg" 
                    className="gap-2 shadow-lg"
                  >
                    Login
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="outline" size="lg">
                    Sign Up Free
                  </Button>
                </Link>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* Key Benefits - Simplified */}
      <section className="border-t">
        <div className="container px-4 md:px-8 py-12">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                "Built for Travel Agencies",
                "Offline + Cloud Ready",
                "Secure & Private",
                "Professional Invoices",
                "Works on All Devices",
                "Works Globally",
              ].map((item, index) => (
                <ScrollAnimation key={index} animation="fade-up" delay={index * 50}>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                </ScrollAnimation>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid - Compact */}
      <section className="container px-4 md:px-8 py-12">
        <ScrollAnimation animation="fade-up">
          <h2 className="text-2xl font-bold text-center mb-8">Core Features</h2>
        </ScrollAnimation>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {features.slice(0, 4).map((feature, index) => (
            <ScrollAnimation key={index} animation="scale-in" delay={index * 100}>
              <Card className="border-border/50 hover:shadow-md transition-shadow duration-300">
                <CardContent className="p-4 text-center space-y-2">
                  <div className="w-10 h-10 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-medium text-sm">{feature.title}</h3>
                </CardContent>
              </Card>
            </ScrollAnimation>
          ))}
        </div>
        <ScrollAnimation animation="fade-in" delay={400}>
          <div className="text-center mt-6">
            <Link to="/features">
              <Button variant="link" className="gap-1 text-sm">
                View All Features
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </ScrollAnimation>
      </section>

      {/* Trust Section - Minimal */}
      <section className="border-t bg-muted/30">
        <div className="container px-4 md:px-8 py-10">
          <ScrollAnimation animation="fade-up">
            <div className="max-w-2xl mx-auto text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-medium">Secure & Private</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Built by travel industry professionals. Your data stays protected with enterprise-grade security.
              </p>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* CTA Section - Simple */}
      <section className="container px-4 md:px-8 py-12">
        <ScrollAnimation animation="fade-up">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <h2 className="text-xl font-semibold">
              Ready to get started?
            </h2>
            <div className="flex items-center justify-center gap-3">
              <Link to="/login">
                <Button className="gap-2">
                  Login
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="outline">Sign Up Free</Button>
              </Link>
            </div>
          </div>
        </ScrollAnimation>
      </section>
      </main>

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
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/features" className="hover:text-foreground transition-colors">
                Features
              </Link>
              <Link to="/pricing" className="hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link to="/contact" className="hover:text-foreground transition-colors">
                Contact
              </Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>

            <p className="text-sm text-muted-foreground">
              {BRANDING.copyright}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
