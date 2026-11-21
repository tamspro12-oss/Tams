import {
  BarChart3,
  Bell,
  BookOpen,
  Calculator,
  CreditCard,
  FileText,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Plane,
  Receipt,
  RotateCcw,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  APP_NAVIGATION_CORE,
  SALES_SUB_SECTIONS_CORE,
  getDesktopSidebarItemsCore,
  getMobileBottomBarItemsCore,
  getMobileMoreItemsCore,
  isMoreMenuRouteActive,
  isNavItemActive,
  normalizeSalesTab,
  type AppNavItemCore,
  type NavIconKey,
  type SalesSubSectionCore,
  type SalesSubSectionId,
} from "@/config/navigationCore";

const ICON_MAP: Record<NavIconKey, LucideIcon> = {
  shield: Shield,
  "layout-dashboard": LayoutDashboard,
  receipt: Receipt,
  users: Users,
  "bar-chart-3": BarChart3,
  "message-square": MessageSquare,
  calculator: Calculator,
  bell: Bell,
  plane: Plane,
  settings: Settings,
  mail: Mail,
  "book-open": BookOpen,
  "file-text": FileText,
  "credit-card": CreditCard,
  "rotate-ccw": RotateCcw,
};

export interface SalesSubSection extends Omit<SalesSubSectionCore, "iconKey"> {
  icon: LucideIcon;
}

export interface AppNavItem extends Omit<AppNavItemCore, "iconKey" | "subItems"> {
  icon: LucideIcon;
  subItems?: readonly SalesSubSection[];
}

function attachSubSectionIcon(sub: SalesSubSectionCore): SalesSubSection {
  const { iconKey, ...rest } = sub;
  return {
    ...rest,
    icon: ICON_MAP[iconKey],
  };
}

function attachNavItemIcon(item: AppNavItemCore): AppNavItem {
  const { iconKey, subItems, ...rest } = item;
  return {
    ...rest,
    icon: ICON_MAP[iconKey],
    subItems: subItems?.map(attachSubSectionIcon),
  };
}

export const SALES_SUB_SECTIONS: readonly SalesSubSection[] =
  SALES_SUB_SECTIONS_CORE.map(attachSubSectionIcon);

export const APP_NAVIGATION: readonly AppNavItem[] =
  APP_NAVIGATION_CORE.map(attachNavItemIcon);

export function getDesktopSidebarItems(options: { isAdmin: boolean }): AppNavItem[] {
  return getDesktopSidebarItemsCore(options).map(attachNavItemIcon);
}

export function getMobileBottomBarItems(): AppNavItem[] {
  return getMobileBottomBarItemsCore().map(attachNavItemIcon);
}

export function getMobileMoreItems(options: { isAdmin: boolean }): AppNavItem[] {
  return getMobileMoreItemsCore(options).map(attachNavItemIcon);
}

export {
  isMoreMenuRouteActive,
  isNavItemActive,
  normalizeSalesTab,
  type SalesSubSectionId,
};

