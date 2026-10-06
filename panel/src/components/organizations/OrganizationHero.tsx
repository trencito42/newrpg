import { OrganizationCover } from "./OrganizationCover";

export function OrganizationHero({
  coverUrl,
  coverAlt,
  fallback,
  children,
}: {
  coverUrl: string | null;
  coverAlt: string;
  fallback: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 sm:relative sm:space-y-0">
      <OrganizationCover coverUrl={coverUrl} fallback={fallback} alt={coverAlt} />
      <div className="sm:absolute sm:bottom-0 sm:left-0 sm:right-0 sm:p-5">{children}</div>
    </div>
  );
}
