import { AuthGuard } from "@/components/AuthGuard";
import { Nav } from "@/components/Nav";

export default function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <Nav />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </AuthGuard>
  );
}
