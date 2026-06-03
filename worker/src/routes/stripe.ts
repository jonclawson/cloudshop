import { Hono } from 'hono';
import Stripe from 'stripe';

type Bindings = CloudshopStripeBindings;

type CloudshopStripeBindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  USE_MOCKS?: string;
  STRIPE_SECRET_KEY?: string;
};

const stripeRoutes = new Hono<{ Bindings }>();

stripeRoutes.post('/payment-intent-ui', async (c) => {
  const secretKey = c.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return c.json({ error: 'Stripe secret key not configured (STRIPE_SECRET_KEY missing)' }, 500);
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2024-06-20',
  });

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { amount, currency, receipt_email } = body as {
    amount?: unknown;
    currency?: unknown;
    receipt_email?: unknown;
  };

  const amountNumber = typeof amount === 'number' ? amount : typeof amount === 'string' ? Number(amount) : NaN;
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return c.json({ error: 'amount must be a positive number' }, 400);
  }
  const amountInteger = Math.trunc(amountNumber);

  const currencyString = typeof currency === 'string' ? currency : '';
  const normalizedCurrency = currencyString.toLowerCase();
  if (!normalizedCurrency || normalizedCurrency.length < 3) {
    return c.json({ error: 'currency is required (e.g. usd)' }, 400);
  }

  const receiptEmailString = typeof receipt_email === 'string' ? receipt_email.trim() : '';
  if (!receiptEmailString) {
    return c.json({ error: 'receipt_email is required' }, 400);
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInteger,
      currency: normalizedCurrency,
      receipt_email: receiptEmailString,
      // Enable multiple methods (incl. PayPal when configured in Stripe dashboard)
      automatic_payment_methods: { enabled: true },
      metadata: {
        // Not perfect because frontend render-only call doesn't include order_id yet,
        // but having some metadata makes debugging simpler.
        source: 'checkout-ui',
      },
    });

    return c.json({ client_secret: paymentIntent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error';
    return c.json({ error: message }, 500);
  }
});

export default stripeRoutes;
