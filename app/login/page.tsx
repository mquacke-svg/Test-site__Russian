import Login from "@/components/Login";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <section className="container page-section">
      <div className="section-heading centered">
        <span className="eyebrow">ВАШ УГОЛОК В НАШЕЙ ПЕКАРНЕ</span>
        <h1 style={{ marginTop: 15 }}>Добро пожаловать</h1>
      </div>
      <Login admin={query.admin === "1"} oauthError={!!query.error} />
    </section>
  );
}
