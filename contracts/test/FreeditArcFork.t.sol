// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Freedit} from "../src/Freedit.sol";

/// @notice Runs Freedit against a fork of Arc Testnet and the real USDC system contract.
/// @dev Needs Arc Foundry (plain Foundry can't simulate Arc's native USDC or blocklist):
///        ARC_FORK=true arc-forge test --match-contract FreeditArcFork -vv
///      Skipped when ARC_FORK isn't set, so the normal `arc-forge test` stays offline.
contract FreeditArcForkTest is Test {
    /// USDC ERC-20 interface on Arc (same address on testnet and mainnet), 6 decimals.
    IERC20 internal constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    /// Seeded on Arc Testnet as a blocklisted address for exercising revert paths (docs: contract-addresses).
    address internal constant BLOCKLISTED = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    bytes32 internal constant H1 = keccak256("cut_v1.mov");
    bytes32 internal constant H2 = keccak256("cut_v2.mov");
    bytes32 internal constant H3 = keccak256("cut_v3.mov");

    Freedit internal freedit;
    bool internal forked;
    address internal editor = makeAddr("fork-editor");
    address internal client = makeAddr("fork-client");

    function setUp() public {
        if (!vm.envOr("ARC_FORK", false)) return;
        vm.createSelectFork("arc_testnet");
        freedit = new Freedit(USDC);
        forked = true;
    }

    modifier onlyFork() {
        if (!forked) vm.skip(true);
        _;
    }

    /// The decimals trap: native balance (18 decimals) and the ERC-20 view (6 decimals) are one balance.
    function test_Fork_NativeAndErc20BalanceAreTheSameMoney() public onlyFork {
        assertEq(IERC20Metadata(address(USDC)).decimals(), 6);
        vm.deal(client, 50 ether); // 50 USDC as a native 18-decimal amount
        assertEq(USDC.balanceOf(client), 50e6); // the same 50 USDC through the ERC-20 interface
    }

    function test_Fork_FullFlowWithRealUsdc() public onlyFork {
        vm.deal(client, 1_000 ether); // $1,000

        vm.prank(editor);
        uint256 id = freedit.createProject(client, 200e6, 1, 15e6);
        vm.prank(editor);
        freedit.submitVersion(id, H1, "previews/fork/v1.mp4");

        vm.startPrank(client);
        USDC.approve(address(freedit), type(uint256).max);
        freedit.requestRevision(id, keccak256("free one"));
        vm.stopPrank();

        vm.prank(editor);
        freedit.submitVersion(id, H2, "previews/fork/v2.mp4");
        vm.prank(client);
        freedit.requestRevision(id, keccak256("paid one")); // $15

        vm.prank(editor);
        freedit.submitVersion(id, H3, "previews/fork/v3.mp4");
        vm.prank(client);
        freedit.approveAndPay(id, H3); // $200

        assertTrue(freedit.isPaid(id));
        assertEq(USDC.balanceOf(editor), 215e6, "editor received $215.00 through the ERC-20 view");
        assertEq(editor.balance, 215 ether, "and the same $215.00 as native 18-decimal balance");
        assertEq(USDC.balanceOf(address(freedit)), 0, "Freedit holds nothing");
    }

    /// Arc enforces its blocklist on every USDC transfer, so paying a blocklisted editor fails
    /// and the project stays unpaid (the file stays locked).
    /// The reason string is what Arc Testnet returns today (checked with `arc-cast call --trace` on 10-12).
    /// Matching it exactly matters: without `network = "arc"` in foundry.toml the same call reverted for an
    /// unrelated reason (the precompile wasn't simulated), and a bare expectRevert() hid that.
    function test_Fork_PaymentToBlocklistedEditorReverts() public onlyFork {
        vm.deal(client, 1_000 ether);

        vm.prank(BLOCKLISTED);
        uint256 id = freedit.createProject(client, 200e6, 0, 15e6);
        vm.prank(BLOCKLISTED);
        freedit.submitVersion(id, H1, "previews/fork/v1.mp4");

        vm.startPrank(client);
        USDC.approve(address(freedit), type(uint256).max);
        vm.expectRevert(bytes("Blocked address"));
        freedit.approveAndPay(id, H1);
        vm.stopPrank();

        assertFalse(freedit.isPaid(id));
    }
}
