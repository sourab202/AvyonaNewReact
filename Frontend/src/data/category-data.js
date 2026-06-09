export function buildCategoryTree(categories = []) {
  const byId = new Map();
  const roots = [];

  categories.forEach((category) => {
    byId.set(category.id, { ...category, children: [] });
  });

  categories.forEach((category) => {
    const current = byId.get(category.id);

    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId).children.push(current);
      return;
    }

    roots.push(current);
  });

  return roots;
}

export function flattenCategoryTree(categories = []) {
  const output = [];

  function walk(items) {
    items.forEach((item) => {
      output.push(item);
      if (Array.isArray(item.children) && item.children.length) {
        walk(item.children);
      }
    });
  }

  walk(categories);
  return output;
}
