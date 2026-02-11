import { Component } from "react";
import type { ReactNode } from "react";

type Props = { children: ReactNode };

type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  reset = () => {
    try {
      localStorage.removeItem("kiosk_lang");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-[#f7f4ee]">
          <div className="rounded-xl border border-amber-200 bg-white p-8 text-center space-y-4">
            <div className="text-lg font-semibold">Something went wrong</div>
            <button className="px-4 py-2 rounded-lg bg-emerald-900 text-white" onClick={this.reset}>
              Reset
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
