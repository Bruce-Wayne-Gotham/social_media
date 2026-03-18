import { PublicApprovalShell } from "@/src/components/PublicApprovalShell";

export default function ApprovalLinkPage({ params }) {
  return <PublicApprovalShell token={params.token} />;
}
