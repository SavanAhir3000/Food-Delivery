import "dotenv/config";
import insforge from "./config/insforge.js";

async function countTable(table) {
  const { data, error } = await insforge.database.from(table).select("id").limit(6);
  if (error) {
    console.error(`Error counting ${table}:`, error.message);
    return 0;
  }
  return data.length;
}

async function seed() {
  console.log("Starting DB seed process...");

  // 1. Seed Users
  let usersCount = await countTable("users");
  if (usersCount < 5) {
    console.log(`Seeding users (${usersCount}/5)...`);
    const users = [];
    for (let i = 0; i < 5; i++) {
      users.push({
        name: `Dummy User ${i + 1}`,
        email: `dummy${i + 1}@example.com`,
        password: "hashedpassword123",
        role: "customer",
        phone: `123456789${i}`,
        address: "123 Dummy St, Dummy City"
      });
    }
    await insforge.database.from("users").insert(users);
    console.log("Added 5 users.");
  } else {
    console.log(`Users table already has ${usersCount} records. Skipping.`);
  }

  // 2. Seed Foods
  let foodsCount = await countTable("foods");
  if (foodsCount < 5) {
    console.log(`Seeding foods (${foodsCount}/5)...`);
    const foods = [];
    const categories = ["Salad", "Rolls", "Deserts", "Sandwich", "Cake"];
    for (let i = 0; i < 5; i++) {
      foods.push({
        name: `Dummy Food ${i + 1}`,
        description: `This is dummy description for food ${i + 1}.`,
        price: 10 + i * 5,
        category: categories[i],
        image: "https://via.placeholder.com/150",
        is_available: true
      });
    }
    await insforge.database.from("foods").insert(foods);
    console.log("Added 5 foods.");
  } else {
    console.log(`Foods table already has ${foodsCount} records. Skipping.`);
  }

  // 3. Seed Coupons
  let couponsCount = await countTable("coupons");
  if (couponsCount < 5) {
    console.log(`Seeding coupons (${couponsCount}/5)...`);
    const coupons = [];
    for (let i = 0; i < 5; i++) {
      coupons.push({
        code: `DUMMY${i + 1}`,
        discount_type: "percentage",
        discount_value: 10,
        expiry_date: "2030-12-31T00:00:00Z",
        usage_limit: 100,
        is_active: true
      });
    }
    await insforge.database.from("coupons").insert(coupons);
    console.log("Added 5 coupons.");
  } else {
    console.log(`Coupons table already has ${couponsCount} records. Skipping.`);
  }

  // Need active users and foods to seed orders
  const { data: users } = await insforge.database.from("users").select("id").limit(5);
  const { data: foods } = await insforge.database.from("foods").select("id, price, name").limit(5);

  if (!users?.length || !foods?.length) {
    console.log("Not enough users/foods to seed orders.");
    return;
  }

  // 4. Seed Orders
  let ordersCount = await countTable("orders");
  if (ordersCount < 5) {
    console.log(`Seeding orders (${ordersCount}/5)...`);
    const orders = [];
    for (let i = 0; i < 5; i++) {
      const u = users[i % users.length];
      const f = foods[i % foods.length];
      orders.push({
        user_id: u.id,
        items: [{ _id: f.id, name: f.name, price: f.price, quantity: 2 }],
        total_amount: f.price * 2 + 50, // includes imaginary delivery fee
        status: "Delivered",
        address: "123 Dummy St",
        payment_method: "Stripe",
        feedback_rating: 5,
        feedback_comment: "Dummy feedback",
        feedback_given_at: new Date().toISOString()
      });
    }
    await insforge.database.from("orders").insert(orders);
    console.log("Added 5 orders.");
  } else {
    console.log(`Orders table already has ${ordersCount} records. Skipping.`);
  }

  // 5. Seed Notifications
  const { data: orders } = await insforge.database.from("orders").select("id, user_id").limit(5);
  let notifsCount = await countTable("notifications");
  if (notifsCount < 5 && orders?.length) {
    console.log(`Seeding notifications (${notifsCount}/5)...`);
    const notifs = [];
    for (let i = 0; i < 5; i++) {
      const o = orders[i % orders.length];
      notifs.push({
        user_id: o.user_id,
        order_id: o.id,
        type: "order_update",
        message: "Order has been delivered (Dummy)"
      });
    }
    await insforge.database.from("notifications").insert(notifs);
    console.log("Added 5 notifications.");
  } else {
    console.log(`Notifications table already has ${notifsCount} records. Skipping.`);
  }

  console.log("Seeding completed successfully.");
}

seed().catch(console.error);
