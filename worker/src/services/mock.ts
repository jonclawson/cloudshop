// Mock Stripe service for development
export const mockStripe = {
  createPaymentIntent: async (amount: number, currency: string = 'usd') => {
    const clientSecret = `pi_test_${Math.random().toString(36).slice(2, 11)}`;
    return {
      id: clientSecret,
      object: 'payment_intent',
      amount,
      currency,
      client_secret: clientSecret,
      status: 'requires_payment_method',
      created: Math.floor(Date.now() / 1000),
    };
  },

  confirmPayment: async (paymentIntentId: string, cardToken: string) => {
    // Simulate failure for test card ending in 0000
    const isFail = cardToken.endsWith('0000');

    if (isFail) {
      return {
        status: 'failed',
        error: 'Your card was declined',
      };
    }

    return {
      status: 'succeeded',
      id: paymentIntentId,
      amount_received: 1000,
    };
  },

  getPaymentIntent: async (paymentIntentId: string) => {
    return {
      id: paymentIntentId,
      status: 'succeeded',
      amount: 1000,
    };
  },
};

// Mock Printful service for development
export const mockPrintful = {
  getProducts: async () => {
    return [
      {
        id: 1,
        external_id: 'tshirt-1',
        title: 'T-Shirt',
        description: 'Premium cotton t-shirt',
        variants: [
          {
            id: 1,
            external_id: 'tshirt-1-s',
            title: 'Small / White',
            size: 'S',
            color: 'White',
            price: 14.99,
          },
          {
            id: 2,
            external_id: 'tshirt-1-m',
            title: 'Medium / White',
            size: 'M',
            color: 'White',
            price: 14.99,
          },
          {
            id: 3,
            external_id: 'tshirt-1-l',
            title: 'Large / White',
            size: 'L',
            color: 'White',
            price: 14.99,
          },
          {
            id: 4,
            external_id: 'tshirt-1-s-black',
            title: 'Small / Black',
            size: 'S',
            color: 'Black',
            price: 14.99,
          },
        ],
      },
      {
        id: 2,
        external_id: 'hoodie-1',
        title: 'Hoodie',
        description: 'Cozy zip-up hoodie',
        variants: [
          {
            id: 5,
            external_id: 'hoodie-1-s',
            title: 'Small / White',
            size: 'S',
            color: 'White',
            price: 34.99,
          },
          {
            id: 6,
            external_id: 'hoodie-1-m',
            title: 'Medium / White',
            size: 'M',
            color: 'White',
            price: 34.99,
          },
        ],
      },
      {
        id: 3,
        external_id: 'mug-1',
        title: 'Coffee Mug',
        description: '11oz ceramic mug',
        variants: [
          {
            id: 7,
            external_id: 'mug-1-1',
            title: 'White',
            color: 'White',
            price: 9.99,
          },
        ],
      },
      {
        id: 4,
        external_id: 'hat-1',
        title: 'Baseball Cap',
        description: 'Adjustable cap',
        variants: [
          {
            id: 8,
            external_id: 'hat-1-black',
            title: 'Black',
            color: 'Black',
            price: 16.99,
          },
          {
            id: 9,
            external_id: 'hat-1-white',
            title: 'White',
            color: 'White',
            price: 16.99,
          },
        ],
      },
    ];
  },

  createOrder: async (items: any[], designFileUrl?: string) => {
    const orderId = `mock-${Math.random().toString(36).slice(2, 11)}`;
    return {
      id: orderId,
      external_id: orderId,
      status: 'pending',
      items,
      shipping: { address1: 'Mock Address' },
    };
  },

  getOrder: async (orderId: string) => {
    return {
      id: orderId,
      status: 'in_production',
      shipments: [],
    };
  },

  syncProducts: async () => {
    const products = await mockPrintful.getProducts();
    return {
      products,
      synced_at: Date.now(),
      count: products.length,
    };
  },
};

// Mock Mailchannels service for development
export const mockMailchannels = {
  sendEmail: async (to: string, subject: string, html: string) => {
    console.log(`📧 [MOCK EMAIL]\nTo: ${to}\nSubject: ${subject}\n---\n${html}\n---`);
    return { success: true, message: 'Email logged to console' };
  },

  sendOrderConfirmation: async (email: string, orderId: string, items: any[]) => {
    const html = `
      <h2>Order Confirmation</h2>
      <p>Thank you for your order!</p>
      <p>Order ID: ${orderId}</p>
      <h3>Items:</h3>
      <ul>
        ${items.map((item) => `<li>${item.name} x ${item.quantity}</li>`).join('')}
      </ul>
    `;
    return mockMailchannels.sendEmail(email, `Order Confirmation - ${orderId}`, html);
  },

  sendPasswordReset: async (email: string, resetToken: string) => {
    const html = `
      <h2>Reset Your Password</h2>
      <p><a href="https://cloudshop.example.com/reset-password?token=${resetToken}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour.</p>
    `;
    return mockMailchannels.sendEmail(email, 'Reset Your Password', html);
  },
};

// Service selector based on environment
export async function getStripeService(useMocks: boolean) {
  return useMocks ? mockStripe : null; // Real Stripe would go here
}

export async function getPrintfulService(useMocks: boolean) {
  return useMocks ? mockPrintful : null; // Real Printful would go here
}

export async function getMailchannelsService(useMocks: boolean) {
  return useMocks ? mockMailchannels : null; // Real Mailchannels would go here
}
