export function App() {
  const { platform, versions } = window.api;

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-2 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">Tessera</h1>
      <p className="text-sm text-muted-foreground">
        {platform} · Electron {versions.electron} · Chrome {versions.chrome} · Node {versions.node}
      </p>
    </main>
  );
}
