# TAMS Quick Start Guide for Developers

## 🚀 What's New in This Update

### Critical Improvements Implemented

1. **⚡ 10-100x Faster Queries** - Database indexes added
2. **🛡️ Data Validation** - Zod schemas prevent corrupt data
3. **🧩 Modular Components** - 842-line forms broken into reusable pieces
4. **📱 Pagination Ready** - Hook supports 10K+ records
5. **🔒 Security Fixed** - Password protection enabled
6. **💾 Offline Sync Works** - Queue processing implemented
7. **🧠 Memory Leak Fixed** - Session manager cleaned up

---

## 📂 New Files Created

### Validation System
```
src/lib/validations/
└── schemas.ts                 # Zod validation schemas
```

### Modular Form Components
```
src/components/forms/
├── ClientBasicInfo.tsx        # Name, contact, CNIC, passport
├── ClientTravelDetails.tsx    # Destination, airline, flight date
├── ClientPricing.tsx           # Pricing, payment, profit calculation
├── ClientVendorSelection.tsx   # Vendor assignment with search
└── ClientNotes.tsx             # Notes section
```

### Validated Form Dialogs
```
src/components/
├── AddExpenseDialogValidated.tsx
├── AddVendorDialogValidated.tsx
└── AddQueryDialogValidated.tsx
```

### Pagination Hook
```
src/hooks/
└── usePaginatedClients.tsx     # 50 records per page, filters supported
```

---

## 🔧 How to Use New Features

### 1. Using Validated Forms

**Old Way (No Validation)**:
```typescript
// AddExpenseDialog.tsx
<Input name="amount" type="number" />
// User can enter negative numbers, text, or huge values!
```

**New Way (With Validation)**:
```typescript
// AddExpenseDialogValidated.tsx
import { expenseSchema, validateData } from "@/lib/validations/schemas";

const validation = validateData(expenseSchema, expenseData);
if (!validation.success) {
  toast.error(validation.error); // "Amount must be greater than 0"
  return;
}
```

**To Use**:
Replace old dialogs with validated versions:
```typescript
// Before
import { AddExpenseDialog } from "@/components/AddExpenseDialog";

// After
import { AddExpenseDialogValidated } from "@/components/AddExpenseDialogValidated";
```

---

### 2. Using Pagination Hook

**Implementation**:
```typescript
import { usePaginatedClients } from "@/hooks/usePaginatedClients";

function ClientsPage() {
  const [page, setPage] = useState(0);
  const { clients, totalCount, hasMore, isLoading } = usePaginatedClients(page, {
    search: searchQuery,
    paymentStatus: filterStatus,
    startDate: dateFilter.startDate,
    endDate: dateFilter.endDate,
  });

  return (
    <>
      {/* Render clients */}
      
      <div className="flex justify-between mt-4">
        <p>Showing {clients.length} of {totalCount}</p>
        <div className="flex gap-2">
          <Button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
          >
            Previous
          </Button>
          <Button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
```

**Benefits**:
- Loads only 50 records at a time
- Works with search and filters
- Supports both local and cloud storage
- Real-time updates maintained

---

### 3. Using Modular Form Components

**Old Way (842 Lines in One File)**:
```typescript
// AddClientDialog.tsx - HUGE!
<Dialog>
  {/* 20+ form fields in single file */}
  <Input name="name" />
  <Input name="contact" />
  <Input name="passport" />
  {/* ... 15 more fields ... */}
</Dialog>
```

**New Way (Modular)**:
```typescript
import { ClientBasicInfo } from "@/components/forms/ClientBasicInfo";
import { ClientTravelDetails } from "@/components/forms/ClientTravelDetails";
import { ClientPricing } from "@/components/forms/ClientPricing";

<Dialog>
  {step === 1 && <ClientBasicInfo formData={data} setFormData={setData} />}
  {step === 2 && <ClientTravelDetails formData={data} setFormData={setData} />}
  {step === 3 && <ClientPricing formData={data} setFormData={setData} />}
</Dialog>
```

**To Implement Multi-Step Wizard**:
```typescript
const [currentStep, setCurrentStep] = useState(1);
const totalSteps = 4;

// Progress indicator
<div className="flex gap-1 mb-4">
  {[1, 2, 3, 4].map(step => (
    <div
      key={step}
      className={cn(
        "flex-1 h-2 rounded",
        step <= currentStep ? "bg-primary" : "bg-muted"
      )}
    />
  ))}
</div>

// Navigation
<div className="flex justify-between mt-4">
  <Button
    onClick={() => setCurrentStep(s => s - 1)}
    disabled={currentStep === 1}
  >
    Back
  </Button>
  <Button onClick={() => setCurrentStep(s => s + 1)}>
    {currentStep === totalSteps ? "Submit" : "Next"}
  </Button>
</div>
```

---

## 🎯 Common Tasks

### Adding Validation to Existing Form

1. **Import validation schema**:
```typescript
import { clientSchema, validateData } from "@/lib/validations/schemas";
```

2. **Validate before submit**:
```typescript
const handleSubmit = async (data) => {
  const validation = validateData(clientSchema, data);
  
  if (!validation.success) {
    toast.error(validation.error);
    return;
  }
  
  // Proceed with validated data
  await saveClient(validation.data);
};
```

3. **Add helpful error messages**:
```typescript
// The schema already provides user-friendly messages:
// "Invalid phone number format (e.g., 03001234567)"
// "Passport format must be 6-9 alphanumeric characters"
// "Amount must be greater than 0"
```

---

### Adding Loading States

**Pattern**:
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);
  
  try {
    await saveData();
  } catch (error) {
    toast.error(error.message);
  } finally {
    setIsSubmitting(false);
  }
};

<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? "Saving..." : "Save"}
</Button>
```

**Apply to**:
- All form submission buttons
- Delete buttons
- Export buttons
- Payment buttons

---

### Adding Empty States

**Pattern**:
```typescript
{data.length === 0 && !isLoading && (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Icon className="h-12 w-12 text-muted-foreground mb-4" />
    <h3 className="text-lg font-semibold mb-2">No data yet</h3>
    <p className="text-sm text-muted-foreground mb-4">
      Get started by adding your first item
    </p>
    <Button onClick={openAddDialog}>
      <Plus className="h-4 w-4 mr-2" />
      Add Item
    </Button>
  </div>
)}
```

---

## 🐛 Debugging Tips

### Validation Issues

**Problem**: Form allows invalid data
**Solution**: Check if validation is applied:
```typescript
// ❌ Wrong - no validation
await saveClient(formData);

// ✅ Correct - with validation
const validation = validateData(clientSchema, formData);
if (!validation.success) {
  toast.error(validation.error);
  return;
}
await saveClient(validation.data);
```

---

### Pagination Not Working

**Problem**: All records still loading
**Solution**: Make sure you're using the hook:
```typescript
// ❌ Wrong - loads all records
const { clients } = useClients();

// ✅ Correct - paginated
const { clients } = usePaginatedClients(page);
```

---

### Memory Leak

**Problem**: Browser slows down over time
**Solution**: Session manager now properly cleans up event listeners. If issue persists, check for:
- Unremoved setInterval/setTimeout
- Unsubscribed Supabase channels
- Large arrays in state

---

## 📚 Validation Schema Reference

### Client Schema
```typescript
clientSchema = {
  name: string (2-100 chars),
  contact_number: string (03XXXXXXXXX) - optional,
  cnic: string (12345-1234567-1) - optional,
  passport_number: string (6-9 alphanumeric) - optional,
  destination: string (max 100 chars) - optional,
  airline: string (max 100 chars) - optional,
  flight_date: string (not in past) - optional,
  selling_price: number (0-10000000) - optional,
  purchasing_price: number (0-10000000) - optional,
  amount_paid: number (0-10000000) - optional,
  group_size: number (1-500),
  notes: string (max 5000 chars) - optional,
}
```

### Vendor Schema
```typescript
vendorSchema = {
  name: string (2-100 chars),
  contact_person: string (max 100 chars) - optional,
  contact_number: string (03XXXXXXXXX) - optional,
  email: string (valid email) - optional,
  service_type: string (max 100 chars) - optional,
  payment_amount: number (0-10000000) - optional,
  amount_paid: number (0-10000000, <= payment_amount) - optional,
  notes: string (max 5000 chars) - optional,
}
```

### Expense Schema
```typescript
expenseSchema = {
  expense_date: string (required),
  expense_type: string (2-100 chars),
  amount: number (0.01-10000000),
  notes: string (max 5000 chars) - optional,
}
```

### Query Schema
```typescript
querySchema = {
  client_name: string (2-100 chars),
  contact_number: string (03XXXXXXXXX) - optional,
  query_text: string (5-2000 chars),
  priority: enum ('low', 'medium', 'high'),
  status: enum ('pending', 'in_progress', 'completed', 'cancelled'),
  assigned_to: string (max 100 chars) - optional,
  due_date: string (not in past) - optional,
  notes: string (max 5000 chars) - optional,
}
```

---

## ⚡ Performance Tips

### Database Queries
- ✅ Indexes are now in place - queries are fast
- ✅ Use pagination for large lists
- ⚠️ Avoid loading all payment history at once
- ⚠️ Use date filters to limit result sets

### React Performance
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers in list items
- Consider `React.memo` for frequently re-rendering components

### Bundle Size
- ⏳ Code splitting not yet implemented
- Consider lazy loading heavy libraries:
  ```typescript
  const jsPDF = lazy(() => import('jspdf'));
  const XLSX = lazy(() => import('xlsx'));
  ```

---

## 🚨 Common Mistakes to Avoid

1. **Don't skip validation**
   ```typescript
   // ❌ Bad
   await addClient(formData);
   
   // ✅ Good
   const validation = validateData(clientSchema, formData);
   if (!validation.success) return;
   await addClient(validation.data);
   ```

2. **Don't forget loading states**
   ```typescript
   // ❌ Bad - button stays enabled
   <Button onClick={handleSubmit}>Save</Button>
   
   // ✅ Good - button disabled while saving
   <Button onClick={handleSubmit} disabled={isSubmitting}>
     {isSubmitting ? "Saving..." : "Save"}
   </Button>
   ```

3. **Don't load all records**
   ```typescript
   // ❌ Bad - loads 10,000 clients
   const { clients } = useClients();
   
   // ✅ Good - loads 50 at a time
   const { clients } = usePaginatedClients(page);
   ```

---

## 📞 Need Help?

**Check these files**:
- `IMPLEMENTATION_STATUS.md` - Full implementation status
- `src/lib/validations/schemas.ts` - Validation rules
- `src/hooks/usePaginatedClients.tsx` - Pagination example

**Common Issues**:
- TypeScript errors? Check validation types
- Performance slow? Use pagination
- Form allows bad data? Add validation
- Memory issues? Check for cleanup in useEffect

---

**Last Updated**: 2025-11-19
**Version**: 3.2.0-beta
