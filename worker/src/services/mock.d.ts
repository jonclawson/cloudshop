export declare const mockStripe: {
    createPaymentIntent: (amount: number, currency?: string) => Promise<{
        id: string;
        object: string;
        amount: number;
        currency: string;
        client_secret: string;
        status: string;
        created: number;
    }>;
    confirmPayment: (paymentIntentId: string, cardToken: string) => Promise<{
        status: string;
        error: string;
        id?: undefined;
        amount_received?: undefined;
    } | {
        status: string;
        id: string;
        amount_received: number;
        error?: undefined;
    }>;
    getPaymentIntent: (paymentIntentId: string) => Promise<{
        id: string;
        status: string;
        amount: number;
    }>;
};
export declare const mockPrintful: {
    getProducts: () => Promise<({
        id: number;
        external_id: string;
        title: string;
        description: string;
        variants: {
            id: number;
            external_id: string;
            title: string;
            size: string;
            color: string;
            price: number;
        }[];
    } | {
        id: number;
        external_id: string;
        title: string;
        description: string;
        variants: {
            id: number;
            external_id: string;
            title: string;
            color: string;
            price: number;
        }[];
    })[]>;
    createOrder: (items: any[], designFileUrl?: string) => Promise<{
        id: string;
        external_id: string;
        status: string;
        items: any[];
        shipping: {
            address1: string;
        };
    }>;
    getOrder: (orderId: string) => Promise<{
        id: string;
        status: string;
        shipments: never[];
    }>;
    syncProducts: () => Promise<{
        products: ({
            id: number;
            external_id: string;
            title: string;
            description: string;
            variants: {
                id: number;
                external_id: string;
                title: string;
                size: string;
                color: string;
                price: number;
            }[];
        } | {
            id: number;
            external_id: string;
            title: string;
            description: string;
            variants: {
                id: number;
                external_id: string;
                title: string;
                color: string;
                price: number;
            }[];
        })[];
        synced_at: number;
        count: number;
    }>;
};
export declare const mockMailchannels: {
    sendEmail: (to: string, subject: string, html: string) => Promise<{
        success: boolean;
        message: string;
    }>;
    sendOrderConfirmation: (email: string, orderId: string, items: any[]) => Promise<{
        success: boolean;
        message: string;
    }>;
    sendPasswordReset: (email: string, resetToken: string) => Promise<{
        success: boolean;
        message: string;
    }>;
};
export declare function getStripeService(useMocks: boolean): Promise<{
    createPaymentIntent: (amount: number, currency?: string) => Promise<{
        id: string;
        object: string;
        amount: number;
        currency: string;
        client_secret: string;
        status: string;
        created: number;
    }>;
    confirmPayment: (paymentIntentId: string, cardToken: string) => Promise<{
        status: string;
        error: string;
        id?: undefined;
        amount_received?: undefined;
    } | {
        status: string;
        id: string;
        amount_received: number;
        error?: undefined;
    }>;
    getPaymentIntent: (paymentIntentId: string) => Promise<{
        id: string;
        status: string;
        amount: number;
    }>;
} | null>;
export declare function getPrintfulService(useMocks: boolean): Promise<{
    getProducts: () => Promise<({
        id: number;
        external_id: string;
        title: string;
        description: string;
        variants: {
            id: number;
            external_id: string;
            title: string;
            size: string;
            color: string;
            price: number;
        }[];
    } | {
        id: number;
        external_id: string;
        title: string;
        description: string;
        variants: {
            id: number;
            external_id: string;
            title: string;
            color: string;
            price: number;
        }[];
    })[]>;
    createOrder: (items: any[], designFileUrl?: string) => Promise<{
        id: string;
        external_id: string;
        status: string;
        items: any[];
        shipping: {
            address1: string;
        };
    }>;
    getOrder: (orderId: string) => Promise<{
        id: string;
        status: string;
        shipments: never[];
    }>;
    syncProducts: () => Promise<{
        products: ({
            id: number;
            external_id: string;
            title: string;
            description: string;
            variants: {
                id: number;
                external_id: string;
                title: string;
                size: string;
                color: string;
                price: number;
            }[];
        } | {
            id: number;
            external_id: string;
            title: string;
            description: string;
            variants: {
                id: number;
                external_id: string;
                title: string;
                color: string;
                price: number;
            }[];
        })[];
        synced_at: number;
        count: number;
    }>;
} | null>;
export declare function getMailchannelsService(useMocks: boolean): Promise<{
    sendEmail: (to: string, subject: string, html: string) => Promise<{
        success: boolean;
        message: string;
    }>;
    sendOrderConfirmation: (email: string, orderId: string, items: any[]) => Promise<{
        success: boolean;
        message: string;
    }>;
    sendPasswordReset: (email: string, resetToken: string) => Promise<{
        success: boolean;
        message: string;
    }>;
} | null>;
