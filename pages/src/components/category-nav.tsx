import { useMemo } from "react";
import { Link } from "react-router-dom";

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

function toNumberOrNull(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export default function CategoryNav({
  currentCategoryId,
  categories,
  className,
}: CategoryNavProps) {
  const currentId = String(currentCategoryId);

  // Dedupe by id to avoid React duplicate key issues.
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

  const topLevelId = useMemo(() => {
    // Find the top-level ancestor: parentId == 0 (or no parent / invalid).
    // Walk up current -> ... -> top
    let cursorId: string | null = currentId;
    const visited = new Set<string>();

    while (cursorId) {
      if (visited.has(cursorId)) break;
      visited.add(cursorId);

      const cursor = categoriesById.get(cursorId);
      if (!cursor) break;

      const parentId = toNumberOrNull(cursor.parentId);
      if (parentId === null || parentId === 0) return cursorId;

      cursorId = String(parentId);
    }

    return currentId;
  }, [categoriesById, currentId]);

  const topLevelCategory = categoriesById.get(topLevelId) ?? null;

  const otherTopLevels = useMemo(() => {
    const list = uniqueCategories
      .filter((c) => toNumberOrNull(c.parentId) === 0)
      .map((c) => ({ ...c, id: String(c.id) }));
    list.sort((a, b) => a.title.localeCompare(b.title));
    return list.filter((c) => c.id !== topLevelId);
  }, [uniqueCategories, topLevelId]);

  const topLevelChildren = useMemo(() => {
    const topIdNum = Number.parseInt(topLevelId, 10);
    if (!Number.isFinite(topIdNum)) return [];

    const list = uniqueCategories
      .filter((c) => toNumberOrNull(c.parentId) === topIdNum)
      .map((c) => ({ ...c, id: String(c.id) }));

    list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [uniqueCategories, topLevelId]);

  const parentOfCurrentId = useMemo(() => {
    if (!currentCategory) return null;
    const parentId = toNumberOrNull(currentCategory.parentId);
    if (parentId === null || parentId === 0) return null;
    return String(parentId);
  }, [currentCategory]);

  const siblingsOfCurrentPage = useMemo(() => {
    // siblings of current page category = children of parentOfCurrentId
    if (!parentOfCurrentId) return [];
    const parentIdNum = Number.parseInt(parentOfCurrentId, 10);
    if (!Number.isFinite(parentIdNum)) return [];

    const list = uniqueCategories
      .filter((c) => toNumberOrNull(c.parentId) === parentIdNum)
      .map((c) => ({ ...c, id: String(c.id) }));

    list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [uniqueCategories, parentOfCurrentId]);

  if (!currentCategory || !topLevelCategory) {
    return (
      <aside className={className ?? "w-full md:w-72 md:flex-shrink-0"}>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Categories</h2>
          <p className="text-sm text-gray-600">Unknown category</p>
        </div>
      </aside>
    );
  }

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

            {/* Current top-level category: show all its children.
                If a top-level child is the direct parent of the current category,
                expand it to show the current category siblings (direct children). */}
            <ul className="space-y-2">
              <li key={`top-${topLevelCategory.id}`}>
                <Link
                  to={`/category/${topLevelCategory.id}`}
                  className={[
                    "block rounded-md border px-3 py-2 text-sm transition",
                    topLevelCategory.id === currentId
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                  ].join(" ")}
                  aria-current={topLevelCategory.id === currentId ? "page" : undefined}
                >
                  {topLevelCategory.title}
                </Link>

                <ul className="mt-2 space-y-2 ml-3 pl-3 border-l border-gray-200">
                  {topLevelChildren.map((child, idx) => {
                    const childKey = `${child.id}-${idx}`;
                    const isParentOfCurrent = child.id === parentOfCurrentId;

                    return (
                      <li key={childKey}>
                        <Link
                          to={`/category/${child.id}`}
                          className={[
                            "block rounded-md border px-3 py-2 text-sm transition",
                            child.id === currentId
                              ? "border-black bg-black text-white"
                              : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                          ].join(" ")}
                          aria-current={child.id === currentId ? "page" : undefined}
                        >
                          {child.title}
                        </Link>

                        {isParentOfCurrent ? (
                          <ul className="mt-2 space-y-2 ml-3 pl-3 border-l border-gray-200">
                            {siblingsOfCurrentPage.length === 0 ? (
                              <li className="text-sm text-gray-600">No sub-categories</li>
                            ) : (
                              siblingsOfCurrentPage.map((sib, sibIdx) => (
                                <li key={`${sib.id}-${sibIdx}`}>
                                  <Link
                                    to={`/category/${sib.id}`}
                                    className={[
                                      "block rounded-md border px-3 py-2 text-sm transition",
                                      sib.id === currentId
                                        ? "border-black bg-black text-white"
                                        : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                                    ].join(" ")}
                                    aria-current={sib.id === currentId ? "page" : undefined}
                                  >
                                    {sib.title}
                                  </Link>
                                </li>
                              ))
                            )}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            </ul>
          </div>

          {/* Other top-level categories (siblings of top-level) */}
          {otherTopLevels.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Other top-level
              </h3>

              <ul className="space-y-2">
                {otherTopLevels.map((cat, idx) => {
                  const key = `${cat.id}-${idx}`;
                  const active = cat.id === currentId;

                  return (
                    <li key={key}>
                      <Link
                        to={`/category/${cat.id}`}
                        className={[
                          "block rounded-md border px-3 py-2 text-sm transition",
                          active
                            ? "border-black bg-black text-white"
                            : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                        ].join(" ")}
                        aria-current={active ? "page" : undefined}
                      >
                        {cat.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </nav>
      </div>
    </aside>
  );
}
