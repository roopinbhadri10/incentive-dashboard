export interface UserListUser {
  empId: string;
  name: string;
  email: string;
  region: string;
  state: string;
  city: string;
  reportingManager: string;
  joinDate: string;
  active: boolean;
}

export interface UserListBatch {
  id: string;
  role: string;
  fileName: string;
  uploadedAt: string;
  users: UserListUser[];
}

const KEY = "userLists.v1";

function read(): UserListBatch[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as UserListBatch[]) : [];
  } catch {
    return [];
  }
}

function write(list: UserListBatch[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("userLists:change"));
}

export function listBatches(): UserListBatch[] {
  return read().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function batchesForRole(role: string) {
  return listBatches().filter((b) => b.role === role);
}

export function addBatch(b: UserListBatch) {
  const all = read();
  all.unshift(b);
  write(all);
}

export function deleteBatch(id: string) {
  write(read().filter((b) => b.id !== id));
}

export function updateUserActive(batchId: string, empId: string, active: boolean) {
  const all = read();
  const idx = all.findIndex((b) => b.id === batchId);
  if (idx < 0) return;
  all[idx] = {
    ...all[idx],
    users: all[idx].users.map((u) => (u.empId === empId ? { ...u, active } : u)),
  };
  write(all);
}

export const USER_TEMPLATE_COLUMNS = [
  "Employee ID",
  "Name",
  "Email",
  "Region",
  "State",
  "City",
  "Reporting Manager",
  "Join Date",
  "Active",
];

export function newBatchId() {
  return `batch_${Math.random().toString(36).slice(2, 10)}`;
}
