import { redirect } from "next/navigation";

export default function AdminBillingRedirectPage() {
  redirect("/pos/admin/secure/control-panel/hm-boutique");
}
