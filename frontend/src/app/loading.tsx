import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <section
        className="panel-enter w-full max-w-sm rounded-3xl border border-[#946440]/55 bg-[#2b1e12]/90 px-7 py-8 text-center text-[#f4ead7] shadow-[0_22px_56px_rgba(43,30,18,0.36)] backdrop-blur-sm"
        aria-live="polite"
        aria-label="Loading page"
      >
        <LoaderCircle
          className="parchment-spinner mx-auto size-8 text-[#bba88d]"
          aria-hidden="true"
        />
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-[#d7bd89]">
          Turning the page
        </p>
        <p className="mt-2 text-sm text-[#f4ead7]/85">
          Preparing the next chapter.
        </p>
      </section>
    </main>
  );
}
