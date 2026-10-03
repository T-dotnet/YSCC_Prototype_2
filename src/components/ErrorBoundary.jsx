import React from "react";
import { Button } from "./UI";
import { clearPrototypeStorage } from "../prototypeStorage.js";

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
        <div className="error-boundary" role="alert">
          <h1>Something went wrong.</h1>
          <p>{this.state.error?.toString()}</p>
          <div className="error-boundary-actions">
            <Button type="button" variant="primary" onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button type="button" variant="secondary" onClick={() => {
              if (!window.confirm("Clear locally saved workspace data and reset the prototype? This cannot be undone.")) return;
              clearPrototypeStorage(localStorage);
              window.location.reload();
            }}>
              Clear data and reset
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
