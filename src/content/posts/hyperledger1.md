---
title: "Hyperledger Fabric Series Part 1: Setting Up the Fabric"
published: 2025-11-13T00:00:00-08:00
tags: [Hyperledger Fabric, Blockchain, Golang]
category: Blockchain
draft: true
---
# Using the Fabric test network
End users interact with the blockchain ledger by invoking smart contracts. 

In Hyperledger Fabric, smart contracts are deployed in packages referred to as chaincode.

# Bring up the test network
`cd fabric-samples/test-network`

From inside the test-network directory, run the following command to remove any containers or artifacts from any previous runs:

`./network.sh down` cleans previous run

`./network.sh up CreateChannel` creates channel `mychannel`

`docker ps -a`

Each node and user that interacts with a Fabric network needs to belong to an organization in order to participate in the network.

Peers are the fundamental components of any Fabric network. Peers store the blockchain ledger and validate transactions before they are committed to the ledger. Peers run the smart contracts that contain the business logic that is used to manage the assets on the blockchain ledger.

Every peer in the network needs to belong to an organization.

On a distributed network, peers may be running far away from each other and not have a common view of when a transaction was created. Coming to consensus on the order of transactions is a costly process that would create overhead for the peers.

An ordering service allows peers to focus on validating transactions and committing them to the ledger. After ordering nodes receive endorsed transactions from clients, they come to consensus on the order of transactions and then add them to blocks. The blocks are then distributed to peer nodes, which add the blocks to the blockchain ledger.

After you have created a channel, you can start using smart contracts to interact with the channel ledger.

# Starting a chaincode on the channel
Applications run by members of the network can invoke smart contracts to create assets on the ledger, as well as change and transfer those assets. Applications also query smart contracts to read data on the ledger.

To ensure that transactions are valid, transactions created using smart contracts typically need to be signed by multiple organizations to be committed to the channel ledger. Multiple signatures are integral to the trust model of Fabric. Requiring multiple endorsements for a transaction prevents one organization on a channel from tampering with the ledger on their peer or using business logic that was not agreed to. To sign a transaction, each organization needs to invoke and execute the smart contract on their peer, which then signs the output of the transaction. If the output is consistent and has been signed by enough organizations, the transaction can be committed to the ledger. The policy that specifies the set organizations on the channel that need to execute the smart contract is referred to as the endorsement policy, which is set for each chaincode as part of the chaincode definition.

In Fabric, smart contracts are deployed on the network in packages referred to as chaincode. 

:::caution
DONT FORGET TO INSTALL Go compiler 
:::


