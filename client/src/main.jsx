import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AppToaster from "./components/app-toaster.jsx";
import { SocketProvider } from "./context/SocketContext";
import ThemeBootstrap from "./components/theme/theme-bootstrap.jsx";

createRoot(document.getElementById("root")).render(
  <SocketProvider>
    <ThemeBootstrap />
    <App />
    <AppToaster />
  </SocketProvider>
);
