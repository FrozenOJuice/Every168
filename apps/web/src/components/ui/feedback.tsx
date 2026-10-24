"use client";
export function Loading() {
  return (
    <p className="empty" role="status">
      Loading your records…
    </p>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="empty" role="alert">
      <p>{error.message}</p>
      <button className="button" type="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function PageHeading({
  eyebrow,
  title,
  level = 1,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  level?: 1 | 2;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {level === 2 ? <h2>{title}</h2> : <h1>{title}</h1>}
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}
