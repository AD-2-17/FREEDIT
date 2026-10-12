// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Freedit} from "../src/Freedit.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @dev Drives Freedit through random sequences of create / submit / revise / pay,
///      and tracks what the editor should have earned using its own bookkeeping.
contract FreeditHandler is Test {
    uint256 public constant CLIENT_FUNDS = 1_000_000_000 * 1e6; // $1B in 6-decimal units

    Freedit public immutable freedit;
    MockUSDC public immutable usdc;
    address public editor = makeAddr("handler-editor");
    address public client = makeAddr("handler-client");

    uint256 public expectedEditorIncome;
    uint256[] internal _ids;

    constructor(Freedit freedit_, MockUSDC usdc_) {
        freedit = freedit_;
        usdc = usdc_;
        usdc.mint(client, CLIENT_FUNDS);
        vm.prank(client);
        usdc.approve(address(freedit), type(uint256).max);
    }

    function create(uint256 price, uint8 free, uint256 fee) external {
        price = bound(price, 1, 10_000e6);
        fee = bound(fee, 0, 1_000e6);
        vm.prank(editor);
        _ids.push(freedit.createProject(client, price, free, fee));
    }

    function submit(uint256 seed, bytes32 fileHash) external {
        if (_ids.length == 0 || fileHash == bytes32(0)) return;
        uint256 id = _ids[seed % _ids.length];
        if (freedit.isPaid(id)) return;
        vm.prank(editor);
        freedit.submitVersion(id, fileHash, "previews/fuzz.mp4");
    }

    function requestRevision(uint256 seed) external {
        if (_ids.length == 0) return;
        uint256 id = _ids[seed % _ids.length];
        Freedit.Project memory p = freedit.getProject(id);
        if (p.paid || p.version == 0 || p.revisionOpen || p.revisionsUsed == type(uint8).max) return;

        expectedEditorIncome += p.revisionsUsed < p.freeRevisions ? 0 : p.revisionFee;
        vm.prank(client);
        freedit.requestRevision(id, bytes32(seed));
    }

    function pay(uint256 seed) external {
        if (_ids.length == 0) return;
        uint256 id = _ids[seed % _ids.length];
        Freedit.Project memory p = freedit.getProject(id);
        if (p.paid || p.version == 0) return;

        expectedEditorIncome += p.price;
        vm.prank(client);
        freedit.approveAndPay(id, p.latestFileHash);
    }
}

contract FreeditInvariantTest is Test {
    MockUSDC internal usdc;
    Freedit internal freedit;
    FreeditHandler internal handler;

    function setUp() public {
        usdc = new MockUSDC();
        freedit = new Freedit(IERC20(address(usdc)));
        handler = new FreeditHandler(freedit, usdc);
        targetContract(address(handler));
    }

    function invariant_FreeditNeverHoldsFunds() public view {
        assertEq(usdc.balanceOf(address(freedit)), 0);
    }

    function invariant_EditorReceivesExactlyWhatIsOwed() public view {
        assertEq(usdc.balanceOf(handler.editor()), handler.expectedEditorIncome());
    }

    function invariant_MoneyOnlyMovesClientToEditor() public view {
        assertEq(usdc.balanceOf(handler.client()) + usdc.balanceOf(handler.editor()), handler.CLIENT_FUNDS());
    }
}
