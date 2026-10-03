/** Textos humanos para mostrar ventas: "Brownie x2, Torta" y su emoji. */
import { normalize } from "@/lib/search";

type ItemLike = { name_snapshot?: string; name?: string; quantity: number };

/** "Brownie x2, Torta" (la cantidad 1 no se muestra). */
export function itemsText(items: ItemLike[]): string {
  return items
    .map((it) => {
      const name = it.name_snapshot ?? it.name ?? "";
      return it.quantity === 1 ? name : `${name} x${formatQty(it.quantity)}`;
    })
    .join(", ");
}

function formatQty(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

const EMOJIS: [string[], string][] = [
  [["torta", "pie", "kuchen"], "🍰"],
  [["cupcake", "muffin"], "🧁"],
  [["galleta", "alfajor", "cookie"], "🍪"],
  [["brownie", "chocolate", "bombon", "trufa"], "🍫"],
  [["queque", "pan", "budin"], "🍞"],
  [["donut", "dona"], "🍩"],
  [["helado"], "🍨"],
  [["postre", "flan", "mousse"], "🍮"],
];

/** Emoji según el nombre o la categoría del producto. */
export function productEmoji(...hints: (string | null | undefined)[]): string {
  const text = normalize(hints.filter(Boolean).join(" "));
  for (const [words, emoji] of EMOJIS) {
    if (words.some((w) => text.includes(w))) return emoji;
  }
  return "🧁";
}
