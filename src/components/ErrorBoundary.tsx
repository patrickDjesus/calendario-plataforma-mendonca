import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  private handleClearStorage = () => {
    if (confirm('Deseja limpar todos os dados locais salvos? Isso resetará as configurações para o padrão.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Ops! Algo deu errado.</h1>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Ocorreu um erro inesperado na aplicação. Você pode tentar recarregar a página ou redefinir os dados salvos se o erro persistir.
            </p>

            {this.state.error && (
              <div className="bg-slate-50 rounded-xl p-4 text-left font-mono text-xs text-slate-600 mb-6 max-h-32 overflow-y-auto border border-slate-100 select-text">
                <p className="font-semibold text-slate-700 mb-1">{this.state.error.name}:</p>
                <p>{this.state.error.message}</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-150 shadow-md shadow-violet-600/15"
              >
                Recarregar Página
              </button>
              <button
                onClick={this.handleClearStorage}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-3 px-4 rounded-xl transition duration-150"
              >
                Limpar Dados Locais (Reset)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
