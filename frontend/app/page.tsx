import { redirect } from "next/navigation";

export default function Home() {
  // Since this is an authenticated app shell, the root should naturally point to the dashboard.
  redirect("/dashboard");
}
