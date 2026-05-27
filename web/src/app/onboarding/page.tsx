"use client";

import Link from "next/link";
import { decodeFunctionResult, encodeFunctionData, isAddress, keccak256, toBytes } from "viem";
import { useMemo, useState } from "react";
import { canonicalizeJsonText, hashCanonicalJsonText } from "@/lib/canonical-json";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.cortex.wallyweb.com").replace(/\/$/, "");
const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_SEPOLIA_CHAIN_HEX = "0x14a34";

const CONTRACTS = {
  commerceRegistry: "0xf0bf44b28567f0b3d2370dc7af8a63335746d8d4",
  agentRegistry: "0x24ca7dc7747b0166e73a2d6d99ce677476f046f3",
  policyModule: "0xb2686c5cc3ab7ce45acfe0091698d9b6a16c2d0c",
};

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const COMMERCE_READ_ABI = [
  {
    type: "function",
    name: "getMerchant",
    inputs: [{ name: "merchantId", type: "uint256" }],
    outputs: [
      {
        name: "merchant",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "payoutAddress", type: "address" },
          { name: "metadataURI", type: "string" },
          { name: "metadataHash", type: "bytes32" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getService",
    inputs: [{ name: "serviceNumericId", type: "uint256" }],
    outputs: [
      {
        name: "service",
        type: "tuple",
        components: [
          { name: "merchantId", type: "uint256" },
          { name: "serviceId", type: "string" },
          { name: "metadataURI", type: "string" },
          { name: "metadataHash", type: "bytes32" },
          { name: "capabilityHash", type: "bytes32" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

const AGENT_READ_ABI = [
  {
    type: "function",
    name: "getAgentsByOwner",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "agentIds", type: "uint256[]" }],
    stateMutability: "view",
  },
] as const;

const COMMERCE_WRITE_ABI = [
  {
    type: "function",
    name: "registerMerchant",
    inputs: [
      { name: "payoutAddress", type: "address" },
      { name: "metadataURI", type: "string" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [{ name: "merchantId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "registerService",
    inputs: [
      { name: "merchantId", type: "uint256" },
      { name: "serviceId", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "metadataHash", type: "bytes32" },
      { name: "capabilityHash", type: "bytes32" },
    ],
    outputs: [{ name: "serviceNumericId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "commitQuote",
    inputs: [
      {
        name: "commitment",
        type: "tuple",
        components: [
          { name: "merchantId", type: "uint256" },
          { name: "serviceNumericId", type: "uint256" },
          { name: "agent", type: "address" },
          { name: "token", type: "address" },
          { name: "facilitator", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "paymentRail", type: "uint8" },
          { name: "expiresAt", type: "uint256" },
          { name: "paymentNonce", type: "uint256" },
          { name: "resourceHash", type: "bytes32" },
          { name: "termsHash", type: "bytes32" },
          { name: "x402PayloadHash", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "quoteHash", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordReceipt",
    inputs: [
      { name: "quoteHash", type: "bytes32" },
      { name: "resultHash", type: "bytes32" },
    ],
    outputs: [{ name: "receiptId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

const AGENT_WRITE_ABI = [
  {
    type: "function",
    name: "registerAgent",
    inputs: [
      { name: "metadataURI", type: "string" },
      { name: "pubkey", type: "bytes" },
      { name: "capabilitiesHash", type: "bytes32" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

const POLICY_WRITE_ABI = [
  {
    type: "function",
    name: "setSignedPaymentPolicy",
    inputs: [
      { name: "merchant", type: "address" },
      { name: "token", type: "address" },
      { name: "facilitator", type: "address" },
      { name: "maxPerPayment", type: "uint256" },
      { name: "maxPerDay", type: "uint256" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

type StepId = "merchant" | "service" | "catalog" | "agent" | "quote";
type TxKey = "merchant" | "service" | "agent" | "policy" | "quote" | "receipt";
type LookupState = {
  loading: boolean;
  error: string | null;
  result: unknown;
};

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type WalletCheckState = {
  account: string | null;
  chainId: number | null;
  apiOk: boolean | null;
  contracts: Record<string, boolean>;
  loading: boolean;
  error: string | null;
};

type OnchainReadState = {
  loading: boolean;
  error: string | null;
  merchant: Record<string, unknown> | null;
  service: Record<string, unknown> | null;
  agentIds: string[] | null;
};

type CatalogPublishState = {
  loading: boolean;
  error: string | null;
  uri: string | null;
  hash: string | null;
};

type QuotePublishState = CatalogPublishState;

type TxState = {
  loading: boolean;
  error: string | null;
  hash: string | null;
};

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function Field({ label, value, onChange, placeholder }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-normal text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-border bg-[#0d1117] px-3 text-sm text-text outline-none transition-colors placeholder:text-muted focus:border-accent-blue"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-normal text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-md border border-border bg-[#0d1117] px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-muted focus:border-accent-blue"
      />
    </label>
  );
}

function CodePanel({ title, value }: { title: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-[#0d1117]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
          className="rounded-md border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-muted hover:text-text"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="m-0 max-h-[420px] overflow-auto rounded-none border-0 bg-transparent p-4 text-xs leading-6">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function DownloadButton({ filename, value, label }: { filename: string; value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const blob = new Blob([value], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }}
      className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
    >
      {label}
    </button>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs ${
        ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-200"
      }`}
    >
      {label}
    </span>
  );
}

function LookupPanel({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  const [state, setState] = useState<LookupState>({ loading: false, error: null, result: null });
  const url = `${API_URL}${path}`;

  return (
    <div className="rounded-lg border border-border bg-[#0d1117] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            setState({ loading: true, error: null, result: null });
            try {
              const response = await fetch(url);
              const body = (await response.json()) as unknown;
              if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
              setState({ loading: false, error: null, result: body });
            } catch (error) {
              setState({
                loading: false,
                error: error instanceof Error ? error.message : "Lookup failed",
                result: null,
              });
            }
          }}
          className="rounded-md border border-border px-3 py-2 text-xs text-muted transition-colors hover:border-muted hover:text-text"
        >
          {state.loading ? "Checking" : "Check API"}
        </button>
      </div>
      <p className="mt-3 break-all font-mono text-xs text-muted">{url}</p>
      {state.error ? <p className="mt-3 text-sm text-red-200">{state.error}</p> : null}
      {state.result ? (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-border bg-[#090d12] p-3 text-xs leading-5">
          <code>{JSON.stringify(state.result, null, 2)}</code>
        </pre>
      ) : null}
    </div>
  );
}

function PreflightPanel({
  state,
  onCheck,
  onSwitchNetwork,
  onUseWallet,
}: {
  state: WalletCheckState;
  onCheck: () => void;
  onSwitchNetwork: () => void;
  onUseWallet: () => void;
}) {
  const onBaseSepolia = state.chainId === BASE_SEPOLIA_CHAIN_ID;
  const contractNames = Object.keys(CONTRACTS);
  const allContractsFound = contractNames.every((name) => state.contracts[name]);

  return (
    <section className="mb-6 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold">Read-only preflight</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Connect a wallet to check account, network, deployed contract code, and hosted API health.
            Transaction buttons below will open your wallet before anything is submitted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCheck}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
          >
            {state.loading ? "Checking" : "Run checks"}
          </button>
          <button
            type="button"
            onClick={onSwitchNetwork}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
          >
            Switch to Base Sepolia
          </button>
          <button
            type="button"
            onClick={onUseWallet}
            disabled={!state.account}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use wallet address
          </button>
        </div>
      </div>

      {state.error ? <p className="mt-4 text-sm text-red-200">{state.error}</p> : null}

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-[#0d1117] p-4">
          <p className="text-xs uppercase tracking-normal text-muted">Wallet</p>
          <p className="mt-2 break-all font-mono text-xs">{state.account ?? "Not connected"}</p>
        </div>
        <div className="rounded-lg border border-border bg-[#0d1117] p-4">
          <p className="text-xs uppercase tracking-normal text-muted">Network</p>
          <div className="mt-2">
            <StatusPill ok={onBaseSepolia} label={state.chainId ? `Chain ${state.chainId}` : "Unknown chain"} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-[#0d1117] p-4">
          <p className="text-xs uppercase tracking-normal text-muted">Contracts</p>
          <div className="mt-2">
            <StatusPill ok={allContractsFound} label={allContractsFound ? "Code found" : "Unchecked or missing"} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-[#0d1117] p-4">
          <p className="text-xs uppercase tracking-normal text-muted">Hosted API</p>
          <div className="mt-2">
            <StatusPill ok={state.apiOk === true} label={state.apiOk === true ? "Healthy" : "Unchecked"} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {contractNames.map((name) => (
          <div key={name} className="rounded-md border border-border bg-[#0d1117] p-3">
            <p className="text-xs font-medium">{contractLabel(name)}</p>
            <p className="mt-1 break-all font-mono text-[11px] text-muted">{CONTRACTS[name as keyof typeof CONTRACTS]}</p>
            <div className="mt-2">
              <StatusPill ok={state.contracts[name] === true} label={state.contracts[name] ? "Deployed" : "Unchecked"} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OnchainReadPanel({
  state,
  onRead,
}: {
  state: OnchainReadState;
  onRead: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-[#0d1117] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Onchain state check</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            Reads the merchant, service, and wallet-owned agent ids directly from Base Sepolia.
          </p>
        </div>
        <button
          type="button"
          onClick={onRead}
          className="rounded-md border border-border px-3 py-2 text-xs text-muted transition-colors hover:border-muted hover:text-text"
        >
          {state.loading ? "Reading" : "Read contracts"}
        </button>
      </div>
      {state.error ? <p className="mt-3 text-sm text-red-200">{state.error}</p> : null}
      <div className="mt-4 grid gap-3">
        <OnchainResult title="Merchant" value={state.merchant} empty="No merchant loaded" />
        <OnchainResult title="Service" value={state.service} empty="No service loaded" />
        <OnchainResult title="Agent ids owned by wallet" value={state.agentIds} empty="Connect a wallet to read agent ids" />
      </div>
    </div>
  );
}

function OnchainResult({ title, value, empty }: { title: string; value: unknown; empty: string }) {
  return (
    <div className="rounded-md border border-border bg-[#090d12] p-3">
      <p className="text-xs font-medium">{title}</p>
      {value ? (
        <pre className="mt-2 max-h-48 overflow-auto text-xs leading-5 text-muted">
          <code>{JSON.stringify(value, null, 2)}</code>
        </pre>
      ) : (
        <p className="mt-2 text-xs text-muted">{empty}</p>
      )}
    </div>
  );
}

function CatalogPublishPanel({
  state,
  onPublish,
}: {
  state: CatalogPublishState;
  onPublish: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-[#0d1117] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Hosted catalog publishing</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            Publishes the exact catalog JSON to the Cortex API and returns a URI/hash pair for service registration.
          </p>
        </div>
        <button
          type="button"
          onClick={onPublish}
          className="rounded-md border border-border px-3 py-2 text-xs text-muted transition-colors hover:border-muted hover:text-text"
        >
          {state.loading ? "Publishing" : "Publish catalog"}
        </button>
      </div>
      {state.error ? <p className="mt-3 text-sm text-red-200">{state.error}</p> : null}
      {state.uri && state.hash ? (
        <div className="mt-3 rounded-md border border-border bg-[#090d12] p-3">
          <p className="text-xs font-medium">Published catalog</p>
          <p className="mt-2 break-all font-mono text-xs text-muted">{state.uri}</p>
          <p className="mt-2 break-all font-mono text-xs text-muted">{state.hash}</p>
        </div>
      ) : null}
    </div>
  );
}

function QuotePublishPanel({
  title,
  description,
  state,
  onPublish,
}: {
  title: string;
  description: string;
  state: QuotePublishState;
  onPublish: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-[#0d1117] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={onPublish}
          className="rounded-md border border-border px-3 py-2 text-xs text-muted transition-colors hover:border-muted hover:text-text"
        >
          {state.loading ? "Publishing" : "Publish"}
        </button>
      </div>
      {state.error ? <p className="mt-3 text-sm text-red-200">{state.error}</p> : null}
      {state.uri && state.hash ? (
        <div className="mt-3 rounded-md border border-border bg-[#090d12] p-3">
          <p className="text-xs font-medium">Hosted document</p>
          <p className="mt-2 break-all font-mono text-xs text-muted">{state.uri}</p>
          <p className="mt-2 break-all font-mono text-xs text-muted">{state.hash}</p>
        </div>
      ) : null}
    </div>
  );
}

function TransactionPanel({
  title,
  description,
  actionLabel,
  state,
  onSend,
}: {
  title: string;
  description: string;
  actionLabel: string;
  state: TxState;
  onSend: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-[#0d1117] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={state.loading}
          className="rounded-md border border-border px-3 py-2 text-xs text-muted transition-colors hover:border-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.loading ? "Waiting" : actionLabel}
        </button>
      </div>
      {state.error ? <p className="mt-3 text-sm text-red-200">{state.error}</p> : null}
      {state.hash ? (
        <div className="mt-3 rounded-md border border-border bg-[#090d12] p-3">
          <p className="text-xs font-medium">Transaction hash</p>
          <a
            href={`https://sepolia.basescan.org/tx/${state.hash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all font-mono text-xs text-accent hover:underline"
          >
            {state.hash}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-muted">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState<StepId>("merchant");
  const [walletCheck, setWalletCheck] = useState<WalletCheckState>({
    account: null,
    chainId: null,
    apiOk: null,
    contracts: {},
    loading: false,
    error: null,
  });
  const [onchainRead, setOnchainRead] = useState<OnchainReadState>({
    loading: false,
    error: null,
    merchant: null,
    service: null,
    agentIds: null,
  });
  const [catalogPublish, setCatalogPublish] = useState<CatalogPublishState>({
    loading: false,
    error: null,
    uri: null,
    hash: null,
  });
  const [quoteRequestPublish, setQuoteRequestPublish] = useState<QuotePublishState>({
    loading: false,
    error: null,
    uri: null,
    hash: null,
  });
  const [quoteResponsePublish, setQuoteResponsePublish] = useState<QuotePublishState>({
    loading: false,
    error: null,
    uri: null,
    hash: null,
  });
  const [txStates, setTxStates] = useState<Record<TxKey, TxState>>({
    merchant: { loading: false, error: null, hash: null },
    service: { loading: false, error: null, hash: null },
    agent: { loading: false, error: null, hash: null },
    policy: { loading: false, error: null, hash: null },
    quote: { loading: false, error: null, hash: null },
    receipt: { loading: false, error: null, hash: null },
  });
  const [merchantName, setMerchantName] = useState("Example Data Merchant");
  const [website, setWebsite] = useState("https://merchant.example");
  const [support, setSupport] = useState("support@merchant.example");
  const [merchantOwner, setMerchantOwner] = useState("0x...");
  const [payout, setPayout] = useState("0x...");
  const [refundPolicy, setRefundPolicy] = useState("Refunds available when fulfillment does not match accepted quote terms.");
  const [merchantFulfillmentKey, setMerchantFulfillmentKey] = useState("did:key:z6MkMerchantFulfillmentKey");
  const [merchantUri, setMerchantUri] = useState("ipfs://merchant-metadata");
  const [merchantHash, setMerchantHash] = useState(ZERO_HASH);
  const [merchantId, setMerchantId] = useState("1");

  const [serviceId, setServiceId] = useState("enrich-company-v1");
  const [serviceName, setServiceName] = useState("Company enrichment API");
  const [capability, setCapability] = useState("company.enrichment");
  const [serviceUri, setServiceUri] = useState("ipfs://service-metadata");
  const [serviceHash, setServiceHash] = useState(ZERO_HASH);
  const [capabilityHash, setCapabilityHash] = useState(ZERO_HASH);
  const [inputSchema, setInputSchema] = useState('{"domain":"string"}');
  const [outputSchema, setOutputSchema] = useState('{"name":"string","industry":"string","confidence":"number"}');
  const [catalogUri, setCatalogUri] = useState("ipfs://service-catalog");
  const [catalogHash, setCatalogHash] = useState(ZERO_HASH);
  const [serviceEndpoint, setServiceEndpoint] = useState("https://merchant.example/api/enrich-company");
  const [serviceMethod, setServiceMethod] = useState("POST");
  const [serviceDescription, setServiceDescription] = useState("Returns company profile data for a submitted domain.");
  const [termsUri, setTermsUri] = useState("https://merchant.example/terms");
  const [privacyUri, setPrivacyUri] = useState("https://merchant.example/privacy");
  const [timeoutMs, setTimeoutMs] = useState("30000");
  const [availabilityTarget, setAvailabilityTarget] = useState("0.99");
  const [automaticRefund, setAutomaticRefund] = useState("true");
  const [disputeWindowSeconds, setDisputeWindowSeconds] = useState("86400");
  const [storesRequest, setStoresRequest] = useState("true");
  const [storesResponse, setStoresResponse] = useState("false");
  const [piiAllowed, setPiiAllowed] = useState("false");

  const [agentName, setAgentName] = useState("Procurement Agent");
  const [agentOwner, setAgentOwner] = useState("0x...");
  const [agentUri, setAgentUri] = useState("ipfs://agent-metadata");
  const [agentPubkey, setAgentPubkey] = useState("0x...");
  const [agentCapabilities, setAgentCapabilities] = useState("commerce.procurement.v1");
  const [agentCapabilitiesHash, setAgentCapabilitiesHash] = useState(ZERO_HASH);
  const [maxPerPayment, setMaxPerPayment] = useState("1000000");
  const [maxPerDay, setMaxPerDay] = useState("10000000");
  const [token, setToken] = useState("0x...");
  const [facilitator, setFacilitator] = useState(ZERO_ADDRESS);

  const [serviceNumericId, setServiceNumericId] = useState("1");
  const [quoteAgent, setQuoteAgent] = useState("0x...");
  const [amount, setAmount] = useState("1000000");
  const [paymentRail, setPaymentRail] = useState("3");
  const [expiresAt, setExpiresAt] = useState(() => String(Math.floor(Date.now() / 1000) + 3600));
  const [paymentNonce, setPaymentNonce] = useState("1");
  const [resourceDescriptor, setResourceDescriptor] = useState("merchant-service-resource-v1");
  const [termsDocument, setTermsDocument] = useState("One company enrichment response for the requested domain.");
  const [primarySettlementAmount, setPrimarySettlementAmount] = useState("830000");
  const [partnerSettlementAmount, setPartnerSettlementAmount] = useState("100000");
  const [partnerSettlementRecipient, setPartnerSettlementRecipient] = useState("0x...");
  const [taxSettlementAmount, setTaxSettlementAmount] = useState("40000");
  const [taxSettlementRecipient, setTaxSettlementRecipient] = useState("0x...");
  const [taxJurisdiction, setTaxJurisdiction] = useState("state-or-county");
  const [tipSettlementAmount, setTipSettlementAmount] = useState("10000");
  const [tipSettlementRecipient, setTipSettlementRecipient] = useState("0x...");
  const [shippingSettlementAmount, setShippingSettlementAmount] = useState("15000");
  const [shippingSettlementRecipient, setShippingSettlementRecipient] = useState("0x...");
  const [shippingMethod, setShippingMethod] = useState("merchant-selected ground");
  const [handlingSettlementAmount, setHandlingSettlementAmount] = useState("5000");
  const [handlingSettlementRecipient, setHandlingSettlementRecipient] = useState("0x...");
  const [encryptedFulfillmentUri, setEncryptedFulfillmentUri] = useState("https://api.cortex.wallyweb.com/fulfillment/0x...");
  const [encryptedFulfillmentHash, setEncryptedFulfillmentHash] = useState(ZERO_HASH);
  const [fulfillmentEncryption, setFulfillmentEncryption] = useState("x25519-xsalsa20-poly1305");
  const [x402Payload, setX402Payload] = useState("x402 payment requirement payload");
  const [quoteHash, setQuoteHash] = useState(ZERO_HASH);
  const [resultDescriptor, setResultDescriptor] = useState("merchant fulfilled accepted quote");
  const [quoteRequestInput, setQuoteRequestInput] = useState('{"domain":"example.com"}');
  const [quoteRequestId, setQuoteRequestId] = useState("req-001");
  const [resourceHash, setResourceHash] = useState(ZERO_HASH);
  const [termsHash, setTermsHash] = useState(ZERO_HASH);
  const [x402PayloadHash, setX402PayloadHash] = useState(ZERO_HASH);

  const merchantMetadata = useMemo(
    () =>
      JSON.stringify(
        {
          name: merchantName,
          website,
          support,
          owner_address: merchantOwner,
          payout_chain: "base-sepolia",
          payout_address: payout,
          refund_policy: refundPolicy,
          fulfillment_encryption: {
            key_id: merchantFulfillmentKey,
            use: "shipping_address_and_delivery_instructions",
          },
          cortex: {
            registry: CONTRACTS.commerceRegistry,
            network: "base-sepolia",
          },
        },
        null,
        2,
      ),
    [merchantName, website, support, merchantOwner, payout, refundPolicy, merchantFulfillmentKey],
  );

  const serviceMetadata = useMemo(
    () =>
      JSON.stringify(
        {
          service_id: serviceId,
          name: serviceName,
          capability,
          payment_rails: ["transfer", "swap", "facilitator", "x402"],
          input_schema: safeJson(inputSchema),
          output_schema: safeJson(outputSchema),
          sla: "Best effort during testnet onboarding.",
          privacy: "Do not include private user data in hashes or public metadata.",
        },
        null,
        2,
      ),
    [serviceId, serviceName, capability, inputSchema, outputSchema],
  );

  const serviceCatalog = useMemo(
    () =>
      JSON.stringify(
        {
          merchant: {
            name: merchantName,
            domain: domainFromUrl(website),
            support_uri: support,
            terms_uri: termsUri,
            privacy_uri: privacyUri,
            owner_address: merchantOwner,
            payout_address: payout,
            registry: CONTRACTS.commerceRegistry,
            network: "base-sepolia",
          },
          services: [
            {
              service_id: serviceId,
              name: serviceName,
              description: serviceDescription,
              endpoint: serviceEndpoint,
              method: serviceMethod,
              capability: {
                hash: capabilityHash,
                tags: capability.split(".").filter(Boolean),
              },
              payment: {
                scheme: paymentRailName(paymentRail),
                network: "base-sepolia",
                token,
                amount,
                target: payout,
                settlement: {
                  scheme: "cortex.settlement-plan.v1",
                  supports_splits: true,
                  supports_tax_lines: true,
                  supports_tip_lines: true,
                  hash_bound_in: "quote.termsHash",
                },
                facilitator: {
                  address: facilitator,
                  url: "https://facilitator.example",
                },
              },
              io: {
                input_schema: safeJson(inputSchema),
                output_schema: safeJson(outputSchema),
              },
              sla: {
                timeout_ms: numberOrString(timeoutMs),
                availability_target: Number(availabilityTarget),
              },
              refund: {
                policy_uri: termsUri,
                automatic_if_timeout: automaticRefund === "true",
                dispute_window_seconds: numberOrString(disputeWindowSeconds),
              },
              privacy: {
                stores_request: storesRequest === "true",
                stores_response: storesResponse === "true",
                pii_allowed: piiAllowed === "true",
                redaction_required: piiAllowed !== "true",
              },
            },
          ],
        },
        null,
        2,
      ),
    [
      merchantName,
      website,
      support,
      termsUri,
      privacyUri,
      merchantOwner,
      payout,
      serviceId,
      serviceName,
      serviceDescription,
      serviceEndpoint,
      serviceMethod,
      capability,
      capabilityHash,
      paymentRail,
      token,
      amount,
      facilitator,
      inputSchema,
      outputSchema,
      timeoutMs,
      availabilityTarget,
      automaticRefund,
      disputeWindowSeconds,
      storesRequest,
      storesResponse,
      piiAllowed,
    ],
  );

  const agentMetadata = useMemo(
    () =>
      JSON.stringify(
        {
          name: agentName,
          owner: agentOwner,
          network: "base-sepolia",
          intended_use: "Autonomous purchasing under Cortex policy controls.",
          capabilities: agentCapabilities,
          policy_expectations: {
            token,
            merchant_id: merchantId,
            facilitator,
            max_per_payment: maxPerPayment,
            max_per_day: maxPerDay,
          },
        },
        null,
        2,
      ),
    [agentName, agentOwner, agentCapabilities, token, merchantId, facilitator, maxPerPayment, maxPerDay],
  );

  const merchantCommand = `export RPC_URL=https://sepolia.base.org
export MERCHANT_KEY=0x...
export COMMERCE_REGISTRY_ADDRESS=${CONTRACTS.commerceRegistry}
export PAYOUT_ADDRESS=${payout}
export MERCHANT_METADATA_URI=${merchantUri}
export MERCHANT_METADATA_HASH=${merchantHash}

cast send "$COMMERCE_REGISTRY_ADDRESS" \\
  "registerMerchant(address,string,bytes32)" \\
  "$PAYOUT_ADDRESS" \\
  "$MERCHANT_METADATA_URI" \\
  "$MERCHANT_METADATA_HASH" \\
  --rpc-url "$RPC_URL" \\
  --private-key "$MERCHANT_KEY"

curl "${API_URL}/merchants?owner=${merchantOwner}"`;

  const serviceCommand = `export RPC_URL=https://sepolia.base.org
export MERCHANT_KEY=0x...
export COMMERCE_REGISTRY_ADDRESS=${CONTRACTS.commerceRegistry}
export MERCHANT_ID=${merchantId}
export SERVICE_ID=${serviceId}
export SERVICE_METADATA_URI=${serviceUri}
export SERVICE_METADATA_HASH=${serviceHash}
export CAPABILITY_HASH=${capabilityHash}

cast send "$COMMERCE_REGISTRY_ADDRESS" \\
  "registerService(uint256,string,string,bytes32,bytes32)" \\
  "$MERCHANT_ID" \\
  "$SERVICE_ID" \\
  "$SERVICE_METADATA_URI" \\
  "$SERVICE_METADATA_HASH" \\
  "$CAPABILITY_HASH" \\
  --rpc-url "$RPC_URL" \\
  --private-key "$MERCHANT_KEY"

curl "${API_URL}/services?merchant_id=$MERCHANT_ID&active=true"`;

  const agentCommand = `export RPC_URL=https://sepolia.base.org
export AGENT_KEY=0x...
export AGENT_REGISTRY_ADDRESS=${CONTRACTS.agentRegistry}
export POLICY_MODULE_ADDRESS=${CONTRACTS.policyModule}
export AGENT_METADATA_URI=${agentUri}
export AGENT_PUBKEY=${agentPubkey}
export AGENT_CAPABILITIES_HASH=${agentCapabilitiesHash}

cast send "$AGENT_REGISTRY_ADDRESS" \\
  "registerAgent(string,bytes,bytes32)" \\
  "$AGENT_METADATA_URI" \\
  "$AGENT_PUBKEY" \\
  "$AGENT_CAPABILITIES_HASH" \\
  --rpc-url "$RPC_URL" \\
  --private-key "$AGENT_KEY"

cast send "$POLICY_MODULE_ADDRESS" \\
  "setSignedPaymentPolicy(address,address,address,uint256,uint256,bool)" \\
  "<merchant-owner-address>" \\
  "${token}" \\
  "${facilitator}" \\
  "${maxPerPayment}" \\
  "${maxPerDay}" \\
  true \\
  --rpc-url "$RPC_URL" \\
  --private-key "$AGENT_KEY"`;

  const settlementPlan = useMemo(
    () => {
      const lineTotal = sumDecimalStrings([
        primarySettlementAmount,
        partnerSettlementAmount,
        taxSettlementAmount,
        tipSettlementAmount,
        shippingSettlementAmount,
        handlingSettlementAmount,
      ]);

      return JSON.stringify(
        {
          schema: "cortex.settlement-plan.v1",
          network: "base-sepolia",
          registry: CONTRACTS.commerceRegistry,
          quote: {
            merchant_id: merchantId,
            service_numeric_id: serviceNumericId,
            service_id: serviceId,
            agent: quoteAgent,
            token,
            payment_rail: paymentRailName(paymentRail),
            facilitator,
            gross_amount: amount,
          },
          terms: {
            summary: termsDocument,
            terms_uri: termsUri,
            refund_policy: refundPolicy,
            dispute_window_seconds: numberOrString(disputeWindowSeconds),
          },
          fulfillment: {
            encrypted_payload_uri: encryptedFulfillmentUri,
            encrypted_payload_hash: encryptedFulfillmentHash,
            encryption: fulfillmentEncryption,
            merchant_key_id: merchantFulfillmentKey,
            contains: ["shipping_name", "shipping_address", "delivery_instructions"],
            plaintext_not_onchain: true,
          },
          lines: [
            {
              kind: "merchant",
              label: "Primary merchant",
              merchant_id: merchantId,
              recipient: payout,
              token,
              amount: primarySettlementAmount,
              basis_points: basisPoints(primarySettlementAmount, amount),
            },
            {
              kind: "supplier",
              label: "Partner merchant",
              merchant_id: null,
              recipient: partnerSettlementRecipient,
              token,
              amount: partnerSettlementAmount,
              basis_points: basisPoints(partnerSettlementAmount, amount),
            },
            {
              kind: "tax",
              label: "Tax reserve",
              jurisdiction: taxJurisdiction,
              authority: "merchant_or_tax_provider",
              recipient: taxSettlementRecipient,
              token,
              amount: taxSettlementAmount,
              basis_points: basisPoints(taxSettlementAmount, amount),
            },
            {
              kind: "tip",
              label: "Optional tip",
              optional: true,
              recipient: tipSettlementRecipient,
              token,
              amount: tipSettlementAmount,
              basis_points: basisPoints(tipSettlementAmount, amount),
            },
            {
              kind: "shipping",
              label: "Shipping",
              method: shippingMethod,
              recipient: shippingSettlementRecipient,
              token,
              amount: shippingSettlementAmount,
              basis_points: basisPoints(shippingSettlementAmount, amount),
              fulfillment_hash: encryptedFulfillmentHash,
            },
            {
              kind: "handling",
              label: "Handling",
              recipient: handlingSettlementRecipient,
              token,
              amount: handlingSettlementAmount,
              basis_points: basisPoints(handlingSettlementAmount, amount),
            },
          ],
          verification: {
            line_total: lineTotal,
            matches_quote_amount: lineTotal === amount,
            hash_algorithm: "keccak256(utf8(canonical-json))",
          },
        },
        null,
        2,
      );
    },
    [
      merchantId,
      serviceNumericId,
      serviceId,
      quoteAgent,
      token,
      paymentRail,
      facilitator,
      amount,
      termsDocument,
      termsUri,
      refundPolicy,
      disputeWindowSeconds,
      payout,
      primarySettlementAmount,
      partnerSettlementRecipient,
      partnerSettlementAmount,
      taxJurisdiction,
      taxSettlementRecipient,
      taxSettlementAmount,
      tipSettlementRecipient,
      tipSettlementAmount,
      shippingSettlementRecipient,
      shippingSettlementAmount,
      shippingMethod,
      handlingSettlementRecipient,
      handlingSettlementAmount,
      encryptedFulfillmentUri,
      encryptedFulfillmentHash,
      fulfillmentEncryption,
      merchantFulfillmentKey,
    ],
  );
  const settlementLineTotal = useMemo(
    () =>
      sumDecimalStrings([
        primarySettlementAmount,
        partnerSettlementAmount,
        taxSettlementAmount,
        tipSettlementAmount,
        shippingSettlementAmount,
        handlingSettlementAmount,
      ]),
    [
      primarySettlementAmount,
      partnerSettlementAmount,
      taxSettlementAmount,
      tipSettlementAmount,
      shippingSettlementAmount,
      handlingSettlementAmount,
    ],
  );
  const settlementMatchesQuote = settlementLineTotal === amount;

  const quotePayload = JSON.stringify(
    {
      merchantId,
      serviceNumericId,
      agent: quoteAgent,
      token,
      facilitator,
      amount,
      paymentRail,
      expiresAt,
      paymentNonce,
      resourceHash,
      termsHash,
      x402PayloadHash,
    },
    null,
    2,
  );

  const quoteRequest = useMemo(
    () =>
      JSON.stringify(
        {
          request_id: quoteRequestId,
          merchant_id: merchantId,
          service_numeric_id: serviceNumericId,
          service_id: serviceId,
          agent: quoteAgent,
          input: safeJson(quoteRequestInput),
          accepted_payment_rails: ["transfer", "swap", "facilitator", "x402"],
          preferred_token: token,
          max_amount: amount,
          requested_resource_hash: resourceHash,
        },
        null,
        2,
      ),
    [quoteRequestId, merchantId, serviceNumericId, serviceId, quoteAgent, quoteRequestInput, token, amount, resourceHash],
  );

  const quoteResponse = useMemo(
    () =>
      JSON.stringify(
        {
          request_id: quoteRequestId,
          quote: JSON.parse(quotePayload) as unknown,
          terms_hash_input: "settlement_plan",
          settlement_plan: JSON.parse(settlementPlan) as unknown,
          payment_requirement: paymentRail === "3" ? safeJson(x402Payload) : null,
          agent_checks: [
            "fetch service catalog and verify metadata hash",
            "verify merchant/service active status",
            "verify quote hash from CommerceRegistry.computeQuoteHash",
            "verify settlement plan hash equals the quote termsHash",
            "verify settlement line total equals quoted amount",
            "verify account policy before payment",
            "verify x402 payload hash when paymentRail is 3",
          ],
        },
        null,
        2,
      ),
    [quoteRequestId, quotePayload, settlementPlan, paymentRail, x402Payload],
  );

  const quoteExchangeSummary = JSON.stringify(
    {
      quote_request_uri: quoteRequestPublish.uri,
      quote_request_hash: quoteRequestPublish.hash,
      quote_response_uri: quoteResponsePublish.uri,
      quote_response_hash: quoteResponsePublish.hash,
      verification: [
        "fetch each URI and recompute keccak256 over the canonical JSON response text",
        "verify merchant and service state before payment",
        "verify quote payload hashes before commit/payment",
      ],
    },
    null,
    2,
  );

  const quoteCommand = `// Use viem or cast to compute and commit the same canonical quote.
// paymentRail: 0=transfer, 1=swap, 2=facilitator, 3=x402

const quote = ${quotePayload};

const quoteHash = await publicClient.readContract({
  address: "${CONTRACTS.commerceRegistry}",
  abi: CommerceRegistryABI,
  functionName: "computeQuoteHash",
  args: [
    BigInt(quote.merchantId),
    BigInt(quote.serviceNumericId),
    quote.agent,
    quote.token,
    quote.facilitator,
    BigInt(quote.amount),
    Number(quote.paymentRail),
    BigInt(quote.expiresAt),
    BigInt(quote.paymentNonce),
    quote.resourceHash,
    quote.termsHash,
    quote.x402PayloadHash,
  ],
});

await merchantWallet.writeContract({
  address: "${CONTRACTS.commerceRegistry}",
  abi: CommerceRegistryABI,
  functionName: "commitQuote",
  args: [quote],
});`;

  const merchantPayoutValid = isAddress(payout);
  const merchantOwnerValid = isAddress(merchantOwner);
  const agentOwnerValid = isAddress(agentOwner);
  const tokenValid = isAddress(token);
  const facilitatorValid = isAddress(facilitator);
  const quoteAgentValid = isAddress(quoteAgent);
  const setTxState = (key: TxKey, patch: Partial<TxState>) => {
    setTxStates((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  };
  const hashMerchantMetadata = () => setMerchantHash(hashJsonText(merchantMetadata));
  const hashServiceMetadata = () => setServiceHash(hashJsonText(serviceMetadata));
  const hashCatalog = () => {
    const hash = hashJsonText(serviceCatalog);
    setCatalogHash(hash);
    setServiceHash(hash);
    setServiceUri(catalogUri);
  };
  const publishCatalog = async () => {
    setCatalogPublish({ loading: true, error: null, uri: null, hash: null });
    try {
      const expectedHash = hashJsonText(serviceCatalog);
      const response = await fetch(`${API_URL}/catalogs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          catalog_json: canonicalizeJsonText(serviceCatalog),
          expected_hash: expectedHash,
          merchant_id: merchantId,
          service_id: serviceId,
        }),
      });
      const body = await response.json() as { uri?: string; catalog_hash?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? `${response.status} ${response.statusText}`);
      if (!body.uri || !body.catalog_hash) throw new Error("Catalog publish response was missing uri or catalog_hash");

      setCatalogUri(body.uri);
      setCatalogHash(body.catalog_hash);
      setServiceUri(body.uri);
      setServiceHash(body.catalog_hash);
      setCatalogPublish({
        loading: false,
        error: null,
        uri: body.uri,
        hash: body.catalog_hash,
      });
    } catch (error) {
      setCatalogPublish({
        loading: false,
        error: error instanceof Error ? error.message : "Catalog publish failed",
        uri: null,
        hash: null,
      });
    }
  };
  const publishQuoteRequest = async () => {
    setQuoteRequestPublish({ loading: true, error: null, uri: null, hash: null });
    try {
      const expectedHash = hashJsonText(quoteRequest);
      const response = await fetch(`${API_URL}/quote-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quote_request_json: canonicalizeJsonText(quoteRequest),
          expected_hash: expectedHash,
          request_id: quoteRequestId,
          merchant_id: merchantId,
          service_numeric_id: serviceNumericId,
          service_id: serviceId,
          agent: quoteAgent,
        }),
      });
      const body = await response.json() as { uri?: string; request_hash?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? `${response.status} ${response.statusText}`);
      if (!body.uri || !body.request_hash) throw new Error("Quote request publish response was missing uri or request_hash");
      setQuoteRequestPublish({ loading: false, error: null, uri: body.uri, hash: body.request_hash });
    } catch (error) {
      setQuoteRequestPublish({
        loading: false,
        error: error instanceof Error ? error.message : "Quote request publish failed",
        uri: null,
        hash: null,
      });
    }
  };
  const publishQuoteResponse = async () => {
    setQuoteResponsePublish({ loading: true, error: null, uri: null, hash: null });
    try {
      const expectedHash = hashJsonText(quoteResponse);
      const response = await fetch(`${API_URL}/quote-responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quote_response_json: canonicalizeJsonText(quoteResponse),
          expected_hash: expectedHash,
          request_hash: quoteRequestPublish.hash,
          request_id: quoteRequestId,
          merchant_id: merchantId,
          service_numeric_id: serviceNumericId,
          agent: quoteAgent,
        }),
      });
      const body = await response.json() as { uri?: string; response_hash?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? `${response.status} ${response.statusText}`);
      if (!body.uri || !body.response_hash) throw new Error("Quote response publish response was missing uri or response_hash");
      setQuoteResponsePublish({ loading: false, error: null, uri: body.uri, hash: body.response_hash });
    } catch (error) {
      setQuoteResponsePublish({
        loading: false,
        error: error instanceof Error ? error.message : "Quote response publish failed",
        uri: null,
        hash: null,
      });
    }
  };
  const hashCapability = () => setCapabilityHash(hashText(capability));
  const hashAgentCapabilities = () => setAgentCapabilitiesHash(hashText(agentCapabilities));
  const hashResource = () => setResourceHash(hashText(resourceDescriptor));
  const hashTerms = () => setTermsHash(hashJsonText(settlementPlan));
  const hashX402Payload = () => setX402PayloadHash(hashText(x402Payload));
  const runWalletChecks = async () => {
    setWalletCheck((current) => ({ ...current, loading: true, error: null }));
    try {
      const provider = getEthereumProvider();
      if (!provider) throw new Error("No injected wallet found. Install or unlock a wallet first.");

      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      const chainHex = await provider.request({ method: "eth_chainId" }) as string;
      const nextContracts: Record<string, boolean> = {};
      for (const [name, address] of Object.entries(CONTRACTS)) {
        const code = await provider.request({ method: "eth_getCode", params: [address, "latest"] }) as string;
        nextContracts[name] = Boolean(code && code !== "0x");
      }

      const apiOk = await fetch(`${API_URL}/health`)
        .then((response) => response.ok)
        .catch(() => false);

      setWalletCheck({
        account: accounts[0] ?? null,
        chainId: Number.parseInt(chainHex, 16),
        apiOk,
        contracts: nextContracts,
        loading: false,
        error: null,
      });
    } catch (error) {
      setWalletCheck((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Wallet check failed",
      }));
    }
  };
  const switchToBaseSepolia = async () => {
    setWalletCheck((current) => ({ ...current, loading: true, error: null }));
    try {
      const provider = getEthereumProvider();
      if (!provider) throw new Error("No injected wallet found. Install or unlock a wallet first.");

      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BASE_SEPOLIA_CHAIN_HEX }],
        });
      } catch (switchError) {
        if (isWalletChainMissingError(switchError)) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: BASE_SEPOLIA_CHAIN_HEX,
                chainName: "Base Sepolia",
                nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://sepolia.base.org"],
                blockExplorerUrls: ["https://sepolia.basescan.org"],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }

      await runWalletChecks();
    } catch (error) {
      setWalletCheck((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Network switch failed",
      }));
    }
  };
  const readOnchainState = async () => {
    setOnchainRead((current) => ({ ...current, loading: true, error: null }));
    try {
      const provider = getEthereumProvider();
      if (!provider) throw new Error("No injected wallet found. Install or unlock a wallet first.");
      const chainHex = await provider.request({ method: "eth_chainId" }) as string;
      const chainId = Number.parseInt(chainHex, 16);
      if (chainId !== BASE_SEPOLIA_CHAIN_ID) throw new Error("Switch your wallet to Base Sepolia before reading contracts.");

      const nextMerchant = await readMerchant(provider, merchantId);
      const nextService = await readService(provider, serviceNumericId);
      const nextAgentIds = walletCheck.account && isAddress(walletCheck.account)
        ? await readAgentIds(provider, walletCheck.account)
        : null;

      setOnchainRead({
        loading: false,
        error: null,
        merchant: nextMerchant,
        service: nextService,
        agentIds: nextAgentIds,
      });
    } catch (error) {
      setOnchainRead((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Onchain read failed",
      }));
    }
  };
  const useWalletAddress = () => {
    if (!walletCheck.account) return;
    setMerchantOwner(walletCheck.account);
    setAgentOwner(walletCheck.account);
    setQuoteAgent(walletCheck.account);
  };
  const sendRegisterMerchant = async () => {
    await sendTx("merchant", async (provider, account) => {
      const data = encodeFunctionData({
        abi: COMMERCE_WRITE_ABI,
        functionName: "registerMerchant",
        args: [parseAddress(payout, "payout address"), merchantUri, parseBytes32(merchantHash, "merchant metadata hash")],
      });
      return sendWalletTransaction(provider, account, CONTRACTS.commerceRegistry, data);
    });
  };
  const sendRegisterService = async () => {
    await sendTx("service", async (provider, account) => {
      const data = encodeFunctionData({
        abi: COMMERCE_WRITE_ABI,
        functionName: "registerService",
        args: [
          parsePositiveBigInt(merchantId, "merchant id"),
          serviceId,
          serviceUri,
          parseBytes32(serviceHash, "service metadata hash"),
          parseBytes32(capabilityHash, "capability hash"),
        ],
      });
      return sendWalletTransaction(provider, account, CONTRACTS.commerceRegistry, data);
    });
  };
  const sendRegisterAgent = async () => {
    await sendTx("agent", async (provider, account) => {
      const data = encodeFunctionData({
        abi: AGENT_WRITE_ABI,
        functionName: "registerAgent",
        args: [agentUri, parseHexBytes(agentPubkey, "agent pubkey"), parseBytes32(agentCapabilitiesHash, "agent capabilities hash")],
      });
      return sendWalletTransaction(provider, account, CONTRACTS.agentRegistry, data);
    });
  };
  const sendSetPaymentPolicy = async () => {
    await sendTx("policy", async (provider, account) => {
      const data = encodeFunctionData({
        abi: POLICY_WRITE_ABI,
        functionName: "setSignedPaymentPolicy",
        args: [
          parseAddress(merchantOwner, "merchant owner"),
          parseAddress(token, "token"),
          parseAddress(facilitator, "facilitator"),
          parseUint(maxPerPayment, "max per payment"),
          parseUint(maxPerDay, "max per day"),
          true,
        ],
      });
      return sendWalletTransaction(provider, account, CONTRACTS.policyModule, data);
    });
  };
  const sendCommitQuote = async () => {
    await sendTx("quote", async (provider, account) => {
      const commitment = buildQuoteCommitment({
        merchantId,
        serviceNumericId,
        quoteAgent,
        token,
        facilitator,
        amount,
        paymentRail,
        expiresAt,
        paymentNonce,
        resourceHash,
        termsHash,
        x402PayloadHash,
      });
      const data = encodeFunctionData({
        abi: COMMERCE_WRITE_ABI,
        functionName: "commitQuote",
        args: [commitment],
      });
      return sendWalletTransaction(provider, account, CONTRACTS.commerceRegistry, data);
    });
  };
  const sendRecordReceipt = async () => {
    await sendTx("receipt", async (provider, account) => {
      const data = encodeFunctionData({
        abi: COMMERCE_WRITE_ABI,
        functionName: "recordReceipt",
        args: [parseBytes32(quoteHash, "quote hash"), hashText(resultDescriptor)],
      });
      return sendWalletTransaction(provider, account, CONTRACTS.commerceRegistry, data);
    });
  };
  const sendTx = async (
    key: TxKey,
    build: (provider: EthereumProvider, account: `0x${string}`) => Promise<string>,
  ) => {
    setTxState(key, { loading: true, error: null, hash: null });
    try {
      const { provider, account } = await requireWalletReady();
      const hash = await build(provider, account);
      setTxState(key, { loading: false, error: null, hash });
      await runWalletChecks();
    } catch (error) {
      setTxState(key, {
        loading: false,
        error: error instanceof Error ? error.message : "Transaction failed",
        hash: null,
      });
    }
  };

  return (
    <main className="min-h-screen bg-[#090d12]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-muted">Cortex Product Onboarding</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">Launch an agent-commerce flow</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Build merchant metadata, register services, prepare an agent account, and commit a quote.
              You can use the generated templates or send the core transactions directly from a browser wallet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/docs/examples" className="rounded-md border border-border px-3 py-2 text-muted hover:text-text">
              Examples
            </Link>
            <Link href="/dashboard" className="rounded-md border border-border px-3 py-2 text-muted hover:text-text">
              Dashboard
            </Link>
          </div>
        </div>

        <PreflightPanel
          state={walletCheck}
          onCheck={runWalletChecks}
          onSwitchNetwork={switchToBaseSepolia}
          onUseWallet={useWalletAddress}
        />

        <div className="mb-6 grid gap-3 md:grid-cols-5">
          {[
            ["merchant", "Merchant profile"],
            ["service", "Service catalog"],
            ["catalog", "Publish catalog"],
            ["agent", "Agent policy"],
            ["quote", "Quote acceptance"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStep(id as StepId)}
              className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                step === id
                  ? "border-accent-blue bg-accent-blue/10 text-text"
                  : "border-border bg-[#11151c] text-muted hover:border-muted hover:text-text"
              }`}
            >
              <span className="block text-xs uppercase tracking-normal text-muted">Step</span>
              <span className="mt-1 block font-medium">{label}</span>
            </button>
          ))}
        </div>

        {step === "merchant" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">Merchant profile</h2>
              <p className="mt-2 text-sm text-muted">
                Start with a payout address and metadata URI/hash. The metadata can live on IPFS,
                Arweave, or HTTPS; Cortex anchors the URI and hash onchain.
              </p>
              <div className="mt-5 grid gap-4">
                <Field label="Merchant name" value={merchantName} onChange={setMerchantName} />
                <Field label="Website" value={website} onChange={setWebsite} />
                <Field label="Support contact" value={support} onChange={setSupport} />
                <Field label="Merchant owner" value={merchantOwner} onChange={setMerchantOwner} />
                <StatusPill ok={merchantOwnerValid} label={merchantOwnerValid ? "Valid owner address" : "Enter the transaction sender address"} />
                <Field label="Payout address" value={payout} onChange={setPayout} />
                <StatusPill ok={merchantPayoutValid} label={merchantPayoutValid ? "Valid payout address" : "Enter a 0x payout address"} />
                <Field label="Fulfillment encryption key" value={merchantFulfillmentKey} onChange={setMerchantFulfillmentKey} />
                <TextArea label="Refund policy" value={refundPolicy} onChange={setRefundPolicy} />
                <Field label="Metadata URI" value={merchantUri} onChange={setMerchantUri} />
                <Field label="Metadata hash" value={merchantHash} onChange={setMerchantHash} />
                <button
                  type="button"
                  onClick={hashMerchantMetadata}
                  className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
                >
                  Generate merchant metadata hash
                </button>
              </div>
            </div>
            <div className="grid gap-4">
              <CodePanel title="Merchant metadata JSON" value={merchantMetadata} />
              <CodePanel title="Register merchant" value={merchantCommand} />
              <TransactionPanel
                title="Register merchant with wallet"
                description="Sends registerMerchant from the connected wallet. The connected account becomes the merchant owner."
                actionLabel="Register merchant"
                state={txStates.merchant}
                onSend={sendRegisterMerchant}
              />
              <LookupPanel
                title="Merchant API check"
                description="After registration and indexing, confirm the merchant record is visible."
                path={`/merchants?owner=${encodeURIComponent(merchantOwner)}&limit=5`}
              />
              <OnchainReadPanel state={onchainRead} onRead={readOnchainState} />
            </div>
          </section>
        ) : null}

        {step === "service" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">Service catalog</h2>
              <p className="mt-2 text-sm text-muted">
                Register each agent-readable product as a service with a stable service id, metadata hash,
                and capability hash. Rich schemas stay offchain and are hash-committed onchain.
              </p>
              <div className="mt-5 grid gap-4">
                <Field label="Merchant ID" value={merchantId} onChange={setMerchantId} />
                <Field label="Service ID" value={serviceId} onChange={setServiceId} />
                <Field label="Service name" value={serviceName} onChange={setServiceName} />
                <TextArea label="Service description" value={serviceDescription} onChange={setServiceDescription} />
                <Field label="Endpoint" value={serviceEndpoint} onChange={setServiceEndpoint} />
                <Field label="Method" value={serviceMethod} onChange={setServiceMethod} />
                <Field label="Capability" value={capability} onChange={setCapability} />
                <TextArea label="Input schema" value={inputSchema} onChange={setInputSchema} />
                <TextArea label="Output schema" value={outputSchema} onChange={setOutputSchema} />
                <Field label="Service metadata URI" value={serviceUri} onChange={setServiceUri} />
                <Field label="Service metadata hash" value={serviceHash} onChange={setServiceHash} />
                <Field label="Capability hash" value={capabilityHash} onChange={setCapabilityHash} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={hashServiceMetadata}
                    className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
                  >
                    Hash service metadata
                  </button>
                  <button
                    type="button"
                    onClick={hashCapability}
                    className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
                  >
                    Hash capability
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-4">
              <CodePanel title="Service metadata JSON" value={serviceMetadata} />
              <CodePanel title="Register service" value={serviceCommand} />
              <TransactionPanel
                title="Register service with wallet"
                description="Sends registerService from the connected merchant owner wallet."
                actionLabel="Register service"
                state={txStates.service}
                onSend={sendRegisterService}
              />
              <LookupPanel
                title="Service API check"
                description="After registration and indexing, confirm active services for this merchant."
                path={`/services?merchant_id=${encodeURIComponent(merchantId)}&active=true&limit=10`}
              />
              <OnchainReadPanel state={onchainRead} onRead={readOnchainState} />
            </div>
          </section>
        ) : null}

        {step === "catalog" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">Publish catalog</h2>
              <p className="mt-2 text-sm text-muted">
                Generate a schema-compatible catalog that agents and marketplaces can read before
                checking the onchain service record. Publish the downloaded JSON to IPFS, Arweave,
                S3, or HTTPS, then register its URI and hash as service metadata.
              </p>
              <div className="mt-5 grid gap-4">
                <Field label="Catalog URI" value={catalogUri} onChange={setCatalogUri} />
                <Field label="Catalog hash" value={catalogHash} onChange={setCatalogHash} />
                <Field label="Terms URI" value={termsUri} onChange={setTermsUri} />
                <Field label="Privacy URI" value={privacyUri} onChange={setPrivacyUri} />
                <Field label="Timeout ms" value={timeoutMs} onChange={setTimeoutMs} />
                <Field label="Availability target" value={availabilityTarget} onChange={setAvailabilityTarget} />
                <Field label="Automatic refund if timeout" value={automaticRefund} onChange={setAutomaticRefund} />
                <Field label="Dispute window seconds" value={disputeWindowSeconds} onChange={setDisputeWindowSeconds} />
                <Field label="Stores request" value={storesRequest} onChange={setStoresRequest} />
                <Field label="Stores response" value={storesResponse} onChange={setStoresResponse} />
                <Field label="PII allowed" value={piiAllowed} onChange={setPiiAllowed} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={hashCatalog}
                    className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
                  >
                    Hash and use catalog
                  </button>
                  <DownloadButton
                    filename={`${serviceId || "cortex-service"}-catalog.json`}
                    value={serviceCatalog}
                    label="Download catalog JSON"
                  />
                </div>
              </div>
              <div className="mt-4">
                <CatalogPublishPanel state={catalogPublish} onPublish={publishCatalog} />
              </div>
              <div className="mt-6 rounded-lg border border-border bg-[#0d1117] p-4">
                <h3 className="text-sm font-semibold">Publishing checklist</h3>
                <div className="mt-3">
                  <Checklist
                    items={[
                      "Download the catalog JSON and publish those exact bytes to a stable URI.",
                      "Click Hash and use catalog after final edits so service metadata hash matches the published file.",
                      "Register the service with the catalog URI and catalog hash.",
                      "Agents should fetch the catalog URI, hash the response bytes, and compare that hash with Cortex before paying.",
                    ]}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-4">
              <CodePanel title="Service catalog JSON" value={serviceCatalog} />
              <CodePanel
                title="Register service with catalog"
                value={`export SERVICE_METADATA_URI=${catalogUri}
export SERVICE_METADATA_HASH=${catalogHash}

cast send "${CONTRACTS.commerceRegistry}" \\
  "registerService(uint256,string,string,bytes32,bytes32)" \\
  "${merchantId}" \\
  "${serviceId}" \\
  "$SERVICE_METADATA_URI" \\
  "$SERVICE_METADATA_HASH" \\
  "${capabilityHash}" \\
  --rpc-url "https://sepolia.base.org" \\
  --private-key "$MERCHANT_KEY"`}
              />
            </div>
          </section>
        ) : null}

        {step === "agent" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">Agent policy</h2>
              <p className="mt-2 text-sm text-muted">
                Register the agent identity, then configure signed payment policy for facilitator or x402
                flows. Direct transfers and swaps should also be constrained through account policy.
              </p>
              <div className="mt-5 grid gap-4">
                <Field label="Agent name" value={agentName} onChange={setAgentName} />
                <Field label="Agent owner" value={agentOwner} onChange={setAgentOwner} />
                <StatusPill ok={agentOwnerValid} label={agentOwnerValid ? "Valid owner address" : "Enter a 0x owner address"} />
                <Field label="Agent metadata URI" value={agentUri} onChange={setAgentUri} />
                <Field label="Agent pubkey" value={agentPubkey} onChange={setAgentPubkey} />
                <Field label="Agent capabilities" value={agentCapabilities} onChange={setAgentCapabilities} />
                <Field label="Agent capabilities hash" value={agentCapabilitiesHash} onChange={setAgentCapabilitiesHash} />
                <Field label="Token" value={token} onChange={setToken} />
                <StatusPill ok={tokenValid} label={tokenValid ? "Valid token address" : "Enter a 0x token address"} />
                <Field label="Facilitator" value={facilitator} onChange={setFacilitator} />
                <StatusPill ok={facilitatorValid} label={facilitatorValid ? "Valid facilitator address" : "Enter a 0x facilitator address"} />
                <Field label="Max per payment" value={maxPerPayment} onChange={setMaxPerPayment} />
                <Field label="Max per day" value={maxPerDay} onChange={setMaxPerDay} />
                <button
                  type="button"
                  onClick={hashAgentCapabilities}
                  className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
                >
                  Hash agent capabilities
                </button>
              </div>
            </div>
            <div className="grid gap-4">
              <CodePanel title="Agent metadata JSON" value={agentMetadata} />
              <CodePanel title="Register agent and set payment policy" value={agentCommand} />
              <div className="grid gap-4 lg:grid-cols-2">
                <TransactionPanel
                  title="Register agent with wallet"
                  description="Sends registerAgent from the connected owner wallet."
                  actionLabel="Register agent"
                  state={txStates.agent}
                  onSend={sendRegisterAgent}
                />
                <TransactionPanel
                  title="Set signed payment policy"
                  description="Allows the connected wallet to spend under merchant, token, facilitator, and budget limits."
                  actionLabel="Set policy"
                  state={txStates.policy}
                  onSend={sendSetPaymentPolicy}
                />
              </div>
              <OnchainReadPanel state={onchainRead} onRead={readOnchainState} />
            </div>
          </section>
        ) : null}

        {step === "quote" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">Quote acceptance</h2>
              <p className="mt-2 text-sm text-muted">
                A quote binds merchant, service, agent, token, amount, rail, nonce, resource, terms,
                optional x402 payload, and fee terms. Agents should verify all fields before payment.
              </p>
              <div className="mt-5 grid gap-4">
                <Field label="Merchant ID" value={merchantId} onChange={setMerchantId} />
                <Field label="Service numeric ID" value={serviceNumericId} onChange={setServiceNumericId} />
                <Field label="Agent address" value={quoteAgent} onChange={setQuoteAgent} />
                <StatusPill ok={quoteAgentValid} label={quoteAgentValid ? "Valid agent address" : "Enter a 0x agent address"} />
                <Field label="Token" value={token} onChange={setToken} />
                <StatusPill ok={tokenValid} label={tokenValid ? "Valid token address" : "Enter a 0x token address"} />
                <Field label="Facilitator" value={facilitator} onChange={setFacilitator} />
                <StatusPill ok={facilitatorValid} label={facilitatorValid ? "Valid facilitator address" : "Enter a 0x facilitator address"} />
                <Field label="Amount" value={amount} onChange={setAmount} />
                <Field label="Payment rail" value={paymentRail} onChange={setPaymentRail} />
                <Field label="Expires at" value={expiresAt} onChange={setExpiresAt} />
                <Field label="Payment nonce" value={paymentNonce} onChange={setPaymentNonce} />
                <Field label="Accepted quote hash" value={quoteHash} onChange={setQuoteHash} />
                <Field label="Quote request ID" value={quoteRequestId} onChange={setQuoteRequestId} />
                <TextArea label="Quote request input" value={quoteRequestInput} onChange={setQuoteRequestInput} />
                <TextArea label="Resource descriptor" value={resourceDescriptor} onChange={setResourceDescriptor} />
                <TextArea label="Terms document" value={termsDocument} onChange={setTermsDocument} />
                <div className="rounded-lg border border-border bg-[#0d1117] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-semibold">Settlement lines</h3>
                    <StatusPill
                      ok={settlementMatchesQuote}
                      label={settlementMatchesQuote ? "Line total matches quote" : `Line total ${settlementLineTotal}`}
                    />
                  </div>
                  <div className="mt-4 grid gap-4">
                    <Field label="Primary merchant amount" value={primarySettlementAmount} onChange={setPrimarySettlementAmount} />
                    <Field label="Partner merchant recipient" value={partnerSettlementRecipient} onChange={setPartnerSettlementRecipient} />
                    <Field label="Partner merchant amount" value={partnerSettlementAmount} onChange={setPartnerSettlementAmount} />
                    <Field label="Tax reserve recipient" value={taxSettlementRecipient} onChange={setTaxSettlementRecipient} />
                    <Field label="Tax amount" value={taxSettlementAmount} onChange={setTaxSettlementAmount} />
                    <Field label="Tax jurisdiction" value={taxJurisdiction} onChange={setTaxJurisdiction} />
                    <Field label="Tip recipient" value={tipSettlementRecipient} onChange={setTipSettlementRecipient} />
                    <Field label="Tip amount" value={tipSettlementAmount} onChange={setTipSettlementAmount} />
                    <Field label="Shipping recipient" value={shippingSettlementRecipient} onChange={setShippingSettlementRecipient} />
                    <Field label="Shipping amount" value={shippingSettlementAmount} onChange={setShippingSettlementAmount} />
                    <Field label="Shipping method" value={shippingMethod} onChange={setShippingMethod} />
                    <Field label="Handling recipient" value={handlingSettlementRecipient} onChange={setHandlingSettlementRecipient} />
                    <Field label="Handling amount" value={handlingSettlementAmount} onChange={setHandlingSettlementAmount} />
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-[#0d1117] p-4">
                  <h3 className="text-sm font-semibold">Encrypted fulfillment payload</h3>
                  <div className="mt-4 grid gap-4">
                    <Field label="Encrypted payload URI" value={encryptedFulfillmentUri} onChange={setEncryptedFulfillmentUri} />
                    <Field label="Encrypted payload hash" value={encryptedFulfillmentHash} onChange={setEncryptedFulfillmentHash} />
                    <Field label="Encryption scheme" value={fulfillmentEncryption} onChange={setFulfillmentEncryption} />
                    <Field label="Merchant key ID" value={merchantFulfillmentKey} onChange={setMerchantFulfillmentKey} />
                  </div>
                </div>
                <TextArea label="x402 payload" value={x402Payload} onChange={setX402Payload} />
                <TextArea label="Receipt result descriptor" value={resultDescriptor} onChange={setResultDescriptor} />
                <Field label="Resource hash" value={resourceHash} onChange={setResourceHash} />
                <Field label="Terms hash" value={termsHash} onChange={setTermsHash} />
                <Field label="x402 payload hash" value={x402PayloadHash} onChange={setX402PayloadHash} />
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={hashResource}
                    className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
                  >
                    Hash resource
                  </button>
                  <button
                    type="button"
                    onClick={hashTerms}
                    className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
                  >
                    Hash settlement terms
                  </button>
                  <button
                    type="button"
                    onClick={hashX402Payload}
                    className="rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text"
                  >
                    Hash x402 sample
                  </button>
                </div>
              </div>
              <div className="mt-6 rounded-lg border border-border bg-[#0d1117] p-4">
                <h3 className="text-sm font-semibold">Agent acceptance checklist</h3>
                <div className="mt-3">
                  <Checklist
                    items={[
                      "Merchant and service are active in Cortex.",
                      "Metadata hashes match the offchain merchant and service documents.",
                      "Payment rail and facilitator match the actual payment requirement.",
                      "Settlement plan hash equals termsHash and line total equals the quote amount.",
                      "Tax recipients are verified remittance or reserve wallets for the merchant's jurisdiction.",
                      "Shipping address is encrypted to the merchant fulfillment key and only the URI/hash are public.",
                      "The account policy allows this merchant, token, facilitator, target, amount, and daily total.",
                      "For x402, the normalized payment payload hash equals the quote x402 payload hash.",
                      "The quote has not expired and the nonce has not been reused.",
                    ]}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-4">
              <CodePanel title="Agent quote request" value={quoteRequest} />
              <CodePanel title="Merchant quote response" value={quoteResponse} />
              <CodePanel title="Settlement plan JSON" value={settlementPlan} />
              <div className="grid gap-4 lg:grid-cols-2">
                <QuotePublishPanel
                  title="Publish quote request"
                  description="Stores canonical agent request JSON and returns a stable URL for the merchant."
                  state={quoteRequestPublish}
                  onPublish={publishQuoteRequest}
                />
                <QuotePublishPanel
                  title="Publish quote response"
                  description="Stores canonical merchant response JSON and returns a stable URL for the agent."
                  state={quoteResponsePublish}
                  onPublish={publishQuoteResponse}
                />
              </div>
              <CodePanel title="Hosted quote exchange" value={quoteExchangeSummary} />
              <CodePanel title="Quote payload" value={quotePayload} />
              <CodePanel title="Compute and commit quote" value={quoteCommand} />
              <div className="grid gap-4 lg:grid-cols-2">
                <TransactionPanel
                  title="Commit quote with wallet"
                  description="Sends commitQuote from the connected merchant owner wallet."
                  actionLabel="Commit quote"
                  state={txStates.quote}
                  onSend={sendCommitQuote}
                />
                <TransactionPanel
                  title="Record receipt with wallet"
                  description="For transfer/swap rails, the merchant or agent can record the receipt. For facilitator/x402 rails, use the facilitator wallet."
                  actionLabel="Record receipt"
                  state={txStates.receipt}
                  onSend={sendRecordReceipt}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <DownloadButton
                  filename={`${quoteRequestId || "quote"}-request.json`}
                  value={quoteRequest}
                  label="Download request"
                />
                <DownloadButton
                  filename={`${quoteRequestId || "quote"}-response.json`}
                  value={quoteResponse}
                  label="Download response"
                />
              </div>
              <LookupPanel
                title="Merchant reputation check"
                description="Before accepting a quote, inspect indexed merchant reputation."
                path={`/merchants/${encodeURIComponent(merchantId)}/reputation`}
              />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function hashText(value: string) {
  return keccak256(toBytes(value));
}

function hashJsonText(value: string) {
  return hashCanonicalJsonText(value);
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return value.replace(/^https?:\/\//, "").split("/")[0] || value;
  }
}

function paymentRailName(value: string) {
  switch (value) {
    case "0":
      return "transfer";
    case "1":
      return "swap";
    case "2":
      return "facilitator";
    case "3":
      return "x402";
    default:
      return "x402";
  }
}

function numberOrString(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function sumDecimalStrings(values: string[]) {
  try {
    return values.reduce((total, value) => total + parseUint(value || "0", "settlement amount"), BigInt(0)).toString();
  } catch {
    return "invalid";
  }
}

function basisPoints(amount: string, total: string) {
  try {
    const numerator = parseUint(amount || "0", "settlement amount") * BigInt(10000);
    const denominator = parseUint(total || "0", "quote amount");
    if (denominator === BigInt(0)) return 0;
    return Number(numerator / denominator);
  } catch {
    return null;
  }
}

function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return candidate ?? null;
}

function contractLabel(name: string) {
  switch (name) {
    case "commerceRegistry":
      return "CommerceRegistry";
    case "agentRegistry":
      return "AgentRegistry";
    case "policyModule":
      return "PolicyModule";
    default:
      return name;
  }
}

async function readMerchant(provider: EthereumProvider, merchantId: string) {
  const id = parsePositiveBigInt(merchantId, "merchant id");
  const data = encodeFunctionData({
    abi: COMMERCE_READ_ABI,
    functionName: "getMerchant",
    args: [id],
  });
  const result = await callContract(provider, CONTRACTS.commerceRegistry, data);
  const merchant = decodeFunctionResult({
    abi: COMMERCE_READ_ABI,
    functionName: "getMerchant",
    data: result as `0x${string}`,
  });
  return normalizeTuple(merchant, ["owner", "payoutAddress", "metadataURI", "metadataHash", "active"]);
}

async function readService(provider: EthereumProvider, serviceNumericId: string) {
  const id = parsePositiveBigInt(serviceNumericId, "service numeric id");
  const data = encodeFunctionData({
    abi: COMMERCE_READ_ABI,
    functionName: "getService",
    args: [id],
  });
  const result = await callContract(provider, CONTRACTS.commerceRegistry, data);
  const service = decodeFunctionResult({
    abi: COMMERCE_READ_ABI,
    functionName: "getService",
    data: result as `0x${string}`,
  });
  return normalizeTuple(service, ["merchantId", "serviceId", "metadataURI", "metadataHash", "capabilityHash", "active"]);
}

async function readAgentIds(provider: EthereumProvider, owner: string) {
  const data = encodeFunctionData({
    abi: AGENT_READ_ABI,
    functionName: "getAgentsByOwner",
    args: [owner as `0x${string}`],
  });
  const result = await callContract(provider, CONTRACTS.agentRegistry, data);
  const agentIds = decodeFunctionResult({
    abi: AGENT_READ_ABI,
    functionName: "getAgentsByOwner",
    data: result as `0x${string}`,
  });
  return Array.isArray(agentIds) ? agentIds.map((value) => value.toString()) : [];
}

async function callContract(provider: EthereumProvider, to: string, data: string) {
  return provider.request({
    method: "eth_call",
    params: [{ to, data }, "latest"],
  });
}

async function requireWalletReady() {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("No injected wallet found. Install or unlock a wallet first.");
  const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
  const account = accounts[0];
  if (!account || !isAddress(account)) throw new Error("Connect a valid wallet account.");

  const chainHex = await provider.request({ method: "eth_chainId" }) as string;
  const chainId = Number.parseInt(chainHex, 16);
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) throw new Error("Switch your wallet to Base Sepolia before sending transactions.");

  return { provider, account: account as `0x${string}` };
}

async function sendWalletTransaction(
  provider: EthereumProvider,
  from: `0x${string}`,
  to: string,
  data: string,
) {
  return provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data }],
  }) as Promise<string>;
}

function buildQuoteCommitment(input: {
  merchantId: string;
  serviceNumericId: string;
  quoteAgent: string;
  token: string;
  facilitator: string;
  amount: string;
  paymentRail: string;
  expiresAt: string;
  paymentNonce: string;
  resourceHash: string;
  termsHash: string;
  x402PayloadHash: string;
}) {
  return {
    merchantId: parsePositiveBigInt(input.merchantId, "merchant id"),
    serviceNumericId: parsePositiveBigInt(input.serviceNumericId, "service numeric id"),
    agent: parseAddress(input.quoteAgent, "agent address"),
    token: parseAddress(input.token, "token"),
    facilitator: parseAddress(input.facilitator, "facilitator"),
    amount: parseUint(input.amount, "amount"),
    paymentRail: Number(parseUint(input.paymentRail, "payment rail")),
    expiresAt: parseUint(input.expiresAt, "expiry"),
    paymentNonce: parseUint(input.paymentNonce, "payment nonce"),
    resourceHash: parseBytes32(input.resourceHash, "resource hash"),
    termsHash: parseBytes32(input.termsHash, "terms hash"),
    x402PayloadHash: parseBytes32(input.x402PayloadHash, "x402 payload hash"),
  };
}

function parseAddress(value: string, label: string) {
  if (!isAddress(value)) throw new Error(`Enter a valid ${label}.`);
  return value as `0x${string}`;
}

function parseUint(value: string, label: string) {
  if (!/^\d+$/.test(value)) throw new Error(`Enter a numeric ${label}.`);
  return BigInt(value);
}

function parseBytes32(value: string, label: string) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`Enter a bytes32 ${label}.`);
  return value as `0x${string}`;
}

function parseHexBytes(value: string, label: string) {
  if (!/^0x([0-9a-fA-F]{2})*$/.test(value)) throw new Error(`Enter hex bytes for ${label}.`);
  return value as `0x${string}`;
}

function parsePositiveBigInt(value: string, label: string) {
  if (!/^\d+$/.test(value) || BigInt(value) === BigInt(0)) throw new Error(`Enter a registered ${label}.`);
  return BigInt(value);
}

function normalizeTuple(value: unknown, keys: string[]) {
  const record: Record<string, unknown> = {};
  keys.forEach((key, index) => {
    const tupleValue = getTupleValue(value, key, index);
    record[key] = stringifyBigInts(tupleValue);
  });
  return record;
}

function getTupleValue(value: unknown, key: string, index: number) {
  if (Array.isArray(value)) return value[index];
  if (value && typeof value === "object" && key in value) return (value as Record<string, unknown>)[key];
  return null;
}

function stringifyBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(stringifyBigInts);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, stringifyBigInts(child)]),
    );
  }
  return value;
}

function isWalletChainMissingError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 4902,
  );
}
