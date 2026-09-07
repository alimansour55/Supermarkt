# Category ↔ Product — Testing & Acceptance Criteria

Definition of done for category tree, product assignment, and cross-surface visibility.

## Automated run

```bash
cd backend
npm run test:acceptance:categories
```

Creates temporary categories/products, asserts backend filters and validation, then cleans up. Requires `MONGODB_URI` (use dev/staging DB).

---

## 1. Create flow

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Admin creates category tree (main → sub → leaf) | All levels saved with correct `parentCategory` / `level` |
| 1.2 | Admin adds product on **leaf** only | Save succeeds; `mainCategory`, `subCategory`, and `category` all point to the same leaf + correct root |
| 1.3 | Admin product list filtered by leaf | Product appears immediately |
| 1.4 | Admin product list filtered by parent/main | Product appears (leaf expansion) |
| 1.5 | Storefront `/category/...` on leaf slug | Product listed |
| 1.6 | Storefront browse parent category | Product listed via descendant expansion |
| 1.7 | Store search by product name | Product returned |
| 1.8 | Homepage section linked to parent category | Section preview shows count ≥ 1; storefront section shows product |

**Reject:** Assigning product to main or mid-level (non-leaf) → validation error before save.

---

## 2. Edit flow

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Change product category from leaf A → leaf B | Save succeeds; all three category fields updated |
| 2.2 | Filter by old leaf A | Product **not** listed |
| 2.3 | Filter by new leaf B | Product **listed** |
| 2.4 | Storefront category pages | Same as filters above |
| 2.5 | Homepage sections using old vs new category | Counts update after save / cache refresh |

---

## 3. Edge cases — clear errors, no silent bad data

| Case | Trigger | Expected |
|------|---------|----------|
| **Inactive category** | Pick inactive leaf in product form | Blocked with inactive message (AR + EN) |
| **Parent / non-leaf** | Pick category with children | Blocked — must choose deeper subcategory |
| **Deleted / missing category** | Section still references deleted category id | Admin: `categoryIssue: missing` + visible warning; not silent empty |
| **Inactive section category** | Section links inactive category | Admin warning; storefront category hidden |
| **Orphaned product ref** | `subCategory` points to deleted id | Integrity scan flags product; repair tool can fix |
| **Import bad slug** | CSV `categorySlug` unknown | Row rejected with `Category not found: "…"` |
| **Import parent as leaf** | CSV uses mid-level slug only | Row rejected — must use full path or leaf slug |
| **Bulk category change** | Products → bulk set category to valid leaf | All selected products updated atomically |
| **Bulk to invalid category** | Bulk set to parent or inactive | API 400 with same messages as single product save |

---

## 4. Manual QA checklist (UI)

### Admin — Categories
- [ ] Create 3-level tree; counts on parent include leaf products
- [ ] Cannot delete category with active products without reassign flow
- [ ] Deactivate category with products prompts reassign

### Admin — Product form
- [ ] `ProductCategoryPicker` only allows leaf selection
- [ ] Breadcrumb shows full path before save
- [ ] Inactive / has-children warnings visible before save

### Admin — Homepage builder
- [ ] Category picker shows preview count + sample products
- [ ] Missing category shows red warning (not empty panel)
- [ ] Inactive category shows amber warning

### Admin — Promotions / offers
- [ ] Category multi-picker uses same expansion as product list
- [ ] Parent category targets all descendant leaf products

### Storefront
- [ ] New product on leaf visible on category page within same session
- [ ] Moving product updates old/new category pages after refresh

---

## 5. Repair & integrity

```bash
npm run repair:categories -- --scan      # report only
npm run repair:categories -- --dry-run   # preview fixes
npm run repair:categories                # apply fixes
```

Acceptance: after a normal create/edit flow, scan reports **0 issues** for affected products.

---

## 6. Sign-off

- [ ] `npm run test:acceptance:categories` passes
- [ ] Manual UI checklist spot-checked
- [ ] No homepage section with `categoryIssue` in admin list (or all acknowledged/fixed)
