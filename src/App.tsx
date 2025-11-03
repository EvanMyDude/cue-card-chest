import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MigrationWizard } from "@/components/MigrationWizard";
import { useMigration } from "@/hooks/useMigration";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const { user } = useAuth();
  const { isReady } = useOfflineStorage();
  const migration = useMigration();
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    if (user && isReady && migration.state.phase === 'backup-ready') {
      setShowMigration(true);
    }
  }, [user, isReady, migration.state.phase]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* Use Vite's BASE_URL so it matches vite.config.js automatically */}
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* Add all custom routes ABOVE the catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>

        <MigrationWizard
          open={showMigration}
          onOpenChange={setShowMigration}
          onComplete={() => {
            setShowMigration(false);
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
