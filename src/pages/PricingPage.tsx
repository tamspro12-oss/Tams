import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plane,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Shield,
  Zap,
} from "lucide-react";

const plans = [
  {
    name: "Monthly",
    originalPrice: "1,999",
    price: "999",
    description: "Perfect for trying out TAMS PRO",
    duration: "/ month",
    discountLabel: "50% OFF",
    features: [
      "All core features",
      "Up to 2 sub-users",
      "Email integration",
      "Cloud backup",
      "Mobile access",
      "Email support",
    ],
    popular: false,
  },
  {
    name: "Yearly",
    originalPrice: "19,999",
    price: "9,999",
    description: "Best value for growing agencies",
    duration: "/ year",
    discountLabel: "50% OFF",
    features: [
      "Everything in Monthly",
      "Priority support",
      "Advanced reports",
      "Unlimited bookings",
      "Custom branding",
      "2 months free",
    ],
    popular: true,
  },
];

const faqs = [
  {
    question: "How do I get access to TAMS PRO?",
    answer: "TAMS PRO uses admin-controlled access. Contact us to set up your agency account with your preferred subscription plan.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes, absolutely. Your data is stored securely in the cloud with Row-Level Security (RLS) ensuring complete isolation. No other user can access your data.",
  },
  {
    question: "Can I add team members?",
    answer: "Yes, you can create up to 2 sub-users per agency with granular permissions to control what each team member can access.",
  },
  {
    question: "What happens if my subscription expires?",
    answer: "You'll be redirected to a subscription renewal page. Your data remains safe and will be accessible once you renew.",
  },
  {
    question: "Can I export my data?",
    answer: "Yes, you can export your data in JSON format anytime. Reports can also be exported to Excel and PDF.",
  },
  {
    question: "Is there a mobile app?",
    answer: "TAMS PRO is a Progressive Web App (PWA) that works like a native app on any device. Install it directly from your browser.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <SeoHead title="Pricing - TAMS Pro Travel Agency Management" description="Simple, transparent pricing for travel agencies. Start free, upgrade when you grow. Monthly and annual plans available." path="/pricing" />
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
            <Zap className="h-4 w-4 mr-2 text-primary" />
            Simple Pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transparent pricing with no hidden fees. All plans include full access to TAMS PRO features.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-4 space-y-1">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-semibold">
                    {plan.discountLabel}
                  </Badge>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-lg text-muted-foreground line-through">PKR {plan.originalPrice}</span>
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-sm text-muted-foreground font-medium">PKR</span>
                    <span className="text-4xl font-bold text-primary">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.duration}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className="block pt-4">
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                  >
                    Get Started
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-muted/30 border-y">
        <div className="container px-4 md:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about TAMS PRO
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {faqs.map((faq, index) => (
              <div key={index} className="p-6 rounded-lg bg-background border">
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container px-4 md:px-8 py-16">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <Shield className="h-12 w-12 mx-auto text-primary" />
          <h2 className="text-3xl font-bold">Need a Custom Solution?</h2>
          <p className="text-muted-foreground">
            Contact us for enterprise pricing or custom requirements.
          </p>
          <Link to="/contact">
            <Button size="lg" className="gap-2 px-8">
              Get in Touch
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
