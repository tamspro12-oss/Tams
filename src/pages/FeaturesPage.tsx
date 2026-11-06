import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plane,
  Calendar,
  Users,
  Receipt,
  BarChart3,
  Shield,
  Calculator,
  Mail,
  Wallet,
  ArrowLeft,
  ArrowRight,
  FileText,
  Globe,
  Smartphone,
  Cloud,
  Lock,
  Zap,
  CheckCircle2,
} from "lucide-react";

const coreFeatures = [
  {
    icon: Calendar,
    title: "Client Booking Management",
    description: "Complete booking lifecycle management from inquiry to completion.",
    details: [
      "Individual and group bookings",
      "PNR tracking and management",
      "Payment status tracking",
      "Name update reminders",
      "Flight date notifications",
    ],
  },
  {
    icon: Users,
    title: "B2B Agent Portal",
    description: "Manage your B2B agent network with complete transparency.",
    details: [
      "Agent registration and profiles",
      "Commission tracking",
      "Ledger management",
      "Payment reconciliation",
      "Agent-wise reporting",
    ],
  },
  {
    icon: Plane,
    title: "Vendor Management",
    description: "Track all vendor relationships and payments in one place.",
    details: [
      "Vendor profiles and contacts",
      "Payment tracking",
      "Outstanding balance management",
      "Aging reports",
      "Transaction history",
    ],
  },
  {
    icon: Receipt,
    title: "Expense Tracking",
    description: "Comprehensive expense management for your agency.",
    details: [
      "Categorized expenses",
      "Recurring expense support",
      "Payment mode tracking",
      "Bank-wise filtering",
      "Expense reports",
    ],
  },
  {
    icon: BarChart3,
    title: "Business Reports",
    description: "Detailed analytics and reports for informed decisions.",
    details: [
      "Profit & loss statements",
      "Revenue reports",
      "Collection reports",
      "Date-wise filtering",
      "Excel/PDF exports",
    ],
  },
  {
    icon: Calculator,
    title: "Smart Calculators",
    description: "Built-in tools for quick and accurate quotes.",
    details: [
      "Umrah package calculator",
      "Ticket payable calculator",
      "Currency conversion",
      "Margin calculations",
      "Quick quotations",
    ],
  },
  {
    icon: Mail,
    title: "Email Integration",
    description: "Professional communication directly from the system.",
    details: [
      "Booking confirmations",
      "Invoice emails",
      "Payment reminders",
      "Custom templates",
      "Email history tracking",
    ],
  },
  {
    icon: Wallet,
    title: "Bank & Cash Manager",
    description: "Centralized financial transaction tracking.",
    details: [
      "Multiple bank accounts",
      "Cash tracking",
      "Transaction categories",
      "Balance reconciliation",
      "Opening balance setup",
    ],
  },
];

const technicalFeatures = [
  {
    icon: Smartphone,
    title: "Mobile-First Design",
    description: "Works perfectly on phones, tablets, and desktops with responsive layouts.",
  },
  {
    icon: Cloud,
    title: "Cloud Storage",
    description: "All data securely stored in the cloud with automatic backups.",
  },
  {
    icon: Globe,
    title: "Works Offline",
    description: "Continue working during internet outages with automatic sync when online.",
  },
  {
    icon: Lock,
    title: "Role-Based Access",
    description: "Create sub-users with granular permissions for different team members.",
  },
  {
    icon: FileText,
    title: "PDF Generation",
    description: "Generate professional invoices and booking confirmations instantly.",
  },
  {
    icon: Zap,
    title: "Real-time Sync",
    description: "All changes sync instantly across all devices and sessions.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <SeoHead title="Features - TAMS Pro Travel Agency Software" description="Explore TAMS Pro features: booking management, B2B agents, vendors, invoices, expenses, financial reports and offline-ready cloud sync." path="/features" jsonLd={{"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "TAMS Pro", "applicationCategory": "BusinessApplication", "operatingSystem": "Web, iOS, Android", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}} />
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md">
              <Plane className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <span className="block font-bold text-lg">TAMS PRO</span>
              <p className="text-xs text-muted-foreground hidden sm:block">Travel Agency Management System</p>
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
            <Zap className="h-4 w-4 mr-2 text-primary" />
            Complete Feature Set
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Everything Your Agency Needs
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            TAMS PRO is built specifically for travel agencies with features designed 
            for real-world workflows.
          </p>
        </div>
      </section>

      {/* Core Features */}
      <section className="container px-4 md:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Core Features</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Comprehensive tools for every aspect of your travel agency operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {coreFeatures.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feature.details.map((detail, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Technical Features */}
      <section className="bg-muted/30 border-y">
        <div className="container px-4 md:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built for Modern Agencies</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Technical features that make TAMS PRO reliable and efficient
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {technicalFeatures.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-background border">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container px-4 md:px-8 py-16">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <Shield className="h-12 w-12 mx-auto text-primary" />
          <h2 className="text-3xl font-bold">Ready to Get Started?</h2>
          <p className="text-muted-foreground">
            Contact us to set up your agency account and start managing your business efficiently.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="gap-2 px-8">
                Sign Up Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="gap-2 px-8">
                Login
              </Button>
            </Link>
          </div>
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
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} TAMS Pro</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
