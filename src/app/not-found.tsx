export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16 text-center">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          glorb
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">The requested reference asset does not exist.</p>
      </div>
    </main>
  );
}
