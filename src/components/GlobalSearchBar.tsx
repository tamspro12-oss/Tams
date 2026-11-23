import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2, Users, FileText, CreditCard, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { isMissingRpcOrParamError } from "@/lib/atomicSave";
import { isInvoiceVoidedOrRefunded } from "@/lib/accountingEngine";
import { cleanPastedSearch } from "@/lib/searchUtils";
import { parseFriendlyError } from "@/lib/friendlyError";
import {
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_MIN_CHARS,
  GLOBAL_SEARCH_PAGE_SIZE,
  GlobalSearchInvoice,
  GlobalSearchParty,
  GlobalSearchResponse,
  GlobalSearchVoucher,
  mergeGlobalSearchPage,
  normalizeGlobalSearchQuery,
  shouldTriggerGlobalSearch,
  sortInvoicesNewestFirst,
  sortVouchersNewestFirst,
} from "@/lib/globalSearchCore";
import { cn } from "@/lib/utils";

function formatShortDate(dateVal?: string | null): string {
  if (!dateVal) return "—";
  const str = String(dateVal).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const [y, m, d] = str.split("-");
  return `${d}-${m}-${y}`;
}

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const { data: agencyId } = useCurrentAgencyId();
  const { isSubUser, isActive, hasModuleAccess } = useUserPermissions();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqCounterRef = useRef(0);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [offset, setOffset] = useState(0);

  const canClients = !isSubUser || (isActive && hasModuleAccess("clients"));
  const canVendors = !isSubUser || (isActive && hasModuleAccess("vendors"));
  const canInvoices = !isSubUser || (isActive && (hasModuleAccess("invoices") || hasModuleAccess("bookings")));
  const canVouchers =
    !isSubUser ||
    (isActive && (hasModuleAccess("invoices") || hasModuleAccess("bookings") || hasModuleAccess("clients")));

  // Pre-SQL fallback scoped strictly to caller's active agency + module permissions
  const runPreSqlFallbackSearch = useCallback(
    async (cleanQ: string, nextOffset: number): Promise<GlobalSearchResponse> => {
      if (!agencyId || (isSubUser && !isActive)) {
        return {
          query: cleanQ,
          limit: GLOBAL_SEARCH_PAGE_SIZE,
          offset: nextOffset,
          parties: [],
          invoices: [],
          vouchers: [],
          has_more: false,
          parties_has_more: false,
          invoices_has_more: false,
          vouchers_has_more: false,
        };
      }

      const likePattern = `%${cleanQ.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      const sliceEnd = nextOffset + GLOBAL_SEARCH_PAGE_SIZE;

      let matchedParties: GlobalSearchParty[] = [];
      let partiesHasMore = false;

      if (canClients || canVendors) {
        const { data: pData } = await (supabase as any)
          .from("parties")
          .select("id, name, type, code, phone, whatsapp, passport, current_balance")
          .eq("agency_id", agencyId)
          .or(
            `name.ilike.${likePattern},code.ilike.${likePattern},phone.ilike.${likePattern},whatsapp.ilike.${likePattern},passport.ilike.${likePattern}`
          )
          .order("name", { ascending: true })
          .range(nextOffset, sliceEnd);

        const allowed = (pData || []).filter((p: any) => {
          if (p.type === "client") return canClients;
          if (p.type === "vendor") return canVendors;
          return canClients || canVendors;
        });

        partiesHasMore = allowed.length > GLOBAL_SEARCH_PAGE_SIZE;
        matchedParties = allowed.slice(0, GLOBAL_SEARCH_PAGE_SIZE);
      }

      const matchedPartyIds = matchedParties.map((p) => p.id);

      let matchedInvoices: GlobalSearchInvoice[] = [];
      let invoicesHasMore = false;

      if (canInvoices) {
        const invFilters = [
          `invoice_no.ilike.${likePattern}`,
          `pnr.ilike.${likePattern}`,
          `ticket_no.ilike.${likePattern}`,
          `passport_no.ilike.${likePattern}`,
        ];
        if (matchedPartyIds.length > 0) {
          const idList = matchedPartyIds.slice(0, 30).join(",");
          invFilters.push(`party_id.in.(${idList})`);
          invFilters.push(`vendor_id.in.(${idList})`);
        }

        const { data: invData } = await (supabase as any)
          .from("booking_invoices")
          .select(
            "id, invoice_no, invoice_date, created_at, party_id, vendor_id, service, client_amount, paid_amount, payment_status, pnr, ticket_no, passport_no, is_void, party:parties!party_id(name), vendor:parties!vendor_id(name)"
          )
          .eq("agency_id", agencyId)
          .or(invFilters.join(","))
          .order("invoice_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(nextOffset, sliceEnd);

        const mapped = (invData || []).map((inv: any): GlobalSearchInvoice => {
          const total = Number(inv.client_amount) || 0;
          const paid = Number(inv.paid_amount) || 0;
          const voided = isInvoiceVoidedOrRefunded(inv);
          return {
            id: inv.id,
            invoice_no: inv.invoice_no || "",
            invoice_date: inv.invoice_date || null,
            created_at: inv.created_at || null,
            party_id: inv.party_id || null,
            party_name: inv.party?.name || "Walk-in / Client",
            vendor_id: inv.vendor_id || null,
            vendor_name: inv.vendor?.name || null,
            service: inv.service || "Booking",
            total,
            paid,
            remaining: voided ? 0 : Math.max(0, total - paid),
            payment_status: inv.payment_status || "pending",
            pnr: inv.pnr || null,
            ticket_no: inv.ticket_no || null,
            passport_no: inv.passport_no || null,
            is_void: Boolean(inv.is_void),
          };
        });

        invoicesHasMore = mapped.length > GLOBAL_SEARCH_PAGE_SIZE;
        matchedInvoices = sortInvoicesNewestFirst(mapped.slice(0, GLOBAL_SEARCH_PAGE_SIZE));
      }

      let matchedVouchers: GlobalSearchVoucher[] = [];
      let vouchersHasMore = false;

      if (canVouchers) {
        const vFilters = [
          `voucher_no.ilike.${likePattern}`,
          `reference_no.ilike.${likePattern}`,
        ];
        if (matchedPartyIds.length > 0) {
          const idList = matchedPartyIds.slice(0, 30).join(",");
          vFilters.push(`party_id.in.(${idList})`);
        }

        const { data: vData } = await (supabase as any)
          .from("payment_vouchers")
          .select(
            "id, voucher_no, voucher_date, created_at, direction, payment_mode, amount, party_id, reference_no, is_void, party:parties!party_id(name)"
          )
          .eq("agency_id", agencyId)
          .or(vFilters.join(","))
          .order("voucher_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(nextOffset, sliceEnd);

        const mapped = (vData || []).map((v: any): GlobalSearchVoucher => ({
          id: v.id,
          voucher_no: v.voucher_no || "",
          voucher_date: v.voucher_date || null,
          created_at: v.created_at || null,
          direction: v.direction || "in",
          payment_mode: v.payment_mode || "cash",
          amount: Number(v.amount) || 0,
          party_id: v.party_id || null,
          party_name: v.party?.name || "Customer",
          reference_no: v.reference_no || null,
          is_void: Boolean(v.is_void),
        }));

        vouchersHasMore = mapped.length > GLOBAL_SEARCH_PAGE_SIZE;
        matchedVouchers = sortVouchersNewestFirst(mapped.slice(0, GLOBAL_SEARCH_PAGE_SIZE));
      }

      return {
        query: cleanQ,
        limit: GLOBAL_SEARCH_PAGE_SIZE,
        offset: nextOffset,
        parties: matchedParties,
        invoices: matchedInvoices,
        vouchers: matchedVouchers,
        parties_has_more: partiesHasMore,
        invoices_has_more: invoicesHasMore,
        vouchers_has_more: vouchersHasMore,
        has_more: partiesHasMore || invoicesHasMore || vouchersHasMore,
      };
    },
    [agencyId, isSubUser, isActive, canClients, canVendors, canInvoices, canVouchers]
  );

  const executeSearch = useCallback(
    async (rawQ: string, nextOffset: number, append: boolean) => {
      const cleanQ = normalizeGlobalSearchQuery(rawQ);
      if (cleanQ.length < GLOBAL_SEARCH_MIN_CHARS) {
        setResults(null);
        setErrorMsg(null);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setErrorMsg("You appear to be offline. Search requires an internet connection.");
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      const callId = ++reqCounterRef.current;
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setErrorMsg(null);

      try {
        let payload: GlobalSearchResponse;
        const { data, error } = await (supabase as any).rpc("global_search", {
          query: cleanQ,
          limit_count: GLOBAL_SEARCH_PAGE_SIZE,
          offset_count: nextOffset,
        });

        if (!error && data) {
          payload = data as GlobalSearchResponse;
        } else if (error && isMissingRpcOrParamError(error)) {
          payload = await runPreSqlFallbackSearch(cleanQ, nextOffset);
        } else {
          throw error || new Error("Search failed");
        }

        if (callId !== reqCounterRef.current) return;

        setResults((prev) => mergeGlobalSearchPage(append ? prev : null, payload));
        setOffset(nextOffset);
      } catch (err) {
        if (callId !== reqCounterRef.current) return;
        const friendly = parseFriendlyError(err, "Could not complete search. Please try again.");
        setErrorMsg(friendly.userMessage);
      } finally {
        if (callId === reqCounterRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [runPreSqlFallbackSearch]
  );

  // Debounced search effect (~300 ms, starts at 2 characters)
  useEffect(() => {
    const cleanQ = normalizeGlobalSearchQuery(query);
    if (!shouldTriggerGlobalSearch(cleanQ)) {
      reqCounterRef.current++;
      setResults(null);
      setErrorMsg(null);
      setOffset(0);
      setIsLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void executeSearch(cleanQ, 0, false);
    }, GLOBAL_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, executeSearch]);

  // Global Ctrl+K / Cmd+K shortcut + Escape close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  const handleSelectParty = (party: GlobalSearchParty) => {
    setIsOpen(false);
    const params = new URLSearchParams();
    params.set("tab", "parties");
    params.set("partyId", party.id);
    if (party.name) params.set("search", party.name);
    navigate(`/app/clients-vendors?${params.toString()}`);
  };

  const handleSelectInvoice = (inv: GlobalSearchInvoice) => {
    setIsOpen(false);
    const params = new URLSearchParams();
    params.set("tab", "booking-invoice");
    params.set("date", "all");
    params.set("highlightId", inv.id);
    if (inv.invoice_no) params.set("search", inv.invoice_no);
    navigate(`/app/sales-expenses?${params.toString()}`);
  };

  const handleSelectVoucher = (v: GlobalSearchVoucher) => {
    setIsOpen(false);
    const params = new URLSearchParams();
    params.set("tab", "payment-vouchers");
    params.set("date", "all");
    params.set("highlightId", v.id);
    if (v.voucher_no) params.set("search", v.voucher_no);
    navigate(`/app/sales-expenses?${params.toString()}`);
  };

  const handleShowMore = () => {
    const nextOffset = offset + GLOBAL_SEARCH_PAGE_SIZE;
    void executeSearch(query, nextOffset, true);
  };

  const cleanLength = normalizeGlobalSearchQuery(query).length;
  const hasAnyResults = Boolean(
    results &&
      (results.parties.length > 0 || results.invoices.length > 0 || results.vouchers.length > 0)
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-[440px]">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          aria-label="Global search"
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted) {
              e.preventDefault();
              setQuery(cleanPastedSearch(pasted));
              setIsOpen(true);
            }
          }}
          placeholder="Search client, vendor, invoice #, voucher #, PNR, passport, phone..."
          className="h-10 md:h-9 pl-8 pr-9 md:pr-16 text-base md:text-xs bg-muted/40 border-border/60 focus-visible:bg-background rounded-lg"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              type="button"
              data-compact-btn=""
              aria-label="Clear global search"
              onClick={() => {
                setQuery("");
                setResults(null);
                setErrorMsg(null);
                inputRef.current?.focus();
              }}
              className="p-1.5 md:p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
          <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-background border border-border/70 rounded select-none">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {isOpen && cleanLength > 0 && (
        <div className="fixed md:absolute left-2 right-2 md:left-0 md:right-auto md:w-[min(92vw,540px)] top-[calc(3.75rem+env(safe-area-inset-top,0px))] md:top-full md:mt-1.5 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[min(75dvh,calc(var(--mobile-vvh,100dvh)-5rem))] md:max-h-[75vh]">
          {cleanLength < GLOBAL_SEARCH_MIN_CHARS ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              Type at least {GLOBAL_SEARCH_MIN_CHARS} characters to search across parties, invoices, and vouchers.
            </div>
          ) : isLoading && !results ? (
            <div className="px-4 py-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Searching records...
            </div>
          ) : errorMsg ? (
            <div className="px-4 py-5 text-center space-y-2">
              <p className="text-xs text-destructive font-medium">{errorMsg}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void executeSearch(query, 0, false)}
              >
                Try Again
              </Button>
            </div>
          ) : !hasAnyResults ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No results found for <span className="font-semibold text-foreground">"{normalizeGlobalSearchQuery(query)}"</span>.
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-border/70">
              {/* 1. Matching Clients & Vendors (Parties) at Top as Quick Links */}
              {results && results.parties.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Clients & Vendors ({results.parties.length})
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {results.parties.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectParty(p)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-accent/70 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold truncate">{p.name}</span>
                            {p.code && (
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                {p.code}
                              </span>
                            )}
                          </div>
                          {(p.phone || p.passport) && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {[p.phone, p.passport ? `PP: ${p.passport}` : null].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 uppercase",
                            p.type === "vendor"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : p.type === "both"
                              ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                          )}
                        >
                          {p.type}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Booking Invoices (Newest First) */}
              {results && results.invoices.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Booking Invoices — Newest First ({results.invoices.length})
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {results.invoices.map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => handleSelectInvoice(inv)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-accent/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono font-bold text-primary shrink-0">
                              {inv.invoice_no}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                              {formatShortDate(inv.invoice_date || inv.created_at)}
                            </span>
                            <span className="text-xs font-semibold truncate">
                              {inv.party_name || "Customer"}
                            </span>
                          </div>
                          {inv.is_void && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-destructive/10 text-destructive shrink-0">
                              VOID
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="text-muted-foreground truncate">
                            {[inv.service, inv.pnr ? `PNR: ${inv.pnr}` : null, inv.ticket_no ? `Tkt: ${inv.ticket_no}` : null]
                              .filter(Boolean)
                              .join(" · ") || "Booking"}
                          </span>
                          <div className="flex items-center gap-2.5 font-mono shrink-0">
                            <span>
                              Total: <strong>PKR {(Number(inv.total) || 0).toLocaleString()}</strong>
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Paid: {(Number(inv.paid) || 0).toLocaleString()}
                            </span>
                            <span
                              className={cn(
                                "font-semibold",
                                (Number(inv.remaining) || 0) > 0
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              Rem: {(Number(inv.remaining) || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Matching Vouchers (Newest First) */}
              {results && results.vouchers.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                    Payment Vouchers — Newest First ({results.vouchers.length})
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {results.vouchers.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVoucher(v)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-accent/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                              {v.voucher_no}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                              {formatShortDate(v.voucher_date || v.created_at)}
                            </span>
                            <span className="text-xs font-semibold truncate">
                              {v.party_name || "Customer"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.2 rounded uppercase",
                                v.direction === "out" || v.direction === "paid"
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                              )}
                            >
                              {v.direction === "out" || v.direction === "paid" ? "PAID" : "RCVD"}
                            </span>
                            <span className="font-bold">
                              PKR {(Number(v.amount) || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {(v.payment_mode || v.reference_no) && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                            {[v.payment_mode?.toUpperCase(), v.reference_no ? `Ref: ${v.reference_no}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Show more option */}
              {results?.has_more && (
                <div className="p-2 bg-muted/20 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isLoadingMore}
                    onClick={handleShowMore}
                    className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        Show more results
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

