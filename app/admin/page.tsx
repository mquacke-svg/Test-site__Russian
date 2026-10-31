import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCatalog } from "@/lib/shop";
import Admin from "@/components/Admin";
export const dynamic = "force-dynamic";
export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  });
  if (!session) redirect("/login?admin=1");
  if (session.user.role !== "admin")
    return (
      <section className="container page-section">
        <h1>Доступ ограничен</h1>
        <p>Этот раздел предназначен для сотрудников пекарни.</p>
      </section>
    );
  return (
    <section className="container page-section admin-page">
      <Admin initial={getCatalog()} />
    </section>
  );
}
