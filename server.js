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
// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    bcrypt.compare(password, user.password, (err, result) => {
      if (err || !result) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Store user in session (without password)
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role
      };
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
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

// Get all addresses
app.get('/api/addresses', (req, res) => {
  db.all('SELECT * FROM addresses', (err, addresses) => {
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});