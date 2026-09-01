"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtBytes, fmtCount, fmtMiB } from "@/lib/format";
import type { Inventory, InventoryFile } from "@/lib/types";

const CATEGORY_LABEL: Record<string, string> = {
  audio: "Audio (.m4a)",
  png: "PNG",
  glb: "3D models (.glb)",
  javascript: "JavaScript (app bundles)",
  draco: "Draco decoder",
  webp: "WebP",
  avif: "AVIF",
  jpeg: "JPEG",
  icons: "Icons",
  font: "Fonts",
  share: "Share image",
  "locale-json": "Locale JSON",
  site: "HTML / sitemap / manifest",
  css: "CSS",
  oldBrowser: "Old-browser fallback",
  bin: "AO bins",
  json: "Other JSON",
  xmp: "XMP sidecar",
};

function categoryLabel(key: string) {
  return CATEGORY_LABEL[key] ?? key;
}

export function InventoryExplorer({ inventory }: { inventory: Inventory }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visible, setVisible] = useState(80);

  const categories = useMemo(() => {
    return Object.entries(inventory.by_category).sort(
      (a, b) => b[1].bytes - a[1].bytes,
    );
  }, [inventory.by_category]);

  const maxBytes = categories[0]?.[1].bytes ?? 1;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inventory.files
      .filter((f) => (category === "all" ? true : f.category === category))
      .filter((f) => (q ? f.path.toLowerCase().includes(q) : true))
      .sort((a, b) => b.bytes - a.bytes);
  }, [inventory.files, query, category]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Weight by type</CardTitle>
          <p className="text-sm text-muted-foreground">
            Audio is 37% of the hosted set. Island music plus{" "}
            <code className="font-mono text-xs">audiosprites.m4a</code> (1.88
            MiB) dominate. PNG terrain splats are next, then GLBs.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.map(([key, stats]) => (
            <div key={key} className="grid gap-1 sm:grid-cols-[minmax(0,11rem)_1fr_auto] sm:items-center">
              <div className="flex items-baseline justify-between gap-2 sm:block">
                <span className="text-sm">{categoryLabel(key)}</span>
                <span className="font-mono text-[11px] text-muted-foreground sm:hidden">
                  {fmtCount(stats.files)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(1.5, (stats.bytes / maxBytes) * 100)}%` }}
                />
              </div>
              <div className="hidden font-mono text-xs text-muted-foreground sm:block">
                {fmtCount(stats.files)} · {fmtMiB(stats.bytes)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Every hosted file</CardTitle>
          <p className="text-sm text-muted-foreground">
            {fmtCount(inventory.totals.real_files)} real files. SPA fallbacks
            for missing URLs were excluded. Search a name, or filter by type.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(80);
              }}
              placeholder="Search paths — audiosprites, IslandWest, draco…"
              className="sm:max-w-sm"
            />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setVisible(80);
              }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="all">All types</option>
              {categories.map(([key]) => (
                <option key={key} value={key}>
                  {categoryLabel(key)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            {fmtCount(filtered.length)} match
            {filtered.length === 1 ? "" : "es"} · showing{" "}
            {Math.min(visible, filtered.length)}
          </p>
          <FileTable files={filtered.slice(0, visible)} />
          {visible < filtered.length ? (
            <button
              type="button"
              className="text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => setVisible((n) => n + 120)}
            >
              Show more
            </button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function FileTable({ files }: { files: InventoryFile[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Path</TableHead>
            <TableHead className="text-right">Size</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              Gzip-6
            </TableHead>
            <TableHead className="hidden md:table-cell">Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.path}>
              <TableCell className="max-w-[18rem] truncate font-mono text-xs sm:max-w-xl">
                {file.path === "/" ? "/ (index.html)" : file.path}
              </TableCell>
              <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                {fmtBytes(file.bytes)}
              </TableCell>
              <TableCell className="hidden text-right font-mono text-xs whitespace-nowrap sm:table-cell">
                {fmtBytes(file.gzip_bytes)}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant="secondary">{categoryLabel(file.category)}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
