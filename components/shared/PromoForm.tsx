"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Tag } from "lucide-react";
import { validateForm, hasErrors, ValidationErrors } from "@/lib/validation";
import { inputClass, textareaClass, selectClass } from "@/components/shared/FormField";

interface Props { initial?: any; mode: "create" | "edit"; }

const RULES = {
  promocode:        { required: true, minLength: 2, pattern: /^[A-Z0-9_-]+$/i, message: "Code must be at least 2 characters (letters and numbers only)" },
  shortDescription: { required: true, minLength: 5, message: "Description must be at least 5 characters" },
  discount:         { required: true, min: 0.01, message: "Discount must be greater than 0" },
  startDate:        { required: true, message: "Start date is required" },
  expiryDate:       { required: true, message: "Expiry date is required" },
};

export default function PromoForm({ initial = {}, mode }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors,  setErrors]  = useState<ValidationErrors<any>>({});

  // Scope pickers — which products / categories the coupon is limited to.
  const [products,   setProducts]   = useState<{ id: number; productName: string; productId: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productIds, setProductIds] = useState<number[]>(
    Array.isArray(initial.productPromocodes)
      ? initial.productPromocodes.map((p: any) => p.productId ?? p.product?.id).filter(Boolean)
      : [],
  );
  const [categoryIds, setCategoryIds] = useState<number[]>(
    Array.isArray(initial.subcategoryPromocodes)
      ? [...new Set(initial.subcategoryPromocodes.map((s: any) => s.subCategory?.categoryId).filter(Boolean))]
      : [],
  );

  useEffect(() => {
    fetch("/api/products?limit=500").then((r) => r.json()).then((d) => setProducts(d.products ?? [])).catch(() => {});
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : (d.categories ?? []))).catch(() => {});
  }, []);

  const toggleProduct = (id: number) =>
    setProductIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleCategory = (id: number) =>
    setCategoryIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const [form, setForm] = useState({
    promocode:        initial.promocode        ?? "",
    shortDescription: initial.shortDescription ?? "",
    description:      initial.description      ?? "",
    discountType:     initial.discountType?.toString() ?? "1",
    discount:         initial.discount?.toString()     ?? "",
    maximumCap:       initial.maximumCap?.toString()   ?? "0",
    minimumOrderValue: initial.minimumOrderValue?.toString() ?? "",
    startDate:        initial.startDate ? new Date(initial.startDate).toISOString().split("T")[0] : "",
    expiryDate:       initial.expiryDate ? new Date(initial.expiryDate).toISOString().split("T")[0] : "",
    useTime:          initial.useTime?.toString() ?? "2",
    isFirstOrder:     initial.isFirstOrder  ?? false,
    isProduct:        initial.isProduct     ?? false,
    isSubcategory:    initial.isSubcategory ?? false,
    status:           initial.status        ?? false,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    const newVal  = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    const newForm = { ...form, [name]: newVal };
    setForm(newForm);
    if (touched[name]) setErrors(validateForm(newForm, RULES));
  }

  function handleBlur(e: React.FocusEvent<any>) {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors(validateForm(form, RULES));
  }

  // Validate that expiry is after start
  function validateDates(f: typeof form): ValidationErrors<any> {
    const errs = validateForm(f, RULES);
    if (f.startDate && f.expiryDate && new Date(f.expiryDate) <= new Date(f.startDate)) {
      errs.expiryDate = "Expiry date must be after start date";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const allTouched: Record<string, boolean> = {};
    Object.keys(form).forEach((k) => (allTouched[k] = true));
    setTouched(allTouched);
    const newErrors = validateDates(form);
    setErrors(newErrors);
    if (hasErrors(newErrors)) return;

    setLoading(true); setError("");
    const url    = mode === "edit" ? `/api/promocodes/${initial.id}` : "/api/promocodes";
    const method = mode === "edit" ? "PUT" : "POST";
    const res    = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        productIds: form.isProduct ? productIds : [],
        categoryIds: form.isSubcategory ? categoryIds : [],
      }),
    });
    const data   = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    router.push("/promocodes");
    router.refresh();
  }

  const t  = (f: string) => touched[f];
  const er = (f: string) => errors[f as keyof typeof errors];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/promocodes" className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-surface hover:bg-gray-50 text-gray-400">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{mode === "edit" ? `Edit: ${initial.promocode}` : "New Promo Code"}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Fields marked with <span className="text-red-500">*</span> are required</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5" noValidate>
        {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

        {/* Code Details */}
        <div className="bg-surface border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-brand-50 rounded-lg flex items-center justify-center"><Tag size={13} className="text-brand-600" /></div>
            <h2 className="font-semibold text-gray-900 text-sm">Code Details</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Promo Code <span className="text-red-500">*</span></label>
              <input name="promocode" value={form.promocode} onChange={handleChange} onBlur={handleBlur}
                className={`${inputClass(er("promocode"), t("promocode"))} uppercase font-mono font-bold`}
                placeholder="SAVE20" />
              {t("promocode") && er("promocode") && <p className="text-xs text-red-500 mt-1">⚠ {er("promocode")}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
              <div className="flex items-center gap-2 mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="status" checked={form.status} onChange={handleChange} className="w-4 h-4 accent-brand-600" />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Short Description <span className="text-red-500">*</span></label>
            <input name="shortDescription" value={form.shortDescription} onChange={handleChange} onBlur={handleBlur}
              className={inputClass(er("shortDescription"), t("shortDescription"))}
              placeholder="Get 20% off on all products" />
            {t("shortDescription") && er("shortDescription") && <p className="text-xs text-red-500 mt-1">⚠ {er("shortDescription")}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} onBlur={handleBlur}
              rows={2} className={textareaClass(er("description"), t("description"))} placeholder="Optional detailed description" />
          </div>
        </div>

        {/* Discount Settings */}
        <div className="bg-surface border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm mb-2">Discount Settings</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Discount Type <span className="text-red-500">*</span></label>
              <select name="discountType" value={form.discountType} onChange={handleChange} onBlur={handleBlur}
                className={selectClass(er("discountType"), t("discountType"))}>
                <option value="1">Percentage (%)</option>
                <option value="2">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Discount {form.discountType === "1" ? "(%)" : "(₹)"} <span className="text-red-500">*</span>
              </label>
              <input name="discount" value={form.discount} onChange={handleChange} onBlur={handleBlur}
                type="number" className={inputClass(er("discount"), t("discount"))}
                placeholder={form.discountType === "1" ? "20" : "100"} />
              {t("discount") && er("discount") && <p className="text-xs text-red-500 mt-1">⚠ {er("discount")}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Maximum Cap (₹)</label>
              <input name="maximumCap" value={form.maximumCap} onChange={handleChange} onBlur={handleBlur}
                type="number" className={inputClass(er("maximumCap"), t("maximumCap"))} placeholder="500" />
              <p className="text-xs text-gray-400 mt-1">Max discount amount</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Minimum Order Value (₹)</label>
              <input name="minimumOrderValue" value={form.minimumOrderValue} onChange={handleChange} onBlur={handleBlur}
                type="number" className={inputClass()} placeholder="e.g. 1500 (blank = none)" />
              <p className="text-xs text-gray-400 mt-1">Min cart subtotal to use this coupon</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Date <span className="text-red-500">*</span></label>
              <input name="startDate" value={form.startDate} onChange={handleChange} onBlur={handleBlur}
                type="date" className={inputClass(er("startDate"), t("startDate"))} />
              {t("startDate") && er("startDate") && <p className="text-xs text-red-500 mt-1">⚠ {er("startDate")}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Expiry Date <span className="text-red-500">*</span></label>
              <input name="expiryDate" value={form.expiryDate} onChange={handleChange} onBlur={handleBlur}
                type="date" className={inputClass(er("expiryDate"), t("expiryDate"))} />
              {t("expiryDate") && er("expiryDate") && <p className="text-xs text-red-500 mt-1">⚠ {er("expiryDate")}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Usage Limit</label>
              <select name="useTime" value={form.useTime} onChange={handleChange} className={selectClass()}>
                <option value="1">One time per customer</option>
                <option value="2">Multiple times</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scope */}
        <div className="bg-surface border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Promo Code Scope</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: "isFirstOrder",  label: "First Order Only", desc: "Only for customer's first order" },
              { name: "isProduct",     label: "Product Specific", desc: "Applies to selected products" },
              { name: "isSubcategory", label: "Category Specific", desc: "Applies to selected categories" },
            ].map((f) => (
              <label key={f.name} className={`flex flex-col gap-1 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                (form as any)[f.name] ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-gray-300"
              }`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name={f.name} checked={(form as any)[f.name]} onChange={handleChange} className="w-4 h-4 accent-brand-600" />
                  <span className="text-sm font-semibold text-gray-800">{f.label}</span>
                </div>
                <p className="text-xs text-gray-400 pl-6">{f.desc}</p>
              </label>
            ))}
          </div>

          {/* Product picker — shown when "Product Specific" is ticked */}
          {form.isProduct && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Choose products <span className="text-gray-400 font-normal">({productIds.length} selected)</span>
              </p>
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by name or SKU..."
                className={inputClass()}
              />
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                {products
                  .filter((p) => {
                    const q = productSearch.trim().toLowerCase();
                    return !q || p.productName.toLowerCase().includes(q) || (p.productId ?? "").toLowerCase().includes(q);
                  })
                  .slice(0, 100)
                  .map((p) => (
                    <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="w-4 h-4 accent-brand-600" />
                      <span className="text-sm text-gray-800">{p.productName}</span>
                      <span className="ml-auto text-xs text-gray-400">{p.productId}</span>
                    </label>
                  ))}
                {products.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">Loading products…</p>}
              </div>
            </div>
          )}

          {/* Category picker — shown when "Category Specific" is ticked */}
          {form.isSubcategory && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Choose categories <span className="text-gray-400 font-normal">({categoryIds.length} selected)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const on = categoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        on ? "border-brand-600 bg-brand-50 text-brand-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
                {categories.length === 0 && <p className="text-sm text-gray-400">Loading categories…</p>}
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
          <Save size={15} />
          {loading ? "Saving..." : mode === "edit" ? "Update Promo Code" : "Create Promo Code"}
        </button>
      </form>
    </div>
  );
}
