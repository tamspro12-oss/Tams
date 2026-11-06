import { corsHeaders } from '../_shared/cors.ts';

const CURRENT_VERSION = '3.5.0'; // Update this with each deployment

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📱 Version check requested');

    const response = {
      version: CURRENT_VERSION,
      timestamp: new Date().toISOString(),
      changelog: {
        '3.5.0': [
          'Complete Settings Redesign: clean zero-scroll layout with 5 prominent top tabs (Account, Branding, Email Integration, Storage & Backup, User Manual)',
          'Global removal of WhatsApp Integration, Meta credentials, and WhatsApp Business Number fields',
          'Relocated Theme Changer to Global Top Header Bar alongside Notification Bell and Online indicator',
          'Automatic responsive views globally: defaults to desktop layout on desktop screens and mobile on phones',
          'Template auto-population: Agency Name, Phone, and Email automatically populated from signup profile across Invoice, Booking, and Reminder templates',
          'Unified Email Integration: clean sub-tabs for Email Configuration, Email Logs History, and Email Cleanup',
        ],
        '3.4.1': [
          'Compact single-bar control header for Umrah Package Calculator',
          'Streamlined Passengers and Service Charges row with Profit field removed',
          'Root-cause fix for multi-hotel combination bug (all Makkah & Madinah hotels stay visible and counted in totals)',
          'Direct 1-click Quotation creation from calculator into quotation form',
        ],
        '3.4.0': [
          'Action-Driven Dashboard: 5-button Quick Actions bar for instant bookings, payments, quotes, queries, and expenses',
          'Financials Above-the-Fold: Unified B2C + B2B aggregations with Net Profit KPI card and clean 3-column financial & payables grid',
          'Conditional Actionable Alerts: Smart slim banner for urgent items, hiding automatically when clear of alerts',
          'Consolidated Navbar Notification Bell: Real-time tabs for Departures (Tickets & Umrah), Name Updates, Active Queries, and Tasks',
          'Interactive Empty States: Direct inline "+ Receive Payment" and "+ Pay Vendor" buttons inside alerts and payables widgets',
        ],
        '3.3.1': [
          'Sidebar-proof Umrah Calculator redesign using container queries',
          'Fintech-style unified layout with soft tints and tabular figures',
          'Shared hotel grid aligning Makkah & Madinah columns with header',
          'Equal 5-card layout for tickets, visas, transport, ziyarat & food',
          'Streamlined summary strip with prominent Final Total',
        ],
        '3.3.0': [
          'Redesigned Queries & Quotes Hub with primary Quotations tab and segmented pill switcher',
          'Full-page keyboard-first New Quotation & Query creation forms with shortcuts',
          'Manual free-text quotation numbering with uniqueness check and last-used helper',
          'Date Preset filtering (Today, Yesterday, Week, Month, Year, Custom Range)',
          'Instant Umrah Calculator package import and quotation-to-booking conversion',
        ],
        '3.2.1': [
          'Unified single-screen Umrah Package Calculator layout',
          'Keyboard-first data entry and shortcuts (Ctrl+S, Ctrl+Enter)',
        ],
        '3.2.0': [
          'Professional update system with iOS support',
          'Auto-sync and pull-to-refresh gestures',
          'Enhanced mobile experience with haptic feedback',
          'Improved performance and caching',
        ],
        '3.1.1': [
          'Improved mobile UI with better spacing',
          'Enhanced calculator layout for mobile',
          'Fixed Settings/Storage button accessibility',
        ],
      },
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        } 
      }
    );
  } catch (error) {
    console.error('❌ Version check error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check version' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
