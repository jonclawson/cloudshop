import { useState, useEffect, useCallback, useRef } from 'react';
import { ordersApi, type PrintfulEstimateResponse } from '../useApi';

type PrintfulEstimateProps = {
  orderItems: Array<{
    catalog_variant_id: number;
    external_id: string;
    quantity: number;
    retail_price?: string;
    name?: string;
    technique?: string;
    template?: any;
  }>;
  retailCosts?: {
    currency?: string;
    discount?: string;
    shipping?: string;
    tax?: string;
  };
  mode: 'manual' | 'auto';
  shippingAddress?: {
    state_code?: string;
    country_code?: string;
    zip?: string;
  };
  onGetEstimate?: Function
};

export default function PrintfulEstimate({
  orderItems,
  retailCosts,
  mode,
  shippingAddress,
  onGetEstimate,
}: PrintfulEstimateProps) {
  const [showZipInput, setShowZipInput] = useState(false);
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<PrintfulEstimateResponse | null>(null);
  const autoTriggeredRef = useRef(false);

  const fetchEstimate = useCallback(
    async (recipient: { state_code?: string; country_code: string; zip?: string }) => {
      setLoading(true);
      setError(null);
      setEstimate(null);

      try {
        const response = await ordersApi.getPrintfulEstimate({
          recipient,
          order_items: orderItems,
          retail_costs: retailCosts,
        });
        if (onGetEstimate) {
          onGetEstimate(response.data)
        }
        setEstimate(response.data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get estimate';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [orderItems, retailCosts]
  );
  // Reset auto-trigger when items change so estimate recalculates
  useEffect(() => {
    autoTriggeredRef.current = false;
  }, [orderItems, retailCosts]);
  // Auto mode: trigger when all shipping fields are present
  useEffect(() => {
    if (mode !== 'auto') return;
    if (!shippingAddress) return;

    const { state_code, country_code, zip: shippingZip } = shippingAddress;
    if (state_code && country_code && shippingZip) {
      // Avoid re-triggering for the same address
      if (autoTriggeredRef.current) return;
      autoTriggeredRef.current = true;

      fetchEstimate({
        state_code,
        country_code,
        zip: shippingZip,
      });
    } else {
      autoTriggeredRef.current = false;
    }
  }, [mode, shippingAddress]);

  // Manual mode: trigger when a 5-digit zip is entered
  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    setZip(value);

    if (value.length === 5) {
      fetchEstimate({
        country_code: 'US',
        zip: value,
      });
    }
  };

  // If in auto mode and address is complete, just show results without UI controls
  if (mode === 'auto') {
    return (
      <div className="mt-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Total Costs</h3>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Calculating estimate...
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {estimate && estimate.status === 'completed' && (
          <EstimateBreakdown costs={estimate.costs} />
        )}
        {!loading && !error && !estimate && (
          <p className="text-sm text-gray-400">Complete shipping fields to see estimate</p>
        )}
      </div>
    );
  }

  // Manual mode
  return (
    <div className="mt-4">
      {!showZipInput && !estimate && (
        <button
          type="button"
          onClick={() => setShowZipInput(true)}
          disabled={loading}
          className="w-full bg-white text-black border-2 border-black py-2 rounded-md hover:bg-black hover:text-white transition cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Getting Estimate...' : 'Get Estimate'}
        </button>
      )}

      {(showZipInput || estimate) && !estimate && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Enter ZIP code for estimate
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="ZIP code"
            value={zip}
            onChange={handleZipChange}
            maxLength={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            autoFocus
          />
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Calculating estimate...
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}

      {estimate && estimate.status === 'completed' && (
        <div>
          <EstimateBreakdown costs={estimate.costs} />
          <button
            type="button"
            onClick={() => {
              setEstimate(null);
              setError(null);
              setZip('');
              setShowZipInput(false);
            }}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 cursor-pointer"
          >
            Clear estimate
          </button>
        </div>
      )}
    </div>
  );
}

function EstimateBreakdown({ costs }: { costs: PrintfulEstimateResponse['costs'] }) {
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: costs.currency || 'USD',
  });

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Subtotal', value: costs.subtotal },
    { label: 'Shipping', value: costs.shipping },
    { label: 'Tax', value: costs.tax },
  ];

  if (costs.discount && costs.discount !== '0.00') {
    rows.push({ label: 'Discount', value: `-${costs.discount}` });
  }

  if (costs.vat && costs.vat !== '0.00') {
    rows.push({ label: 'VAT', value: costs.vat });
  }

  if (costs.digitization && costs.digitization !== '0.00') {
    rows.push({ label: 'Digitization', value: costs.digitization });
  }

  if (costs.additional_fee && costs.additional_fee !== '0.00') {
    rows.push({ label: 'Additional Fee', value: costs.additional_fee });
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
      <h4 className="font-semibold text-gray-700 mb-2">Cost</h4>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between">
            <span className="text-gray-600">{row.label}</span>
            <span>{currencyFormatter.format(Number(row.value))}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1 font-semibold">
          <span>Total</span>
          <span>{currencyFormatter.format(Number(costs.total))}</span>
        </div>
      </div>
    </div>
  );
}