import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--validation-text)" }}>
          <h1>Something went wrong.</h1>
          <p>{this.state.error?.toString()}</p>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ marginTop: "20px", padding: "10px 20px", cursor: "pointer" }}
          >
            Clear data and reset
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
