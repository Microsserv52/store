"use client";

import { useDeferredValue, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, MenuItem, Snackbar, TextField } from "@mui/material";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shell } from "@/components/shell";
import { CartProvider, useCart } from "@/components/cart";
import { useSession } from "@/components/session";
import { Empty, Failure, Loading } from "@/components/feedback";
import { ProductCard } from "@/components/product-card";
import { ProductVisual } from "@/components/product-visual";
import { api, date, money } from "@/lib/api";
import {
  accountSchema,
  loginSchema,
  orderSchema,
  ordersSchema,
  productSchema,
  productsSchema,
  registerSchema,
} from "@/lib/contracts";
import { track } from "@/components/telemetry";
import "@/app/page-title.css";

type Screen =
  | "catalog"
  | "product"
  | "cart"
  | "checkout"
  | "login"
  | "register"
  | "orders"
  | "order"
  | "account";
export function StoreView({ screen }: { screen: Screen }) {
  return (
    <CartProvider>
      <StoreScreen screen={screen} />
    </CartProvider>
  );
}
function StoreScreen({ screen }: { screen: Screen }) {
  const cart = useCart();
  return (
    <Shell cartCount={cart.lines.reduce((sum, line) => sum + line.quantity, 0)}>
      <div
        className={
          "container " +
          (["login", "register", "account"].includes(screen) ? "narrow" : "")
        }
      >
        <h1 className="sr-only">Microsserv52 demo store: {screen}</h1>
        {screen === "catalog" && <Catalog />}
        {screen === "product" && <ProductDetail />}
        {(screen === "cart" || screen === "checkout") && (
          <CartReview checkout={screen === "checkout"} />
        )}
        {(screen === "login" || screen === "register") && (
          <AuthForm register={screen === "register"} />
        )}
        {(screen === "orders" ||
          screen === "order" ||
          screen === "account") && (
          <Protected>
            {screen === "account" ? (
              <AccountView />
            ) : screen === "orders" ? (
              <Orders />
            ) : (
              <OrderDetail />
            )}
          </Protected>
        )}
      </div>
    </Shell>
  );
}
function Heading({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="section-label">{label}</p>
      <h2 className="page-title">{title}</h2>
      {children}
    </div>
  );
}
function Protected({ children }: { children: React.ReactNode }) {
  const { account, loading, error, refresh } = useSession();
  if (loading) return <Loading label="Checking your session…" />;
  if (error) return <Failure error={error} retry={() => void refresh()} />;
  if (!account)
    return (
      <Empty title="Sign in to continue.">
        <p>Your demo orders belong to your account.</p>
        <Button
          href={
            "/store/login/?returnTo=" +
            encodeURIComponent(
              window.location.pathname + window.location.search,
            )
          }
          variant="contained"
        >
          Sign in
        </Button>
      </Empty>
    );
  return children;
}
function Catalog() {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [sort, setSort] = useState("name");
  const [added, setAdded] = useState(false);
  const cart = useCart();
  const products = useQuery({
    queryKey: ["products"],
    queryFn: ({ signal }) => api("/products", productsSchema, { signal }),
  });
  const visible =
    products.data
      ?.filter((product) =>
        product.name.toLowerCase().includes(deferred.toLowerCase()),
      )
      .toSorted((a, b) =>
        sort === "price-asc"
          ? a.price - b.price
          : sort === "price-desc"
            ? b.price - a.price
            : a.name.localeCompare(b.name),
      ) ?? [];
  return (
    <>
      <Heading label="THE DEMO CATALOG" title="A cart full of possibilities.">
        <p className="muted">
          Browse the service-backed catalog. Prices are in USD. Every order is a
          simulation.
        </p>
      </Heading>
      <div className="toolbar">
        <TextField
          label="Search products"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 160 }}
          type="search"
        />
        <TextField
          select
          label="Sort by"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          size="small"
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="name">Name</MenuItem>
          <MenuItem value="price-asc">Price: low to high</MenuItem>
          <MenuItem value="price-desc">Price: high to low</MenuItem>
        </TextField>
      </div>
      {products.isPending ? (
        <Loading label="Loading products…" />
      ) : products.error ? (
        <Failure error={products.error} retry={() => void products.refetch()} />
      ) : (
        <>
          <p className="muted" aria-live="polite">
            {visible.length} {visible.length === 1 ? "product" : "products"}
          </p>
          {!visible.length ? (
            <Empty
              title={search ? "No matching products." : "No demo products yet."}
            >
              {search && (
                <Button onClick={() => setSearch("")}>Clear search</Button>
              )}
            </Empty>
          ) : (
            <div className="product-grid" aria-busy={deferred !== search}>
              {visible.map((product) => (
                <ProductCard
                  product={product}
                  key={product.id}
                  add={() => {
                    cart.add(product.id);
                    setAdded(true);
                    track("demo_cart_item_added");
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
      <Snackbar
        open={added}
        autoHideDuration={3000}
        onClose={() => setAdded(false)}
        message="Added to your demo cart"
        action={
          <Button href="/store/cart/" color="inherit">
            View cart
          </Button>
        }
      />
    </>
  );
}
function ProductDetail() {
  const id = useSearchParams().get("id");
  const valid = z.uuid().safeParse(id).success;
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const product = useQuery({
    queryKey: ["product", id],
    queryFn: ({ signal }) => api("/products/" + id, productSchema, { signal }),
    enabled: valid,
  });
  if (!valid)
    return (
      <Empty title="Choose a product.">
        <Button href="/store/">Back to catalog</Button>
      </Empty>
    );
  if (product.isPending) return <Loading />;
  if (product.error)
    return (
      <Failure error={product.error} retry={() => void product.refetch()} />
    );
  return (
    <>
      <p>
        <a href="/store/">Catalog</a> / {product.data.name}
      </p>
      <div className="split">
        <div className="product-tile" style={{ minHeight: 320 }}>
          <ProductVisual product={product.data} priority />
        </div>
        <div>
          <Heading label="DEMO PRODUCT" title={product.data.name} />
          <p className="total">
            {money(product.data.price)} <small>per {product.data.unit}</small>
          </p>
          <div className="form-stack">
            <TextField
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              slotProps={{ htmlInput: { min: 1, max: 999, step: 1 } }}
              error={
                !Number.isInteger(quantity) || quantity < 1 || quantity > 999
              }
              helperText="Choose 1 to 999 units."
            />
            <Button
              variant="contained"
              disabled={
                !Number.isInteger(quantity) || quantity < 1 || quantity > 999
              }
              onClick={() => {
                cart.add(product.data.id, quantity);
                setAdded(true);
                track("demo_cart_item_added");
              }}
            >
              Add to demo cart
            </Button>
            {added && (
              <Alert severity="success">
                Added. <a href="/store/cart/">View your demo cart</a>.
              </Alert>
            )}
            <p className="muted">
              No real payments or transactions. Nothing will be shipped.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
function CartReview({ checkout }: { checkout: boolean }) {
  const cart = useCart();
  const router = useRouter();
  const client = useQueryClient();
  const submitting = useRef(false);
  const products = useQuery({
    queryKey: ["products"],
    queryFn: ({ signal }) => api("/products", productsSchema, { signal }),
    staleTime: checkout ? 0 : 30_000,
  });
  const submit = useMutation({
    mutationFn: async () => {
      const fresh = await api("/products", productsSchema);
      if (
        cart.lines.some(
          (line) => !fresh.some((product) => product.id === line.id),
        )
      )
        throw new Error(
          "A product is no longer available. Remove it from your cart before ordering.",
        );
      return api("/orders", orderSchema, {
        method: "POST",
        body: JSON.stringify({
          items: cart.lines.map((line) => ({
            idProduct: line.id,
            quantity: line.quantity,
          })),
        }),
      });
    },
    onSuccess: async (order) => {
      cart.clear();
      await client.invalidateQueries({ queryKey: ["orders"] });
      track("demo_order_created");
      router.push("/order/?id=" + order.id + "&created=1");
    },
    onError: () => track("demo_order_failed"),
    onSettled: () => {
      submitting.current = false;
    },
  });
  if (!cart.lines.length)
    return (
      <Empty title="Your demo cart is empty.">
        <p>Browse the catalog and add something to try the order flow.</p>
        <Button href="/store/" variant="contained">
          Browse demo catalog
        </Button>
      </Empty>
    );
  if (products.isPending) return <Loading />;
  if (products.error)
    return (
      <Failure error={products.error} retry={() => void products.refetch()} />
    );
  const missing = cart.lines.some(
    (line) => !products.data.some((product) => product.id === line.id),
  );
  const total = cart.lines.reduce(
    (sum, line) =>
      sum +
      (products.data.find((product) => product.id === line.id)?.price || 0) *
        line.quantity,
    0,
  );
  const content = (
    <>
      <Heading
        label={checkout ? "FINAL REVIEW" : "YOUR SELECTION"}
        title={checkout ? "Create a demo order." : "Your demo cart."}
      />
      <div className="split">
        <div>
          {cart.lines.map((line) => {
            const product = products.data.find(
              (product) => product.id === line.id,
            );
            return (
              <div className="data-row" key={line.id}>
                <div>
                  <strong>{product?.name || "Unavailable product"}</strong>
                  <p className="muted">
                    {product
                      ? money(product.price) + " / " + product.unit
                      : "Remove this product to continue."}
                  </p>
                  <Button size="small" onClick={() => cart.update(line.id, 0)}>
                    Remove
                  </Button>
                </div>
                <TextField
                  label="Quantity"
                  type="number"
                  value={line.quantity}
                  sx={{ width: 96, flexShrink: 0 }}
                  onChange={(event) => {
                    const n = Number(event.target.value);
                    if (Number.isInteger(n) && n >= 1 && n <= 999)
                      cart.update(line.id, n);
                  }}
                  slotProps={{
                    htmlInput: {
                      min: 1,
                      max: 999,
                      step: 1,
                      "aria-label":
                        "Quantity for " +
                        (product?.name || "unavailable product"),
                    },
                  }}
                />
                <strong>
                  {product
                    ? money(product.price * line.quantity)
                    : "Unavailable"}
                </strong>
              </div>
            );
          })}
        </div>
        <aside className="panel">
          <h2>Demo summary</h2>
          <div className="total">
            <span>Estimated total</span>
            <strong>{money(total)}</strong>
          </div>
          <p className="muted">
            Final prices are calculated by the Order service. This is a demo: no
            payment will be taken and no goods will be shipped.
          </p>
          {missing && (
            <Alert severity="warning">
              Remove unavailable products before continuing.
            </Alert>
          )}
          {submit.error && (
            <>
              <Failure error={submit.error} />
              <p>
                If the connection failed after submission,{" "}
                <a href="/store/orders/">check demo orders</a> before trying
                again. The request is never retried automatically.
              </p>
            </>
          )}
          {checkout ? (
            <Button
              fullWidth
              variant="contained"
              disabled={submit.isPending || missing}
              onClick={() => {
                if (submitting.current) return;
                submitting.current = true;
                submit.mutate();
              }}
            >
              {submit.isPending ? "Creating demo order…" : "Create demo order"}
            </Button>
          ) : (
            <Button
              href="/store/checkout/"
              fullWidth
              variant="contained"
              disabled={missing}
            >
              Review demo order
            </Button>
          )}
          <p>
            <a href={checkout ? "/store/cart/" : "/store/"}>
              {checkout ? "Back to cart" : "Continue browsing"}
            </a>
          </p>
        </aside>
      </div>
    </>
  );
  return checkout ? <Protected>{content}</Protected> : content;
}
function AuthForm({ register }: { register: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(
      register ? registerSchema : loginSchema.extend({ name: z.string() }),
    ),
    defaultValues: {
      name: register ? "" : "Demo visitor",
      email: "",
      password: "",
    },
  });
  const login = useMutation({
    mutationFn: async (values: z.infer<typeof registerSchema>) => {
      if (register)
        await api("/accounts", accountSchema, {
          method: "POST",
          body: JSON.stringify(values),
        });
      await api("/session/login", z.undefined(), {
        method: "POST",
        body: JSON.stringify(loginSchema.parse(values)),
      });
    },
    onSuccess: async () => {
      await session.refresh();
      const channel = new BroadcastChannel("ms52-session");
      channel.postMessage("changed");
      channel.close();
      const target = params.get("returnTo");
      const safe =
        target &&
        /^\/(store|admin)\/(?:[^\\]*)$/.test(target) &&
        !target.includes("//")
          ? target
          : "/store/";
      window.location.assign(
        safe === "/store/checkout/" && !localStorage.getItem("ms52-cart-v1")
          ? "/store/"
          : safe,
      );
    },
  });
  return (
    <>
      <Heading
        label="A DEMO ACCOUNT"
        title={register ? "Make yourself at home." : "Welcome back."}
      >
        <p className="muted">
          Use fictitious details. This account is for testing the mock store.
        </p>
      </Heading>
      <form
        className="form-stack"
        onSubmit={form.handleSubmit((values) => login.mutate(values))}
        noValidate
      >
        {register && (
          <TextField
            label="Name"
            autoComplete="name"
            {...form.register("name")}
            error={!!form.formState.errors.name}
            helperText={form.formState.errors.name?.message}
          />
        )}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          {...form.register("email")}
          error={!!form.formState.errors.email}
          helperText={form.formState.errors.email?.message}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete={register ? "new-password" : "current-password"}
          {...form.register("password")}
          error={!!form.formState.errors.password}
          helperText={form.formState.errors.password?.message}
        />
        {login.error && <Failure error={login.error} />}
        <Button type="submit" variant="contained" disabled={login.isPending}>
          {login.isPending
            ? "Please wait…"
            : register
              ? "Create demo account"
              : "Sign in"}
        </Button>
      </form>
      <p>
        <a href={register ? "/store/login/" : "/store/register/"}>
          {register
            ? "Already have an account? Sign in"
            : "New here? Create a demo account"}
        </a>
      </p>
      <Button onClick={() => router.back()}>Go back</Button>
    </>
  );
}
function Orders() {
  const { account } = useSession();
  const orders = useQuery({
    queryKey: ["orders", account?.id],
    queryFn: ({ signal }) => api("/orders", ordersSchema, { signal }),
  });
  return (
    <>
      <Heading label="YOUR ACCOUNT" title="Demo order history." />
      <p className="muted">
        These orders are simulations. No payment was taken and no goods will be
        shipped.
      </p>
      {orders.isPending ? (
        <Loading />
      ) : orders.error ? (
        <Failure error={orders.error} retry={() => void orders.refetch()} />
      ) : !orders.data.length ? (
        <Empty title="No demo orders yet.">
          <Button href="/store/">Browse demo catalog</Button>
        </Empty>
      ) : (
        <div className="panel">
          {orders.data.map((order) => (
            <div className="data-row" key={order.id}>
              <div>
                <a href={"/store/order/?id=" + order.id}>
                  Demo order {order.id.slice(0, 8)}
                </a>
                <p className="muted">{date(order.date)}</p>
              </div>
              <strong>{money(order.total, order.currency)}</strong>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
function OrderDetail() {
  const params = useSearchParams();
  const id = params.get("id");
  const { account } = useSession();
  const valid = z.uuid().safeParse(id).success;
  const order = useQuery({
    queryKey: ["order", account?.id, id],
    queryFn: ({ signal }) => api("/orders/" + id, orderSchema, { signal }),
    enabled: valid,
  });
  if (!valid)
    return (
      <Empty title="Choose a demo order.">
        <Button href="/store/orders/">View demo orders</Button>
      </Empty>
    );
  if (order.isPending) return <Loading />;
  if (order.error) return <Failure error={order.error} />;
  return (
    <>
      <Heading
        label="DEMO ORDER"
        title={
          params.get("created")
            ? "Your demo order is saved."
            : "The details, all here."
        }
      />
      <Alert severity="info">
        No payment was taken. No goods will be shipped.
      </Alert>
      <p className="muted">
        {order.data.id} · {date(order.data.date)}
      </p>
      <div className="panel">
        {order.data.items.map((item) => (
          <div className="data-row" key={item.id}>
            <div>
              <a href={"/store/product/?id=" + item.productId}>
                Product {item.productId.slice(0, 8)}
              </a>
              <p className="muted">Quantity: {item.quantity}</p>
            </div>
            <strong>{money(item.total, order.data.currency)}</strong>
          </div>
        ))}
        <div className="total">
          <span>Demo total</span>
          <strong>{money(order.data.total, order.data.currency)}</strong>
        </div>
      </div>
      <p>
        <a href="/store/orders/">View your demo orders</a>
      </p>
    </>
  );
}
function AccountView() {
  const session = useSession();
  const [error, setError] = useState<Error | null>(null);
  return (
    <>
      <Heading label="YOUR ACCOUNT" title="A familiar place." />
      <div className="panel">
        <p>
          <strong>{session.account?.name}</strong>
        </p>
        <p>{session.account?.email}</p>
        <p className="muted">Your demo account profile is read-only.</p>
        <div className="actions">
          <Button href="/store/orders/" variant="outlined">
            View demo orders
          </Button>
          <Button onClick={() => void session.logout().catch(setError)}>
            Sign out
          </Button>
        </div>
        {error && <Failure error={error} />}
      </div>
    </>
  );
}
