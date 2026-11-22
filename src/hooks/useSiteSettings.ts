import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_SITE_SETTINGS,
  fetchSiteSettings,
  SITE_SETTINGS_QUERY_KEY,
  type SiteSettingsData,
} from "@/lib/siteSettings";

export function useSiteSettings() {
  const query = useQuery<SiteSettingsData>({
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: fetchSiteSettings,
    placeholderData: DEFAULT_SITE_SETTINGS,
    staleTime: 30 * 1000,
    refetchOnMount: "always",
  });

  return {
    settings: query.data ?? DEFAULT_SITE_SETTINGS,
    hero: query.data?.hero ?? DEFAULT_SITE_SETTINGS.hero,
    pricing: query.data?.pricing ?? DEFAULT_SITE_SETTINGS.pricing,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

