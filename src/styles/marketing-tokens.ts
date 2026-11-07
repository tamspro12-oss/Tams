// Marketing design tokens for TAMS Pro public pages
// Deep navy (#0B1530), ivory (#F8F6F1), slate greys, and champagne-gold accent (#C9A961)

export const MARKETING_TOKENS = {
  colors: {
    navy: {
      950: "#070D1E",
      900: "#0B1530",
      850: "#0E1B3B",
      800: "#122146",
      border: "#1A294E",
    },
    ivory: {
      bg: "#F8F6F1",
      surface: "#FFFFFF",
      border: "#E6E2D8",
    },
    gold: {
      DEFAULT: "#C9A961",
      hover: "#D8B86F",
      bgLight: "rgba(201, 169, 97, 0.10)",
      bgDark: "rgba(201, 169, 97, 0.15)",
      border: "rgba(201, 169, 97, 0.35)",
    },
    slate: {
      mutedLight: "#64748B",
      mutedDark: "#94A3B8",
    },
  },
  tile: {
    heightDesktop: "148px",
    heightMobile: "132px",
    radius: "16px",
    padding: "20px",
    iconSize: "44px",
  },
} as const;
