import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

type VendorShareType = "percentage" | "fixed";

export function TicketPayableCalculator() {
  const [baseFare, setBaseFare] = useState<string>("");
  const [taxes, setTaxes] = useState<string>("");
  const [vendorShareType, setVendorShareType] = useState<VendorShareType>("percentage");
  const [vendorSharePercent, setVendorSharePercent] = useState<string>("");
  const [vendorShareAmount, setVendorShareAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const handleClearAll = () => {
    setBaseFare("");
    setTaxes("");
    setVendorShareType("percentage");
    setVendorSharePercent("");
    setVendorShareAmount("");
    setNotes("");
  };

  const [results, setResults] = useState({
    netPayableToVendor: 0,
    taxesApplied: 0,
    totalPayableToVendor: 0,
    totalFareOfTicket: 0,
  });

  useEffect(() => {
    const base = parseFloat(baseFare) || 0;
    const taxAmount = parseFloat(taxes) || 0;

    let vendorShare = 0;
    let netPayableToVendor = 0;
    let totalFareOfTicket = 0;

    if (vendorShareType === "percentage") {
      const percent = parseFloat(vendorSharePercent) || 0;
      vendorShare = (base * percent) / 100;
      
      if (percent < 0) {
        // Negative percentage: subtract from basic fare, ticket fare stays base + tax
        netPayableToVendor = base - Math.abs(vendorShare);
        totalFareOfTicket = base + taxAmount;
      } else {
        // Positive percentage: add to basic fare and total fare
        netPayableToVendor = base + vendorShare;
        totalFareOfTicket = base + taxAmount + vendorShare;
      }
    } else {
      vendorShare = parseFloat(vendorShareAmount) || 0;
      netPayableToVendor = base + vendorShare;
      totalFareOfTicket = base + taxAmount + vendorShare;
    }

    const taxesApplied = taxAmount;
    const totalPayableToVendor = netPayableToVendor + taxesApplied;

    setResults({
      netPayableToVendor,
      taxesApplied,
      totalPayableToVendor,
      totalFareOfTicket,
    });
  }, [baseFare, taxes, vendorShareType, vendorSharePercent, vendorShareAmount]);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
        <Card className="p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Input Details</h2>
            <Button
              onClick={handleClearAll}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              Clear All
            </Button>
          </div>

          <div className="space-y-5">
            <div>
              <Label htmlFor="baseFare" className="flex items-center gap-2">
                Basic Fare
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The base ticket price before vendor share and taxes</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                id="baseFare"
                type="number"
                placeholder="0.00"
                value={baseFare}
                onChange={(e) => setBaseFare(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="taxes" className="flex items-center gap-2">
                Tax Amount
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Fixed tax amount to be added to net payable</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                id="taxes"
                type="number"
                placeholder="0.00"
                value={taxes}
                onChange={(e) => setTaxes(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                Vendor Share Type
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Choose how the vendor's commission is calculated</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <RadioGroup
                value={vendorShareType}
                onValueChange={(value) => setVendorShareType(value as VendorShareType)}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="percentage" />
                  <Label htmlFor="percentage" className="font-normal cursor-pointer">
                    Percentage
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed" className="font-normal cursor-pointer">
                    Fixed Amount
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {vendorShareType === "percentage" ? (
              <div>
                <Label htmlFor="vendorSharePercent">Vendor Share %</Label>
                <Input
                  id="vendorSharePercent"
                  type="number"
                  placeholder="0.00"
                  value={vendorSharePercent}
                  onChange={(e) => setVendorSharePercent(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="vendorShareAmount">Vendor Share Amount</Label>
                <Input
                  id="vendorShareAmount"
                  type="number"
                  placeholder="0.00"
                  value={vendorShareAmount}
                  onChange={(e) => setVendorShareAmount(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-foreground mb-6">Calculation Results</h2>

          <div className="space-y-4">
            <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                Net Payable to Vendor
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Basic Fare - Vendor Share</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-3xl font-bold text-primary">
                {results.netPayableToVendor.toFixed(2)}
              </div>
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                Taxes Applied
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Fixed tax amount added to net payable</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {results.taxesApplied.toFixed(2)}
              </div>
            </div>

            <div className="bg-accent/20 border-2 border-accent rounded-lg p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                Total Payable to Vendor
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Net Payable + Taxes Applied</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-3xl font-bold text-accent-foreground">
                {results.totalPayableToVendor.toFixed(2)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary rounded-lg p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                Total Fare of Ticket
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Basic Fare + Taxes (Total ticket price)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-3xl font-bold text-primary">
                {results.totalFareOfTicket.toFixed(2)}
              </div>
            </div>

            {notes && (
              <div className="bg-muted/30 border border-border rounded-lg p-4 mt-6">
                <div className="text-sm font-medium text-muted-foreground mb-2">Notes</div>
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {notes}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
}
