const accents = [
  "#8b5cf6",
  "#f43f5e",
  "#3b82f6",
  "#10b981",
  "#22c55e",
  "#06b6d4",
  "#f59e0b",
];

export function passwordAccent(name: string): string {
  const hash = [...name].reduce(
    (total, character) => total + character.codePointAt(0)!,
    0,
  );
  return accents[hash % accents.length]!;
}
