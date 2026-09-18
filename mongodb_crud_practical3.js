// ============================================================================
// Practical Work 3 - Performing MongoDB CRUD Operations
// Run this file with: mongosh "<your Atlas connection string>" mongodb_crud_practical3.js
// or paste sections into the mongosh shell inside GitHub Codespaces / MongoDB Atlas.
// ============================================================================

// ----------------------------------------------------------------------------
// Preparation
// ----------------------------------------------------------------------------
// Confirm the service and record versions before starting (paste output into the report):
// db.version()
// db.runCommand({ buildInfo: 1 }).version

// ----------------------------------------------------------------------------
// HOUR 1 - Guided setup and demonstration
// ----------------------------------------------------------------------------
use nosql_course;

db.items.deleteMany({}); // clean slate for a repeatable demo

// Seed 12 demo documents, roughly one third inactive, spaced one hour apart
for (let i = 0; i < 12; i++) {
  db.items.insertOne({
    name: "demo_item_" + i,
    category: "sample",
    active: (i % 3 !== 0),
    createdAt: new Date(Date.now() - i * 60 * 60 * 1000)
  });
}

// Instructor example: 10 most recently created active items
db.items.find({ active: true }).sort({ createdAt: -1 }).limit(10);

// Instructor example: inspect the execution plan for a category filter
db.items.explain("executionStats").find({ category: "sample" });
// Expected: no index on "category" yet, so the winning plan is a COLLSCAN
// (a full collection scan) - see the report for the before/after index discussion.

// ----------------------------------------------------------------------------
// HOUR 2 - Independent implementation (nosql_web_store.items)
// ----------------------------------------------------------------------------
use nosql_web_store;

db.items.deleteMany({}); // clean slate

// --- CREATE: seed a small product catalogue ---
db.items.insertMany([
  { name: "Wireless Mouse",         category: "Electronics", price: 19.99,  stock: 120, active: true,  createdAt: new Date(Date.now() - 1 * 86400000) },
  { name: "Mechanical Keyboard",    category: "Electronics", price: 79.99,  stock: 45,  active: true,  createdAt: new Date(Date.now() - 2 * 86400000) },
  { name: "USB-C Hub",              category: "Electronics", price: 24.50,  stock: 0,   active: false, createdAt: new Date(Date.now() - 40 * 86400000) },
  { name: "27-inch Monitor",        category: "Electronics", price: 219.00, stock: 15,  active: true,  createdAt: new Date(Date.now() - 3 * 86400000) },
  { name: "Yoga Mat",               category: "Sports",      price: 15.00,  stock: 80,  active: true,  createdAt: new Date(Date.now() - 5 * 86400000) },
  { name: "Dumbbell Set 10kg",      category: "Sports",      price: 45.00,  stock: 30,  active: true,  createdAt: new Date(Date.now() - 6 * 86400000) },
  { name: "Old Treadmill",          category: "Sports",      price: 300.0,  stock: 0,   active: false, createdAt: new Date(Date.now() - 90 * 86400000) },
  { name: "Ceramic Mug Set",        category: "Home",        price: 12.00,  stock: 60,  active: true,  createdAt: new Date(Date.now() - 4 * 86400000) },
  { name: "Table Lamp",             category: "Home",        price: 22.30,  stock: 25,  active: true,  createdAt: new Date(Date.now() - 7 * 86400000) },
  { name: "Discontinued Rug",       category: "Home",        price: 55.00,  stock: 0,   active: false, createdAt: new Date(Date.now() - 120 * 86400000) },
  { name: "Big Data Systems (Bk)",  category: "Books",       price: 38.00,  stock: 50,  active: true,  createdAt: new Date(Date.now() - 8 * 86400000) },
  { name: "NoSQL in Practice (Bk)", category: "Books",       price: 29.99,  stock: 40,  active: true,  createdAt: new Date(Date.now() - 9 * 86400000) }
]);

// --- READ (1): active products, newest first, page 1 ---
db.items.find({ active: true }).sort({ createdAt: -1 }).limit(5);

// --- READ (2): meaningful aggregate output - inventory value by category ---
db.items.aggregate([
  { $match: { active: true } },
  { $group: {
      _id: "$category",
      num_products: { $sum: 1 },
      inventory_value: { $sum: { $multiply: ["$price", "$stock"] } }
  }},
  { $sort: { inventory_value: -1 } }
]);

// --- UPDATE (1): 10% discount on active Electronics ---
db.items.updateMany(
  { category: "Electronics", active: true },
  { $mul: { price: 0.9 } }
);
db.items.find({ category: "Electronics", active: true }, { name: 1, price: 1, _id: 0 });

// --- UPDATE (2): restock a specific product ---
db.items.updateOne(
  { name: "Mechanical Keyboard" },
  { $inc: { stock: 25 } }
);

// --- DELETE: remove discontinued, out-of-stock products ---
db.items.deleteMany({ stock: 0, active: false });

// ----------------------------------------------------------------------------
// HOUR 3 - Verification and reporting
// ----------------------------------------------------------------------------

// Normal case: confirm the discount + restock persisted correctly
db.items.findOne({ name: "27-inch Monitor" });

// Edge case 1: update targeting a category that does not exist -> should be a safe no-op
db.items.updateMany({ category: "Toys" }, { $set: { onSale: true } });
// Expect: { matchedCount: 0, modifiedCount: 0 }

// Edge case 2: attempt to insert a duplicate _id -> should raise a duplicate key error
var existing = db.items.findOne({ name: "Yoga Mat" });
try {
  db.items.insertOne({ _id: existing._id, name: "Fake Duplicate", category: "Sports",
                        price: 1.0, stock: 1, active: true, createdAt: new Date() });
} catch (e) {
  print("Caught expected error: " + e);
}
db.items.findOne({ _id: existing._id }); // confirm the original document is unchanged

// --- Index improvement, re-checked with explain() ---
db.items.createIndex({ active: 1, createdAt: -1 });
db.items.find({ active: true }).sort({ createdAt: -1 }).limit(5).explain("executionStats");
// Expected: winning plan now reports an IXSCAN on the new compound index,
// and totalDocsExamined should drop to close to the number of documents returned.
