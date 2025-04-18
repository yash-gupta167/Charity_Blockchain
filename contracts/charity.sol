// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0; // Updated Pragma

contract charity {
  uint public charity_count = 0;
  uint public org_count = 0;
  uint public transaction_count = 0;
  uint public blockchain_count = 0;

  // Charity structure - removed bank account references
  struct charity_structre {
    string name;
    string description;
    address payable wallet_address;  // Direct ETH wallet address
    uint id;
    bytes32 hash;
    uint balance;  // Track balance in wei
    string impact_metrics;  // Track impact of donations
    bool verified;  // Verification status
    string[] updates;  // Project updates
  }

  // Organization structure - removed bank account references
  struct personOrOrganisation_structure {
    string name;
    address payable wallet_address;  // Direct ETH wallet address
    uint id;
    bytes32 hash;
    uint balance;  // Track balance in wei
    bool verified;  // Verification status
  }

  // Transaction structure with more details
  struct transactions {
    address payable charity_address;
    address payable organisation_address; // This needs to be payable
    uint amount;
    uint id;
    bytes32 transaction_hash;
    uint timestamp;
    string purpose;  // Purpose of donation
    bool completed;
  }

  // Blockchain structure remains similar
  struct blockchain_structure {
    uint nonce;
    bytes data;
    bytes32 transaction_hash_add;
    uint blockNumber;
    bytes32 hash;
    bytes32 previous_hash;
    uint timestamp;
  }

  // Milestone-based funding structure
  struct funding_milestone {
    string description;
    uint target_amount;
    uint current_amount;
    bool released;
    uint deadline;
  }

  // Mappings
  mapping(uint => charity_structre) public charitys;
  mapping(uint => personOrOrganisation_structure) public org;
  mapping(uint => transactions) public transaction_dict;
  mapping(uint => blockchain_structure) public Blockchain;
  mapping(address => bool) public verified_addresses;
  mapping(uint => funding_milestone[]) public charity_milestones;

  bytes32 previousHash;

  // Events for better tracking
  event CharityCreated(uint id, string name, address wallet_address);
  event OrganisationCreated(uint id, string name, address wallet_address);
  event TransactionCompleted(uint id, address from, address to, uint amount, string purpose);
  event BlockMined(uint blockNumber, bytes32 blockHash);
  event MilestoneCreated(uint charity_id, uint milestone_id, string description, uint target);
  event MilestoneCompleted(uint charity_id, uint milestone_id);

  // Constructor updated - removed 'public'
  constructor() {
    // Initialize with a default charity and organization
    // Note: Using hardcoded addresses in constructors is generally for testing/deployment scripts.
    // Consider making these parameters if deploying for real use.
    createCharity("Blockchain Relief Fund", "Supporting global humanitarian efforts through blockchain technology", payable(0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c), "Providing clean water to 1000 people");
    createOrganisation("Crypto Donors Alliance", payable(0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c)); // Example address, ensure it's payable if needed
    blockchain_function(); // Initial block mining
  }

  // ... existing code ...
// ... existing constructor and struct definitions ...

// Your contract function is correct with 4 parameters
function createCharity(
  string memory _name,
  string memory _description,
  address payable _wallet_address,
  string memory _impact_metrics
) public returns(uint) {
  charity_count++;
  
  bytes memory name_byte = bytes(_name);
  bytes memory description_byte = bytes(_description);
  bytes memory address_bytes = abi.encodePacked(_wallet_address);
  
  bytes memory combined = abi.encodePacked(name_byte, description_byte, address_bytes);
  bytes32 hash_value = keccak256(combined);
  
  charitys[charity_count] = charity_structre({
    name: _name,
    description: _description,
    wallet_address: _wallet_address,
    id: charity_count,
    hash: hash_value,
    balance: 0,
    impact_metrics: _impact_metrics,
    verified: false,
    updates: new string[](0)
  });
  
  emit CharityCreated(charity_count, _name, _wallet_address);
  return charity_count;
}
// ... existing code ...

  // Create organization with direct wallet address
  function createOrganisation(string memory _name, address payable _wallet_address) public returns(uint) {
    org_count++;

    // Generate hash from organization details
    bytes memory name_byte = bytes(_name);
    bytes memory address_bytes = abi.encodePacked(_wallet_address);

    bytes memory combined = abi.encodePacked(name_byte, address_bytes);
    bytes32 hash_value = keccak256(combined);

    // Store organization details
    org[org_count].name = _name;
    org[org_count].wallet_address = _wallet_address;
    org[org_count].id = org_count;
    org[org_count].hash = hash_value;
    org[org_count].balance = 0; // This balance seems unused currently
    org[org_count].verified = false;

    emit OrganisationCreated(org_count, _name, _wallet_address);
    return org_count;
  }

  // Create transaction with direct ETH transfer
  function createTransaction(address payable _charity_address, string memory _purpose) public payable returns(uint) {
    require(msg.value > 0, "Donation amount must be greater than 0");

    transaction_count++;

    // Generate transaction hash
    bytes32 tx_hash = keccak256(abi.encodePacked(_charity_address, msg.sender, msg.value, block.timestamp));

    // Store transaction details
    transaction_dict[transaction_count].charity_address = _charity_address;
    // *** Updated: Cast msg.sender to payable ***
    transaction_dict[transaction_count].organisation_address = payable(msg.sender);
    transaction_dict[transaction_count].amount = msg.value;
    transaction_dict[transaction_count].id = transaction_count;
    transaction_dict[transaction_count].transaction_hash = tx_hash;
    transaction_dict[transaction_count].timestamp = block.timestamp;
    transaction_dict[transaction_count].purpose = _purpose;
    transaction_dict[transaction_count].completed = true;

    // Transfer ETH to charity
    // Using transfer is simple but has gas limits. Consider call for more complex receivers.
    _charity_address.transfer(msg.value);

    // Update internal charity balance tracking (optional, as blockchain balance is the source of truth)
    // Note: This only tracks donations made *through this contract*. Direct transfers aren't tracked here.
    for(uint i = 1; i <= charity_count; i++) {
      if(charitys[i].wallet_address == _charity_address) {
        charitys[i].balance += msg.value; // Safe arithmetic in 0.8+
        break;
      }
    }

    emit TransactionCompleted(transaction_count, msg.sender, _charity_address, msg.value, _purpose);
    return transaction_count;
  }

  // Create milestone for a charity
  function createMilestone(uint _charity_id, string memory _description, uint _target_amount, uint _deadline) public returns(uint) {
    require(_charity_id > 0 && _charity_id <= charity_count, "Invalid charity ID");
    // Add require for msg.sender authorization if needed (e.g., only charity owner)
    // require(msg.sender == charitys[_charity_id].wallet_address, "Only charity owner can create milestones");

    uint milestone_id = charity_milestones[_charity_id].length;

    funding_milestone memory new_milestone = funding_milestone({
      description: _description,
      target_amount: _target_amount,
      current_amount: 0,
      released: false,
      deadline: _deadline // Ensure deadline logic is implemented elsewhere if needed
    });

    charity_milestones[_charity_id].push(new_milestone);

    emit MilestoneCreated(_charity_id, milestone_id, _description, _target_amount);
    return milestone_id;
  }

  // Verify a charity or organization (could be restricted to admin/owner)
  function verifyEntity(uint _id, bool _is_charity) public {
    // Add access control (e.g., onlyOwner modifier)
    if(_is_charity) {
      require(_id > 0 && _id <= charity_count, "Invalid charity ID");
      charitys[_id].verified = true;
      verified_addresses[charitys[_id].wallet_address] = true;
    } else {
      require(_id > 0 && _id <= org_count, "Invalid organization ID");
      org[_id].verified = true;
      verified_addresses[org[_id].wallet_address] = true;
    }
  }

  // Add update to charity
  function addCharityUpdate(uint _charity_id, string memory _update) public {
    require(_charity_id > 0 && _charity_id <= charity_count, "Invalid charity ID");
    // Comparing address with address payable is fine
    require(msg.sender == charitys[_charity_id].wallet_address, "Only charity owner can add updates");

    charitys[_charity_id].updates.push(_update);
  }

  // Get charity updates
  function getCharityUpdates(uint _charity_id) public view returns(string[] memory) {
    require(_charity_id > 0 && _charity_id <= charity_count, "Invalid charity ID");
    return charitys[_charity_id].updates;
  }

  // Mining function (simplified concept - real mining doesn't happen in contract)
  // This simulates creating a block record within the contract's state.
  function blockchain_function() public {
    blockchain_count++;

    // Collect data from all entities and transactions
    bytes memory dataString = collectBlockchainData();

    // Generate transaction hash summary for the block
    bytes32 transaction_hash_address = generateTransactionHashSummary();

    // Generate block hash
    // Note: Using blockhash is only reliable for recent blocks (last 256).
    // Using block.number-1 is okay, but the nonce derived is predictable.
    // This is NOT cryptographically secure mining.
    uint nonce = uint(blockhash(block.number - 1)) % 1000000; // Simple pseudo-nonce
    bytes32 hash_addressNew = keccak256(abi.encodePacked(nonce, dataString, transaction_hash_address, previousHash, block.timestamp));

    // Create new block record
    Blockchain[blockchain_count] = blockchain_structure({
      nonce: nonce,
      data: dataString,
      transaction_hash_add: transaction_hash_address,
      blockNumber: blockchain_count,
      hash: hash_addressNew,
      previous_hash: previousHash, // Links to previous contract-internal block record
      timestamp: block.timestamp
    });

    // Update previous hash for next block record
    previousHash = hash_addressNew;

    emit BlockMined(blockchain_count, hash_addressNew);
  }

  // Helper function to collect blockchain data summary
  // This is a placeholder - real implementation would be more complex.
  function collectBlockchainData() private view returns(bytes memory) {
    // Example: could concatenate hashes or summaries of structs
    return abi.encodePacked("Block data summary for block ", blockchain_count);
  }

  // Helper function to generate a hash summary of transactions for the block record
  function generateTransactionHashSummary() private view returns(bytes32) {
    // This creates a hash digest of *all* recorded transactions up to this point.
    // A more typical block would only include *new* transactions since the last block.
    bytes memory txData;

    for(uint i = 1; i <= transaction_count; i++) {
      txData = abi.encodePacked(
        txData,
        transaction_dict[i].charity_address,
        transaction_dict[i].organisation_address,
        transaction_dict[i].amount,
        transaction_dict[i].transaction_hash // Include individual tx hash
      );
    }

    return keccak256(txData);
  }

  // Get charity details
  function getCharityDetails(uint _id) public view returns(
    string memory name,
    string memory description,
    address payable wallet_address, // *** Updated return type ***
    uint balance, // Internal tracked balance
    string memory impact_metrics,
    bool verified
  ) {
    require(_id > 0 && _id <= charity_count, "Invalid charity ID");

    charity_structre storage c = charitys[_id]; // Use storage pointer for efficiency
    return (c.name, c.description, c.wallet_address, c.balance, c.impact_metrics, c.verified);
  }

  // Get organization details
  function getOrganisationDetails(uint _id) public view returns(
    string memory name,
    address payable wallet_address, // *** Updated return type ***
    uint balance, // Internal tracked balance (seems unused)
    bool verified
  ) {
    require(_id > 0 && _id <= org_count, "Invalid organization ID");

    personOrOrganisation_structure storage o = org[_id]; // Use storage pointer
    return (o.name, o.wallet_address, o.balance, o.verified);
  }
}