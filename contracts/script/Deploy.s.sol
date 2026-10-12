// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Freedit} from "../src/Freedit.sol";

/// @notice Deploys Freedit pointed at Arc's USDC. Refuses to run on any chain that isn't Arc.
///   arc-forge script script/Deploy.s.sol --rpc-url arc_testnet --account deployer --broadcast \
///     --verify --verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/
contract Deploy is Script {
    /// USDC ERC-20 interface on Arc (6 decimals). Same address on testnet and mainnet (docs: contract-addresses).
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    uint256 internal constant ARC_MAINNET = 5042;
    uint256 internal constant ARC_TESTNET = 5042002;

    function run() external returns (Freedit freedit) {
        require(block.chainid == ARC_MAINNET || block.chainid == ARC_TESTNET, "Deploy: not an Arc chain");

        vm.startBroadcast();
        freedit = new Freedit(IERC20(ARC_USDC));
        vm.stopBroadcast();

        console.log("Chain id:", block.chainid);
        console.log("Freedit: ", address(freedit));
    }
}
