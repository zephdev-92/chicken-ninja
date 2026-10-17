// Renders the light markup allowed in translated texts — **bold**, *italic* and
// `code` — as real elements, so translators never have to write JSX/HTML.

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

export default function RichText({ text }) {
  return String(text).split(TOKEN).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}
