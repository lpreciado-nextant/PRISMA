export function validateAttachmentName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 100 || Array.from(name).some(character => character.charCodeAt(0) < 32 || (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159))) {
    throw new Error("Display name must be 1 to 100 characters without control characters.");
  }
  return name;
}
