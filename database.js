const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Create a new database connection
const db = new sqlite3.Database(path.join(__dirname, 'food_delivery.db'));

// Initialize database
function initializeDatabase() {
  db.serialize(() => {
    // Users table for authentication (merchants, couriers, admins)
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('merchant', 'courier', 'admin')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Addresses table
    db.run(`CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_restaurant BOOLEAN DEFAULT 0,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL
    )`);

    // Travel times between locations
    db.run(`CREATE TABLE IF NOT EXISTS travel_times (
      from_address_id INTEGER NOT NULL,
      to_address_id INTEGER NOT NULL,
      time_in_minutes INTEGER NOT NULL,
      PRIMARY KEY (from_address_id, to_address_id),
      FOREIGN KEY (from_address_id) REFERENCES addresses (id),
      FOREIGN KEY (to_address_id) REFERENCES addresses (id)
    )`);

    // Orders table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      courier_id INTEGER,
      customer_address_id INTEGER NOT NULL,
      restaurant_address_id INTEGER NOT NULL,
      due_time TIMESTAMP NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_transit', 'delivered', 'cancelled')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES users (id),
      FOREIGN KEY (courier_id) REFERENCES users (id),
      FOREIGN KEY (customer_address_id) REFERENCES addresses (id),
      FOREIGN KEY (restaurant_address_id) REFERENCES addresses (id)
    )`);
    
    // Insert predefined addresses (1 restaurant + 8 customer addresses)
    checkAndInsertAddresses();
    
    // Insert predefined travel times
    checkAndInsertTravelTimes();
    
    // Insert a default admin user
    insertDefaultAdmin();
  });
}

// Check if addresses exist and insert if not
function checkAndInsertAddresses() {
  db.get("SELECT COUNT(*) as count FROM addresses", (err, row) => {
    if (err) {
      console.error("Error checking addresses:", err);
      return;
    }
    
    if (row.count === 0) {
      // Insert 1 restaurant
      db.run(`INSERT INTO addresses (name, is_restaurant, latitude, longitude) 
              VALUES ('Main Restaurant', 1, 40.7128, -74.0060)`);
      
      // Insert 8 customer addresses
      const customerAddresses = [
        ['Customer A', 40.7282, -73.9942],
        ['Customer B', 40.7484, -73.9857],
        ['Customer C', 40.7287, -74.0171],
        ['Customer D', 40.6892, -74.0445],
        ['Customer E', 40.7514, -73.9776],
        ['Customer F', 40.7265, -73.9815],
        ['Customer G', 40.7631, -73.9740],
        ['Customer H', 40.7195, -74.0094]
      ];
      
      customerAddresses.forEach(addr => {
        db.run(`INSERT INTO addresses (name, is_restaurant, latitude, longitude) 
                VALUES (?, 0, ?, ?)`, addr);
      });
    }
  });
}

// Check if travel times exist and insert if not
function checkAndInsertTravelTimes() {
  db.get("SELECT COUNT(*) as count FROM travel_times", (err, row) => {
    if (err) {
      console.error("Error checking travel times:", err);
      return;
    }
    
    if (row.count === 0) {
      db.all("SELECT id FROM addresses", (err, addresses) => {
        if (err) {
          console.error("Error fetching addresses:", err);
          return;
        }
        
        // Create travel times between all addresses
        addresses.forEach(from => {
          addresses.forEach(to => {
            if (from.id !== to.id) {
              // Generate a travel time between 5-30 minutes
              const travelTime = Math.floor(Math.random() * 26) + 5;
              
              db.run(`INSERT INTO travel_times (from_address_id, to_address_id, time_in_minutes) 
                      VALUES (?, ?, ?)`, [from.id, to.id, travelTime]);
            }
          });
        });
      });
    }
  });
}

// Insert default admin if not exists
function insertDefaultAdmin() {
  db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", (err, row) => {
    if (err) {
      console.error("Error checking admin:", err);
      return;
    }
    
    if (row.count === 0) {
      bcrypt.hash('admin123', 10, (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
          return;
        }
        
        db.run(`INSERT INTO users (username, password, role) 
                VALUES ('admin', ?, 'admin')`, [hash]);
      });
    }
  });
}

module.exports = {
  db,
  initializeDatabase
};