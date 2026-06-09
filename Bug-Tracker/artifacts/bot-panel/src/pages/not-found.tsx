import { Terminal } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Terminal className="w-12 h-12 text-primary mx-auto" />
        <h1 className="text-3xl font-bold font-mono text-foreground uppercase tracking-wider">404</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-sm">Page Not Found</p>
      </div>
    </div>
  );
}
