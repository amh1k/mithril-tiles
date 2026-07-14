import {
  Crown,
  Eye,
  MessageCircle,
  Paintbrush,
  ScrollText,
  Trophy,
  Users,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rules | Mithril Tiles",
  description: "Learn how to play Mithril Tiles.",
};

const rules = [
  {
    icon: Users,
    title: "Gather the fellowship",
    description:
      "Create or join a private room, then wait for at least two players before the host begins the game.",
  },
  {
    icon: Crown,
    title: "The host chooses the word pack",
    description:
      "Only the host selects the word pack. Once locked, everyone plays from the same theme.",
  },
  {
    icon: Paintbrush,
    title: "Draw when the quill is yours",
    description:
      "When you are the drawer, your secret word appears privately. Sketch it clearly on the canvas before time runs out.",
  },
  {
    icon: Eye,
    title: "Watch when another player draws",
    description:
      "Non-drawers can see the canvas in real time, but cannot draw during another player’s turn.",
  },
  {
    icon: MessageCircle,
    title: "Guess in the chat",
    description:
      "Submit guesses through chat. Faster correct guesses earn more points, so move quickly.",
  },
  {
    icon: Trophy,
    title: "Win by total score",
    description:
      "Scores carry across rounds. When the game ends, the final ranking reveals the champion.",
  },
];

export default function RulesPage() {
  return (
    <main className="relative isolate flex flex-1 overflow-hidden bg-[#21160e] px-4 py-10 text-[#2b1e12] sm:px-6 lg:py-14">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(43,30,18,0.58),rgba(43,30,18,0.76)),radial-gradient(circle_at_center,transparent_36%,rgba(43,30,18,0.42)_128%),url('/textures/parchment-background.png')] bg-cover bg-fixed bg-center bg-no-repeat"
        aria-hidden="true"
      />

      <section className="panel-enter relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[#946440]/60 bg-[#bba88d] shadow-[0_30px_90px_rgba(10,6,3,0.48)]">
        <header className="relative overflow-hidden border-b border-[#946440]/45 bg-[#2b1e12] px-6 py-10 text-[#f4ead7] sm:px-10 sm:py-14 lg:px-14">
          <ScrollText className="pointer-events-none absolute -bottom-16 -right-8 size-64 text-[#bba88d]/[0.035]" strokeWidth={0.7} aria-hidden="true" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#a98d63]">The charter of play</p>
            <h1 className="mt-5 font-heading text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">Rules of Mithril Tiles</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#cdbb9f]/80 sm:text-lg sm:leading-8">
              Draw boldly, guess quickly, and keep the room fair. One drawer,
              many guessers, and a clock that waits for no fellowship.
            </p>
          </div>
        </header>

        <div className="relative bg-[#bba88d] px-4 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-[#946440]/20" aria-hidden="true" />
          <div className="relative grid gap-4 md:grid-cols-2 lg:gap-5">
            {rules.map(({ icon: Icon, title, description }, index) => (
              <article
                key={title}
                className="group min-w-0 rounded-2xl border border-[#946440]/40 bg-[#d0bda1]/55 p-5 shadow-[inset_0_1px_0_rgba(255,248,218,0.32)] transition-[border-color,box-shadow] duration-200 hover:border-[#5d542b]/65 hover:shadow-[0_12px_28px_rgba(43,30,18,0.12)] sm:p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full border border-[#5d542b]/35 bg-[#2b1e12] text-[#e4d4bc]">
                    <Icon className="size-5" aria-hidden="true" />
                    <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-[#946440] bg-[#bba88d] font-heading text-[0.6rem] font-bold text-[#2b1e12]">
                      {index + 1}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-bold leading-6 text-[#2b1e12] sm:text-xl">{title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#3b2818]">{description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <footer className="relative mt-7 rounded-2xl border border-[#5d542b]/45 bg-[#2b1e12] px-5 py-5 text-center text-[#e4d4bc] sm:px-8">
            <p className="font-heading text-sm font-semibold tracking-wide">The room’s covenant</p>
            <p className="mt-2 text-sm leading-6 text-[#cdbb9f]/75">
              Respect the drawer, keep guesses in the chat, and let every player
              take their rightful turn at the canvas.
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}
