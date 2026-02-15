export function slugify(s){
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
