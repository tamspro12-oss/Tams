import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Calendar } from "lucide-react";

interface ClientPricingProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function ClientPricing({ formData, setFormData }: ClientPricingProps) {
  const sellingPrice = parseFloat(formData.selling_price) || 0;
  const purchasingPrice = parseFloat(formData.purchasing_price) || 0;
  const amountPaid = parseFloat(formData.amount_paid) || 0;
  const profit = sellingPrice - purchasingPrice;
  const remainingBalance = sellingPrice - amountPaid;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Pricing & Payment</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="selling_price">Selling Price (₨)</Label>
          <div className="relative">
            <TrendingUp className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="selling_price"
              type="number"
              step="0.01"
              min="0"
              value={formData.selling_price}
              onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
              placeholder="0.00"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchasing_price">Purchasing Price (₨)</Label>
          <div className="relative">
            <TrendingDown className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="purchasing_price"
              type="number"
              step="0.01"
              min="0"
              value={formData.purchasing_price}
              onChange={(e) => setFormData({ ...formData, purchasing_price: e.target.value })}
              placeholder="0.00"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount_paid">Amount Paid (₨)</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="amount_paid"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount_paid}
              onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
              placeholder="0.00"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="remaining_payment_date">Remaining Payment Date</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="remaining_payment_date"
              type="date"
              value={formData.remaining_payment_date}
              onChange={(e) => setFormData({ ...formData, remaining_payment_date: e.target.value })}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_status">Payment Status</Label>
          <Select 
            value={formData.payment_status} 
            onValueChange={(value) => setFormData({ ...formData, payment_status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Partial">Partial</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Profit & Balance Summary */}
      {(profit !== 0 || remainingBalance !== 0) && (
        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Expected Profit:</span>
            <span className={`text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₨{profit.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Remaining Balance:</span>
            <span className="text-sm font-semibold text-orange-600">
              ₨{remainingBalance.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
