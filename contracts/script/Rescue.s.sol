// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";

/// @notice Created once, sends everything already sitting at its own address to `to`, and does nothing else.
contract Sweep {
    constructor(address payable to) {
        (bool ok,) = to.call{value: address(this).balance}("");
        require(ok, "Sweep: transfer failed");
    }
}

/// @notice One-off for Arc mainnet (10-13). $1 USDC was sent by mistake to 0xC82a…4895, the address the deployer's
///         FIRST contract gets (CREATE with nonce 0). Creating Sweep as that first contract returns the $1 to the
///         deployer, so Freedit, created next (nonce 1, 0x470D…fA9F), starts with a zero balance.
///   arc-forge script script/Rescue.s.sol --tc Rescue --rpc-url arc_mainnet --account deployer --broadcast
contract Rescue is Script {
    address internal constant STUCK = 0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895;

    function run() external {
        require(block.chainid == 5042, "Rescue: Arc mainnet only");
        address deployer = msg.sender;
        // Refuse unless the next contract from this account lands exactly on the stuck address.
        require(vm.computeCreateAddress(deployer, vm.getNonce(deployer)) == STUCK, "Rescue: wrong account or nonce");
        uint256 stuck = STUCK.balance;

        vm.startBroadcast();
        new Sweep(payable(deployer));
        vm.stopBroadcast();

        console.log("Recovered (USDC, 18-decimal native units):", stuck);
        console.log("Left at", STUCK, STUCK.balance);
        console.log("Freedit will deploy next at:", vm.computeCreateAddress(deployer, vm.getNonce(deployer)));
    }
}
