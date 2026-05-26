"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.cortex.wallyweb.com").replace(/\/$/, "");

const CONTRACTS = {
  commerceRegistry: "0x378c1d1a06e80f7a53809bf4289afcd131a3be87",
  agentRegistry: "0x9e2b846226539e93669e66c7478304910dcbaa61",
  policyModule: "0x8f14e12177c7baf8d389629210c3c82718205fd1",
};

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type StepId = "merchant" | "service" | "agent" | "quote";

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
  const [merchantName, setMerchantName] = useState("Example Data Merchant");
  const [website, setWebsite] = useState("https://merchant.example");
  const [support, setSupport] = useState("support@merchant.example");
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

  const [agentName, setAgentName] = useState("Procurement Agent");
  const [agentOwner, setAgentOwner] = useState("0x...");
  const [agentUri, setAgentUri] = useState("ipfs://agent-metadata");
  const [agentPubkey, setAgentPubkey] = useState("0x...");
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
    [merchantName, website, support, payout, refundPolicy],
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

  const agentMetadata = useMemo(
    () =>
      JSON.stringify(
        {
          name: agentName,
          owner: agentOwner,
          network: "base-sepolia",
          intended_use: "Autonomous purchasing under Cortex policy controls.",
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
    [agentName, agentOwner, token, merchantId, facilitator, maxPerPayment, maxPerDay],
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

curl "${API_URL}/merchants?owner=<merchant-owner-address>"`;

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

        <div className="mb-6 grid gap-3 md:grid-cols-4">
          {[
            ["merchant", "Merchant profile"],
            ["service", "Service catalog"],
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
                <Field label="Payout address" value={payout} onChange={setPayout} />
                <TextArea label="Refund policy" value={refundPolicy} onChange={setRefundPolicy} />
                <Field label="Metadata URI" value={merchantUri} onChange={setMerchantUri} />
                <Field label="Metadata hash" value={merchantHash} onChange={setMerchantHash} />
              </div>
            </div>
            <div className="grid gap-4">
              <CodePanel title="Merchant metadata JSON" value={merchantMetadata} />
              <CodePanel title="Register merchant" value={merchantCommand} />
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
                <Field label="Capability" value={capability} onChange={setCapability} />
                <TextArea label="Input schema" value={inputSchema} onChange={setInputSchema} />
                <TextArea label="Output schema" value={outputSchema} onChange={setOutputSchema} />
                <Field label="Service metadata URI" value={serviceUri} onChange={setServiceUri} />
                <Field label="Service metadata hash" value={serviceHash} onChange={setServiceHash} />
                <Field label="Capability hash" value={capabilityHash} onChange={setCapabilityHash} />
              </div>
            </div>
            <div className="grid gap-4">
              <CodePanel title="Service metadata JSON" value={serviceMetadata} />
              <CodePanel title="Register service" value={serviceCommand} />
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
                <Field label="Agent metadata URI" value={agentUri} onChange={setAgentUri} />
                <Field label="Agent pubkey" value={agentPubkey} onChange={setAgentPubkey} />
                <Field label="Agent capabilities hash" value={agentCapabilitiesHash} onChange={setAgentCapabilitiesHash} />
                <Field label="Token" value={token} onChange={setToken} />
                <Field label="Facilitator" value={facilitator} onChange={setFacilitator} />
                <Field label="Max per payment" value={maxPerPayment} onChange={setMaxPerPayment} />
                <Field label="Max per day" value={maxPerDay} onChange={setMaxPerDay} />
              </div>
            </div>
            <div className="grid gap-4">
              <CodePanel title="Agent metadata JSON" value={agentMetadata} />
              <CodePanel title="Register agent and set payment policy" value={agentCommand} />
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
                <Field label="Token" value={token} onChange={setToken} />
                <Field label="Facilitator" value={facilitator} onChange={setFacilitator} />
                <Field label="Amount" value={amount} onChange={setAmount} />
                <Field label="Payment rail" value={paymentRail} onChange={setPaymentRail} />
                <Field label="Payment nonce" value={paymentNonce} onChange={setPaymentNonce} />
                <Field label="Resource hash" value={resourceHash} onChange={setResourceHash} />
                <Field label="Terms hash" value={termsHash} onChange={setTermsHash} />
                <Field label="x402 payload hash" value={x402PayloadHash} onChange={setX402PayloadHash} />
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
              <CodePanel title="Quote payload" value={quotePayload} />
              <CodePanel title="Compute and commit quote" value={quoteCommand} />
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
