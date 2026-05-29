import { Link } from "react-router-dom";
import { useMemo } from "react";

export type CategoryNavItem = {
  id: string;
  title: string;
  parentId?: number | null;
};

type CategoryNavProps = {
  currentCategoryId: string;
  categories: CategoryNavItem[];
  className?: string;
};

function normalizeParentId(parentId: CategoryNavItem["parentId"]): number {
  if (typeof parentId !== "number" || !Number.isFinite(parentId)) return 0;
  return parentId;
}

function sortByTitle<T extends { title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title));
}

export default function CategoryNav({
  currentCategoryId,
  categories,
  className,
}: CategoryNavProps) {
  const currentId = String(currentCategoryId);

  const uniqueCategories = useMemo(() => {
    const map = new Map<string, CategoryNavItem>();
    for (const cat of categories) {
      const id = String(cat.id);
      if (!map.has(id)) map.set(id, cat);
    }
    return Array.from(map.values());
  }, [categories]);

  const categoriesById = useMemo(() => {
    const map = new Map<string, CategoryNavItem>();
    for (const cat of uniqueCategories) map.set(String(cat.id), cat);
    return map;
  }, [uniqueCategories]);

  const currentCategory = categoriesById.get(currentId) ?? null;

  const childrenByParentId = useMemo(() => {
    const map = new Map<number, CategoryNavItem[]>();

    for (const cat of uniqueCategories) {
      const pid = normalizeParentId(cat.parentId);
      const list = map.get(pid) ?? [];
      list.push(cat);
      map.set(pid, list);
    }

    for (const [pid, list] of map.entries()) {
      map.set(pid, sortByTitle(list));
    }

    return map;
  }, [uniqueCategories]);

  // Ancestor chain: top-level -> ... -> current
  const ancestorChain = useMemo(() => {
    const chain: CategoryNavItem[] = [];
    const visited = new Set<string>();

    let cursorId: string | null = currentId;

    while (cursorId) {
      if (visited.has(cursorId)) break;
      visited.add(cursorId);

      const cursor = categoriesById.get(cursorId);
      if (!cursor) break;

      chain.push(cursor);

      const pid = normalizeParentId(cursor.parentId);
      if (pid === 0) break;

      cursorId = String(pid);
    }

    return chain.reverse();
  }, [categoriesById, currentId]);

  const pathSet = useMemo(() => new Set(ancestorChain.map((c) => c.id)), [ancestorChain]);
  const topLevelId = ancestorChain[0]?.id ?? null;

  if (!currentCategory || !topLevelId) {
    return (
      <aside className={className ?? "w-full md:w-72 md:flex-shrink-0"}>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Categories</h2>
          <p className="text-sm text-gray-600">Unknown category</p>
        </div>
      </aside>
    );
  }

  const renderChildren = (parentId: number, depth: number) => {
    const children = childrenByParentId.get(parentId) ?? [];

    if (children.length === 0) return null;

    return (
      <ul className="mt-2 space-y-2 ml-3 pl-3 border-l border-gray-200">
        {children.map((child) => {
          const active = child.id === currentId;
          const onPath = pathSet.has(child.id);

          return (
            <li key={child.id}>
              <Link
                to={`/category/${child.id}`}
                className={[
                  "block rounded-md border px-3 py-2 text-sm transition",
                  active
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {child.title}
              </Link>

              {/* Expand direct children for nodes on the current path (including the current node). */}
              {onPath ? renderChildren(Number(child.id), depth + 1) : null}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <aside className={className ?? "w-full md:w-72 md:flex-shrink-0"}>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
        </div>

        <nav aria-label="Category navigation" className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              By hierarchy
            </h3>

            {/* Show all top-level categories (parentId = 0) */}
            <ul className="space-y-2">
              {(childrenByParentId.get(0) ?? []).map((tl) => {
                const activeTop = tl.id === currentId;
                const expandTop = tl.id === topLevelId;

                return (
                  <li key={tl.id}>
                    <Link
                      to={`/category/${tl.id}`}
                      className={[
                        "block rounded-md border px-3 py-2 text-sm transition",
                        activeTop
                          ? "border-black bg-black text-white"
                          : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                      ].join(" ")}
                      aria-current={activeTop ? "page" : undefined}
                    >
                      {tl.title}
                    </Link>

                    {/* Only expand the currently active top-level category */}
                    {expandTop ? renderChildren(0, 1) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </div>
    </aside>
  );
}
