function word(w: string): string {
  let n = -1;
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    const vowel = ("aeiou".includes(c) && !(c === "u" && i > 0 && w[i - 1] === "q")) || (c === "y" && i > 0);
    if (vowel) {
      n = i;
      break;
    }
  }
  if (n === 0) return w + "way";
  if (n < 0) return w + "ay";
  return w.slice(n) + w.slice(0, n) + "ay";
}

export function pig_latin(s: string): string {
  if (s === "") return "";
  return s.split(" ").map(word).join(" ");
}
