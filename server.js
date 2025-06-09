const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const { db, initializeDatabase } = require('./database');

// Initialize database
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'food_delivery_secret',
  resave: false,
  saveUninitialized: true
}));

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/merchant-dashboard', checkAuthentication('merchant'), (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'merchant-dashboard.html'));
});

app.get('/courier-dashboard', checkAuthentication('courier'), (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'courier-dashboard.html'));
});

app.get('/admin-dashboard', checkAuthentication('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin-dashboard.html'));
});

app.get('/customer-dashboard', checkAuthentication('customer'), (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'customer-dashboard.html'));
});

// Authentication middleware
function checkAuthentication(role) {
  return (req, res, next) => {
    if (req.session.user && (!role || req.session.user.role === role)) {
      return next();
    }
    res.redirect('/login');
  };
}

// API routes
// Registration endpoint
app.post('/api/register', (req, res) => {
  const { username, email, password, role } = req.body;
  
  // Validate input
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  // Only allow valid roles
  const validRoles = ['customer', 'merchant', 'courier'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected' });
  }
  
  // Check if username or email already exists
  db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error during registration' });
    }
    
    if (user) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    
    // Hash password and create user
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ error: 'Password encryption failed' });
      }
      
      db.run(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [username, email, hash, role],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to register user' });
          }
          
          res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user_id: this.lastID
          });
        }
      );
    });
  });
});

// Login - allow login with either username or email
app.post('/api/login', (req, res) => {
  const { login, password, role } = req.body;
  
  if (!login || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // Check if login is email or username
  const isEmail = login.includes('@');
  const query = isEmail 
    ? 'SELECT * FROM users WHERE email = ? AND role = ?'
    : 'SELECT * FROM users WHERE username = ? AND role = ?';
  
  // Get user with the specified login and role
  db.get(query, [login, role], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or role' });
    }
    
    bcrypt.compare(password, user.password, (err, result) => {
      if (err || !result) {
        return res.status(401).json({ error: 'Invalid credentials or role' });
      }
      
      // Store user in session (without password)
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    });
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get user information
app.get('/api/user/info', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({
    success: true,
    user: req.session.user
  });
});

// Change password
app.put('/api/user/password', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { current_password, new_password } = req.body;
  
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // Verify current password
  db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Failed to retrieve user information' });
    }
    
    bcrypt.compare(current_password, user.password, (err, result) => {
      if (err || !result) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      
      // Hash new password
      bcrypt.hash(new_password, 10, (err, hash) => {
        if (err) {
          return res.status(500).json({ error: 'Password encryption failed' });
        }
        
        // Update password
        db.run(
          'UPDATE users SET password = ? WHERE id = ?',
          [hash, req.session.user.id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to update password' });
            }
            
            res.json({
              success: true,
              message: 'Password updated successfully'
            });
          }
        );
      });
    });
  });
});

// Get all addresses
app.get('/api/addresses', (req, res) => {
  const type = req.query.type;
  let query = 'SELECT * FROM addresses';
  let params = [];
  
  if (type === 'restaurant') {
    query = 'SELECT * FROM addresses WHERE is_restaurant = 1';
  } else if (type === 'customer') {
    query = 'SELECT * FROM addresses WHERE is_restaurant = 0';
  }
  
  db.all(query, params, (err, addresses) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch addresses' });
    }
    res.json(addresses);
  });
});

// Get travel times
app.get('/api/travel-times', (req, res) => {
  db.all('SELECT * FROM travel_times', (err, times) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch travel times' });
    }
    res.json(times);
  });
});

// Create new order (for merchants)
app.post('/api/orders', checkAuthentication('merchant'), (req, res) => {
  const { customer_address_id, restaurant_address_id, due_time } = req.body;
  const merchant_id = req.session.user.id;
  
  db.run(`INSERT INTO orders (merchant_id, customer_address_id, restaurant_address_id, due_time) 
          VALUES (?, ?, ?, ?)`, 
          [merchant_id, customer_address_id, restaurant_address_id, due_time],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to create order' });
            }
            
            res.status(201).json({ 
              success: true, 
              order_id: this.lastID 
            });
          });
});

// Get orders based on role
app.get('/api/orders', (req, res) => {
  const { role, status } = req.query;
  let query = 'SELECT * FROM orders';
  let params = [];
  
  // If role is provided, filter by role
  if (role && req.session.user) {
    if (role === 'merchant') {
      query = 'SELECT * FROM orders WHERE merchant_id = ?';
      params = [req.session.user.id];
    } else if (role === 'courier') {
      query = 'SELECT * FROM orders WHERE courier_id = ?';
      params = [req.session.user.id];
    } else if (role === 'customer') {
      query = `SELECT o.*, a.name as restaurant_name 
               FROM orders o
               JOIN addresses a ON o.restaurant_address_id = a.id
               WHERE o.customer_address_id IN (
                 SELECT id FROM addresses WHERE name LIKE ?
               )`;
      params = [`%${req.session.user.username}%`]; // This is a simplification; in a real app you'd link customers to addresses
    }
  }
  
  // If status is provided, filter by status
  if (status) {
    if (params.length > 0) {
      query += ' AND status = ?';
    } else {
      query += ' WHERE status = ?';
    }
    params.push(status);
  }
  
  // Add ordering
  query += ' ORDER BY due_time ASC';
  
  db.all(query, params, (err, orders) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
    }
    res.json(orders);
  });
});

// Accept order (for couriers)
app.post('/api/orders/:id/accept', checkAuthentication('courier'), (req, res) => {
  const orderId = req.params.id;
  const courierId = req.session.user.id;
  
  db.run(
    'UPDATE orders SET courier_id = ?, status = "accepted" WHERE id = ? AND status = "pending"',
    [courierId, orderId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to accept order' });
      }
      
      if (this.changes === 0) {
        return res.status(400).json({ error: 'Order already accepted or does not exist' });
      }
      
      res.json({
        success: true,
        message: 'Order accepted successfully'
      });
    }
  );
});

// Update order status
app.put('/api/orders/:id/status', checkAuthentication(), (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;
  
  // Validate status
  const validStatuses = ['pending', 'accepted', 'in_transit', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  // Check permissions based on role
  let query = '';
  let params = [];
  
  if (userRole === 'courier') {
    // Couriers can only update their own orders
    query = 'UPDATE orders SET status = ? WHERE id = ? AND courier_id = ?';
    params = [status, orderId, userId];
  } else if (userRole === 'merchant') {
    // Merchants can only update their own orders
    query = 'UPDATE orders SET status = ? WHERE id = ? AND merchant_id = ?';
    params = [status, orderId, userId];
  } else if (userRole === 'admin') {
    // Admins can update any order
    query = 'UPDATE orders SET status = ? WHERE id = ?';
    params = [status, orderId];
  } else {
    return res.status(403).json({ error: 'Unauthorized to update this order' });
  }
  
  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update order status' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Order not found or you do not have permission to update it' });
    }
    
    res.json({
      success: true,
      message: 'Order status updated successfully'
    });
  });
});

// Get users (admin only)
app.get('/api/users', checkAuthentication('admin'), (req, res) => {
  db.all('SELECT id, username, email, role, created_at FROM users', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(users);
  });
});

// Create user (admin only)
app.post('/api/users', checkAuthentication('admin'), (req, res) => {
  const { username, email, password, role } = req.body;
  
  // Validate input
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  // Check if username or email already exists
  db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error during user creation' });
    }
    
    if (user) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    
    // Hash password and create user
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ error: 'Password encryption failed' });
      }
      
      db.run(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [username, email, hash, role],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create user' });
          }
          
          res.status(201).json({
            success: true,
            message: 'User created successfully',
            user_id: this.lastID
          });
        }
      );
    });
  });
});

// Add new address (admin only)
app.post('/api/addresses', checkAuthentication('admin'), (req, res) => {
  const { name, is_restaurant, latitude, longitude } = req.body;
  
  // Validate input
  if (!name || latitude === undefined || longitude === undefined || is_restaurant === undefined) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  db.run(
    'INSERT INTO addresses (name, is_restaurant, latitude, longitude) VALUES (?, ?, ?, ?)',
    [name, is_restaurant, latitude, longitude],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to add address' });
      }
      
      // After adding new address, we need to update travel times
      const newAddressId = this.lastID;
      
      // Get all other addresses
      db.all('SELECT id FROM addresses WHERE id != ?', [newAddressId], (err, addresses) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to retrieve addresses for travel time calculation' });
        }
        
        // Create travel times to and from all other addresses
        const travelTimePromises = [];
        
        addresses.forEach(addr => {
          // Random travel time between 5-30 minutes
          const timeToAddr = Math.floor(Math.random() * 26) + 5;
          const timeFromAddr = Math.floor(Math.random() * 26) + 5;
          
          travelTimePromises.push(
            new Promise((resolve, reject) => {
              // Time from new address to existing address
              db.run(
                'INSERT INTO travel_times (from_address_id, to_address_id, time_in_minutes) VALUES (?, ?, ?)',
                [newAddressId, addr.id, timeToAddr],
                err => err ? reject(err) : resolve()
              );
            })
          );
          
          travelTimePromises.push(
            new Promise((resolve, reject) => {
              // Time from existing address to new address
              db.run(
                'INSERT INTO travel_times (from_address_id, to_address_id, time_in_minutes) VALUES (?, ?, ?)',
                [addr.id, newAddressId, timeFromAddr],
                err => err ? reject(err) : resolve()
              );
            })
          );
        });
        
        Promise.all(travelTimePromises)
          .then(() => {
            res.status(201).json({
              success: true,
              message: 'Address added successfully',
              address_id: newAddressId
            });
          })
          .catch(err => {
            console.error('Failed to create travel times:', err);
            res.status(500).json({
              success: true, // Still return success since the address was created
              warning: 'Address added but travel times may be incomplete',
              address_id: newAddressId
            });
          });
      });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
