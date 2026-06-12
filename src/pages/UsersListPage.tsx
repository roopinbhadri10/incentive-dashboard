import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ChevronDown, Download, Upload, Trash2, Users, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { PROGRAM_ROLES } from "@/components/wizard/builderState";
import {
  addBatch,
  batchesForRole,
  deleteBatch,
  listBatches,
  newBatchId,
  updateUserActive,
  USER_TEMPLATE_COLUMNS,
  type UserListBatch,
  type UserListUser,
} from "@/lib/userListsStore";

function downloadTemplate(role: string) {
  const sample: Record<string, string> = {
    "Employee ID": "EMP10234",
    "Name": "Rahul Sharma",
    "Email": "rahul.sharma@salescode.ai",
    "Region": "West",
    "State": "Maharashtra",
    "City": "Mumbai",
    "Reporting Manager": "Anjali Patel",
    "Join Date": "2024-05-12",
    "Active": "Yes",
  };
  const empty: Record<string, string> = Object.fromEntries(USER_TEMPLATE_COLUMNS.map((c) => [c, ""]));
  const ws = XLSX.utils.json_to_sheet([sample, empty, empty]);
  Object.assign(ws, { "!cols": USER_TEMPLATE_COLUMNS.map((c) => ({ wch: Math.max(c.length + 4, 18) })) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Users");
  const safe = role.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  XLSX.writeFile(wb, `user-list-template_${safe}.xlsx`);
}

function parseFile(file: File): Promise<UserListUser[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const users: UserListUser[] = rows
          .filter((r) => String(r["Employee ID"] ?? "").trim() || String(r["Name"] ?? "").trim())
          .map((r) => {
            const activeRaw = String(r["Active"] ?? "Yes").trim().toLowerCase();
            const active = !["no", "n", "inactive", "false", "0"].includes(activeRaw);
            return {
              empId: String(r["Employee ID"] ?? "").trim(),
              name: String(r["Name"] ?? "").trim(),
              email: String(r["Email"] ?? "").trim(),
              region: String(r["Region"] ?? "").trim(),
              state: String(r["State"] ?? "").trim(),
              city: String(r["City"] ?? "").trim(),
              reportingManager: String(r["Reporting Manager"] ?? "").trim(),
              joinDate: String(r["Join Date"] ?? "").trim(),
              active,
            };
          });
        resolve(users);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function UsersListPage() {
  const [role, setRole] = useState<string>(PROGRAM_ROLES[0]);
  const [batches, setBatches] = useState<UserListBatch[]>(() => listBatches());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = () => setBatches(listBatches());
    window.addEventListener("userLists:change", h);
    return () => window.removeEventListener("userLists:change", h);
  }, []);

  const roleBatches = batchesForRole(role);
  const totalUsers = roleBatches.reduce((s, b) => s + b.users.length, 0);
  const activeUsers = roleBatches.reduce((s, b) => s + b.users.filter((u) => u.active).length, 0);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const users = await parseFile(file);
      if (users.length === 0) {
        toast.error("No users found in file", { description: "Check the column names match the template." });
      } else {
        addBatch({
          id: newBatchId(),
          role,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          users,
        });
        toast.success(`Uploaded ${users.length} users`, { description: `Added to ${role}` });
      }
    } catch {
      toast.error("Failed to parse file", { description: "Use the provided .xlsx template." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="bg-card rounded-xl mx-4 mt-4 mb-4 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-[26px] bg-primary rounded-full" />
          <div>
            <h1 className="text-[22px] font-semibold text-foreground leading-tight">Users List</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload and manage user lists per role. Multiple uploads for the same role stack together.
            </p>
          </div>
        </div>

        {/* Upload card */}
        <Card className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => downloadTemplate(role)} className="gap-2">
                <Download size={14} /> Download template
              </Button>
              <Button onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload size={14} /> Upload list
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onUpload}
                className="hidden"
              />
            </div>
          </div>
          {roleBatches.length > 0 && (
            <div className="flex gap-2 pt-1">
              <Badge variant="secondary" className="text-[10px]">{roleBatches.length} upload{roleBatches.length === 1 ? "" : "s"}</Badge>
              <Badge variant="secondary" className="text-[10px]">{totalUsers} users total</Badge>
              <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{activeUsers} active</Badge>
            </div>
          )}
        </Card>

        {/* Lists */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <FileSpreadsheet size={12} /> Uploaded lists for {role}
          </div>
          {roleBatches.length === 0 ? (
            <Card className="p-8 border-dashed text-center">
              <Users className="mx-auto mb-2 text-muted-foreground" size={28} />
              <p className="text-sm text-muted-foreground">No lists uploaded for this role yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Download the template, fill in users and upload.</p>
            </Card>
          ) : (
            roleBatches.map((b) => <BatchCard key={b.id} batch={b} />)
          )}
        </div>
      </div>
    </div>
  );
}

function BatchCard({ batch }: { batch: UserListBatch }) {
  const [open, setOpen] = useState(false);
  const active = batch.users.filter((u) => u.active).length;

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete list "${batch.fileName}"? This cannot be undone.`)) {
      deleteBatch(batch.id);
      toast.success("List deleted");
    }
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition">
            <ChevronDown
              size={16}
              className={`text-muted-foreground transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{batch.fileName}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {batch.users.length} users · {active} active · uploaded {new Date(batch.uploadedAt).toLocaleString()}
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px]">{batch.users.length} users</Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 size={14} />
            </Button>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9 text-xs">Employee ID</TableHead>
                  <TableHead className="h-9 text-xs">Name</TableHead>
                  <TableHead className="h-9 text-xs">Email</TableHead>
                  <TableHead className="h-9 text-xs">Region</TableHead>
                  <TableHead className="h-9 text-xs">State</TableHead>
                  <TableHead className="h-9 text-xs">City</TableHead>
                  <TableHead className="h-9 text-xs">Reporting Mgr</TableHead>
                  <TableHead className="h-9 text-xs">Join Date</TableHead>
                  <TableHead className="h-9 text-xs text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.users.map((u) => (
                  <TableRow key={u.empId + u.name} className={!u.active ? "opacity-50" : ""}>
                    <TableCell className="py-2 text-xs font-mono">{u.empId}</TableCell>
                    <TableCell className="py-2 text-xs font-medium">{u.name}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="py-2 text-xs">{u.region}</TableCell>
                    <TableCell className="py-2 text-xs">{u.state}</TableCell>
                    <TableCell className="py-2 text-xs">{u.city}</TableCell>
                    <TableCell className="py-2 text-xs">{u.reportingManager}</TableCell>
                    <TableCell className="py-2 text-xs">{u.joinDate}</TableCell>
                    <TableCell className="py-2 text-right">
                      <Switch
                        checked={u.active}
                        onCheckedChange={(v) => updateUserActive(batch.id, u.empId, v)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
