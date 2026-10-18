import type { Item } from "./types";

export type Index = {
  byId: Map<string, Item>;
  /** Enfants actifs (hors corbeille) par dossier parent ; la clé "" = racine. */
  children: Map<string, Item[]>;
  /** Enfants de tout état (corbeille comprise). */
  allChildren: Map<string, Item[]>;
};

const key = (id: string | null) => id ?? "";

export function buildIndex(items: Item[]): Index {
  const byId = new Map<string, Item>();
  const children = new Map<string, Item[]>();
  const allChildren = new Map<string, Item[]>();
  for (const it of items) {
    byId.set(it.id, it);
    const k = key(it.parent_id);
    (allChildren.get(k) ?? allChildren.set(k, []).get(k)!).push(it);
    if (!it.deleted_at) (children.get(k) ?? children.set(k, []).get(k)!).push(it);
  }
  return { byId, children, allChildren };
}

export function childrenOf(index: Index, parentId: string | null): Item[] {
  return index.children.get(key(parentId)) ?? [];
}

/** Chemin depuis la racine jusqu'à l'élément (élément inclus). */
export function pathOf(index: Index, id: string | null): Item[] {
  const out: Item[] = [];
  let cur = id ? index.byId.get(id) : undefined;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parent_id ? index.byId.get(cur.parent_id) : undefined;
  }
  return out;
}

export function pathString(index: Index, item: Item): string {
  return pathOf(index, item.id)
    .map((i) => i.name)
    .join("/");
}

/** Tous les descendants d'un élément (lui-même exclu). */
export function descendants(index: Index, id: string, includeTrashed = true): Item[] {
  const out: Item[] = [];
  const stack = [id];
  const source = includeTrashed ? index.allChildren : index.children;
  while (stack.length) {
    const cur = stack.pop()!;
    for (const child of source.get(key(cur)) ?? []) {
      out.push(child);
      if (child.kind === "folder") stack.push(child.id);
    }
  }
  return out;
}

/** Vrai si `maybeDescendant` se trouve dans le sous-arbre de `ancestorId`. */
export function isInside(index: Index, ancestorId: string, maybeDescendant: string | null): boolean {
  let cur = maybeDescendant ? index.byId.get(maybeDescendant) : undefined;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    if (cur.id === ancestorId) return true;
    seen.add(cur.id);
    cur = cur.parent_id ? index.byId.get(cur.parent_id) : undefined;
  }
  return false;
}

/** Racines de la corbeille : éléments supprimés dont le parent n'a pas été supprimé en même temps. */
export function trashRoots(index: Index): Item[] {
  const out: Item[] = [];
  for (const it of index.byId.values()) {
    if (!it.deleted_at) continue;
    const parent = it.parent_id ? index.byId.get(it.parent_id) : undefined;
    if (!parent || parent.deleted_at !== it.deleted_at) out.push(it);
  }
  return out;
}

/** Donne un nom libre dans le dossier : "exo.py" -> "exo (1).py". */
export function uniqueName(index: Index, parentId: string | null, name: string): string {
  const taken = new Set(childrenOf(index, parentId).map((i) => i.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 1; n < 1000; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}
