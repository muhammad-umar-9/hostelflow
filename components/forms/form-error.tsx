export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="animate-fade-up rounded-2xl border border-bad/25 bg-badt px-3.5 py-3 text-[12.5px] font-semibold leading-relaxed text-bad">
      {message}
    </p>
  );
}
