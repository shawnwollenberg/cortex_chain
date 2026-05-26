"use client";

import Link from "next/link";
import { decodeFunctionResult, encodeFunctionData, isAddress, keccak256, toBytes } from "viem";
import { useMemo, useState } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.cortex.wallyweb.com").replace(/\/$/, "");
const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_SEPOLIA_CHAIN_HEX = "0x14a34";

const CONTRACTS = {
  commerceRegistry: "0x378c1d1a06e80f7a53809bf4289afcd131a3be87",
  agentRegistry: "0x9e2b846226539e93669e66c7478304910dcbaa61",
  policyModule: "0x8f14e12177c7baf8d389629210c3c82718205fd1",
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

type StepId = "merchant" | "service" | "catalog" | "agent" | "quote";
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
            This does not submit transactions or request signatures.
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
  const [merchantName, setMerchantName] = useState("Example Data Merchant");
  const [website, setWebsite] = useState("https://merchant.example");
  const [support, setSupport] = useState("support@merchant.example");
  const [merchantOwner, setMerchantOwner] = useState("0x...");
  const [payout, setPayout] = useState("0x...");
  const [refundPolicy, setRefundPolicy] = useState("Refunds available when fulfillment does not match accepted quote terms.");
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
  const [paymentNonce, setPaymentNonce] = useState("1");
  const [resourceDescriptor, setResourceDescriptor] = useState("merchant-service-resource-v1");
  const [termsDocument, setTermsDocument] = useState("One company enrichment response for the requested domain.");
  const [x402Payload, setX402Payload] = useState("x402 payment requirement payload");
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
          cortex: {
            registry: CONTRACTS.commerceRegistry,
            network: "base-sepolia",
          },
        },
        null,
        2,
      ),
    [merchantName, website, support, merchantOwner, payout, refundPolicy],
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

  const quotePayload = JSON.stringify(
    {
      merchantId,
      serviceNumericId,
      agent: quoteAgent,
      token,
      facilitator,
      amount,
      paymentRail,
      expiresAt: "<unix-expiry>",
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
          terms_document: termsDocument,
          payment_requirement: paymentRail === "3" ? safeJson(x402Payload) : null,
          agent_checks: [
            "fetch service catalog and verify metadata hash",
            "verify merchant/service active status",
            "verify quote hash from CommerceRegistry.computeQuoteHash",
            "verify account policy before payment",
            "verify x402 payload hash when paymentRail is 3",
          ],
        },
        null,
        2,
      ),
    [quoteRequestId, quotePayload, termsDocument, paymentRail, x402Payload],
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
  const hashMerchantMetadata = () => setMerchantHash(hashText(merchantMetadata));
  const hashServiceMetadata = () => setServiceHash(hashText(serviceMetadata));
  const hashCatalog = () => {
    const hash = hashText(serviceCatalog);
    setCatalogHash(hash);
    setServiceHash(hash);
    setServiceUri(catalogUri);
  };
  const hashCapability = () => setCapabilityHash(hashText(capability));
  const hashAgentCapabilities = () => setAgentCapabilitiesHash(hashText(agentCapabilities));
  const hashResource = () => setResourceHash(hashText(resourceDescriptor));
  const hashTerms = () => setTermsHash(hashText(termsDocument));
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

  return (
    <main className="min-h-screen bg-[#090d12]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-muted">Cortex Product Onboarding</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">Launch an agent-commerce flow</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Build merchant metadata, register services, prepare an agent account, and commit a quote.
              This page generates safe templates only; transactions still run through your wallet or scripts.
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
                <Field label="Payment nonce" value={paymentNonce} onChange={setPaymentNonce} />
                <Field label="Quote request ID" value={quoteRequestId} onChange={setQuoteRequestId} />
                <TextArea label="Quote request input" value={quoteRequestInput} onChange={setQuoteRequestInput} />
                <TextArea label="Resource descriptor" value={resourceDescriptor} onChange={setResourceDescriptor} />
                <TextArea label="Terms document" value={termsDocument} onChange={setTermsDocument} />
                <TextArea label="x402 payload" value={x402Payload} onChange={setX402Payload} />
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
                    Hash quote terms
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
              <CodePanel title="Quote payload" value={quotePayload} />
              <CodePanel title="Compute and commit quote" value={quoteCommand} />
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
