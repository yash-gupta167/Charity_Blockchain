App = {
  loading: false,
  contracts: {},
  lastCharityCount: 0,
  lastOrgCount: 0,
  lastTxCount: 0,
  lastBlockCount: 0,

  load: async() => {
    $('#loader').show();
    $('#content').hide();

    try {
      await App.loadWeb3();
      await App.loadAccount();
      await App.loadContract();
      await App.renderCharities();
      await App.renderOrganizations();
      await App.renderTransactions();
      await App.renderBlocks();
      await App.setupEventListeners();

      $('#loader').hide();
      $('#content').show();
    } catch (error) {
      console.error("Application loading error:", error);
      $('#loader').hide();
      $('#content').html(`
        <div class="alert alert-danger text-center my-5">
          <h4><i class="fas fa-exclamation-triangle me-2"></i>Connection Error</h4>
          <p>${error.message || 'Failed to connect to the blockchain. Please check your connection and MetaMask setup.'}</p>
          <button class="btn btn-primary mt-3" onclick="window.location.reload()">
            <i class="fas fa-sync-alt me-2"></i>Try Again
          </button>
        </div>
      `).show();
    }
  },

  loadWeb3: async () => {
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log("Ethereum enabled");

        window.ethereum.on('accountsChanged', function (accounts) {
          console.log('Account changed to:', accounts[0]);
          window.location.reload();
        });

        window.ethereum.on('chainChanged', function (chainId) {
          console.log('Network changed to:', chainId);
          window.location.reload();
        });

        return true;
      } catch (error) {
        console.error("User denied account access");
        return false;
      }
    }
    else if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
      return true;
    }
    else {
      console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
      return false;
    }
  },

  loadAccount: async () => {
    const accounts = await web3.eth.getAccounts();
    App.account = accounts[0];
    console.log("Current account:", App.account);

    $('#account-address').html(App.account);

    const balance = await web3.eth.getBalance(App.account);
    const etherBalance = web3.utils.fromWei(balance, 'ether');
    $('#account-balance').html(etherBalance);
    console.log("Account balance:", etherBalance, "ETH");
  },

  loadContract: async () => {
    const charity = await $.getJSON('charity.json');
    App.contracts.charity = TruffleContract(charity);
    App.contracts.charity.setProvider(web3.currentProvider);

    App.charity = await App.contracts.charity.deployed();
    console.log("Contract deployed at:", App.charity.address);

    const networkId = await web3.eth.net.getId();
    console.log("Current network ID:", networkId);

    return App.charity;
  },

  renderCharities: async () => {
    try {
      const charityCount = await App.charity.charity_count();
      console.log("Total charities:", charityCount.toNumber());

      const charityTemplate = $('#charityTemplate');
      const charitiesRow = $('#charitiesRow');

      charitiesRow.empty();

      for (let i = 1; i <= charityCount.toNumber(); i++) {
        const charity = await App.charity.charitys(i);

        const id = i;
        const name = charity[0];
        const description = charity[1];
        const walletAddress = charity[2];
        const impact = charity[7];
        const verified = charity[8];

        const charityCard = charityTemplate.clone();
        charityCard.find('.charity-name').html(name);
        charityCard.find('.charity-description').html(description);
        charityCard.find('.charity-address').html(walletAddress);
        charityCard.find('.charity-impact').html(impact);

        if (verified) {
          charityCard.find('.charity-verified').show();
        } else {
          charityCard.find('.charity-verified').hide();
        }

        charityCard.find('.btn-donate').attr('data-id', id);
        charityCard.find('.btn-donate').attr('data-address', walletAddress);

        charityCard.find('.btn-verify').attr('data-id', id);

        charityCard.removeAttr('id');
        charityCard.show();
        charitiesRow.append(charityCard);
      }
    } catch (error) {
      console.error("Error rendering charities:", error);
    }
  },

  renderOrganizations: async () => {
    try {
      const orgCount = await App.charity.org_count();
      console.log("Total organizations:", orgCount.toNumber());

      const orgTemplate = $('#organizationTemplate');
      const orgsRow = $('#organizationsRow');

      orgsRow.empty();

      for (let i = 1; i <= orgCount.toNumber(); i++) {
        const organization = await App.charity.org(i);

        const id = i;
        const name = organization[0];
        const walletAddress = organization[1];
        const verified = organization[5];

        const orgCard = orgTemplate.clone();
        orgCard.find('.org-name').html(name);
        orgCard.find('.org-address').html(walletAddress);

        if (verified) {
          orgCard.find('.org-verified').show();
        } else {
          orgCard.find('.org-verified').hide();
        }

        orgCard.find('.btn-verify-org').attr('data-id', id);

        orgCard.removeAttr('id');
        orgCard.show();
        orgsRow.append(orgCard);
      }
    } catch (error) {
      console.error("Error rendering organizations:", error);
    }
  },

  renderTransactions: async () => {
    try {
      const transactionCount = await App.charity.transaction_count();
      console.log("Total transactions:", transactionCount.toNumber());

      const transactionsTable = $('#transactionsTable');
      transactionsTable.empty();

      for (let i = 1; i <= transactionCount.toNumber(); i++) {
        const transaction = await App.charity.transaction_dict(i);

        const txId = i;
        const recipient = transaction[0];
        const sender = transaction[1];
        const amount = web3.utils.fromWei(transaction[2].toString(), 'ether');
        const purpose = transaction[6];

        let timestamp;
        try {
          timestamp = new Date(transaction[5].toNumber() * 1000).toLocaleString();
        } catch (e) {
          timestamp = 'Unknown';
        }

        const txHash = transaction[4];

        const row = `
          <tr>
            <td>${txId}</td>
            <td title="${sender}">${sender.substring(0, 10)}...</td>
            <td title="${recipient}">${recipient.substring(0, 10)}...</td>
            <td>${amount} ETH</td>
            <td>${purpose}</td>
            <td>${timestamp}</td>
            <td><a href="https://etherscan.io/tx/${txHash}" target="_blank" class="hash-link" title="${txHash}">${txHash.substring(0, 10)}...</a></td>
          </tr>
        `;

        transactionsTable.append(row);
      }
    } catch (error) {
      console.error("Error rendering transactions:", error);
    }
  },

  renderBlocks: async () => {
    try {
      const blockCount = await App.charity.blockchain_count();
      console.log("Total blocks:", blockCount.toNumber());

      const blocksContainer = $('#blocksContainer');
      blocksContainer.empty();

      for (let i = 1; i <= blockCount.toNumber(); i++) {
        const block = await App.charity.Blockchain(i);

        const blockNumber = i;
        const nonce = block[0].toNumber();
        let data = "";
        try {
          data = web3.utils.hexToUtf8(block[1]);
        } catch (e) {
          data = "Binary data";
        }
        const txHash = block[2];

        let timestamp;
        try {
          timestamp = new Date(block[6].toNumber() * 1000).toLocaleString();
        } catch (e) {
          timestamp = 'Unknown';
        }

        const prevHash = block[5];
        const hash = block[4];

        const blockCard = `
          <div class="blockchain-block">
            <div class="block-header">
              <h5>Block #${blockNumber}</h5>
              <span class="timestamp">${timestamp}</span>
            </div>
            <div class="block-content">
              <div class="block-detail">
                <span class="detail-label">Hash:</span>
                <span class="detail-value" title="${hash}">${hash.substring(0, 15)}...</span>
              </div>
              <div class="block-detail">
                <span class="detail-label">Prev Hash:</span>
                <span class="detail-value" title="${prevHash}">${prevHash.substring(0, 15)}...</span>
              </div>
              <div class="block-detail">
                <span class="detail-label">Nonce:</span>
                <span class="detail-value">${nonce}</span>
              </div>
              <div class="block-detail">
                <span class="detail-label">Data:</span>
                <span class="detail-value" title="${data}">${data.substring(0, 20)}...</span>
              </div>
            </div>
          </div>
        `;

        blocksContainer.append(blockCard);
      }
    } catch (error) {
      console.error("Error rendering blocks:", error);
    }
  },

  setupEventListeners: async () => {
    try {
      if (App.charity.events) {
        App.charity.events.CharityCreated({}, {
          fromBlock: 'latest'
        }).on('data', function(event) {
          console.log('Charity created:', event.returnValues);
          App.renderCharities();
        }).on('error', console.error);

        App.charity.events.OrganisationCreated({}, {
          fromBlock: 'latest'
        }).on('data', function(event) {
          console.log('Organization created:', event.returnValues);
          App.renderOrganizations();
        }).on('error', console.error);

        App.charity.events.TransactionCompleted({}, {
          fromBlock: 'latest'
        }).on('data', function(event) {
          console.log('Transaction created:', event.returnValues);
          App.renderTransactions();
        }).on('error', console.error);

        App.charity.events.BlockMined({}, {
          fromBlock: 'latest'
        }).on('data', function(event) {
          console.log('Block mined:', event.returnValues);
          App.renderBlocks();
        }).on('error', console.error);
      } else {
        console.log("Contract doesn't have events property");

        setInterval(async () => {
          const currentCharityCount = await App.charity.charity_count();
          const currentOrgCount = await App.charity.org_count();
          const currentTxCount = await App.charity.transaction_count();
          const currentBlockCount = await App.charity.blockchain_count();

          if (currentCharityCount.toNumber() > App.lastCharityCount) {
            console.log('New charity detected');
            App.renderCharities();
            App.lastCharityCount = currentCharityCount.toNumber();
          }

          if (currentOrgCount.toNumber() > App.lastOrgCount) {
            console.log('New organization detected');
            App.renderOrganizations();
            App.lastOrgCount = currentOrgCount.toNumber();
          }

          if (currentTxCount.toNumber() > App.lastTxCount) {
            console.log('New transaction detected');
            App.renderTransactions();
            App.lastTxCount = currentTxCount.toNumber();
          }

          if (currentBlockCount.toNumber() > App.lastBlockCount) {
            console.log('New block detected');
            App.renderBlocks();
            App.lastBlockCount = currentBlockCount.toNumber();
          }
        }, 5000);

        App.lastCharityCount = (await App.charity.charity_count()).toNumber();
        App.lastOrgCount = (await App.charity.org_count()).toNumber();
        App.lastTxCount = (await App.charity.transaction_count()).toNumber();
        App.lastBlockCount = (await App.charity.blockchain_count()).toNumber();
      }
    } catch (error) {
      console.error("Error setting up event listeners:", error);
    }
  },

  // ... existing code ...
// ... existing code ...
createCharity: async () => {
  try {
    // Trim values to avoid whitespace issues
    const name = ($('#name').val() || '').trim();
    const description = ($('#description').val() || '').trim();
    const address = ($('#address').val() || '').trim();
    const impact = ($('#impact_metrics').val() || '').trim();

    // Debug log to see exactly what is being checked
    console.log("Checking fields:", { name, description, address, impact });

    // Check if required fields are filled
    if (!name || !description || !address || !impact) {
      alert("Please fill all required fields");
      return;
    }

    // Check if address is valid
    if (!web3.utils.isAddress(address)) {
      alert("Please enter a valid Ethereum address");
      return;
    }

    // Use web3.js directly for contract interaction
    const contractABI = App.contracts.charity.abi;
    const contractAddress = App.charity.address;
    const contract = new web3.eth.Contract(contractABI, contractAddress);

    // FIX: Only pass 4 parameters as required by the contract
    await contract.methods.createCharity(
      name,
      description,
      address,
      impact
    ).send({ from: App.account });

    // Clear form fields
    $('#name').val('');
    $('#description').val('');
    $('#address').val('');
    $('#impact_metrics').val('');

    // Close modal
    $('#addCharityModal').modal('hide');

    // Refresh charities list
    await App.renderCharities();

    alert("Charity created successfully!");
  } catch (error) {
    console.error("Error creating charity:", error);
    alert("Failed to create charity: " + error.message);
  }
},
// ... existing code ...
// ... existing code ...

  createOrganization: async () => {
    try {
      const name = $('#name1').val();
      const address = $('#address1').val();

      if (!web3.utils.isAddress(address)) {
        alert("Please enter a valid Ethereum address");
        return;
      }

      await App.charity.createOrganisation(
        name,
        address,
        { from: App.account }
      );

      $('#addOrganizationModal').modal('hide');
      await App.renderOrganizations();
    } catch (error) {
      console.error("Error creating organization:", error);
      alert("Failed to create organization. See console for details.");
    }
  },

  makeDonation: async () => {
    try {
      const charityId = $('#charity-select').val();
      const amount = $('#donation-amount').val();
      const purpose = $('#donation-purpose').val();

      const charity = await App.charity.charitys(charityId);
      const charityAddress = charity[2];

      const amountWei = web3.utils.toWei(amount, 'ether');

      await App.charity.createTransaction(
        charityAddress,
        purpose,
        { from: App.account, value: amountWei }
      );

      $('#donateModal').modal('hide');
      await App.renderTransactions();

      $('#donation-success').show();
      setTimeout(() => {
        $('#donation-success').hide();
      }, 5000);
    } catch (error) {
      console.error("Error making donation:", error);
      alert("Failed to make donation. See console for details.");
    }
  },

  verifyCharity: async (id) => {
    try {
      await App.charity.verifyEntity(id, true, { from: App.account });
      await App.renderCharities();
    } catch (error) {
      console.error("Error verifying charity:", error);
      alert("Failed to verify charity. See console for details.");
    }
  },

  verifyOrganization: async (id) => {
    try {
      await App.charity.verifyEntity(id, false, { from: App.account });
      await App.renderOrganizations();
    } catch (error) {
      console.error("Error verifying organization:", error);
      alert("Failed to verify organization. See console for details.");
    }
  },

  mineBlock: async () => {
    try {
      await App.charity.blockchain_function({ from: App.account });
      await App.renderBlocks();
    } catch (error) {
      console.error("Error mining block:", error);
      alert("Failed to mine block. See console for details.");
    }
  }
};

$(document).ready(function() {
  App.load();

  $(document).on('submit', '#charity-form', function(e) {
    e.preventDefault();
    App.createCharity();
  });

  $(document).on('submit', '#organization-form', function(e) {
    e.preventDefault();
    App.createOrganization();
  });

  $(document).on('submit', '#donation-form', function(e) {
    e.preventDefault();
    App.makeDonation();
  });

  $(document).on('click', '.btn-verify', function() {
    const id = $(this).data('id');
    App.verifyCharity(id);
  });

  $(document).on('click', '.btn-verify-org', function() {
    const id = $(this).data('id');
    App.verifyOrganization(id);
  });

  $(document).on('click', '#mine-block', function() {
    App.mineBlock();
  });

  $(document).on('show.bs.modal', '#donateModal', async function() {
    const charitySelect = $('#charity-select');
    charitySelect.empty();

    const charityCount = await App.charity.charity_count();

    for (let i = 1; i <= charityCount.toNumber(); i++) {
      const charity = await App.charity.charitys(i);
      const name = charity[0];

      charitySelect.append(`<option value="${i}">${name}</option>`);
    }
  });
});