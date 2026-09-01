import { InventoryExplorer } from "@/components/inventory-explorer";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DUMP_FOLDERS,
  MISSING_FROM_DUMP_LIST,
  RUNTIME_JSON,
} from "@/lib/dump-folders";
import { fmtBytes, fmtCount, fmtMB, fmtMiB } from "@/lib/format";
import type { Inventory } from "@/lib/types";
import inventoryJson from "@/data/inventory.json";

const inventory = inventoryJson as Inventory;

const PREVIOUS = {
  files: 1305,
  bytesMB: 32.4,
  bytesMiB: 30.9,
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-2xl tracking-tight sm:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

export default function Home() {
  const { totals } = inventory;
  const assets = inventory.by_dump_bucket["assets"];
  const missingHosted = MISSING_FROM_DUMP_LIST.reduce((n, f) => n + f.bytes, 0);
  const top = [...inventory.files].sort((a, b) => b.bytes - a.bytes).slice(0, 8);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-4">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Data B-each · reference inventory
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          The retained reference snapshot is {fmtMiB(totals.bytes)} (
          {fmtMB(totals.bytes)}) across {fmtCount(totals.real_files)} files.
        </h1>
        <p className="max-w-2xl text-muted-foreground text-pretty">
          This inventory records the hosted asset snapshot used for the Data
          B-each reference collection. The retained files are now neutralized.
          Source origin label: <code className="font-mono text-xs">databeach.local</code>.
          HTML + <code className="font-mono text-xs">main.js</code> is still
          only ~275 KB. The rest is vendor JS, hundreds of GLBs, terrain
          textures, and twelve audio files.
        </p>
        <p className="text-sm">
          The replicated boot pages are back in{" "}
          <code className="font-mono text-xs">reference/</code>. Run{" "}
          <code className="font-mono text-xs">npm run dump:serve</code> to
          open the neutralized Data B-each reference build with its retained
          visual assets and new logo.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Uncompressed"
          value={fmtMiB(totals.bytes)}
          hint={`${fmtMB(totals.bytes)} · ${fmtCount(totals.bytes)} bytes`}
        />
        <Stat
          label="Gzip-6 of the same set"
          value={fmtMiB(totals.gzip_bytes)}
          hint="Audio and images barely shrink. JS, HTML, JSON, GLB, and WASM do."
        />
        <Stat
          label="Real hosted files"
          value={fmtCount(totals.real_files)}
          hint="SPA HTML returned for missing URLs was excluded."
        />
        <Stat
          label="Typical playthrough"
          value="~26.9 MiB"
          hint="One image format per triple, WOFF2 not WOFF, WASM Draco not the 706 KB JS decoder."
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Were those the files?
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">
            The previous table was the live hosted set, not your Downloads
            dump. This pass found {fmtCount(totals.real_files - PREVIOUS.files)}{" "}
            extra files the earlier count skipped:{" "}
            <code className="font-mono text-xs">/icons/icon_192.png</code>,{" "}
            <code className="font-mono text-xs">/icons/icon_512.png</code>,{" "}
            <code className="font-mono text-xs">/sitemap.xml</code>, and{" "}
            <code className="font-mono text-xs">/robots.txt</code>. That is why
            the total moved from {PREVIOUS.bytesMiB} MiB / {PREVIOUS.bytesMB} MB
            to {fmtMiB(totals.bytes)} / {fmtMB(totals.bytes)}.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Files</TableHead>
                <TableHead className="text-right">Uncompressed</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Gzip-6
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <Row
                name="Audio (.m4a)"
                files={inventory.by_extension.m4a.files}
                bytes={inventory.by_extension.m4a.bytes}
                gzip={inventory.by_extension.m4a.gzip_bytes}
              />
              <Row
                name="PNG"
                files={inventory.by_extension.png.files}
                bytes={inventory.by_extension.png.bytes}
                gzip={inventory.by_extension.png.gzip_bytes}
              />
              <Row
                name="3D models (.glb)"
                files={inventory.by_extension.glb.files}
                bytes={inventory.by_extension.glb.bytes}
                gzip={inventory.by_extension.glb.gzip_bytes}
              />
              <Row
                name="JavaScript (including Draco JS)"
                files={5}
                bytes={
                  (inventory.by_category.javascript?.bytes ?? 0) +
                  (inventory.files.find((f) =>
                    f.path.endsWith("draco_decoder.js"),
                  )?.bytes ?? 0) +
                  (inventory.files.find((f) =>
                    f.path.endsWith("draco_wasm_wrapper.js"),
                  )?.bytes ?? 0)
                }
                gzip={
                  (inventory.by_category.javascript?.gzip_bytes ?? 0) +
                  (inventory.files.find((f) =>
                    f.path.endsWith("draco_decoder.js"),
                  )?.gzip_bytes ?? 0) +
                  (inventory.files.find((f) =>
                    f.path.endsWith("draco_wasm_wrapper.js"),
                  )?.gzip_bytes ?? 0)
                }
              />
              <Row
                name="WebP"
                files={inventory.by_extension.webp.files}
                bytes={inventory.by_extension.webp.bytes}
                gzip={inventory.by_extension.webp.gzip_bytes}
              />
              <Row
                name="AVIF"
                files={inventory.by_extension.avif.files}
                bytes={inventory.by_extension.avif.bytes}
                gzip={inventory.by_extension.avif.gzip_bytes}
              />
              <Row
                name="Everything else"
                files={
                  totals.real_files -
                  inventory.by_extension.m4a.files -
                  inventory.by_extension.png.files -
                  inventory.by_extension.glb.files -
                  5 -
                  inventory.by_extension.webp.files -
                  inventory.by_extension.avif.files
                }
                bytes={
                  totals.bytes -
                  inventory.by_extension.m4a.bytes -
                  inventory.by_extension.png.bytes -
                  inventory.by_extension.glb.bytes -
                  ((inventory.by_category.javascript?.bytes ?? 0) +
                    (inventory.files.find((f) =>
                      f.path.endsWith("draco_decoder.js"),
                    )?.bytes ?? 0) +
                    (inventory.files.find((f) =>
                      f.path.endsWith("draco_wasm_wrapper.js"),
                    )?.bytes ?? 0)) -
                  inventory.by_extension.webp.bytes -
                  inventory.by_extension.avif.bytes
                }
                gzip={
                  totals.gzip_bytes -
                  inventory.by_extension.m4a.gzip_bytes -
                  inventory.by_extension.png.gzip_bytes -
                  inventory.by_extension.glb.gzip_bytes -
                  ((inventory.by_category.javascript?.gzip_bytes ?? 0) +
                    (inventory.files.find((f) =>
                      f.path.endsWith("draco_decoder.js"),
                    )?.gzip_bytes ?? 0) +
                    (inventory.files.find((f) =>
                      f.path.endsWith("draco_wasm_wrapper.js"),
                    )?.gzip_bytes ?? 0)) -
                  inventory.by_extension.webp.gzip_bytes -
                  inventory.by_extension.avif.gzip_bytes
                }
              />
              <TableRow className="font-medium">
                <TableCell>Total hosted</TableCell>
                <TableCell className="text-right font-mono">
                  {fmtCount(totals.real_files)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {fmtMiB(totals.bytes)} / {fmtMB(totals.bytes)}
                </TableCell>
                <TableCell className="hidden text-right font-mono sm:table-cell">
                  {fmtMiB(totals.gzip_bytes)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Your dump folders vs the live game
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">
            The folders you listed are a typical three-rescue layout. They do
            not include every hosted path. If{" "}
            <code className="font-mono text-xs">assets</code> is complete, you
            already have {fmtMiB(assets.bytes)} of the {fmtMiB(totals.bytes)}{" "}
            game. Quick check: that folder should contain twelve{" "}
            <code className="font-mono text-xs">.m4a</code> files and 339{" "}
            <code className="font-mono text-xs">.glb</code> files.
          </p>
        </div>
        <div className="grid gap-3">
          {DUMP_FOLDERS.map((folder) => (
            <Card key={folder.name}>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="font-mono text-base">
                    {folder.name}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {folder.path}
                  </CardDescription>
                </div>
                <Badge variant={folder.inHostedTotal ? "default" : "secondary"}>
                  {folder.inHostedTotal
                    ? "Counts toward 31.53 MiB"
                    : "Not extra hosted bytes"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Live mapping: </span>
                  {folder.mapsTo}
                </p>
                <p className="text-muted-foreground">{folder.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Files those folders do not cover
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">
            Nothing in your list maps to <code className="font-mono text-xs">/vendors/draco/</code>,{" "}
            <code className="font-mono text-xs">/share/</code>, or the site-root
            documents. Together that is {fmtBytes(missingHosted)} if none of it
            landed somewhere else in the dump.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hosted path</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="hidden sm:table-cell">Why it matters</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MISSING_FROM_DUMP_LIST.map((file) => (
                <TableRow key={file.path}>
                  <TableCell className="font-mono text-xs">
                    {file.path === "/" ? "/ (index.html)" : file.path}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                    {fmtBytes(file.bytes)}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {file.why}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Locale JSON (inside assets, easy to miss)
            </CardTitle>
            <CardDescription>
              These five files are built at runtime as{" "}
              <code className="font-mono text-xs">
                /assets/&lt;name&gt;_en.json
              </code>
              . A dump that only regexes static strings can skip them.{" "}
              <code className="font-mono text-xs">dialogs_en.json</code> is 120
              KB by itself.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {RUNTIME_JSON.map((path) => {
              const file = inventory.files.find((f) => f.path === path);
              return (
                <Badge key={path} variant="outline" className="font-mono">
                  {path.replace("/assets/", "")} · {fmtBytes(file?.bytes ?? 0)}
                </Badge>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Heaviest files</h2>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((file) => (
                <TableRow key={file.path}>
                  <TableCell className="font-mono text-xs">{file.path}</TableCell>
                  <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                    {fmtMiB(file.bytes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <InventoryExplorer inventory={inventory} />

      <footer className="border-t pt-6 text-sm text-muted-foreground">
        Measured {inventory.generated} from the preserved hosted snapshot.{" "}
        {fmtCount(inventory.blender_export_key_count)} Blender export keys and{" "}
        {fmtCount(inventory.unhashed_alias_count)} unhashed{" "}
        <code className="font-mono text-xs">/assets/images/…</code> aliases
        resolve to hashed files or to SPA HTML — they are not a second copy of
        the game.
      </footer>
    </div>
  );
}

function Row({
  name,
  files,
  bytes,
  gzip,
}: {
  name: string;
  files: number;
  bytes: number;
  gzip: number;
}) {
  return (
    <TableRow>
      <TableCell>{name}</TableCell>
      <TableCell className="text-right font-mono">{fmtCount(files)}</TableCell>
      <TableCell className="text-right font-mono">{fmtMiB(bytes)}</TableCell>
      <TableCell className="hidden text-right font-mono sm:table-cell">
        {fmtMiB(gzip)}
      </TableCell>
    </TableRow>
  );
}
