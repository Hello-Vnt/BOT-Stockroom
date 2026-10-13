// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BOT Stockroom
/// @notice A tiny inventory log. Each wallet has its own stockroom, and every
///         change to a product's quantity is appended to a history that can
///         never be edited or deleted. No tokens, payments or admin.
contract Stockroom {
    struct Product {
        string name;
        string sku;
        uint32 qty;
        uint32 lowAt;
        uint64 updatedAt;
    }

    /// @dev reason: 0 Restock, 1 Sale, 2 Damaged, 3 Correction
    struct Change {
        int32 delta;
        uint32 qtyAfter;
        uint8 reason;
        uint64 at;
    }

    uint8 public constant MAX_REASON = 3;
    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_SKU_LENGTH = 32;

    mapping(address => Product[]) private products;
    mapping(address => mapping(uint256 => Change[])) private history;

    event ProductAdded(address indexed shop, uint256 indexed id, string name);
    event StockChanged(address indexed shop, uint256 indexed id, int32 delta, uint32 qtyAfter, uint8 reason);

    error EmptyName();
    error TextTooLong();
    error QuantityTooLarge();
    error ProductNotFound();
    error ZeroDelta();
    error InvalidReason();
    error BelowZero();

    /// @notice Add a product to the caller's stockroom. The starting quantity
    ///         is logged as the first change in its history (as a restock).
    function addProduct(string calldata name, string calldata sku, uint32 qty, uint32 lowAt) external returns (uint256 id) {
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(name).length > MAX_NAME_LENGTH || bytes(sku).length > MAX_SKU_LENGTH) revert TextTooLong();
        if (qty > uint32(type(int32).max)) revert QuantityTooLarge();

        id = products[msg.sender].length;
        products[msg.sender].push(Product(name, sku, qty, lowAt, uint64(block.timestamp)));
        history[msg.sender][id].push(Change(int32(qty), qty, 0, uint64(block.timestamp)));

        emit ProductAdded(msg.sender, id, name);
        emit StockChanged(msg.sender, id, int32(qty), qty, 0);
    }

    /// @notice Add to or take from one of the caller's own products.
    function adjustStock(uint256 id, int32 delta, uint8 reason) external {
        if (id >= products[msg.sender].length) revert ProductNotFound();
        if (delta == 0) revert ZeroDelta();
        if (reason > MAX_REASON) revert InvalidReason();

        Product storage product = products[msg.sender][id];
        int64 next = int64(uint64(product.qty)) + delta;
        if (next < 0) revert BelowZero();
        if (next > int64(type(int32).max)) revert QuantityTooLarge();

        uint32 qtyAfter = uint32(uint64(next));
        product.qty = qtyAfter;
        product.updatedAt = uint64(block.timestamp);
        history[msg.sender][id].push(Change(delta, qtyAfter, reason, uint64(block.timestamp)));

        emit StockChanged(msg.sender, id, delta, qtyAfter, reason);
    }

    function getProducts(address shop) external view returns (Product[] memory) {
        return products[shop];
    }

    function getHistory(address shop, uint256 id) external view returns (Change[] memory) {
        return history[shop][id];
    }
}
