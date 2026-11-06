// WhatsApp sharing utility
export interface BookingShareData {
  clientName: string;
  pnr?: string;
  airline?: string;
  flightDate?: Date | string;
  destination?: string;
  travelType?: string;
  phoneNumber?: string;
}

export const shareViaWhatsApp = (booking: BookingShareData) => {
  const date = booking.flightDate 
    ? new Date(booking.flightDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'N/A';

  const message = `
🎫 *Booking Confirmation*

👤 *Client:* ${booking.clientName}
${booking.pnr ? `📋 *PNR:* ${booking.pnr}` : ''}
${booking.airline ? `✈️ *Airline:* ${booking.airline}` : ''}
${booking.destination ? `📍 *Destination:* ${booking.destination}` : ''}
${booking.travelType ? `🧳 *Travel Type:* ${booking.travelType}` : ''}
📅 *Flight Date:* ${date}

Thank you for choosing our services!
  `.trim();

  const encodedMessage = encodeURIComponent(message);
  const phoneNumber = booking.phoneNumber?.replace(/[^0-9]/g, '') || '';
  
  // Use WhatsApp URL scheme
  const whatsappUrl = phoneNumber
    ? `https://wa.me/${phoneNumber}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;
  
  window.open(whatsappUrl, '_blank');
};

export const sendFlightReminderViaWhatsApp = (data: {
  clientName: string;
  flightDate: string;
  destination?: string;
  pnr?: string;
  travelType?: string;
  phoneNumber?: string;
  agencyPhone?: string;
}) => {
  const message = `
⏰ *FLIGHT REMINDER* ⏰

Dear ${data.clientName},

This is a friendly reminder about your upcoming flight:

✈️ *Flight Date:* ${data.flightDate}
${data.destination ? `📍 *Destination:* ${data.destination}` : ''}
${data.pnr ? `📋 *PNR:* ${data.pnr}` : ''}
${data.travelType ? `🧳 *Travel Type:* ${data.travelType}` : ''}

Please ensure you:
✓ Arrive at airport 3 hours before departure
✓ Carry your passport and documents
✓ Check-in online if available

Have a safe journey! 🛫
  `.trim();

  const encodedMessage = encodeURIComponent(message);
  const clientNumber = data.phoneNumber?.replace(/[^0-9]/g, '') || '';
  const agencyNumber = data.agencyPhone?.replace(/[^0-9]/g, '') || '';
  
  // Use agency phone if available, otherwise client's phone
  const targetNumber = agencyNumber || clientNumber;
  
  const whatsappUrl = targetNumber
    ? `https://wa.me/${targetNumber}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;
  
  window.open(whatsappUrl, '_blank');
};

export const copyBookingToClipboard = async (booking: BookingShareData): Promise<boolean> => {
  const date = booking.flightDate 
    ? new Date(booking.flightDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'N/A';

  const message = `
Booking Confirmation

Client: ${booking.clientName}
${booking.pnr ? `PNR: ${booking.pnr}` : ''}
${booking.airline ? `Airline: ${booking.airline}` : ''}
${booking.destination ? `Destination: ${booking.destination}` : ''}
${booking.travelType ? `Travel Type: ${booking.travelType}` : ''}
Flight Date: ${date}
  `.trim();

  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};
