// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MockUSDC} from "./MockUSDC.sol";

/// @dev Malicious token that calls back into a target during `transferFrom`.
///      Used only to prove Freedit's reentrancy guard holds on the payment paths.
contract ReentrantToken is MockUSDC {
    address public target;
    bytes public payload;

    function arm(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (target != address(0)) {
            (bool ok, bytes memory ret) = target.call(payload);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
        return super.transferFrom(from, to, value);
    }
}
