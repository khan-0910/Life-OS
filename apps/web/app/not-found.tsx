import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-20 max-w-md text-center">
      <h1 className="text-xl font-semibold">Nothing here</h1>
      <p className="mt-2 text-sm text-ink-3">That page does not exist.</p>
      <Link href="/today" className="mt-5 inline-block text-sm text-sage hover:underline">Back to Today</Link>
    </div>
  );
}
