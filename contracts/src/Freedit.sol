// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Freedit
/// @notice Paid revisions and pay-to-unlock delivery for freelance video editors, settled in USDC on Arc.
/// @dev Freedit never holds money. Every payment is a single `transferFrom` straight from the client to the
///      editor, so this contract's USDC balance is always zero. No owner, no admin, no upgrade path, no withdraw.
///
///      Units: every amount goes through the USDC ERC-20 interface on Arc (0x3600…0000), which uses 6 decimals:
///      1 USDC = 1_000_000. Arc's native gas balance is the same money at 18 decimals; this contract never
///      touches it (no payable functions, no msg.value, no address.balance).
contract Freedit is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev The spec's fields, ordered so the small ones share one storage slot (6 slots instead of 9).
    ///      `revisionOpen` is the one addition: it is true while the client's change request is waiting
    ///      for the editor's next version, which blocks accidental double requests (and double fees).
    struct Project {
        address editor; // slot 0
        uint8 freeRevisions; // slot 0
        uint8 revisionsUsed; // slot 0
        uint16 version; // slot 0 — 0 until the first version is submitted
        bool paid; // slot 0
        bool revisionOpen; // slot 0
        address client; // slot 1
        uint256 price; // slot 2
        uint256 revisionFee; // slot 3
        bytes32 latestFileHash; // slot 4 — SHA-256 of the full-quality file of the latest version
        string previewURI; // slot 5 — watermarked preview of the latest version
    }

    /// @dev One entry per submitted version, so every V1/V2/V3 fingerprint stays checkable on-chain.
    struct Version {
        bytes32 fileHash;
        uint64 submittedAt;
        string previewURI;
    }

    IERC20 public immutable usdc;
    uint256 public projectCount;

    mapping(uint256 id => Project) private _projects;
    mapping(uint256 id => mapping(uint16 version => Version)) private _versions;
    mapping(address editor => uint256[] ids) private _editorProjects;
    mapping(address client => uint256[] ids) private _clientProjects;

    event ProjectCreated(
        uint256 indexed id,
        address indexed editor,
        address indexed client,
        uint256 price,
        uint8 freeRevisions,
        uint256 revisionFee
    );
    event VersionSubmitted(uint256 indexed id, uint16 version, bytes32 fileHash, string previewURI);
    /// @param n        1-based count of revisions requested on this project, including this one
    /// @param paidFee  USDC (6 decimals) sent client → editor in this transaction; 0 for a free revision
    /// @param noteHash hash of the client's off-chain change notes
    /// @param version  the version the client asked to change
    event RevisionRequested(uint256 indexed id, uint8 n, uint256 paidFee, bytes32 noteHash, uint16 version);
    event Paid(
        uint256 indexed id,
        address indexed client,
        address indexed editor,
        uint256 amount,
        uint16 version,
        bytes32 fileHash
    );

    error ZeroAddress();
    error EditorIsClient();
    error ZeroPrice();
    error UnknownProject();
    error UnknownVersion();
    error NotEditor();
    error NotClient();
    error AlreadyPaid();
    error EmptyFileHash();
    error NoVersionYet();
    error RevisionAlreadyOpen();
    error RevisionLimitReached();
    error FileHashMismatch();

    constructor(IERC20 usdc_) {
        if (address(usdc_) == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    // ─── Editor ──────────────────────────────────────────────────────────────

    /// @notice Open a project for `client`. The caller is the editor.
    /// @param price         total due on approval, USDC with 6 decimals
    /// @param freeRevisions revisions the client gets before fees apply
    /// @param revisionFee   charged per revision after the free ones, USDC with 6 decimals (0 = always free)
    function createProject(address client, uint256 price, uint8 freeRevisions, uint256 revisionFee)
        external
        returns (uint256 id)
    {
        if (client == address(0)) revert ZeroAddress();
        if (client == msg.sender) revert EditorIsClient();
        if (price == 0) revert ZeroPrice();

        id = ++projectCount;
        Project storage p = _projects[id];
        p.editor = msg.sender;
        p.client = client;
        p.price = price;
        p.freeRevisions = freeRevisions;
        p.revisionFee = revisionFee;

        _editorProjects[msg.sender].push(id);
        _clientProjects[client].push(id);

        emit ProjectCreated(id, msg.sender, client, price, freeRevisions, revisionFee);
    }

    /// @notice Record a new version: the SHA-256 fingerprint of the full file and where its watermarked preview lives.
    /// @dev Closes any open revision request. Locked once the project is paid, so the delivered file can't change.
    function submitVersion(uint256 id, bytes32 fileHash, string calldata previewURI) external {
        Project storage p = _project(id);
        if (msg.sender != p.editor) revert NotEditor();
        if (p.paid) revert AlreadyPaid();
        if (fileHash == bytes32(0)) revert EmptyFileHash();

        uint16 v = p.version + 1;
        p.version = v;
        p.latestFileHash = fileHash;
        p.previewURI = previewURI;
        p.revisionOpen = false;
        _versions[id][v] = Version({fileHash: fileHash, submittedAt: uint64(block.timestamp), previewURI: previewURI});

        emit VersionSubmitted(id, v, fileHash, previewURI);
    }

    // ─── Client ──────────────────────────────────────────────────────────────

    /// @notice Ask for changes to the latest version. Free until the free revisions are used up; after that
    ///         `revisionFee` moves from the client to the editor in this same transaction.
    /// @dev Needs a USDC allowance of at least `revisionCost(id)` when that is non-zero.
    function requestRevision(uint256 id, bytes32 noteHash) external nonReentrant {
        Project storage p = _project(id);
        if (msg.sender != p.client) revert NotClient();
        if (p.paid) revert AlreadyPaid();
        if (p.version == 0) revert NoVersionYet();
        if (p.revisionOpen) revert RevisionAlreadyOpen();
        if (p.revisionsUsed == type(uint8).max) revert RevisionLimitReached();

        uint256 fee = p.revisionsUsed < p.freeRevisions ? 0 : p.revisionFee;
        uint8 n = p.revisionsUsed + 1;

        p.revisionsUsed = n;
        p.revisionOpen = true;
        emit RevisionRequested(id, n, fee, noteHash, p.version);

        if (fee != 0) usdc.safeTransferFrom(msg.sender, p.editor, fee);
    }

    /// @notice Approve the version you reviewed and pay the editor the full price.
    /// @param approvedFileHash fingerprint of the version the client reviewed. If the editor submitted a newer
    ///        version in the meantime, this reverts instead of paying for a file the client hasn't seen.
    /// @dev Needs a USDC allowance of at least `price`.
    function approveAndPay(uint256 id, bytes32 approvedFileHash) external nonReentrant {
        Project storage p = _project(id);
        if (msg.sender != p.client) revert NotClient();
        if (p.paid) revert AlreadyPaid();
        if (p.version == 0) revert NoVersionYet();
        if (approvedFileHash != p.latestFileHash) revert FileHashMismatch();

        p.paid = true;
        p.revisionOpen = false;
        emit Paid(id, msg.sender, p.editor, p.price, p.version, approvedFileHash);

        usdc.safeTransferFrom(msg.sender, p.editor, p.price);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /// @notice Whether the client has paid. False for unknown ids. The download server checks this.
    function isPaid(uint256 id) external view returns (bool) {
        return _projects[id].paid;
    }

    function getProject(uint256 id) external view returns (Project memory) {
        return _project(id);
    }

    /// @param v 1-based version number
    function getVersion(uint256 id, uint16 v) external view returns (Version memory) {
        Project storage p = _project(id);
        if (v == 0 || v > p.version) revert UnknownVersion();
        return _versions[id][v];
    }

    /// @notice USDC (6 decimals) the client's next revision request would cost.
    function revisionCost(uint256 id) external view returns (uint256) {
        Project storage p = _project(id);
        return p.revisionsUsed < p.freeRevisions ? 0 : p.revisionFee;
    }

    function projectsByEditor(address editor) external view returns (uint256[] memory) {
        return _editorProjects[editor];
    }

    function projectsByClient(address client) external view returns (uint256[] memory) {
        return _clientProjects[client];
    }

    function _project(uint256 id) private view returns (Project storage p) {
        p = _projects[id];
        if (p.editor == address(0)) revert UnknownProject();
    }
}
