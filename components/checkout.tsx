"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Check,
  ShoppingBag,
} from "lucide-react";
import { useShop, request } from "./shop-provider";
import { Book } from "./book-art";
import { formatMoney } from "@/lib/commerce";
import type { Order } from "@/lib/types";
export function Checkout() {
  const { cart, user, loading, connected, busy, change, signIn, refresh } =
    useShop();
  const router = useRouter();
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [requestId, setRequestId] = useState("");
  useEffect(() => {
    setRequestId(crypto.randomUUID());
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !user || !requestId) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { order } = await request<{ order: Order }>("/api/checkout", {
        request_id: requestId,
        full_name: form.get("full_name"),
        phone: form.get("phone"),
        address: form.get("address"),
        city: form.get("city"),
        state: form.get("state"),
        notes: form.get("notes"),
      });
      await refresh();
      router.push("/orders/" + order.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your order could not be saved. Please retry.",
      );
      setSaving(false);
    }
  }
  return (
    <section className="checkout-page wrap page-shell">
      <Link href="/#collection" className="back-link">
        <ArrowLeft size={16} /> Continue shopping
      </Link>
      <div className="checkout-title">
        <div>
          <p className="section-kicker">A few details, then it is yours.</p>
          <h1>Make it a good mail day.</h1>
        </div>
        <span>
          <ShieldCheck size={18} /> Pay on delivery
        </span>
      </div>
      {loading ? (
        <p className="loading-state">Loading your bag…</p>
      ) : !connected ? (
        <div className="empty-panel">
          <h2>The shop is getting ready.</h2>
          <p>Checkout will open once the shop connection is complete.</p>
          <Link className="primary-button" href="/#collection">
            Browse the collection
          </Link>
        </div>
      ) : cart.items.length === 0 ? (
        <div className="empty-panel">
          <ShoppingBag size={40} />
          <h2>Your bag is waiting.</h2>
          <p>Add a notebook or planner before checking out.</p>
          <Link className="primary-button" href="/#collection">
            Find your paper companion
          </Link>
        </div>
      ) : (
        <div className="checkout-grid">
          <form className="checkout-form" onSubmit={submit}>
            <section className="form-section">
              <div className="form-heading">
                <span className="step-number">1</span>
                <h2>Your account</h2>
                {user && <Check className="step-check" size={20} />}
              </div>
              {user ? (
                <div className="signed-in">
                  <p>
                    Signed in as <strong>{user.name || user.email}</strong>
                  </p>
                  <span>{user.email}</span>
                  <p className="small muted">
                    Your confirmation email will go to this address.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="muted">
                    Sign in to save your order and receive your confirmation.
                  </p>
                  <button
                    className="google-button"
                    type="button"
                    onClick={() => void signIn("/checkout")}
                  >
                    <span className="google-g" aria-hidden="true">
                      G
                    </span>
                    Continue with Google
                  </button>
                </div>
              )}
            </section>
            <fieldset className="form-section" disabled={!user || saving}>
              <legend className="form-heading">
                <span className="step-number">2</span>
                <h2>Delivery details</h2>
              </legend>
              <div className="form-fields">
                <label className="span-two">
                  Full name
                  <input
                    name="full_name"
                    autoComplete="name"
                    defaultValue={user?.name || ""}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <label className="span-two">
                  Phone number
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="e.g. 0801 234 5678"
                    required
                    minLength={7}
                    maxLength={25}
                  />
                </label>
                <label className="span-two">
                  Street address
                  <textarea
                    name="address"
                    autoComplete="street-address"
                    rows={2}
                    placeholder="House number, street, and area"
                    required
                    minLength={5}
                    maxLength={250}
                  />
                </label>
                <label>
                  City
                  <input
                    name="city"
                    autoComplete="address-level2"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
                <label>
                  State
                  <select
                    name="state"
                    autoComplete="address-level1"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Select a state
                    </option>
                    {[
                      "Abia",
                      "Adamawa",
                      "Akwa Ibom",
                      "Anambra",
                      "Bauchi",
                      "Bayelsa",
                      "Benue",
                      "Borno",
                      "Cross River",
                      "Delta",
                      "Ebonyi",
                      "Edo",
                      "Ekiti",
                      "Enugu",
                      "FCT Abuja",
                      "Gombe",
                      "Imo",
                      "Jigawa",
                      "Kaduna",
                      "Kano",
                      "Katsina",
                      "Kebbi",
                      "Kogi",
                      "Kwara",
                      "Lagos",
                      "Nasarawa",
                      "Niger",
                      "Ogun",
                      "Ondo",
                      "Osun",
                      "Oyo",
                      "Plateau",
                      "Rivers",
                      "Sokoto",
                      "Taraba",
                      "Yobe",
                      "Zamfara",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="span-two">
                  Delivery note <span className="optional">(optional)</span>
                  <textarea
                    name="notes"
                    maxLength={500}
                    rows={2}
                    placeholder="Anything that would help with delivery?"
                  />
                </label>
              </div>
            </fieldset>
            <section className="form-section">
              <div className="form-heading">
                <span className="step-number">3</span>
                <h2>Payment</h2>
              </div>
              <div className="payment-option">
                <span className="radio-dot" />
                <div>
                  <strong>Pay on delivery</strong>
                  <p>No card details or online payment needed.</p>
                </div>
                <Check size={19} />
              </div>
              <div className="payment-option payment-disabled">
                <span className="radio-dot" />
                <div>
                  <strong>Online Payment</strong>
                  <p>Card and Bank Payment Coming Soon.</p>
                </div>
              </div>
            </section>
            <p className="demo-note">
              Checkout is currently in testing. Orders placed during this period
              will not be charged or dispatched.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Link href="/#collection" className="checkout-back-button">
              <ArrowLeft size={17} />
              Back to collection
            </Link>
            <button
              className="primary-button full-width place-order"
              disabled={!user || saving || busy || !requestId}
              type="submit"
            >
              {saving
                ? "Saving your order…"
                : "Place order · " + formatMoney(cart.total_kobo)}
              {!saving && <ArrowRight size={18} />}
            </button>
          </form>
          <aside className="order-summary">
            <h2>
              In your bag{" "}
              <span>({cart.items.reduce((n, i) => n + i.quantity, 0)})</span>
            </h2>
            {cart.items.map((item) => (
              <div className="summary-product" key={item.product_id}>
                <div className="mini-art">
                  <Book product={item.product} />
                </div>
                <div>
                  <h3>{item.product.name}</h3>
                  <label className="summary-quantity">
                    Qty
                    <select
                      aria-label={"Quantity for " + item.product.name}
                      value={item.quantity}
                      disabled={busy || saving}
                      onChange={(e) =>
                        void change(item.product_id, Number(e.target.value))
                      }
                    >
                      {Array.from(
                        {
                          length:
                            Math.max(
                              item.quantity,
                              Math.min(item.product.stock, 10),
                            ) + 1,
                        },
                        (_, i) => (
                          <option key={i} value={i}>
                            {i === 0 ? "Remove" : i}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="checkout-remove"
                    disabled={busy || saving}
                    onClick={() => void change(item.product_id, 0)}
                  >
                    Remove
                  </button>
                </div>
                <strong>
                  {formatMoney(item.product.price_kobo * item.quantity)}
                </strong>
              </div>
            ))}
            <div className="summary-totals">
              <p>
                <span>Subtotal</span>
                <span>{formatMoney(cart.subtotal_kobo)}</span>
              </p>
              <p>
                <span>Delivery</span>
                <span>
                  {cart.shipping_kobo
                    ? formatMoney(cart.shipping_kobo)
                    : "Free"}
                </span>
              </p>
              <p className="total-line">
                <strong>Total</strong>
                <strong>{formatMoney(cart.total_kobo)}</strong>
              </p>
            </div>
            <p className="small muted">
              Prices shown in Nigerian naira. Delivery is free from ₦30,000.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
