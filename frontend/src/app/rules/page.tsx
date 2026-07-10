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
    <main className="relative isolate flex flex-1 bg-[#2b1e12] px-4 py-10 text-[#2b1e12] sm:px-6 lg:py-14">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(43,30,18,0.58),rgba(43,30,18,0.76)),radial-gradient(circle_at_center,transparent_36%,rgba(43,30,18,0.42)_128%),url('/textures/parchment-background.png')] bg-cover bg-fixed bg-center bg-no-repeat"
        aria-hidden="true"
      />

      <section className="relative mx-auto flex w-full max-w-5xl items-start justify-center">
        <div className="relative min-h-[58rem] w-full max-w-4xl">
          <div
            className="pointer-events-none absolute inset-x-6 inset-y-10 rounded-[40%] bg-[#bba88d]/18 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-12 top-12 h-40 rounded-full bg-[#946440]/20 blur-3xl"
            aria-hidden="true"
          />
          <img
            src="/images/parchment-scroll-transparent.png"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-fill drop-shadow-[0_24px_50px_rgba(43,30,18,0.42)]"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-3xl px-8 py-24 sm:px-14 sm:py-28 lg:px-20">
            <div className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#946440]/60 bg-[#2b1e12]/10 text-[#5d542b]">
                <ScrollText className="size-7" aria-hidden="true" />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.32em] text-[#5d542b]">
                The charter of play
              </p>
              <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight text-[#2b1e12] sm:text-5xl">
                Rules of Mithril Tiles
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#3b2818]">
                Draw boldly, guess quickly, and keep the room fair. The game is
                simple by design: one drawer, many guessers, and a ticking clock.
              </p>
            </div>

            <div className="mt-12 grid gap-4">
              {rules.map(({ icon: Icon, title, description }, index) => (
                <article
                  key={title}
                  className="grid gap-4 rounded-2xl border border-[#946440]/35 bg-[#f4ead7]/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-[1px] sm:grid-cols-[auto_1fr]"
                >
                  <div className="flex size-11 items-center justify-center rounded-xl border border-[#946440]/45 bg-[#2b1e12]/10 text-[#5d542b]">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-serif text-lg font-bold text-[#2b1e12]">
                      {index + 1}. {title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[#3b2818]">
                      {description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
