"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { slugify } from "@/lib/utils";
import { validateForm, hasErrors, ValidationErrors } from "@/lib/validation";
import { inputClass, textareaClass, selectClass } from "@/components/shared/FormField";
import { ImageUpload } from "@/components/shared/ImageUpload";

interface Variation {
  id?: number;
  sku: string; price: string; specialPrice: string; stock: string;
  weightUnit: string; weight: string; dimensionUnit: string;
  length: string; width: string; height: string; variationImage: string;
}

const emptyVariation = (): Variation => ({
  sku: "", price: "", specialPrice: "", stock: "",
  weightUnit: "kg", weight: "", dimensionUnit: "cm",
  length: "", width: "", height: "", variationImage: "",
});

interface Props { initial?: any; mode: "create" | "edit"; }

const FORM_RULES = {
  subcategoryId:    { required: true,  message: "Please select a subcategory" },
  productName:      { required: true, minLength: 2, message: "Product name must be at least 2 characters" },
  shortDescription: { required: true, minLength: 5, message: "Short description must be at least 5 characters" },
  description:      { required: true, minLength: 10, message: "Full description must be at least 10 characters" },
};

const VAR_RULES = {
  sku:   { required: true, message: "SKU is required" },
  // Optional: some products aren't priced yet. Blank is stored as 0, which the
  // storefront shows as "Request a Quote". A price, if given, can't be negative.
  price: { min: 0, message: "Price can't be negative" },
  stock: { required: true, min: 0,    message: "Stock must be 0 or more" },
};

export default function ProductForm({ initial = {}, mode }: Props) {
  const router = useRouter();
  const [loading,          setLoading]          = useState(false);
  const [serverError,      setServerError]      = useState("");
  const [categories,       setCategories]       = useState<any[]>([]);
  // Sub-categories are auto-managed (one per category) — no separate dropdown.
  // On edit, seed from the product's parent category so the category dropdown
  // shows the saved value and the subcategory list loads + pre-selects.
  const [selectedCategory, setSelectedCategory] = useState(
    initial.subcategory?.categoryId?.toString() ?? "",
  );
  const [touched,          setTouched]          = useState<Record<string, boolean>>({});
  const [errors,           setErrors]           = useState<ValidationErrors<any>>({});
  const [varTouched,       setVarTouched]       = useState<Record<string, boolean>[]>([{}]);
  const [varErrors,        setVarErrors]        = useState<ValidationErrors<any>[]>([{}]);

  const [variations, setVariations] = useState<Variation[]>(
    initial.variations?.length
      ? initial.variations.map((v: any) => ({
          id: v.id, sku: v.sku ?? "", price: v.price?.toString() ?? "",
          specialPrice: v.specialPrice?.toString() ?? "", stock: v.stock?.toString() ?? "",
          weightUnit: v.weightUnit ?? "kg", weight: v.weight?.toString() ?? "",
          dimensionUnit: v.dimensionUnit ?? "cm", length: v.length?.toString() ?? "",
          width: v.width?.toString() ?? "", height: v.height?.toString() ?? "",
          variationImage: v.variationImage ?? "",
        }))
      : [emptyVariation()]
  );

  const [form, setForm] = useState({
    subcategoryId:   initial.subcategoryId?.toString() ?? "",
    productName:     initial.productName     ?? "",
    urlSlug:         initial.urlSlug         ?? "",
    productId:       initial.productId       ?? "",
    shortDescription:initial.shortDescription ?? "",
    description:     initial.description     ?? "",
    altTag:          initial.altTag          ?? "",
    metaTitle:       initial.metaTitle       ?? "",
    metaDescription: initial.metaDescription ?? "",
    metaKeywords:    initial.metaKeywords    ?? "",
    isFeatured:      initial.isFeatured      ?? false,
    status:          initial.status          ?? false,
    isNew:           initial.isNew           ?? false,
    isBestSeller:    initial.isBestSeller    ?? false,
    // "Trending" per storefront mode → home Most Loved + Bestsellers page.
    trendingCorporate: (initial.trendingModes ?? []).includes("corporate"),
    trendingPersonal:  (initial.trendingModes ?? []).includes("personal"),
    personalizationEnabled: initial.personalizationEnabled ?? false,
    personalizationPrice:   initial.personalizationPrice?.toString() ?? "",
    // Storefront merchandising
    giftMode:         initial.giftMode ?? "both",
    occasions:        (initial.occasions ?? []).join(", "),
    recipients:       (initial.recipients ?? []).join(", "),
    hamperTier:       initial.hamperTier ?? "",
    rating:           initial.rating?.toString() ?? "",
    reviewCount:      initial.reviewCount?.toString() ?? "",
    badge:            initial.badge ?? "",
    deliveryTimeline: initial.deliveryTimeline ?? "",
    maxQtyPerOrder:   initial.maxQtyPerOrder?.toString() ?? "",
    images:           (initial.images ?? []).join("\n"),
  });

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    fetch(`/api/subcategories?categoryId=${selectedCategory}`)
      .then((r) => r.json())
      .then((subs) => {
        // Assign the category's sub-category behind the scenes so the admin
        // only picks a category (sub-categories are auto-managed, one per cat).
        if (Array.isArray(subs) && subs.length) {
          setForm((f) => ({ ...f, subcategoryId: String(subs[0].id) }));
        }
      });
  }, [selectedCategory]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    const newVal = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    const newForm = { ...form, [name]: newVal };
    if (name === "productName") newForm.urlSlug = slugify(value);
    setForm(newForm);
    if (touched[name]) setErrors(validateForm(newForm, FORM_RULES));
  }

  function handleBlur(e: React.FocusEvent<any>) {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors(validateForm(form, FORM_RULES));
  }

  function handleVariationChange(index: number, field: keyof Variation, value: string) {
    const newVars = variations.map((v, i) => i === index ? { ...v, [field]: value } : v);
    setVariations(newVars);
    if (varTouched[index]?.[field]) {
      const newVarErrors = [...varErrors];
      newVarErrors[index] = validateForm(newVars[index], VAR_RULES);
      setVarErrors(newVarErrors);
    }
  }

  function handleVariationBlur(index: number, field: string) {
    const newVarTouched = [...varTouched];
    newVarTouched[index] = { ...newVarTouched[index], [field]: true };
    setVarTouched(newVarTouched);
    const newVarErrors = [...varErrors];
    newVarErrors[index] = validateForm(variations[index], VAR_RULES);
    setVarErrors(newVarErrors);
  }

  function addVariation() {
    setVariations((prev) => [...prev, emptyVariation()]);
    setVarTouched((prev) => [...prev, {}]);
    setVarErrors((prev) => [...prev, {}]);
  }

  function removeVariation(index: number) {
    setVariations((prev) => prev.filter((_, i) => i !== index));
    setVarTouched((prev) => prev.filter((_, i) => i !== index));
    setVarErrors((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Touch all form fields
    const allTouched: Record<string, boolean> = {};
    Object.keys(form).forEach((k) => (allTouched[k] = true));
    setTouched(allTouched);
    const newErrors = validateForm(form, FORM_RULES);
    setErrors(newErrors);

    // Touch all variation fields
    const newVarTouched = variations.map(() =>
      Object.fromEntries(Object.keys(VAR_RULES).map((k) => [k, true]))
    );
    setVarTouched(newVarTouched);
    const newVarErrors = variations.map((v) => validateForm(v, VAR_RULES));
    setVarErrors(newVarErrors);

    if (hasErrors(newErrors) || newVarErrors.some(hasErrors)) return;

    setLoading(true); setServerError("");
    const url    = mode === "edit" ? `/api/products/${initial.id}` : "/api/products";
    const method = mode === "edit" ? "PUT" : "POST";

    const res  = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        occasions: form.occasions.split(",").map((s) => s.trim()).filter(Boolean),
        recipients: form.recipients.split(",").map((s) => s.trim()).filter(Boolean),
        trendingModes: [
          form.trendingCorporate ? "corporate" : null,
          form.trendingPersonal ? "personal" : null,
        ].filter(Boolean),
        images: form.images.split("\n").map((s) => s.trim()).filter(Boolean),
        variations,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setServerError(data.error ?? "Something went wrong"); return; }
    router.push("/products"); router.refresh();
  }

  const t  = (f: string) => touched[f];
  const er = (f: string) => errors[f as keyof typeof errors];
  const vt = (i: number, f: string) => varTouched[i]?.[f];
  const ve = (i: number, f: string) => varErrors[i]?.[f as keyof (typeof varErrors)[0]];

  const INPUT_BASE = "w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition-all";

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/products" className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-surface hover:bg-gray-50 text-gray-400">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {mode === "edit" ? `Edit: ${initial.productName}` : "New Product"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Fields marked with <span className="text-red-500">*</span> are required</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl" noValidate>
        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{serverError}</div>
        )}

        {/* Basic Info */}
        <div className="bg-surface rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Basic Information</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
            <select value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={selectClass(er("subcategoryId"), t("subcategoryId"))}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {t("subcategoryId") && er("subcategoryId") && <p className="text-xs text-red-500 mt-1">⚠ Please select a category</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product Name <span className="text-red-500">*</span></label>
              <input name="productName" value={form.productName}
                onChange={handleChange} onBlur={handleBlur}
                className={inputClass(er("productName"), t("productName"))}
                placeholder="e.g. Stainless Steel Pan" />
              {t("productName") && er("productName") && <p className="text-xs text-red-500 mt-1">⚠ {er("productName")}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product ID</label>
              <input name="productId" value={form.productId} onChange={handleChange}
                className={inputClass()} placeholder="e.g. SSP-001" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">URL Slug</label>
            <input name="urlSlug" value={form.urlSlug} onChange={handleChange}
              className={inputClass()} placeholder="auto-generated from name" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Short Description <span className="text-red-500">*</span></label>
            <textarea name="shortDescription" value={form.shortDescription}
              onChange={handleChange} onBlur={handleBlur} rows={2}
              className={textareaClass(er("shortDescription"), t("shortDescription"))} />
            {t("shortDescription") && er("shortDescription") && <p className="text-xs text-red-500 mt-1">⚠ {er("shortDescription")}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Description <span className="text-red-500">*</span></label>
            <textarea name="description" value={form.description}
              onChange={handleChange} onBlur={handleBlur} rows={5}
              className={textareaClass(er("description"), t("description"))} />
            {t("description") && er("description") && <p className="text-xs text-red-500 mt-1">⚠ {er("description")}</p>}
          </div>

          <div className="flex flex-wrap gap-6">
            {[
              { name: "isFeatured",  label: "Featured"    },
              { name: "status",      label: "Active"      },
              { name: "isNew",       label: "New Arrival" },
              { name: "isBestSeller",label: "Best Seller" },
              { name: "trendingCorporate", label: "Trending — Corporate" },
              { name: "trendingPersonal",  label: "Trending — Personal"  },
            ].map((f) => (
              <label key={f.name} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name={f.name} checked={(form as any)[f.name]}
                  onChange={handleChange} className="w-4 h-4 accent-brand-600" />
                <span className="text-sm text-gray-700">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Personalization */}
        <div className="bg-surface rounded-2xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Personalization</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Controls the &ldquo;Add Personalized Text / Select Font / Upload Image&rdquo;
              section on the storefront product page.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="personalizationEnabled"
              checked={form.personalizationEnabled}
              onChange={handleChange}
              className="w-4 h-4 accent-brand-600"
            />
            <span className="text-sm text-gray-700">
              Allow personalization for this product
            </span>
          </label>

          {form.personalizationEnabled && (
            <div className="max-w-xs">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Additional Charge (₹)
              </label>
              <input
                type="number"
                name="personalizationPrice"
                min="0"
                step="0.01"
                value={form.personalizationPrice}
                onChange={handleChange}
                className={inputClass()}
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                Added to the item price when a customer personalizes it. Leave
                blank or 0 to offer it free.
              </p>
            </div>
          )}
        </div>

        {/* Merchandising & Storefront */}
        <div className="bg-surface rounded-2xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Merchandising &amp; Storefront</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Controls how this product appears and filters on the storefront.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product Images</label>
            <textarea
              name="images"
              value={form.images}
              onChange={handleChange}
              rows={3}
              className={textareaClass()}
              placeholder="One image URL per line (up to 4)."
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <ImageUpload
                folder="products"
                label="Upload images"
                multiple
                onUploaded={(url) =>
                  setForm((f) => ({
                    ...f,
                    images: f.images.trim() ? `${f.images.trim()}\n${url}` : url,
                  }))
                }
              />
              <span className="text-xs text-gray-500">
                PNG, JPG or WEBP · up to 5 MB. Each upload adds a line above; or paste hosted URLs.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Gift Mode</label>
              <select name="giftMode" value={form.giftMode} onChange={handleChange} className={selectClass()}>
                <option value="both">Both (Personal &amp; Corporate)</option>
                <option value="personal">Personal (B2C)</option>
                <option value="corporate">Corporate (B2B)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Badge</label>
              <select name="badge" value={form.badge} onChange={handleChange} className={selectClass()}>
                <option value="">None</option>
                <option value="Bestseller">Bestseller</option>
                <option value="New">New</option>
                <option value="Limited Edition">Limited Edition</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Occasions</label>
            <input name="occasions" value={form.occasions} onChange={handleChange} className={inputClass()}
              placeholder="Comma-separated, e.g. Diwali, Birthday, Anniversary" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Recipients</label>
            <input name="recipients" value={form.recipients} onChange={handleChange} className={inputClass()}
              placeholder="Comma-separated, e.g. Employees, Clients, Her, Him" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rating (0-5)</label>
              <input type="number" name="rating" min="0" max="5" step="0.1" value={form.rating}
                onChange={handleChange} className={inputClass()} placeholder="4.5" />
              <p className="mt-1 text-xs text-gray-500">Shown as the product's star rating; used by the storefront's <strong>“Top Rated”</strong> sort.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Review Count</label>
              <input type="number" name="reviewCount" min="0" value={form.reviewCount}
                onChange={handleChange} className={inputClass()} placeholder="256" />
              <p className="mt-1 text-xs text-gray-500">The number of reviews shown on the card; used by the storefront's <strong>“Most Popular”</strong> sort (higher = shown first).</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Delivery Timeline</label>
              <input name="deliveryTimeline" value={form.deliveryTimeline} onChange={handleChange}
                className={inputClass()} placeholder="4-7 business days" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Max Qty / Order</label>
              <input type="number" name="maxQtyPerOrder" min="1" value={form.maxQtyPerOrder}
                onChange={handleChange} className={inputClass()} placeholder="10" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Hamper Tier</label>
              <input name="hamperTier" value={form.hamperTier} onChange={handleChange}
                className={inputClass()} placeholder="e.g. Festive, Premium, ₹500" />
            </div>
          </div>
        </div>

        {/* Variations */}
        <div className="bg-surface rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Variations / SKUs</h2>
            <button type="button" onClick={addVariation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
              <Plus size={14} /> Add Variation
            </button>
          </div>

          {variations.map((v, i) => (
            <div key={i} className={`border rounded-xl p-4 space-y-3 ${
              varErrors[i] && Object.values(varErrors[i]).some(Boolean) && varTouched[i] && Object.keys(varTouched[i]).length > 0
                ? "border-red-200 bg-red-50/30"
                : "border-gray-100"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Variation {i + 1}</span>
                {variations.length > 1 && (
                  <button type="button" onClick={() => removeVariation(i)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">SKU <span className="text-red-500">*</span></label>
                  <input value={v.sku}
                    onChange={(e) => handleVariationChange(i, "sku", e.target.value)}
                    onBlur={() => handleVariationBlur(i, "sku")}
                    className={inputClass(ve(i, "sku"), vt(i, "sku"))}
                    placeholder="SSP-001-RED" />
                  {vt(i, "sku") && ve(i, "sku") && <p className="text-xs text-red-500 mt-0.5">⚠ {ve(i, "sku")}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Price (₹)</label>
                  <input type="number" value={v.price}
                    onChange={(e) => handleVariationChange(i, "price", e.target.value)}
                    onBlur={() => handleVariationBlur(i, "price")}
                    className={inputClass(ve(i, "price"), vt(i, "price"))}
                    placeholder="Leave blank = Request a Quote" />
                  {vt(i, "price") && ve(i, "price") && <p className="text-xs text-red-500 mt-0.5">⚠ {ve(i, "price")}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Special Price (₹)</label>
                  <input type="number" value={v.specialPrice}
                    onChange={(e) => handleVariationChange(i, "specialPrice", e.target.value)}
                    className={inputClass()} placeholder="799" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Stock <span className="text-red-500">*</span></label>
                  <input type="number" value={v.stock}
                    onChange={(e) => handleVariationChange(i, "stock", e.target.value)}
                    onBlur={() => handleVariationBlur(i, "stock")}
                    className={inputClass(ve(i, "stock"), vt(i, "stock"))}
                    placeholder="50" />
                  {vt(i, "stock") && ve(i, "stock") && <p className="text-xs text-red-500 mt-0.5">⚠ {ve(i, "stock")}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Weight</label>
                  <div className="flex gap-2">
                    <input type="number" value={v.weight}
                      onChange={(e) => handleVariationChange(i, "weight", e.target.value)}
                      className={inputClass()} placeholder="1.5" />
                    <select value={v.weightUnit}
                      onChange={(e) => handleVariationChange(i, "weightUnit", e.target.value)}
                      className="px-2 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none">
                      <option>kg</option><option>g</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Dimensions (L × W × H)</label>
                  <div className="flex gap-1">
                    <input type="number" value={v.length} onChange={(e) => handleVariationChange(i, "length", e.target.value)} className={inputClass()} placeholder="L" />
                    <input type="number" value={v.width}  onChange={(e) => handleVariationChange(i, "width",  e.target.value)} className={inputClass()} placeholder="W" />
                    <input type="number" value={v.height} onChange={(e) => handleVariationChange(i, "height", e.target.value)} className={inputClass()} placeholder="H" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Variation Image URL</label>
                  <input value={v.variationImage}
                    onChange={(e) => handleVariationChange(i, "variationImage", e.target.value)}
                    className={inputClass()} placeholder="https://..." />
                  <div className="mt-1.5">
                    <ImageUpload
                      folder="products"
                      label="Upload"
                      onUploaded={(url) => handleVariationChange(i, "variationImage", url)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SEO */}
        <div className="bg-surface rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">SEO</h2>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Meta Title</label>
            <input name="metaTitle" value={form.metaTitle} onChange={handleChange} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Meta Description</label>
            <textarea name="metaDescription" value={form.metaDescription} onChange={handleChange} rows={2} className={textareaClass()} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Meta Keywords</label>
            <input name="metaKeywords" value={form.metaKeywords} onChange={handleChange} className={inputClass()} placeholder="keyword1, keyword2" />
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
          <Save size={16} />
          {loading ? "Saving..." : mode === "edit" ? "Update Product" : "Create Product"}
        </button>
      </form>
    </div>
  );
}
