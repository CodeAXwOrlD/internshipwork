import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { toast } from "sonner";
import { format, formatDistanceToNow, addDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  FileText, CheckCircle, Clock, AlertCircle, Search, Plus, Trash2,
  MoreHorizontal, Eye, Download, Send, Pencil, Copy, Ban, DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number | null;
  total_amount: number;
  status: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  client_id: string | null;
  admin_id: string | null;
  created_at: string;
  client_name?: string;
  client_email?: string;
};

type LineItem = {
  id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

export default function AdminBillingPage() {
  const { admin } = useAdmin();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [viewInvoiceOpen, setViewInvoiceOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [viewLineItems, setViewLineItems] = useState<LineItem[]>([]);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("");

  // Generate invoice form state
  const [formClientId, setFormClientId] = useState("");
  const [formInvoiceNumber, setFormInvoiceNumber] = useState("");
  const [formInvoiceDate, setFormInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formDueDate, setFormDueDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [formNotes, setFormNotes] = useState("");
  const [formAddTax, setFormAddTax] = useState(false);
  const [formTaxRate, setFormTaxRate] = useState(18);
  const [formAddDiscount, setFormAddDiscount] = useState(false);
  const [formDiscountAmount, setFormDiscountAmount] = useState(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("invoice_date", { ascending: false });
      if (error) throw error;

      if (!data?.length) return [];

      const clientIds = [...new Set(data.map((i) => i.client_id).filter(Boolean))] as string[];
      let clients: any[] = [];
      if (clientIds.length > 0) {
        const { data: cData } = await supabase
          .from("clients")
          .select("id, company_name, user_id")
          .in("id", clientIds);
        clients = cData || [];
      }

      const userIds = [...new Set(clients.map((c) => c.user_id).filter(Boolean))];
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", userIds);
        profiles = pData || [];
      }

      const clientMap = new Map(clients?.map((c) => [c.id, c]) || []);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data.map((inv) => {
        const client = inv.client_id ? clientMap.get(inv.client_id) : null;
        const profile = client ? profileMap.get(client.user_id) : null;
        return {
          ...inv,
          client_name: client?.company_name || "Unknown",
          client_email: profile?.email || "",
        } as InvoiceRow;
      });
    },
  });

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["admin-clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, company_name").order("company_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch services for line items
  const { data: services = [] } = useQuery({
    queryKey: ["admin-services-billing"],
    queryFn: async () => {
      const { data: svcData, error } = await supabase.from("services").select("id, name, base_price").eq("is_active", true);
      if (error) throw error;

      // Get admin pricing
      const { data: pricing } = await supabase.from("admin_pricing").select("service_id, custom_price_per_unit, is_custom_pricing, markup_percentage");
      const pricingMap = new Map(pricing?.map((p) => [p.service_id, p]) || []);

      return (svcData || []).map((s) => {
        const ap = pricingMap.get(s.id);
        const price = ap?.is_custom_pricing && ap.custom_price_per_unit ? ap.custom_price_per_unit : s.base_price * (1 + (ap?.markup_percentage || 0) / 100);
        return { ...s, admin_price: price };
      });
    },
  });

  // Summary stats
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const totalBilled = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
    const paidThisMonth = invoices
      .filter((i) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= monthStart && new Date(i.paid_at) <= monthEnd)
      .reduce((s, i) => s + Number(i.total_amount), 0);
    const pending = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
    const pendingAmount = pending.reduce((s, i) => s + Number(i.total_amount), 0);
    const overdue = invoices.filter((i) => i.status === "overdue" || (i.status === "sent" && i.due_date && new Date(i.due_date) < now));
    const overdueAmount = overdue.reduce((s, i) => s + Number(i.total_amount), 0);

    return { totalBilled, paidThisMonth, pendingAmount, pendingCount: pending.length, overdueAmount, overdueCount: overdue.length };
  }, [invoices]);

  // Filtered invoices
  const filtered = useMemo(() => {
    let result = [...invoices];
    if (tab !== "all") result = result.filter((i) => i.status === tab);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) =>
        i.invoice_number.toLowerCase().includes(q) ||
        i.client_name?.toLowerCase().includes(q)
      );
    }
    if (clientFilter !== "all") result = result.filter((i) => i.client_id === clientFilter);
    if (dateFilter === "this_month") {
      const ms = startOfMonth(new Date());
      result = result.filter((i) => new Date(i.invoice_date) >= ms);
    } else if (dateFilter === "last_month") {
      const ms = startOfMonth(subMonths(new Date(), 1));
      const me = endOfMonth(subMonths(new Date(), 1));
      result = result.filter((i) => new Date(i.invoice_date) >= ms && new Date(i.invoice_date) <= me);
    }
    return result;
  }, [invoices, tab, search, clientFilter, dateFilter]);

  // Next invoice number
  const nextInvoiceNumber = useMemo(() => {
    const year = new Date().getFullYear();
    const existing = invoices
      .map((i) => {
        const match = i.invoice_number.match(/INV-\d{4}-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter((n) => n > 0);
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return `INV-${year}-${String(next).padStart(3, "0")}`;
  }, [invoices]);

  // Line item helpers
  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), service_id: null, description: "", quantity: 1, unit_price: 0, total_price: 0 },
    ]);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "service_id" && value) {
          const svc = services.find((s) => s.id === value);
          if (svc) {
            updated.description = svc.name;
            updated.unit_price = Number(svc.admin_price);
          }
        }
        if (field === "quantity" || field === "unit_price" || field === "service_id") {
          updated.total_price = updated.quantity * updated.unit_price;
        }
        return updated;
      })
    );
  };

  const removeLineItem = (id: string) => setLineItems((prev) => prev.filter((i) => i.id !== id));

  const subtotal = lineItems.reduce((s, i) => s + i.total_price, 0);
  const taxAmount = formAddTax ? subtotal * (formTaxRate / 100) : 0;
  const discountAmt = formAddDiscount ? formDiscountAmount : 0;
  const totalAmount = subtotal + taxAmount - discountAmt;

  // Auto-fill from usage
  const autoFillUsage = async () => {
    if (!formClientId) { toast.error("Select a client first"); return; }
    const { data: cs } = await supabase
      .from("client_services")
      .select("service_id, usage_consumed")
      .eq("client_id", formClientId)
      .eq("is_active", true);

    if (!cs?.length) { toast.info("No active services for this client"); return; }

    const items: LineItem[] = cs.filter((s) => (s.usage_consumed || 0) > 0).map((s) => {
      const svc = services.find((sv) => sv.id === s.service_id);
      const price = Number(svc?.admin_price || 0);
      const qty = s.usage_consumed || 0;
      return {
        id: crypto.randomUUID(),
        service_id: s.service_id,
        description: svc?.name || "Service",
        quantity: qty,
        unit_price: price,
        total_price: qty * price,
      };
    });
    if (items.length === 0) { toast.info("No usage to bill"); return; }
    setLineItems(items);
    toast.success(`Added ${items.length} service(s) from usage`);
  };

  // Open generate modal
  const openGenerate = () => {
    setFormClientId("");
    setFormInvoiceNumber(nextInvoiceNumber);
    setFormInvoiceDate(format(new Date(), "yyyy-MM-dd"));
    setFormDueDate(format(addDays(new Date(), 30), "yyyy-MM-dd"));
    setFormNotes("");
    setFormAddTax(false);
    setFormTaxRate(18);
    setFormAddDiscount(false);
    setFormDiscountAmount(0);
    setLineItems([]);
    setGenerateOpen(true);
  };

  // Save invoice
  const saveInvoice = async (status: "draft" | "sent") => {
    if (!formClientId) { toast.error("Select a client"); return; }
    if (lineItems.length === 0) { toast.error("Add at least one line item"); return; }
    if (!formInvoiceNumber.trim()) { toast.error("Invoice number is required"); return; }

    setSaving(true);
    try {
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert({
          admin_id: admin?.id,
          client_id: formClientId,
          invoice_number: formInvoiceNumber,
          invoice_date: formInvoiceDate,
          due_date: formDueDate || null,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          status,
          notes: formNotes || null,
        })
        .select("id")
        .single();

      if (invErr) throw invErr;

      const itemsToInsert = lineItems.map((li) => ({
        invoice_id: inv.id,
        service_id: li.service_id || null,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        total_price: li.total_price,
      }));

      const { error: itemsErr } = await supabase.from("invoice_items").insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      setGenerateOpen(false);
      toast.success(status === "draft" ? "Invoice saved as draft" : "Invoice created and sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  // Mark as paid
  const markAsPaid = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) return;
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: paymentDate, payment_method: paymentMethod || null })
        .eq("id", selectedInvoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      setMarkPaidOpen(false);
      toast.success("Invoice marked as paid");
    },
    onError: () => toast.error("Failed to update invoice"),
  });

  // Update status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "sent" | "paid" | "overdue" | "cancelled" }) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      toast.success("Invoice status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const getDueDateInfo = (inv: InvoiceRow) => {
    if (!inv.due_date) return null;
    const due = new Date(inv.due_date);
    const now = new Date();
    if (inv.status === "paid") return null;
    if (due < now) return { text: `${formatDistanceToNow(due)} overdue`, className: "text-destructive" };
    return { text: `Due in ${formatDistanceToNow(due)}`, className: "text-muted-foreground" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing & Invoices</h1>
          <p className="text-muted-foreground">Manage invoices and track payments</p>
        </div>
        <Button onClick={openGenerate}>
          <FileText className="mr-2 h-4 w-4" /> Generate Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">₹{stats.totalBilled.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">Total Billed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-500" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">₹{stats.paidThisMonth.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">Paid This Month</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10"><Clock className="h-5 w-5 text-yellow-500" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">₹{stats.pendingAmount.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">{stats.pendingCount} invoices pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertCircle className="h-5 w-5 text-destructive" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">₹{stats.overdueAmount.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">{stats.overdueCount > 0 ? "Action required" : "No overdue"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by invoice number or client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs + Table */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({invoices.length})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({invoices.filter((i) => i.status === "draft").length})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({invoices.filter((i) => i.status === "sent").length})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({invoices.filter((i) => i.status === "paid").length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({invoices.filter((i) => i.status === "overdue").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-1">No invoices found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {invoices.length === 0 ? "Create your first invoice to start billing clients" : "Try adjusting your filters"}
                </p>
                {invoices.length === 0 && (
                  <Button onClick={openGenerate}><FileText className="mr-2 h-4 w-4" /> Generate Invoice</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid On</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const dueInfo = getDueDateInfo(inv);
                    const sc = statusConfig[inv.status || "draft"];
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.client_name}</TableCell>
                        <TableCell>{format(new Date(inv.invoice_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          {inv.due_date ? (
                            <div>
                              <span>{format(new Date(inv.due_date), "MMM d, yyyy")}</span>
                              {dueInfo && <p className={`text-xs ${dueInfo.className}`}>{dueInfo.text}</p>}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">₹{Number(inv.total_amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell><Badge variant={sc.variant}>{sc.label}</Badge></TableCell>
                        <TableCell>{inv.paid_at ? format(new Date(inv.paid_at), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={async () => {
                                setSelectedInvoice(inv);
                                const { data: items } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
                                setViewLineItems((items || []).map((i: any) => ({
                                  id: i.id, service_id: i.service_id, description: i.description,
                                  quantity: i.quantity ?? 1, unit_price: Number(i.unit_price), total_price: Number(i.total_price),
                                })));
                                setViewInvoiceOpen(true);
                              }}>
                                <Eye className="mr-2 h-4 w-4" /> View Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                const toastId = toast.loading("Generating PDF...");
                                try {
                                  const { default: jsPDF } = await import("jspdf");
                                  const { default: autoTable } = await import("jspdf-autotable");
                                  const doc = new jsPDF();
                                  doc.setFontSize(18);
                                  doc.text("INVOICE", 105, 20, { align: "center" });
                                  doc.setFontSize(10);
                                  doc.text(`Invoice #: ${inv.invoice_number}`, 20, 35);
                                  doc.text(`Date: ${format(new Date(inv.invoice_date), "MMM d, yyyy")}`, 20, 41);
                                  if (inv.due_date) doc.text(`Due: ${format(new Date(inv.due_date), "MMM d, yyyy")}`, 20, 47);
                                  doc.text(`Client: ${inv.client_name}`, 20, 53);
                                  doc.text(`Status: ${(inv.status || "draft").toUpperCase()}`, 20, 59);
                                  const { data: items } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
                                  autoTable(doc, {
                                    startY: 68,
                                    head: [["Description", "Qty", "Unit Price", "Total"]],
                                    body: (items || []).map((i: any) => [i.description, i.quantity ?? 1, `₹${Number(i.unit_price).toFixed(2)}`, `₹${Number(i.total_price).toFixed(2)}`]),
                                    theme: "grid",
                                    styles: { fontSize: 9 },
                                    headStyles: { fillColor: [34, 34, 34] },
                                  });
                                  const finalY = (doc as any).lastAutoTable?.finalY || 120;
                                  doc.setFontSize(10);
                                  doc.text(`Subtotal: ₹${Number(inv.subtotal).toFixed(2)}`, 140, finalY + 10);
                                  if (inv.tax_amount) doc.text(`Tax: ₹${Number(inv.tax_amount).toFixed(2)}`, 140, finalY + 16);
                                  doc.setFontSize(12);
                                  doc.text(`Total: ₹${Number(inv.total_amount).toFixed(2)}`, 140, finalY + 24);
                                  doc.save(`${inv.invoice_number}.pdf`);
                                  toast.success("PDF downloaded", { id: toastId });
                                } catch {
                                  toast.error("Failed to generate PDF", { id: toastId });
                                }
                              }}>
                                <Download className="mr-2 h-4 w-4" /> Download PDF
                              </DropdownMenuItem>
                              {(inv.status === "draft" || inv.status === "sent" || inv.status === "overdue") && (
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: inv.id, status: "sent" })}>
                                  <Send className="mr-2 h-4 w-4" /> Send to Client
                                </DropdownMenuItem>
                              )}
                              {(inv.status === "sent" || inv.status === "overdue") && (
                                <DropdownMenuItem onClick={() => { setSelectedInvoice(inv); setPaymentDate(format(new Date(), "yyyy-MM-dd")); setPaymentMethod(""); setMarkPaidOpen(true); }}>
                                  <CheckCircle className="mr-2 h-4 w-4" /> Mark as Paid
                                </DropdownMenuItem>
                              )}
                              {inv.status === "draft" && (
                                <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={async () => {
                                const { data: items } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
                                const { data: newInv, error: invErr } = await supabase.from("invoices").insert({
                                  admin_id: inv.admin_id, client_id: inv.client_id,
                                  invoice_number: `${inv.invoice_number}-COPY`,
                                  invoice_date: format(new Date(), "yyyy-MM-dd"),
                                  due_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
                                  subtotal: inv.subtotal, tax_amount: inv.tax_amount,
                                  total_amount: inv.total_amount, status: "draft", notes: inv.notes,
                                }).select("id").single();
                                if (invErr) { toast.error("Failed to duplicate"); return; }
                                if (items?.length && newInv) {
                                  await supabase.from("invoice_items").insert(
                                    items.map((i: any) => ({ invoice_id: newInv.id, service_id: i.service_id, description: i.description, quantity: i.quantity, unit_price: i.unit_price, total_price: i.total_price }))
                                  );
                                }
                                queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
                                toast.success("Invoice duplicated as draft");
                              }}>
                                <Copy className="mr-2 h-4 w-4" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => updateStatus.mutate({ id: inv.id, status: "cancelled" })}>
                                <Ban className="mr-2 h-4 w-4" /> Cancel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Generate Invoice Modal */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate New Invoice</DialogTitle>
            <DialogDescription>Create an invoice for a client</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={formClientId} onValueChange={setFormClientId}>
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Number *</Label>
                <Input value={formInvoiceNumber} onChange={(e) => setFormInvoiceNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select defaultValue="net30" onValueChange={(v) => {
                  const days = v === "receipt" ? 0 : v === "net15" ? 15 : v === "net30" ? 30 : 60;
                  setFormDueDate(format(addDays(new Date(formInvoiceDate), days), "yyyy-MM-dd"));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receipt">Due on Receipt</SelectItem>
                    <SelectItem value="net15">Net 15</SelectItem>
                    <SelectItem value="net30">Net 30</SelectItem>
                    <SelectItem value="net60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input type="date" value={formInvoiceDate} onChange={(e) => setFormInvoiceDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Line Items</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={autoFillUsage}>
                    <DollarSign className="mr-1 h-3 w-3" /> Auto-fill from Usage
                  </Button>
                  <Button variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="mr-1 h-3 w-3" /> Add Item
                  </Button>
                </div>
              </div>

              {lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No items added yet. Click "Add Item" or "Auto-fill from Usage".</p>
              ) : (
                <div className="space-y-3">
                  {lineItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">Service</Label>
                        <Select value={item.service_id || ""} onValueChange={(v) => updateLineItem(item.id, "service_id", v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {services.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input className="h-9" value={item.description} onChange={(e) => updateLineItem(item.id, "description", e.target.value)} />
                      </div>
                      <div className="col-span-1 space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input className="h-9" type="number" min={1} value={item.quantity} onChange={(e) => updateLineItem(item.id, "quantity", parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Price (₹)</Label>
                        <Input className="h-9" type="number" min={0} step={0.01} value={item.unit_price} onChange={(e) => updateLineItem(item.id, "unit_price", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-1 flex items-center justify-between">
                        <span className="text-sm font-medium">₹{item.total_price.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLineItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox checked={formAddTax} onCheckedChange={(c) => setFormAddTax(!!c)} id="addTax" />
                <Label htmlFor="addTax" className="text-sm">Add Tax</Label>
                {formAddTax && (
                  <div className="flex items-center gap-2">
                    <Input className="h-8 w-20" type="number" value={formTaxRate} onChange={(e) => setFormTaxRate(parseFloat(e.target.value) || 0)} />
                    <span className="text-sm text-muted-foreground">%</span>
                    <span className="text-sm ml-2">= ₹{taxAmount.toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Checkbox checked={formAddDiscount} onCheckedChange={(c) => setFormAddDiscount(!!c)} id="addDiscount" />
                <Label htmlFor="addDiscount" className="text-sm">Add Discount</Label>
                {formAddDiscount && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">₹</span>
                    <Input className="h-8 w-24" type="number" value={formDiscountAmount} onChange={(e) => setFormDiscountAmount(parseFloat(e.target.value) || 0)} />
                  </div>
                )}
              </div>

              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total Amount</span>
                <span>₹{totalAmount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Payment instructions, terms, etc." rows={3} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => saveInvoice("draft")} disabled={saving}>Save as Draft</Button>
            <Button onClick={() => saveInvoice("sent")} disabled={saving}>Save & Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Modal */}
      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
            <DialogDescription>
              {selectedInvoice && `Invoice ${selectedInvoice.invoice_number} — ₹${Number(selectedInvoice.total_amount).toLocaleString("en-IN")}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Method (optional)</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidOpen(false)}>Cancel</Button>
            <Button onClick={() => markAsPaid.mutate()} disabled={markAsPaid.isPending}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={viewInvoiceOpen} onOpenChange={setViewInvoiceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              {selectedInvoice && `${selectedInvoice.invoice_number} — ${selectedInvoice.client_name}`}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Invoice Number</p>
                  <p className="font-medium">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={statusConfig[selectedInvoice.status || "draft"]?.variant}>
                    {statusConfig[selectedInvoice.status || "draft"]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(selectedInvoice.invoice_date), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{selectedInvoice.due_date ? format(new Date(selectedInvoice.due_date), "MMM d, yyyy") : "—"}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Line Items</p>
                <div className="space-y-2">
                  {viewLineItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span>{item.description} × {item.quantity}</span>
                      <span className="font-medium">₹{item.total_price.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{Number(selectedInvoice.subtotal).toLocaleString("en-IN")}</span></div>
                {Number(selectedInvoice.tax_amount) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>₹{Number(selectedInvoice.tax_amount).toLocaleString("en-IN")}</span></div>
                )}
                <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span>₹{Number(selectedInvoice.total_amount).toLocaleString("en-IN")}</span></div>
              </div>
              {selectedInvoice.notes && (
                <>
                  <Separator />
                  <div><p className="text-sm text-muted-foreground">Notes</p><p className="text-sm">{selectedInvoice.notes}</p></div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
