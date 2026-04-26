import "dotenv/config";
import insforge from "./config/insforge.js";

async function checkSchema() {
  const tables = ["users", "foods", "orders", "notifications", "coupons", "order_assignments", "food_items"];
  for (const table of tables) {
    const { data, error } = await insforge.database.from(table).select().limit(1);
    if (error) {
      console.log(`Table ${table} error:`, error.message);
    } else {
      console.log(`Table ${table} exists!`);
    }
  }
}

checkSchema();
