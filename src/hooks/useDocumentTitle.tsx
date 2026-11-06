import { useEffect } from "react";
import { useAgency } from "./useAgency";

export function useDocumentTitle(pageTitle?: string) {
  const { data: agency } = useAgency();
  
  useEffect(() => {
    const agencyName = agency?.name || "TAMS Pro";
    const baseTitle = `${agencyName} - TAMS Pro`;
    document.title = pageTitle ? `${pageTitle} | ${baseTitle}` : baseTitle;
  }, [agency, pageTitle]);
}
