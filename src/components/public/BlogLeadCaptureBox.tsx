import React, { useState } from "react";
import { MessageCircle, Send, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONTACT_CHANNELS } from "@/config/marketingContent";
import { submitBlogLead } from "@/lib/blogs";

interface BlogLeadCaptureBoxProps {
  sourceSlug?: string;
  articleTitle?: string;
}

export const BlogLeadCaptureBox: React.FC<BlogLeadCaptureBoxProps> = ({
  sourceSlug,
  articleTitle,
}) => {
  const [agencyName, setAgencyName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const whatsappText = encodeURIComponent(
    articleTitle
      ? `Assalam-o-Alaikum, I read "${articleTitle}" on TAMS Pro and would like a quick demo for my travel agency.`
      : "Assalam-o-Alaikum, I would like a quick TAMS Pro walkthrough for my travel agency."
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const { success, error } = await submitBlogLead({
        agencyName,
        whatsapp,
        email,
        sourceSlug,
      });
      if (!success || error) {
        toast.error(error || "Please check your agency name and WhatsApp number.");
        return;
      }
      setSubmitted(true);
      toast.success("Request sent! Our team will message you on WhatsApp shortly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="mt-8 tams-card rounded-2xl bg-white p-6 sm:p-8"
      aria-labelledby="blog-lead-capture-heading"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-lg">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[#0F5E63] block mb-1.5">
            FREE AGENCY WALKTHROUGH
          </span>
          <h2
            id="blog-lead-capture-heading"
            className="text-lg sm:text-xl font-bold text-[#0F172A] tracking-tight"
          >
            Want a quick WhatsApp setup walkthrough for your agency?
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-[#475569] leading-relaxed">
            Get travel agency growth tips plus a 10-minute live setup call—PKR 1,999/month, or PKR 9,999/year with 50% off on the yearly plan.
          </p>
        </div>

        {submitted ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-teal-50 border border-teal-200/70 text-[#0F5E63] shrink-0">
            <CheckCircle2 className="w-5 h-5 shrink-0" strokeWidth={1.75} />
            <div className="text-xs sm:text-sm font-semibold">
              Thanks! We will reach out on WhatsApp shortly.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full lg:max-w-md space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Your Agency Name *"
                aria-label="Agency Name"
                required
                className="tams-public-search-input h-10 rounded-xl text-xs sm:text-sm"
              />
              <Input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp (03XX-XXXXXXX) *"
                aria-label="WhatsApp Number"
                required
                className="tams-public-search-input h-10 rounded-xl text-xs sm:text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                aria-label="Email Address"
                className="tams-public-search-input h-10 rounded-xl text-xs sm:text-sm flex-1"
              />
              <Button
                type="submit"
                disabled={submitting}
                className="tams-btn-primary h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold gap-1.5 shrink-0"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" strokeWidth={1.75} />
                )}
                <span>Request Walkthrough</span>
              </Button>
            </div>

            <div className="pt-0.5 flex items-center justify-between text-xs text-[#64748B]">
              <span>Prefer direct chat?</span>
              <a
                href={`${CONTACT_CHANNELS.whatsapp.href}?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-[#0F5E63] hover:text-[#0B4A4E]"
              >
                <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Chat on WhatsApp</span>
              </a>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};

