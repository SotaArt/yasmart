import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ info });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const componentStack = info?.componentStack ?? "";

    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-background">
        <div className="max-w-lg w-full rounded-xl border border-destructive/50 bg-card p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-destructive">Что-то пошло не так</p>
            <p className="text-xs text-muted-foreground">
              Ошибка перехвачена. Откройте консоль (F12) и посмотрите «ErrorBoundary caught» для полного бекона.
            </p>
          </div>
          <div className="text-xs font-mono text-destructive break-words">
            {error.message || String(error)}
          </div>
          {error.stack && (
            <pre className="text-[10px] text-muted-foreground/80 whitespace-pre-wrap break-words max-h-40 overflow-auto border border-border/40 rounded-lg p-2">
              {error.stack}
            </pre>
          )}
          {componentStack && (
            <div className="text-[10px] text-muted-foreground/60 whitespace-pre-wrap break-words max-h-40 overflow-auto border border-border/40 rounded-lg p-2">
              {componentStack}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="text-xs px-3 py-1.5 rounded-md border border-[hsl(var(--gold))]/40 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10 transition-colors"
            >
              Перезагрузить
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("yandex_access_token");
                void fetch("/api/yandex/token", { method: "DELETE" })
                  .catch(() => undefined)
                  .finally(() => window.location.reload());
              }}
              className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Сбросить токен и перезагрузить
            </button>
          </div>
        </div>
      </div>
    );
  }
}