// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Hackathon testnet prototype. Completion is self-reported, not verified work.
/// No forfeitures, owner, fees, or reward token. Each deposit is always credited back
/// to its original depositor on settlement, cancellation, or timeout.
contract FocusPact {
    enum State { Missing, Waiting, Active, Settled, Cancelled, TimedOut }
    struct Pact {
        address creator;
        address buddy;
        uint256 stake;
        uint64 duration;
        uint64 joinBy;
        uint64 endsAt;
        uint64 refundAfter;
        bool creatorConfirmed;
        bool buddyConfirmed;
        State state;
    }
    uint256 public nextId = 1;
    uint256 public constant JOIN_WINDOW = 1 days;
    uint256 public constant CONFIRM_WINDOW = 10 minutes;
    mapping(uint256 => Pact) public pacts;
    mapping(address => uint256) public credits;
    event PactCreated(uint256 indexed id, address indexed creator, address indexed buddy, uint256 stake);
    event PactJoined(uint256 indexed id, uint256 endsAt);
    event Confirmed(uint256 indexed id, address indexed participant);
    event Closed(uint256 indexed id, State state);
    event Withdrawn(address indexed participant, uint256 amount);

    constructor() {
        require(block.chainid == 11155111 || block.chainid == 31337, "Test networks only");
    }
    function version() external pure returns (string memory) { return "focus-pact-v1"; }

    function createPact(address buddy, uint64 duration) external payable returns (uint256 id) {
        require(buddy != address(0) && buddy != msg.sender, "Choose another wallet");
        require(msg.value > 0 && msg.value <= 0.01 ether, "Stake must be > 0 and <= 0.01 test ETH");
        require(duration >= 10 && duration <= 7200, "Duration must be 10s to 2h");
        id = nextId++;
        pacts[id] = Pact(msg.sender, buddy, msg.value, duration,
            uint64(block.timestamp + JOIN_WINDOW), 0, 0, false, false, State.Waiting);
        emit PactCreated(id, msg.sender, buddy, msg.value);
    }

    function joinPact(uint256 id) external payable {
        Pact storage p = pacts[id];
        require(p.state == State.Waiting, "Not waiting");
        require(msg.sender == p.buddy, "Invited buddy only");
        require(block.timestamp < p.joinBy, "Invitation expired");
        require(msg.value == p.stake, "Match the deposit");
        p.endsAt = uint64(block.timestamp + p.duration);
        p.refundAfter = uint64(p.endsAt + CONFIRM_WINDOW);
        p.state = State.Active;
        emit PactJoined(id, p.endsAt);
    }

    function confirmCompletion(uint256 id) external {
        Pact storage p = pacts[id];
        require(p.state == State.Active, "Not active");
        require(block.timestamp >= p.endsAt, "Session not finished");
        require(block.timestamp < p.refundAfter, "Use timeout refund");
        if (msg.sender == p.creator) {
            require(!p.creatorConfirmed, "Already confirmed");
            p.creatorConfirmed = true;
        } else {
            require(msg.sender == p.buddy, "Participant only");
            require(!p.buddyConfirmed, "Already confirmed");
            p.buddyConfirmed = true;
        }
        emit Confirmed(id, msg.sender);
        if (p.creatorConfirmed && p.buddyConfirmed) _close(id, p, State.Settled, true);
    }

    function cancelPact(uint256 id) external {
        Pact storage p = pacts[id];
        require(p.state == State.Waiting && msg.sender == p.creator, "Creator, waiting only");
        _close(id, p, State.Cancelled, false);
    }

    function refundTimedOut(uint256 id) external {
        Pact storage p = pacts[id];
        bool joined = p.state == State.Active;
        require((p.state == State.Waiting && block.timestamp >= p.joinBy) ||
            (joined && block.timestamp >= p.refundAfter), "Not timed out");
        _close(id, p, State.TimedOut, joined);
    }

    function _close(uint256 id, Pact storage p, State state, bool joined) internal {
        p.state = state;
        credits[p.creator] += p.stake;
        if (joined) credits[p.buddy] += p.stake;
        emit Closed(id, state);
    }

    /// @dev Pull withdrawals: one participant's rejecting wallet cannot block the other.
    function withdraw() external {
        uint256 amount = credits[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        credits[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }
}
