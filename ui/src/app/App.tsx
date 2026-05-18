// Root shell: app-wide providers and client-side router.
import { RouterProvider } from "react-router";
import { router } from "./routing/router";
import { AppProviders } from "./providers";

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
