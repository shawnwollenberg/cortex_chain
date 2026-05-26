// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CommerceRegistry {
    enum DisputeStatus {
        OPEN,
        RESOLVED,
        REJECTED
    }

    enum PaymentRail {
        TRANSFER,
        SWAP,
        FACILITATOR,
        X402
    }

    enum SignalSubject {
        MERCHANT,
        SERVICE,
        FACILITATOR,
        AGENT
    }

    enum SignalKind {
        VERIFICATION,
        RISK,
        COMPLIANCE,
        FULFILLMENT
    }

    struct Merchant {
        address owner;
        address payoutAddress;
        string metadataURI;
        bytes32 metadataHash;
        bool active;
    }

    struct Service {
        uint256 merchantId;
        string serviceId;
        string metadataURI;
        bytes32 metadataHash;
        bytes32 capabilityHash;
        bool active;
    }

    struct Facilitator {
        address facilitator;
        string metadataURI;
        bytes32 metadataHash;
        bool active;
    }

    struct Quote {
        uint256 merchantId;
        uint256 serviceNumericId;
        address agent;
        address token;
        address facilitator;
        uint256 amount;
        PaymentRail paymentRail;
        uint16 protocolFeeBps;
        uint256 protocolFeeAmount;
        uint256 expiresAt;
        uint256 paymentNonce;
        bytes32 resourceHash;
        bytes32 termsHash;
        bytes32 x402PayloadHash;
        bool settled;
    }

    struct Receipt {
        bytes32 quoteHash;
        address agent;
        uint256 merchantId;
        uint256 serviceNumericId;
        address token;
        uint256 amount;
        PaymentRail paymentRail;
        uint16 protocolFeeBps;
        uint256 protocolFeeAmount;
        address facilitator;
        bytes32 resultHash;
        bytes32 resourceHash;
        bytes32 fulfillmentHash;
    }

    struct Dispute {
        uint256 receiptId;
        address opener;
        bytes32 reasonHash;
        DisputeStatus status;
        bytes32 resolutionHash;
    }

    struct TrustSignal {
        SignalSubject subjectType;
        uint256 subjectId;
        SignalKind kind;
        address reporter;
        bytes32 signalHash;
    }

    struct QuoteCommitment {
        uint256 merchantId;
        uint256 serviceNumericId;
        address agent;
        address token;
        address facilitator;
        uint256 amount;
        PaymentRail paymentRail;
        uint256 expiresAt;
        uint256 paymentNonce;
        bytes32 resourceHash;
        bytes32 termsHash;
        bytes32 x402PayloadHash;
    }

    uint256 private _nextMerchantId = 1;
    uint256 private _nextServiceNumericId = 1;
    uint256 private _nextFacilitatorId = 1;
    uint256 private _nextReceiptId = 1;
    uint256 private _nextDisputeId = 1;
    uint256 private _nextSignalId = 1;

    uint16 public constant PROTOCOL_FEE_BPS = 0;

    mapping(uint256 => Merchant) private _merchants;
    mapping(uint256 => Service) private _services;
    mapping(uint256 => Facilitator) private _facilitatorsById;
    mapping(address => uint256) private _facilitatorIdByAddress;
    mapping(bytes32 => Quote) private _quotes;
    mapping(uint256 => Receipt) private _receipts;
    mapping(uint256 => Dispute) private _disputes;
    mapping(uint256 => TrustSignal) private _trustSignals;

    event MerchantRegistered(
        uint256 indexed merchantId,
        address indexed owner,
        address indexed payoutAddress,
        string metadataURI,
        bytes32 metadataHash
    );
    event MerchantUpdated(
        uint256 indexed merchantId,
        address indexed payoutAddress,
        string metadataURI,
        bytes32 metadataHash,
        bool active
    );
    event ServiceRegistered(
        uint256 indexed serviceNumericId,
        uint256 indexed merchantId,
        string serviceId,
        string metadataURI,
        bytes32 metadataHash,
        bytes32 capabilityHash
    );
    event ServiceUpdated(
        uint256 indexed serviceNumericId,
        string metadataURI,
        bytes32 metadataHash,
        bytes32 capabilityHash,
        bool active
    );
    event FacilitatorRegistered(
        uint256 indexed facilitatorId,
        address indexed facilitator,
        string metadataURI,
        bytes32 metadataHash
    );
    event FacilitatorUpdated(
        uint256 indexed facilitatorId,
        address indexed facilitator,
        string metadataURI,
        bytes32 metadataHash,
        bool active
    );
    event QuoteCommitted(
        bytes32 indexed quoteHash,
        uint256 indexed merchantId,
        uint256 indexed serviceNumericId,
        address agent,
        address token,
        address facilitator,
        uint256 amount,
        PaymentRail paymentRail,
        uint16 protocolFeeBps,
        uint256 protocolFeeAmount,
        uint256 expiresAt,
        uint256 paymentNonce,
        bytes32 resourceHash,
        bytes32 termsHash,
        bytes32 x402PayloadHash
    );
    event ReceiptRecorded(
        uint256 indexed receiptId,
        bytes32 indexed quoteHash,
        address indexed agent,
        uint256 merchantId,
        uint256 serviceNumericId,
        address token,
        uint256 amount,
        PaymentRail paymentRail,
        uint16 protocolFeeBps,
        uint256 protocolFeeAmount,
        address facilitator,
        bytes32 resultHash,
        bytes32 resourceHash,
        bytes32 fulfillmentHash
    );
    event FulfillmentRecorded(uint256 indexed receiptId, bytes32 fulfillmentHash);
    event DisputeOpened(uint256 indexed disputeId, uint256 indexed receiptId, address indexed opener, bytes32 reasonHash);
    event DisputeResolved(uint256 indexed disputeId, DisputeStatus status, bytes32 resolutionHash);
    event TrustSignalRecorded(
        uint256 indexed signalId,
        SignalSubject indexed subjectType,
        uint256 indexed subjectId,
        SignalKind kind,
        address reporter,
        bytes32 signalHash
    );

    error Unauthorized();
    error MerchantNotFound();
    error ServiceNotFound();
    error FacilitatorNotFound();
    error FacilitatorInactive();
    error QuoteNotFound();
    error QuoteExpired();
    error QuoteAlreadySettled();
    error ReceiptNotFound();
    error DisputeNotFound();

    function registerMerchant(address payoutAddress, string calldata metadataURI, bytes32 metadataHash)
        external
        returns (uint256 merchantId)
    {
        merchantId = _nextMerchantId++;
        _merchants[merchantId] = Merchant({
            owner: msg.sender,
            payoutAddress: payoutAddress,
            metadataURI: metadataURI,
            metadataHash: metadataHash,
            active: true
        });
        emit MerchantRegistered(merchantId, msg.sender, payoutAddress, metadataURI, metadataHash);
    }

    function updateMerchant(
        uint256 merchantId,
        address payoutAddress,
        string calldata metadataURI,
        bytes32 metadataHash,
        bool active
    ) external {
        Merchant storage merchant = _merchant(merchantId);
        if (merchant.owner != msg.sender) revert Unauthorized();

        merchant.payoutAddress = payoutAddress;
        merchant.metadataURI = metadataURI;
        merchant.metadataHash = metadataHash;
        merchant.active = active;
        emit MerchantUpdated(merchantId, payoutAddress, metadataURI, metadataHash, active);
    }

    function registerService(
        uint256 merchantId,
        string calldata serviceId,
        string calldata metadataURI,
        bytes32 metadataHash,
        bytes32 capabilityHash
    ) external returns (uint256 serviceNumericId) {
        Merchant storage merchant = _merchant(merchantId);
        if (merchant.owner != msg.sender) revert Unauthorized();

        serviceNumericId = _nextServiceNumericId++;
        _services[serviceNumericId] = Service({
            merchantId: merchantId,
            serviceId: serviceId,
            metadataURI: metadataURI,
            metadataHash: metadataHash,
            capabilityHash: capabilityHash,
            active: true
        });
        emit ServiceRegistered(serviceNumericId, merchantId, serviceId, metadataURI, metadataHash, capabilityHash);
    }

    function updateService(
        uint256 serviceNumericId,
        string calldata metadataURI,
        bytes32 metadataHash,
        bytes32 capabilityHash,
        bool active
    ) external {
        Service storage service = _service(serviceNumericId);
        Merchant storage merchant = _merchant(service.merchantId);
        if (merchant.owner != msg.sender) revert Unauthorized();

        service.metadataURI = metadataURI;
        service.metadataHash = metadataHash;
        service.capabilityHash = capabilityHash;
        service.active = active;
        emit ServiceUpdated(serviceNumericId, metadataURI, metadataHash, capabilityHash, active);
    }

    function registerFacilitator(address facilitator, string calldata metadataURI, bytes32 metadataHash)
        external
        returns (uint256 facilitatorId)
    {
        facilitatorId = _facilitatorIdByAddress[facilitator];
        if (facilitatorId == 0) {
            facilitatorId = _nextFacilitatorId++;
            _facilitatorIdByAddress[facilitator] = facilitatorId;
        }
        _facilitatorsById[facilitatorId] = Facilitator({
            facilitator: facilitator,
            metadataURI: metadataURI,
            metadataHash: metadataHash,
            active: true
        });
        emit FacilitatorRegistered(facilitatorId, facilitator, metadataURI, metadataHash);
    }

    function updateFacilitator(uint256 facilitatorId, string calldata metadataURI, bytes32 metadataHash, bool active)
        external
    {
        Facilitator storage facilitator = _facilitator(facilitatorId);
        if (facilitator.facilitator != msg.sender) revert Unauthorized();

        facilitator.metadataURI = metadataURI;
        facilitator.metadataHash = metadataHash;
        facilitator.active = active;
        emit FacilitatorUpdated(facilitatorId, facilitator.facilitator, metadataURI, metadataHash, active);
    }

    function commitQuote(QuoteCommitment calldata commitment) external returns (bytes32 quoteHash) {
        Merchant storage merchant = _merchant(commitment.merchantId);
        Service storage service = _service(commitment.serviceNumericId);
        if (merchant.owner != msg.sender) revert Unauthorized();
        if (service.merchantId != commitment.merchantId) revert ServiceNotFound();
        if (!_paymentRailAllowed(commitment.paymentRail, commitment.facilitator)) revert FacilitatorInactive();
        quoteHash = _computeQuoteHash(commitment);

        _quotes[quoteHash] = Quote({
            merchantId: commitment.merchantId,
            serviceNumericId: commitment.serviceNumericId,
            agent: commitment.agent,
            token: commitment.token,
            facilitator: commitment.facilitator,
            amount: commitment.amount,
            paymentRail: commitment.paymentRail,
            protocolFeeBps: PROTOCOL_FEE_BPS,
            protocolFeeAmount: _protocolFeeAmount(commitment.amount),
            expiresAt: commitment.expiresAt,
            paymentNonce: commitment.paymentNonce,
            resourceHash: commitment.resourceHash,
            termsHash: commitment.termsHash,
            x402PayloadHash: commitment.x402PayloadHash,
            settled: false
        });
        _emitQuoteCommitted(quoteHash);
    }

    function recordReceipt(bytes32 quoteHash, bytes32 resultHash) external returns (uint256 receiptId) {
        Quote storage quote = _quotes[quoteHash];
        if (quote.merchantId == 0) revert QuoteNotFound();
        if (quote.settled) revert QuoteAlreadySettled();
        if (block.timestamp > quote.expiresAt) revert QuoteExpired();
        if (!_canRecordReceipt(quote, msg.sender)) revert Unauthorized();

        quote.settled = true;
        receiptId = _nextReceiptId++;
        _receipts[receiptId] = Receipt({
            quoteHash: quoteHash,
            agent: quote.agent,
            merchantId: quote.merchantId,
            serviceNumericId: quote.serviceNumericId,
            token: quote.token,
            amount: quote.amount,
            paymentRail: quote.paymentRail,
            protocolFeeBps: quote.protocolFeeBps,
            protocolFeeAmount: quote.protocolFeeAmount,
            facilitator: quote.facilitator,
            resultHash: resultHash,
            resourceHash: quote.resourceHash,
            fulfillmentHash: bytes32(0)
        });
        emit ReceiptRecorded(
            receiptId,
            quoteHash,
            quote.agent,
            quote.merchantId,
            quote.serviceNumericId,
            quote.token,
            quote.amount,
            quote.paymentRail,
            quote.protocolFeeBps,
            quote.protocolFeeAmount,
            quote.facilitator,
            resultHash,
            quote.resourceHash,
            bytes32(0)
        );
    }

    function recordFulfillment(uint256 receiptId, bytes32 fulfillmentHash) external {
        Receipt storage receipt = _receipt(receiptId);
        Merchant storage merchant = _merchant(receipt.merchantId);
        if (!_isMerchantOrFacilitator(merchant.owner, receipt.facilitator, msg.sender)) revert Unauthorized();

        receipt.fulfillmentHash = fulfillmentHash;
        emit FulfillmentRecorded(receiptId, fulfillmentHash);
    }

    function openDispute(uint256 receiptId, bytes32 reasonHash) external returns (uint256 disputeId) {
        Receipt storage receipt = _receipt(receiptId);
        Merchant storage merchant = _merchant(receipt.merchantId);
        if (
            msg.sender != receipt.agent
                && !_isMerchantOrFacilitator(merchant.owner, receipt.facilitator, msg.sender)
        ) {
            revert Unauthorized();
        }

        disputeId = _nextDisputeId++;
        _disputes[disputeId] = Dispute({
            receiptId: receiptId,
            opener: msg.sender,
            reasonHash: reasonHash,
            status: DisputeStatus.OPEN,
            resolutionHash: bytes32(0)
        });
        emit DisputeOpened(disputeId, receiptId, msg.sender, reasonHash);
    }

    function resolveDispute(uint256 disputeId, DisputeStatus status, bytes32 resolutionHash) external {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.receiptId == 0) revert DisputeNotFound();
        Receipt storage receipt = _receipt(dispute.receiptId);
        Merchant storage merchant = _merchant(receipt.merchantId);
        if (!_isMerchantOrFacilitator(merchant.owner, receipt.facilitator, msg.sender)) revert Unauthorized();
        if (status == DisputeStatus.OPEN) revert Unauthorized();

        dispute.status = status;
        dispute.resolutionHash = resolutionHash;
        emit DisputeResolved(disputeId, status, resolutionHash);
    }

    function recordTrustSignal(
        SignalSubject subjectType,
        uint256 subjectId,
        SignalKind kind,
        bytes32 signalHash
    ) external returns (uint256 signalId) {
        signalId = _nextSignalId++;
        _trustSignals[signalId] = TrustSignal({
            subjectType: subjectType,
            subjectId: subjectId,
            kind: kind,
            reporter: msg.sender,
            signalHash: signalHash
        });
        emit TrustSignalRecorded(signalId, subjectType, subjectId, kind, msg.sender, signalHash);
    }

    function getMerchant(uint256 merchantId) external view returns (Merchant memory) {
        return _merchant(merchantId);
    }

    function getService(uint256 serviceNumericId) external view returns (Service memory) {
        return _service(serviceNumericId);
    }

    function getFacilitator(uint256 facilitatorId) external view returns (Facilitator memory) {
        return _facilitator(facilitatorId);
    }

    function getQuote(bytes32 quoteHash) external view returns (Quote memory) {
        Quote memory quote = _quotes[quoteHash];
        if (quote.merchantId == 0) revert QuoteNotFound();
        return quote;
    }

    function getReceipt(uint256 receiptId) external view returns (Receipt memory) {
        return _receipt(receiptId);
    }

    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        Dispute memory dispute = _disputes[disputeId];
        if (dispute.receiptId == 0) revert DisputeNotFound();
        return dispute;
    }

    function getTrustSignal(uint256 signalId) external view returns (TrustSignal memory) {
        return _trustSignals[signalId];
    }

    function computeQuoteHash(QuoteCommitment calldata commitment) external view returns (bytes32) {
        return _computeQuoteHash(commitment);
    }

    function computeQuoteHash(
        uint256 merchantId,
        uint256 serviceNumericId,
        address agent,
        address token,
        address facilitator,
        uint256 amount,
        PaymentRail paymentRail,
        uint256 expiresAt,
        uint256 paymentNonce,
        bytes32 resourceHash,
        bytes32 termsHash,
        bytes32 x402PayloadHash
    ) public view returns (bytes32) {
        return _computeQuoteHash(
            QuoteCommitment({
                merchantId: merchantId,
                serviceNumericId: serviceNumericId,
                agent: agent,
                token: token,
                facilitator: facilitator,
                amount: amount,
                paymentRail: paymentRail,
                expiresAt: expiresAt,
                paymentNonce: paymentNonce,
                resourceHash: resourceHash,
                termsHash: termsHash,
                x402PayloadHash: x402PayloadHash
            })
        );
    }

    function _computeQuoteHash(QuoteCommitment memory commitment) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                _serviceTermsHash(commitment),
                _paymentTermsHash(commitment),
                PROTOCOL_FEE_BPS,
                _protocolFeeAmount(commitment.amount)
            )
        );
    }

    function _serviceTermsHash(QuoteCommitment memory commitment) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                commitment.merchantId,
                commitment.serviceNumericId,
                commitment.resourceHash,
                commitment.termsHash
            )
        );
    }

    function _paymentTermsHash(QuoteCommitment memory commitment) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                commitment.agent,
                commitment.token,
                commitment.facilitator,
                commitment.amount,
                commitment.paymentRail,
                commitment.expiresAt,
                commitment.paymentNonce,
                commitment.x402PayloadHash
            )
        );
    }

    function _protocolFeeAmount(uint256 amount) internal pure returns (uint256) {
        return (amount * PROTOCOL_FEE_BPS) / 10_000;
    }

    function _emitQuoteCommitted(bytes32 quoteHash) internal {
        Quote storage quote = _quotes[quoteHash];
        emit QuoteCommitted(
            quoteHash,
            quote.merchantId,
            quote.serviceNumericId,
            quote.agent,
            quote.token,
            quote.facilitator,
            quote.amount,
            quote.paymentRail,
            quote.protocolFeeBps,
            quote.protocolFeeAmount,
            quote.expiresAt,
            quote.paymentNonce,
            quote.resourceHash,
            quote.termsHash,
            quote.x402PayloadHash
        );
    }

    function _merchant(uint256 merchantId) internal view returns (Merchant storage merchant) {
        merchant = _merchants[merchantId];
        if (merchant.owner == address(0)) revert MerchantNotFound();
    }

    function _service(uint256 serviceNumericId) internal view returns (Service storage service) {
        service = _services[serviceNumericId];
        if (service.merchantId == 0) revert ServiceNotFound();
    }

    function _facilitator(uint256 facilitatorId) internal view returns (Facilitator storage facilitator) {
        facilitator = _facilitatorsById[facilitatorId];
        if (facilitator.facilitator == address(0)) revert FacilitatorNotFound();
    }

    function _receipt(uint256 receiptId) internal view returns (Receipt storage receipt) {
        receipt = _receipts[receiptId];
        if (receipt.merchantId == 0) revert ReceiptNotFound();
    }

    function _facilitatorActive(address facilitator) internal view returns (bool) {
        uint256 facilitatorId = _facilitatorIdByAddress[facilitator];
        return facilitatorId != 0 && _facilitatorsById[facilitatorId].active;
    }

    function _paymentRailAllowed(PaymentRail paymentRail, address facilitator) internal view returns (bool) {
        if (paymentRail == PaymentRail.FACILITATOR || paymentRail == PaymentRail.X402) {
            return facilitator != address(0) && _facilitatorActive(facilitator);
        }
        return facilitator == address(0) || _facilitatorActive(facilitator);
    }

    function _canRecordReceipt(Quote storage quote, address sender) internal view returns (bool) {
        if (quote.paymentRail == PaymentRail.FACILITATOR || quote.paymentRail == PaymentRail.X402) {
            return sender == quote.facilitator;
        }

        Merchant storage merchant = _merchant(quote.merchantId);
        return sender == merchant.owner || sender == quote.agent;
    }

    function _isMerchantOrFacilitator(address merchantOwner, address facilitator, address sender)
        internal
        pure
        returns (bool)
    {
        return sender == merchantOwner || (facilitator != address(0) && sender == facilitator);
    }
}
