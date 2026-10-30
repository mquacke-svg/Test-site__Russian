import OrderView from "@/components/OrderView";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <OrderView id={(await params).id} />;
}
