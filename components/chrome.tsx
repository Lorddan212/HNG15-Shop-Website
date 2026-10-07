"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ShoppingBag,
  X,
  Minus,
  Plus,
  ArrowRight,
  BookOpen,
  UserRound,
  LogOut,
  Trash2,
} from "lucide-react";
import { useShop } from "./shop-provider";
import { Book } from "./book-art";
import { formatMoney } from "@/lib/commerce";

export function Header() {
  const { cart, user, setBagOpen, signIn, signOut } = useShop();
  const count = cart.items.reduce((n, item) => n + item.quantity, 0);

  return (
    <>
      <div className="announcement-bar">
        A little space for good ideas. {" "}
        <span>Delivery fee calculated at checkout · Free from ₦30,000</span>
      </div>
      <header className="site-header wrap">
        <Link className="wordmark" href="/" aria-label="FolioVale home">
          <BookOpen size={25} strokeWidth={1.4} />
          FolioVale
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/#collection">The collection</Link>
          <Link href="/#our-story" className="story-nav">
            About FolioVale
          </Link>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
            <Link href="/orders" className="account-link" aria-label="My orders">
              <UserRound size={18} />
              <span>My orders</span>
            </Link>
            <button className="quiet-button account-link sign-out-button" onClick={() => void signOut()}>
              <LogOut size={18} aria-hidden="true" />
              <span>Sign out</span>
            </button>
            </>
          ) : (
            <button
              className="quiet-button account-link"
              onClick={() => void signIn("/")}
            >
              <UserRound size={18} />
              <span>Sign in</span>
            </button>
          )}
          <button
            className="bag-button"
            onClick={() => setBagOpen(true)}
            aria-label={"Open cart, " + count + " items"}
          >
            <ShoppingBag size={19} />
            <span className="bag-word">Cart</span>
            <span className="bag-count">{count}</span>
          </button>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer id="site-footer" className="footer wrap">
      <div>
        <Link className="wordmark" href="/">
          FolioVale
        </Link>
        <p>
          Notebooks, planners, and a little room to think.
          <br />
          For the plans you make and the ideas you keep.
        </p>
      </div>
      <div className="footer-links">
        <Link href="/#collection">Browse the collection</Link>
        <Link href="/orders">Your orders</Link>
        <Link href="/shipping">Delivery &amp; shop information</Link>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} FolioVale</span>
        <span>Thoughtful stationery for everyday ideas.</span>
      </div>
    </footer>
  );
}

export function Notice() {
  const { notice, setNotice, connected, loading } = useShop();

  return (
    <>
      {!loading && !connected && (
        <div className="setup-notice wrap">
          We cannot load the latest collection right now. Please refresh the page
          before placing an order.
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}

export function Bag() {
  const { cart, bagOpen, setBagOpen, change, busy } = useShop();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (bagOpen) {
      ref.current?.showModal();
      document.body.style.overflow = "hidden";
    } else {
      ref.current?.close();
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [bagOpen]);

  return (
    <dialog
      ref={ref}
      className="bag-dialog"
      onCancel={() => setBagOpen(false)}
      aria-labelledby="bag-title"
    >
      <div className="bag-heading">
        <h2 id="bag-title">
          Your cart {" "}
          <span>({cart.items.reduce((n, i) => n + i.quantity, 0)})</span>
        </h2>
        <button
          className="icon-button"
          aria-label="Close cart"
          onClick={() => setBagOpen(false)}
        >
          <X />
        </button>
      </div>
      {cart.items.length === 0 ? (
        <div className="empty-bag">
          <ShoppingBag size={42} strokeWidth={1} />
          <h3>Your cart is empty.</h3>
          <p>Add a notebook, planner, or set from the collection.</p>
          <button className="primary-button" onClick={() => setBagOpen(false)}>
            Explore the collection
          </button>
        </div>
      ) : (
        <>
          <div className="bag-items">
            {cart.items.map((item) => (
              <div className="bag-item" key={item.product_id}>
                <div className="mini-art">
                  <Book product={item.product} />
                </div>
                <div className="bag-item-info">
                  <Link
                    href={"/products/" + item.product.slug}
                    onClick={() => setBagOpen(false)}
                  >
                    {item.product.name}
                  </Link>
                  <p>{formatMoney(item.product.price_kobo)}</p>
                  <div className="quantity-control">
                    <button
                      disabled={busy}
                      aria-label={"Decrease " + item.product.name}
                      onClick={() =>
                        void change(item.product_id, item.quantity - 1)
                      }
                    >
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      disabled={
                        busy ||
                        item.quantity >= Math.min(item.product.stock, 10)
                      }
                      aria-label={"Increase " + item.product.name}
                      onClick={() =>
                        void change(item.product_id, item.quantity + 1)
                      }
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <button
                  disabled={busy}
                  className="remove-button"
                  aria-label={"Remove " + item.product.name}
                  onClick={() => void change(item.product_id, 0)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
          <div className="bag-totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(cart.subtotal_kobo)}</strong>
            </div>
            <div>
              <span>Delivery</span>
              <span>
                {cart.shipping_kobo ? formatMoney(cart.shipping_kobo) : "Free"}
              </span>
            </div>
            <div className="total-line">
              <strong>Total</strong>
              <strong>{formatMoney(cart.total_kobo)}</strong>
            </div>
            <button
              type="button"
              className="text-link bag-continue-shopping"
              onClick={() => setBagOpen(false)}
            >
              Continue shopping
            </button>
            <Link
              className={
                "primary-button full-width " + (busy ? "disabled-link" : "")
              }
              href="/checkout"
              onClick={() => setBagOpen(false)}
            >
              Proceed to checkout <ArrowRight size={18} />
            </Link>
            <p>Pay on delivery · No online payment required</p>
          </div>
        </>
      )}
    </dialog>
  );
}
