// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Freedit} from "../src/Freedit.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {ReentrantToken} from "./mocks/ReentrantToken.sol";

contract FreeditTest is Test {
    uint256 internal constant ONE_USDC = 1_000_000; // USDC ERC-20 interface on Arc: 6 decimals
    uint256 internal constant PRICE = 200 * ONE_USDC; // $200.00
    uint8 internal constant FREE = 3;
    uint256 internal constant FEE = 15 * ONE_USDC; // $15.00
    uint256 internal constant CLIENT_FUNDS = 10_000 * ONE_USDC;

    // Stand-ins for SHA-256 fingerprints of the full-quality exports.
    bytes32 internal constant HASH_V1 = keccak256("final_cut_v1.mov");
    bytes32 internal constant HASH_V2 = keccak256("final_cut_v2.mov");
    bytes32 internal constant HASH_V3 = keccak256("final_cut_v3.mov");
    bytes32 internal constant NOTE = keccak256("00:42 swap the b-roll, 01:10 louder music");
    string internal constant PREVIEW_V1 = "previews/1/v1.mp4";
    string internal constant PREVIEW_V2 = "previews/1/v2.mp4";

    MockUSDC internal usdc;
    Freedit internal freedit;

    address internal editor = makeAddr("editor");
    address internal client = makeAddr("client");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        usdc = new MockUSDC();
        freedit = new Freedit(IERC20(address(usdc)));
        usdc.mint(client, CLIENT_FUNDS);
        usdc.mint(stranger, CLIENT_FUNDS);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    function _create(uint8 free, uint256 fee) internal returns (uint256 id) {
        vm.prank(editor);
        id = freedit.createProject(client, PRICE, free, fee);
    }

    function _createWithV1() internal returns (uint256 id) {
        id = _create(FREE, FEE);
        _submit(id, HASH_V1, PREVIEW_V1);
    }

    function _submit(uint256 id, bytes32 fileHash, string memory preview) internal {
        vm.prank(editor);
        freedit.submitVersion(id, fileHash, preview);
    }

    function _approve(address from, uint256 amount) internal {
        vm.prank(from);
        usdc.approve(address(freedit), amount);
    }

    function _requestRevision(uint256 id) internal {
        vm.prank(client);
        freedit.requestRevision(id, NOTE);
    }

    function _pay(uint256 id, bytes32 approvedHash) internal {
        vm.prank(client);
        freedit.approveAndPay(id, approvedHash);
    }

    function _assertNoCustody() internal view {
        assertEq(usdc.balanceOf(address(freedit)), 0, "Freedit must never hold USDC");
    }

    // ─── constructor ─────────────────────────────────────────────────────────

    function test_RevertWhen_TokenIsZeroAddress() public {
        vm.expectRevert(Freedit.ZeroAddress.selector);
        new Freedit(IERC20(address(0)));
    }

    // ─── createProject ───────────────────────────────────────────────────────

    function test_CreateProject_StoresTermsAndEmits() public {
        vm.expectEmit(address(freedit));
        emit Freedit.ProjectCreated(1, editor, client, PRICE, FREE, FEE);
        uint256 id = _create(FREE, FEE);

        assertEq(id, 1);
        assertEq(freedit.projectCount(), 1);
        Freedit.Project memory p = freedit.getProject(id);
        assertEq(p.editor, editor);
        assertEq(p.client, client);
        assertEq(p.price, PRICE);
        assertEq(p.freeRevisions, FREE);
        assertEq(p.revisionFee, FEE);
        assertEq(p.revisionsUsed, 0);
        assertEq(p.version, 0);
        assertEq(p.latestFileHash, bytes32(0));
        assertFalse(p.paid);
        assertFalse(p.revisionOpen);
        assertFalse(freedit.isPaid(id));
    }

    function test_RevertWhen_ClientIsZeroAddress() public {
        vm.prank(editor);
        vm.expectRevert(Freedit.ZeroAddress.selector);
        freedit.createProject(address(0), PRICE, FREE, FEE);
    }

    function test_RevertWhen_EditorIsClient() public {
        vm.prank(editor);
        vm.expectRevert(Freedit.EditorIsClient.selector);
        freedit.createProject(editor, PRICE, FREE, FEE);
    }

    function test_RevertWhen_PriceIsZero() public {
        vm.prank(editor);
        vm.expectRevert(Freedit.ZeroPrice.selector);
        freedit.createProject(client, 0, FREE, FEE);
    }

    function test_ProjectsAreListedByEditorAndClient() public {
        uint256 a = _create(FREE, FEE);
        uint256 b = _create(0, FEE);

        uint256[] memory byEditor = freedit.projectsByEditor(editor);
        uint256[] memory byClient = freedit.projectsByClient(client);
        assertEq(byEditor.length, 2);
        assertEq(byEditor[0], a);
        assertEq(byEditor[1], b);
        assertEq(byClient.length, 2);
        assertEq(freedit.projectsByEditor(stranger).length, 0);
    }

    // ─── submitVersion ───────────────────────────────────────────────────────

    function test_SubmitVersion_RecordsFingerprintAndHistory() public {
        uint256 id = _create(FREE, FEE);

        vm.expectEmit(address(freedit));
        emit Freedit.VersionSubmitted(id, 1, HASH_V1, PREVIEW_V1);
        _submit(id, HASH_V1, PREVIEW_V1);

        vm.warp(block.timestamp + 1 days);
        _submit(id, HASH_V2, PREVIEW_V2);

        Freedit.Project memory p = freedit.getProject(id);
        assertEq(p.version, 2);
        assertEq(p.latestFileHash, HASH_V2);
        assertEq(p.previewURI, PREVIEW_V2);

        Freedit.Version memory v1 = freedit.getVersion(id, 1);
        Freedit.Version memory v2 = freedit.getVersion(id, 2);
        assertEq(v1.fileHash, HASH_V1);
        assertEq(v1.previewURI, PREVIEW_V1);
        assertEq(v2.fileHash, HASH_V2);
        assertEq(v2.submittedAt - v1.submittedAt, 1 days);
    }

    function test_RevertWhen_NonEditorSubmitsVersion() public {
        uint256 id = _create(FREE, FEE);

        vm.prank(stranger);
        vm.expectRevert(Freedit.NotEditor.selector);
        freedit.submitVersion(id, HASH_V1, PREVIEW_V1);

        vm.prank(client);
        vm.expectRevert(Freedit.NotEditor.selector);
        freedit.submitVersion(id, HASH_V1, PREVIEW_V1);
    }

    function test_RevertWhen_FingerprintIsEmpty() public {
        uint256 id = _create(FREE, FEE);
        vm.prank(editor);
        vm.expectRevert(Freedit.EmptyFileHash.selector);
        freedit.submitVersion(id, bytes32(0), PREVIEW_V1);
    }

    function test_RevertWhen_ProjectDoesNotExist() public {
        vm.prank(editor);
        vm.expectRevert(Freedit.UnknownProject.selector);
        freedit.submitVersion(42, HASH_V1, PREVIEW_V1);

        vm.expectRevert(Freedit.UnknownProject.selector);
        freedit.getProject(42);

        vm.expectRevert(Freedit.UnknownProject.selector);
        freedit.revisionCost(42);

        assertFalse(freedit.isPaid(42));
    }

    function test_RevertWhen_VersionOutOfRange() public {
        uint256 id = _createWithV1();
        vm.expectRevert(Freedit.UnknownVersion.selector);
        freedit.getVersion(id, 0);
        vm.expectRevert(Freedit.UnknownVersion.selector);
        freedit.getVersion(id, 2);
    }

    function test_RevertWhen_SubmittingAfterPaid() public {
        uint256 id = _createWithV1();
        _approve(client, PRICE);
        _pay(id, HASH_V1);

        vm.prank(editor);
        vm.expectRevert(Freedit.AlreadyPaid.selector);
        freedit.submitVersion(id, HASH_V2, PREVIEW_V2);

        assertEq(freedit.getProject(id).latestFileHash, HASH_V1, "delivered file must not change after payment");
    }

    // ─── requestRevision ─────────────────────────────────────────────────────

    function test_RevertWhen_NonClientRequestsRevision() public {
        uint256 id = _createWithV1();
        _approve(stranger, type(uint256).max);

        vm.prank(stranger);
        vm.expectRevert(Freedit.NotClient.selector);
        freedit.requestRevision(id, NOTE);

        vm.prank(editor);
        vm.expectRevert(Freedit.NotClient.selector);
        freedit.requestRevision(id, NOTE);
    }

    function test_RevertWhen_RevisionBeforeFirstVersion() public {
        uint256 id = _create(FREE, FEE);
        vm.prank(client);
        vm.expectRevert(Freedit.NoVersionYet.selector);
        freedit.requestRevision(id, NOTE);
    }

    function test_FreeRevisionNeedsNoAllowance() public {
        uint256 id = _createWithV1();
        assertEq(usdc.allowance(client, address(freedit)), 0);

        vm.expectEmit(address(freedit));
        emit Freedit.RevisionRequested(id, 1, 0, NOTE, 1);
        _requestRevision(id);

        Freedit.Project memory p = freedit.getProject(id);
        assertEq(p.revisionsUsed, 1);
        assertTrue(p.revisionOpen);
        assertEq(usdc.balanceOf(editor), 0);
        assertEq(usdc.balanceOf(client), CLIENT_FUNDS);
    }

    function test_FreeRevisionsCountDown_ThenFeeIsCharged() public {
        uint256 id = _createWithV1();
        _approve(client, 2 * FEE);

        for (uint8 i = 1; i <= FREE; i++) {
            assertEq(freedit.revisionCost(id), 0, "still free");
            vm.expectEmit(address(freedit));
            emit Freedit.RevisionRequested(id, i, 0, NOTE, i);
            _requestRevision(id);

            assertEq(freedit.getProject(id).revisionsUsed, i);
            assertEq(usdc.balanceOf(editor), 0, "free revisions move no money");
            _submit(id, keccak256(abi.encode(i)), PREVIEW_V2);
        }

        // Free revisions used up: the 4th costs exactly FEE, paid client -> editor in the same tx.
        assertEq(freedit.revisionCost(id), FEE);
        vm.expectEmit(address(freedit));
        emit Freedit.RevisionRequested(id, FREE + 1, FEE, NOTE, FREE + 1);
        _requestRevision(id);
        assertEq(usdc.balanceOf(editor), FEE);
        assertEq(usdc.balanceOf(client), CLIENT_FUNDS - FEE);
        _assertNoCustody();

        // And the 5th costs FEE again.
        _submit(id, HASH_V3, PREVIEW_V2);
        _requestRevision(id);
        assertEq(usdc.balanceOf(editor), 2 * FEE);
        assertEq(usdc.balanceOf(client), CLIENT_FUNDS - 2 * FEE);
        _assertNoCustody();
    }

    function test_ZeroFreeRevisions_FirstRevisionIsPaid() public {
        uint256 id = _create(0, FEE);
        _submit(id, HASH_V1, PREVIEW_V1);
        assertEq(freedit.revisionCost(id), FEE);

        _approve(client, FEE);
        _requestRevision(id);
        assertEq(usdc.balanceOf(editor), FEE);
        _assertNoCustody();
    }

    function test_ZeroRevisionFee_ExtraRevisionsStayFree() public {
        uint256 id = _create(1, 0);
        _submit(id, HASH_V1, PREVIEW_V1);
        _requestRevision(id); // free one
        _submit(id, HASH_V2, PREVIEW_V2);
        _requestRevision(id); // past the free count, but the fee is 0: no transfer, no allowance needed
        assertEq(freedit.getProject(id).revisionsUsed, 2);
        assertEq(usdc.balanceOf(editor), 0);
    }

    function test_RevertWhen_RevisionAlreadyOpen() public {
        uint256 id = _createWithV1();
        _requestRevision(id);

        vm.prank(client);
        vm.expectRevert(Freedit.RevisionAlreadyOpen.selector);
        freedit.requestRevision(id, NOTE);

        // The editor's next version closes the request, so the client can ask again.
        _submit(id, HASH_V2, PREVIEW_V2);
        assertFalse(freedit.getProject(id).revisionOpen);
        _requestRevision(id);
        assertEq(freedit.getProject(id).revisionsUsed, 2);
    }

    function test_RevertWhen_PaidRevisionHasInsufficientAllowance() public {
        uint256 id = _create(0, FEE);
        _submit(id, HASH_V1, PREVIEW_V1);
        _approve(client, FEE - 1);

        vm.prank(client);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(freedit), FEE - 1, FEE
            )
        );
        freedit.requestRevision(id, NOTE);

        Freedit.Project memory p = freedit.getProject(id);
        assertEq(p.revisionsUsed, 0, "failed request must not use up a revision");
        assertFalse(p.revisionOpen);
        assertEq(usdc.balanceOf(editor), 0);
    }

    function test_RevertWhen_PaidRevisionHasInsufficientBalance() public {
        address brokeClient = makeAddr("brokeClient");
        vm.prank(editor);
        uint256 id = freedit.createProject(brokeClient, PRICE, 0, FEE);
        _submit(id, HASH_V1, PREVIEW_V1);
        _approve(brokeClient, FEE);

        vm.prank(brokeClient);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, brokeClient, 0, FEE)
        );
        freedit.requestRevision(id, NOTE);
    }

    function test_RevertWhen_RevisionAfterPaid() public {
        uint256 id = _createWithV1();
        _approve(client, PRICE);
        _pay(id, HASH_V1);

        vm.prank(client);
        vm.expectRevert(Freedit.AlreadyPaid.selector);
        freedit.requestRevision(id, NOTE);
    }

    function test_RevertWhen_RevisionLimitReached() public {
        uint256 id = _create(type(uint8).max, FEE); // all 255 revisions free
        for (uint256 i = 1; i <= type(uint8).max; i++) {
            _submit(id, keccak256(abi.encode(i)), PREVIEW_V1);
            _requestRevision(id);
        }
        _submit(id, HASH_V1, PREVIEW_V1);

        vm.prank(client);
        vm.expectRevert(Freedit.RevisionLimitReached.selector);
        freedit.requestRevision(id, NOTE);
    }

    // ─── approveAndPay ───────────────────────────────────────────────────────

    function test_ApproveAndPay_MovesExactPriceFromClientToEditor() public {
        uint256 id = _createWithV1();
        _approve(client, PRICE);

        vm.expectEmit(address(freedit));
        emit Freedit.Paid(id, client, editor, PRICE, 1, HASH_V1);
        _pay(id, HASH_V1);

        assertTrue(freedit.isPaid(id));
        assertEq(usdc.balanceOf(editor), PRICE, "editor gets exactly the price");
        assertEq(usdc.balanceOf(client), CLIENT_FUNDS - PRICE);
        assertEq(usdc.allowance(client, address(freedit)), 0);
        _assertNoCustody();
    }

    function test_RevertWhen_NonClientPays() public {
        uint256 id = _createWithV1();
        _approve(stranger, PRICE);

        vm.prank(stranger);
        vm.expectRevert(Freedit.NotClient.selector);
        freedit.approveAndPay(id, HASH_V1);

        vm.prank(editor);
        vm.expectRevert(Freedit.NotClient.selector);
        freedit.approveAndPay(id, HASH_V1);

        assertFalse(freedit.isPaid(id));
    }

    function test_RevertWhen_PayingTwice() public {
        uint256 id = _createWithV1();
        _approve(client, 2 * PRICE);
        _pay(id, HASH_V1);

        vm.prank(client);
        vm.expectRevert(Freedit.AlreadyPaid.selector);
        freedit.approveAndPay(id, HASH_V1);

        assertEq(usdc.balanceOf(editor), PRICE, "editor paid once, not twice");
        assertEq(usdc.allowance(client, address(freedit)), PRICE, "second payment never pulled");
    }

    function test_RevertWhen_PayWithInsufficientAllowance() public {
        uint256 id = _createWithV1();
        _approve(client, PRICE - 1);

        vm.prank(client);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(freedit), PRICE - 1, PRICE
            )
        );
        freedit.approveAndPay(id, HASH_V1);
        assertFalse(freedit.isPaid(id));
    }

    function test_RevertWhen_PayBeforeFirstVersion() public {
        uint256 id = _create(FREE, FEE);
        _approve(client, PRICE);
        vm.prank(client);
        vm.expectRevert(Freedit.NoVersionYet.selector);
        freedit.approveAndPay(id, bytes32(0));
    }

    function test_RevertWhen_ApprovedFingerprintIsStale() public {
        // Client reviews V1, but the editor slips in V2 before the payment lands.
        uint256 id = _createWithV1();
        _submit(id, HASH_V2, PREVIEW_V2);
        _approve(client, PRICE);

        vm.prank(client);
        vm.expectRevert(Freedit.FileHashMismatch.selector);
        freedit.approveAndPay(id, HASH_V1);

        assertFalse(freedit.isPaid(id));
        assertEq(usdc.balanceOf(editor), 0, "client never pays for a file they didn't review");
    }

    function test_PayWhileRevisionOpen_ClosesTheRequest() public {
        uint256 id = _createWithV1();
        _requestRevision(id);
        _approve(client, PRICE);
        _pay(id, HASH_V1); // client changed their mind and accepts V1 as is

        Freedit.Project memory p = freedit.getProject(id);
        assertTrue(p.paid);
        assertFalse(p.revisionOpen);
    }

    // ─── full flow and units ─────────────────────────────────────────────────

    function test_FullFlow_EditorEarnsPricePlusPaidRevisions() public {
        uint256 id = _create(1, FEE); // 1 free revision, $15 after
        _submit(id, HASH_V1, PREVIEW_V1);
        _requestRevision(id); // free
        _submit(id, HASH_V2, PREVIEW_V2);
        _approve(client, FEE);
        _requestRevision(id); // paid: $15
        _submit(id, HASH_V3, PREVIEW_V2);
        _approve(client, PRICE);
        _pay(id, HASH_V3); // $200

        assertEq(usdc.balanceOf(editor), PRICE + FEE); // $215.00
        assertEq(usdc.balanceOf(client), CLIENT_FUNDS - PRICE - FEE);
        assertEq(freedit.getProject(id).latestFileHash, HASH_V3);
        assertTrue(freedit.isPaid(id));
        _assertNoCustody();
    }

    function test_AmountsUseSixDecimalUsdcUnits() public {
        assertEq(usdc.decimals(), 6);
        assertEq(PRICE, 200_000_000, "$200.00 is 200_000_000 units, not 200e18");
        assertEq(FEE, 15_000_000);

        uint256 id = _createWithV1();
        _approve(client, PRICE);
        _pay(id, HASH_V1);
        assertEq(usdc.balanceOf(editor), 200_000_000);
    }

    // ─── reentrancy ──────────────────────────────────────────────────────────

    function test_RevertWhen_TokenReentersApproveAndPay() public {
        (ReentrantToken evil, Freedit f, uint256 id) = _evilSetup(FREE);
        evil.arm(address(f), abi.encodeCall(Freedit.approveAndPay, (id, HASH_V1)));

        vm.prank(client);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        f.approveAndPay(id, HASH_V1);
        assertFalse(f.isPaid(id));
    }

    function test_RevertWhen_TokenReentersRequestRevision() public {
        (ReentrantToken evil, Freedit f, uint256 id) = _evilSetup(0);
        evil.arm(address(f), abi.encodeCall(Freedit.requestRevision, (id, NOTE)));

        vm.prank(client);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        f.requestRevision(id, NOTE);
        assertEq(f.getProject(id).revisionsUsed, 0);
    }

    function _evilSetup(uint8 free) internal returns (ReentrantToken evil, Freedit f, uint256 id) {
        evil = new ReentrantToken();
        f = new Freedit(IERC20(address(evil)));
        evil.mint(client, CLIENT_FUNDS);
        vm.prank(client);
        evil.approve(address(f), type(uint256).max);
        vm.prank(editor);
        id = f.createProject(client, PRICE, free, FEE);
        vm.prank(editor);
        f.submitVersion(id, HASH_V1, PREVIEW_V1);
    }

    // ─── fuzz ────────────────────────────────────────────────────────────────

    function testFuzz_FeesChargedOnlyAfterFreeRevisionsAreUsed(uint8 free, uint256 requests, uint256 fee)
        public
    {
        requests = bound(requests, 0, 40);
        fee = bound(fee, 0, 200 * ONE_USDC); // 40 × $200 stays within CLIENT_FUNDS

        uint256 id = _create(free, fee);
        _submit(id, HASH_V1, PREVIEW_V1);
        _approve(client, type(uint256).max);

        uint256 expected;
        for (uint256 i = 0; i < requests; i++) {
            uint256 cost = i < free ? 0 : fee;
            assertEq(freedit.revisionCost(id), cost);
            _requestRevision(id);
            expected += cost;
            _submit(id, keccak256(abi.encode(i)), PREVIEW_V2);
        }

        assertEq(usdc.balanceOf(editor), expected);
        assertEq(usdc.balanceOf(client), CLIENT_FUNDS - expected);
        _assertNoCustody();
    }
}
