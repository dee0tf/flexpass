export function csvCell(val: string | number): string {
  const s = String(val ?? "").replace(/"/g, '""');
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
}

export function downloadCSV(rows: string[][], filename: string) {
  const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob), download: filename,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
